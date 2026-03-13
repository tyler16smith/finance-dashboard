import { NextResponse } from "next/server";
import { parse } from "papaparse";
import { z } from "zod";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { loadRules, runRules } from "~/server/rules-engine/ruleRunner";

const MappingSchema = z.object({
	date: z.string(),
	amount: z.string(),
	type: z.string().optional(),
	description: z.string().optional(),
	category: z.string().optional(),
	account: z.string().optional(),
});

const RowSchema = z.object({
	date: z.string().min(1),
	amount: z.string().min(1),
});

function parseAmount(raw: string): number | null {
	const cleaned = raw.replace(/[$,\s()]/g, "").trim();
	const negative = raw.includes("(") || raw.startsWith("-");
	const value = Number.parseFloat(cleaned.replace("-", ""));
	if (Number.isNaN(value)) return null;
	return negative ? -Math.abs(value) : Math.abs(value);
}

function parseDate(raw: string): Date | null {
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? null : d;
}

function inferType(
	typeRaw: string | undefined,
	amount: number,
): "INCOME" | "EXPENSE" {
	if (typeRaw) {
		const lower = typeRaw.toLowerCase();
		if (
			lower.includes("credit") ||
			lower.includes("income") ||
			lower.includes("deposit")
		) {
			return "INCOME";
		}
		if (
			lower.includes("debit") ||
			lower.includes("expense") ||
			lower.includes("withdrawal")
		) {
			return "EXPENSE";
		}
	}
	// Fall back to sign of amount
	return amount >= 0 ? "INCOME" : "EXPENSE";
}

export async function POST(req: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const formData = await req.formData();
	const file = formData.get("file");
	const mappingRaw = formData.get("mapping");
	const classRaw = formData.get("categoryClassifications");
	const modeRaw = formData.get("mode");

	if (!file || typeof file === "string") {
		return NextResponse.json({ error: "No file provided" }, { status: 400 });
	}
	if (!mappingRaw || typeof mappingRaw !== "string") {
		return NextResponse.json({ error: "No mapping provided" }, { status: 400 });
	}

	const mappingParsed = MappingSchema.safeParse(JSON.parse(mappingRaw));
	if (!mappingParsed.success) {
		return NextResponse.json({ error: "Invalid mapping" }, { status: 400 });
	}
	const mapping = mappingParsed.data;

	const categoryClassifications: Record<string, "INCOME" | "EXPENSE" | "SKIP"> =
		classRaw && typeof classRaw === "string"
			? (JSON.parse(classRaw) as Record<string, "INCOME" | "EXPENSE" | "SKIP">)
			: {};

	const mode: "replace" | "append" =
		modeRaw === "append" ? "append" : "replace";

	const text = await file.text();
	const { data, errors } = parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (h) => h.trim(),
	});

	if (errors.length > 0) {
		return NextResponse.json(
			{ error: "CSV parse error", details: errors[0]?.message },
			{ status: 400 },
		);
	}

	// Delete existing transactions if replacing
	if (mode === "replace") {
		await db.transaction.deleteMany({ where: { userId: session.user.id } });
	}

	const csvImport = await db.csvImport.create({
		data: {
			userId: session.user.id,
			filename: (file as File).name,
			status: "processing",
		},
	});

	// Pre-scan: collect unique raw category values from CSV (excluding SKIP rows)
	const uniqueRawCategories = new Set<string>();
	for (const row of data) {
		if (mapping.category) {
			const rawCat = (row[mapping.category] ?? "").trim();
			if (rawCat) uniqueRawCategories.add(rawCat);
		}
	}

	// Resolve each unique category value to a Category record
	const existingCategories = await db.category.findMany({
		where: { OR: [{ userId: null }, { userId: session.user.id }] },
	});

	const categoryMap = new Map<string, string>(); // rawValue → categoryId
	for (const rawValue of uniqueRawCategories) {
		const lower = rawValue.toLowerCase();
		const match = existingCategories.find((c) => c.name.toLowerCase() === lower);
		if (match) {
			categoryMap.set(rawValue, match.id);
		} else {
			const created = await db.category.create({
				data: { userId: session.user.id, name: rawValue },
			});
			categoryMap.set(rawValue, created.id);
			existingCategories.push(created);
		}
	}

	const uncategorizedId =
		existingCategories.find((c) => c.name === "Uncategorized" && c.userId === null)?.id ?? null;

	const toInsert: {
		userId: string;
		importId: string;
		date: Date;
		amount: number;
		type: "INCOME" | "EXPENSE";
		category: string;
		categoryId: string | null;
		description: string | null;
		account: string | null;
	}[] = [];
	let skipped = 0;

	for (const row of data) {
		const rawDate = row[mapping.date] ?? "";
		const rawAmount = row[mapping.amount] ?? "";

		const validation = RowSchema.safeParse({
			date: rawDate,
			amount: rawAmount,
		});
		if (!validation.success) {
			skipped++;
			continue;
		}

		const date = parseDate(rawDate);
		const rawAmountParsed = parseAmount(rawAmount);
		if (!date || rawAmountParsed === null) {
			skipped++;
			continue;
		}

		const rawCatValue = mapping.category
			? (row[mapping.category] ?? "").trim()
			: "";
		const typeRaw = mapping.type ? row[mapping.type] : undefined;
		const rawTypeValue = typeRaw?.trim() ?? "";

		// Priority 1: categoryClassifications lookup (user-defined)
		// Check category column value first, then type column value
		const classif =
			categoryClassifications[rawCatValue] ??
			categoryClassifications[rawTypeValue];

		if (classif === "SKIP") {
			skipped++;
			continue;
		}

		// Priority 2: inferType fallback
		const type: "INCOME" | "EXPENSE" =
			classif === "INCOME" || classif === "EXPENSE"
				? classif
				: inferType(typeRaw, rawAmountParsed);

		const amount = Math.abs(rawAmountParsed);
		const description = mapping.description
			? (row[mapping.description] ?? null)
			: null;
		const account = mapping.account ? (row[mapping.account] ?? null) : null;

		const categoryId = rawCatValue
			? (categoryMap.get(rawCatValue) ?? uncategorizedId)
			: uncategorizedId;

		toInsert.push({
			userId: session.user.id,
			importId: csvImport.id,
			date,
			amount,
			type,
			category: rawCatValue || "OTHER",
			categoryId,
			description,
			account,
		});
	}

	// Load active rules once for the whole import batch
	const rules = await loadRules(db, session.user.id);

	// Bulk insert in chunks of 500, then apply rules
	const CHUNK = 500;
	for (let i = 0; i < toInsert.length; i += CHUNK) {
		await db.transaction.createMany({ data: toInsert.slice(i, i + CHUNK) });
	}

	// Apply rules to newly inserted transactions
	if (rules.length > 0) {
		const newTxs = await db.transaction.findMany({
			where: { importId: csvImport.id },
			select: {
				id: true, description: true, account: true, amount: true,
				category: true, categoryRef: { select: { name: true } }, date: true,
			},
		});

		for (const tx of newTxs) {
			const matchable = { ...tx, category: tx.categoryRef?.name ?? tx.category };
			const { mutation, matchedRuleIds } = runRules(matchable, rules);
			if (matchedRuleIds.length === 0) continue;

			if (mutation.type === "SKIP") {
				await db.transaction.delete({ where: { id: tx.id } });
				continue;
			}

			const scalarUpdate: Record<string, unknown> = {};

			if (mutation.category) {
				let cat = existingCategories.find(
					(c) => c.name.toLowerCase() === mutation.category!.toLowerCase(),
				);
				if (!cat) {
					cat = await db.category.create({
						data: { userId: session.user.id, name: mutation.category },
					});
					existingCategories.push(cat);
				}
				scalarUpdate.categoryId = cat.id;
				scalarUpdate.category = cat.name;
			}

			if (mutation.description !== undefined) scalarUpdate.description = mutation.description;
			if (mutation.type) scalarUpdate.type = mutation.type;
			if (Object.keys(scalarUpdate).length > 0) {
				await db.transaction.update({ where: { id: tx.id }, data: scalarUpdate });
			}

			for (const normalizedName of mutation.hashtagsToAdd) {
				const hashtag = await db.hashtag.upsert({
					where: { userId_normalizedName: { userId: session.user.id, normalizedName } },
					create: { userId: session.user.id, name: normalizedName, normalizedName },
					update: {},
				});
				await db.transactionHashtag.upsert({
					where: { transactionId_hashtagId: { transactionId: tx.id, hashtagId: hashtag.id } },
					create: { transactionId: tx.id, hashtagId: hashtag.id },
					update: {},
				});
			}

			await db.transactionRuleApplication.createMany({
				data: matchedRuleIds.map((ruleId) => ({
					transactionId: tx.id,
					ruleId,
					wasHistoricalBackfill: false,
				})),
				skipDuplicates: true,
			});
		}
	}

	await db.csvImport.update({
		where: { id: csvImport.id },
		data: {
			status: "complete",
			rowCount: toInsert.length,
			skippedCount: skipped,
		},
	});

	return NextResponse.json({
		importId: csvImport.id,
		imported: toInsert.length,
		skipped,
	});
}
