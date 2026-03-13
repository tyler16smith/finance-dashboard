import type { PrismaClient } from "../../../generated/prisma";
import { loadRules, runRules } from "./ruleRunner";

type UpdatedTx = {
	id: string;
	description?: string | null;
	type?: string;
	category?: string;
	categoryRef?: { name: string } | null;
	addedHashtagNames?: string[];
};

type BackfillResult = {
	affected: number;
	deletedIds: string[];
	updates: UpdatedTx[];
};

/**
 * Applies a single rule to all matching historical transactions for a user.
 * Returns affected count, deleted IDs, and field-level updates for cache patching.
 */
export async function runHistoricalBackfill(
	db: PrismaClient,
	userId: string,
	ruleId: string,
): Promise<BackfillResult> {
	const rules = await loadRules(db, userId);
	const rule = rules.find((r) => r.id === ruleId);
	if (!rule) return { affected: 0, deletedIds: [], updates: [] };

	// Load all transactions for this user
	const transactions = await db.transaction.findMany({
		where: { userId },
		include: {
			hashtags: { include: { hashtag: true } },
			categoryRef: { select: { name: true } },
		},
	});

	let affected = 0;
	const deletedIds: string[] = [];
	const updates: UpdatedTx[] = [];

	for (const tx of transactions) {
		const matchable = { ...tx, category: tx.categoryRef?.name ?? tx.category };
		const { mutation, matchedRuleIds } = runRules(matchable, [rule]);
		if (matchedRuleIds.length === 0) continue;

		affected++;

		// SKIP = delete the transaction
		if (mutation.type === "SKIP") {
			await db.transaction.delete({ where: { id: tx.id } });
			deletedIds.push(tx.id);
			continue;
		}

		const update: UpdatedTx = { id: tx.id };
		const scalarUpdate: Record<string, unknown> = {};

		if (mutation.category) {
			let cat = await db.category.findFirst({
				where: {
					OR: [
						{ userId, name: { equals: mutation.category, mode: "insensitive" } },
						{ userId: null, name: { equals: mutation.category, mode: "insensitive" } },
					],
				},
			});
			if (!cat) {
				cat = await db.category.create({ data: { userId, name: mutation.category } });
			}
			scalarUpdate.categoryId = cat.id;
			scalarUpdate.category = cat.name;
			update.category = cat.name;
			update.categoryRef = { name: cat.name };
		}

		if (mutation.description !== undefined) {
			scalarUpdate.description = mutation.description;
			update.description = mutation.description;
		}

		if (mutation.type) {
			scalarUpdate.type = mutation.type;
			update.type = mutation.type;
		}

		if (Object.keys(scalarUpdate).length > 0) {
			await db.transaction.update({
				where: { id: tx.id },
				data: scalarUpdate,
			});
		}

		// Apply hashtag additions
		const addedHashtagNames: string[] = [];
		for (const normalizedName of mutation.hashtagsToAdd) {
			const existingNames = tx.hashtags.map((h) => h.hashtag.normalizedName);
			if (existingNames.includes(normalizedName)) continue;

			const hashtag = await db.hashtag.upsert({
				where: { userId_normalizedName: { userId, normalizedName } },
				create: { userId, name: normalizedName, normalizedName },
				update: {},
			});

			await db.transactionHashtag.upsert({
				where: { transactionId_hashtagId: { transactionId: tx.id, hashtagId: hashtag.id } },
				create: { transactionId: tx.id, hashtagId: hashtag.id },
				update: {},
			});

			addedHashtagNames.push(normalizedName);
		}
		if (addedHashtagNames.length > 0) update.addedHashtagNames = addedHashtagNames;

		updates.push(update);

		// Record audit log (upsert so re-runs don't duplicate)
		await db.transactionRuleApplication.upsert({
			where: {
				// Use a synthetic unique — fallback to create+skip on conflict via try/catch
				id: `${tx.id}_${ruleId}`,
			},
			create: {
				id: `${tx.id}_${ruleId}`,
				transactionId: tx.id,
				ruleId,
				wasHistoricalBackfill: true,
			},
			update: { appliedAt: new Date() },
		});
	}

	return { affected, deletedIds, updates };
}

/**
 * Counts how many transactions would be affected by a rule's conditions
 * without making any changes. Used for the preview before backfill.
 */
export async function previewBackfillCount(
	db: PrismaClient,
	userId: string,
	ruleId: string,
): Promise<number> {
	const rules = await loadRules(db, userId);
	const rule = rules.find((r) => r.id === ruleId);
	if (!rule) return 0;

	const transactions = await db.transaction.findMany({
		where: { userId },
		select: {
			id: true, description: true, account: true, amount: true,
			category: true, categoryRef: { select: { name: true } }, date: true,
		},
	});

	return transactions.filter((tx) => {
		const matchable = { ...tx, category: tx.categoryRef?.name ?? tx.category };
		const { matchedRuleIds } = runRules(matchable, [rule]);
		return matchedRuleIds.length > 0;
	}).length;
}
