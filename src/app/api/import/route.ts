import { NextResponse } from "next/server";
import { parse } from "papaparse";
import { z } from "zod";
import { normalizeCategory } from "~/lib/category-normalize";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { TransactionCategory } from "../../../../generated/prisma";

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

	const csvImport = await db.csvImport.create({
		data: {
			userId: session.user.id,
			filename: (file as File).name,
			status: "processing",
		},
	});

	const toInsert: {
		userId: string;
		importId: string;
		date: Date;
		amount: number;
		type: "INCOME" | "EXPENSE";
		category: TransactionCategory;
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

		const typeRaw = mapping.type ? row[mapping.type] : undefined;
		const type = inferType(typeRaw, rawAmountParsed);
		const amount = Math.abs(rawAmountParsed);
		const description = mapping.description
			? (row[mapping.description] ?? null)
			: null;
		const rawCategory = mapping.category
			? (row[mapping.category] ?? null)
			: null;
		const account = mapping.account ? (row[mapping.account] ?? null) : null;

		const category = normalizeCategory(description, rawCategory);

		toInsert.push({
			userId: session.user.id,
			importId: csvImport.id,
			date,
			amount,
			type,
			category: category as TransactionCategory,
			description,
			account,
		});
	}

	// Bulk insert in chunks of 500
	const CHUNK = 500;
	for (let i = 0; i < toInsert.length; i += CHUNK) {
		await db.transaction.createMany({ data: toInsert.slice(i, i + CHUNK) });
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
