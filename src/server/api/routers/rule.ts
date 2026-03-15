import { z } from "zod";
import { createTRPCRouter, demoOrProtectedProcedure, protectedProcedure } from "~/server/api/trpc";
import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";
import {
	previewBackfillCount,
	runHistoricalBackfill,
} from "~/server/rules-engine/historicalBackfill";
import { matchAllConditions } from "~/server/rules-engine/conditionMatcher";

const ConditionSchema = z.object({
	field: z.enum(["MERCHANT", "DESCRIPTION", "AMOUNT", "CATEGORY", "DATE", "ACCOUNT", "NOTES"]),
	operator: z.enum([
		"CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH",
		"EQUALS", "NOT_EQUALS", "GREATER_THAN", "GREATER_THAN_OR_EQUAL",
		"LESS_THAN", "LESS_THAN_OR_EQUAL", "IS_EMPTY", "IS_NOT_EMPTY",
		"BEFORE", "AFTER", "ON", "BETWEEN",
	]),
	valueText: z.string().nullable().default(null),
	valueNumber: z.number().nullable().default(null),
	valueDate: z.date().nullable().default(null),
	secondValueNumber: z.number().nullable().default(null),
	secondValueDate: z.date().nullable().default(null),
});

const ActionSchema = z.object({
	type: z.enum(["SET_CATEGORY", "SET_DESCRIPTION", "SET_TYPE", "ADD_HASHTAG"]),
	valueText: z.string().nullable().default(null),
	hashtagId: z.string().nullable().default(null),
});

export const ruleRouter = createTRPCRouter({
	list: demoOrProtectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.isDemoMode ? await requireDemoUserId() : ctx.session!.user.id;
		return ctx.db.transactionRule.findMany({
			where: { userId },
			orderBy: { priority: "asc" },
			include: {
				conditions: { orderBy: { sortOrder: "asc" } },
				actions: {
					orderBy: { sortOrder: "asc" },
					include: { hashtag: true },
				},
			},
		});
	}),

	create: protectedProcedure
		.input(z.object({
			name: z.string().min(1),
			conditions: z.array(ConditionSchema).min(1),
			actions: z.array(ActionSchema).min(1),
		}))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			// Assign priority = max existing + 1
			const max = await ctx.db.transactionRule.aggregate({
				where: { userId },
				_max: { priority: true },
			});
			const priority = (max._max.priority ?? 0) + 1;

			return ctx.db.transactionRule.create({
				data: {
					userId,
					name: input.name,
					priority,
					conditions: {
						create: input.conditions.map((c, i) => ({ ...c, sortOrder: i })),
					},
					actions: {
						create: input.actions.map((a, i) => ({ ...a, sortOrder: i })),
					},
				},
				include: {
					conditions: true,
					actions: { include: { hashtag: true } },
				},
			});
		}),

	update: protectedProcedure
		.input(z.object({
			id: z.string(),
			name: z.string().min(1),
			conditions: z.array(ConditionSchema).min(1),
			actions: z.array(ActionSchema).min(1),
		}))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const rule = await ctx.db.transactionRule.findFirst({
				where: { id: input.id, userId },
			});
			if (!rule) throw new Error("Rule not found");

			// Delete children and recreate atomically
			await ctx.db.$transaction([
				ctx.db.transactionRuleCondition.deleteMany({ where: { ruleId: input.id } }),
				ctx.db.transactionRuleAction.deleteMany({ where: { ruleId: input.id } }),
				ctx.db.transactionRule.update({
					where: { id: input.id },
					data: {
						name: input.name,
						conditions: {
							create: input.conditions.map((c, i) => ({ ...c, sortOrder: i })),
						},
						actions: {
							create: input.actions.map((a, i) => ({ ...a, sortOrder: i })),
						},
					},
				}),
			]);

			return ctx.db.transactionRule.findUnique({
				where: { id: input.id },
				include: {
					conditions: { orderBy: { sortOrder: "asc" } },
					actions: { orderBy: { sortOrder: "asc" }, include: { hashtag: true } },
				},
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transactionRule.deleteMany({
				where: { id: input.id, userId: ctx.session.user.id },
			});
			return { success: true };
		}),

	reorder: protectedProcedure
		.input(z.object({ orderedIds: z.array(z.string()) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await ctx.db.$transaction(
				input.orderedIds.map((id, i) =>
					ctx.db.transactionRule.updateMany({
						where: { id, userId },
						data: { priority: i + 1 },
					}),
				),
			);
			return { success: true };
		}),

	toggleActive: protectedProcedure
		.input(z.object({ id: z.string(), isActive: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transactionRule.updateMany({
				where: { id: input.id, userId: ctx.session.user.id },
				data: { isActive: input.isActive },
			});
			return { success: true };
		}),

	previewConditions: protectedProcedure
		.input(z.object({ conditions: z.array(ConditionSchema) }))
		.query(async ({ ctx, input }) => {
			const txs = await ctx.db.transaction.findMany({
				where: { userId: ctx.session.user.id },
				include: { hashtags: { include: { hashtag: true } } },
				orderBy: { date: "desc" },
				take: 1000,
			});
			const matched = txs
				.filter((tx) => matchAllConditions(tx, input.conditions))
				.slice(0, 3);
			return matched.map((tx) => ({
				id: tx.id,
				date: tx.date,
				description: tx.description,
				amount: tx.amount,
				type: tx.type,
				category: tx.category,
				account: tx.account,
				hashtags: tx.hashtags.map((h) => h.hashtag.name),
			}));
		}),

	previewMatchCount: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const count = await previewBackfillCount(ctx.db, ctx.session.user.id, input.id);
			return { count };
		}),

	applyHistorical: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return runHistoricalBackfill(ctx.db, ctx.session.user.id, input.id);
		}),

	// User settings for rule execution preference
	getSettings: demoOrProtectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.isDemoMode ? await requireDemoUserId() : ctx.session!.user.id;
		return ctx.db.userSettings.findUnique({ where: { userId } });
	}),

	updateSettings: protectedProcedure
		.input(z.object({
			ruleExecutionPreference: z.enum(["ALWAYS_ASK", "APPLY_HISTORICAL", "FUTURE_ONLY"]),
		}))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.userSettings.upsert({
				where: { userId: ctx.session.user.id },
				create: { userId: ctx.session.user.id, ...input },
				update: input,
			});
		}),
});
