import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const transactionRouter = createTRPCRouter({
	listCategories: protectedProcedure.query(async ({ ctx }) => {
		const cats = await ctx.db.category.findMany({
			where: { OR: [{ userId: null }, { userId: ctx.session.user.id }] },
			orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
			select: { name: true },
		});
		return cats.map((c) => c.name);
	}),

	hasData: protectedProcedure.query(async ({ ctx }) => {
		const count = await ctx.db.transaction.count({
			where: { userId: ctx.session.user.id },
		});
		return count > 0;
	}),

	getAll: protectedProcedure
		.input(
			z.object({
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				category: z.string().optional(),
				type: z.enum(["INCOME", "EXPENSE"]).optional(),
				search: z.string().optional(),
				hashtag: z.string().optional(),
				sortField: z.enum(["date", "amount", "account"]).default("date"),
				sortDir: z.enum(["asc", "desc"]).default("desc"),
				limit: z.number().min(1).max(200).default(100),
				cursor: z.number().default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const items = await ctx.db.transaction.findMany({
				where: {
					userId: ctx.session.user.id,
					...(input.startDate && { date: { gte: input.startDate } }),
					...(input.endDate && { date: { lte: input.endDate } }),
					...(input.category && {
					categoryRef: { name: { equals: input.category, mode: "insensitive" } },
				}),
					...(input.type && { type: input.type as never }),
					...(input.search && {
						description: {
							contains: input.search,
							mode: "insensitive" as never,
						},
					}),
					...(input.hashtag && {
						hashtags: {
							some: {
								hashtag: {
									normalizedName: input.hashtag.replace(/^#/, "").toLowerCase(),
								},
							},
						},
					}),
				},
				include: {
					hashtags: {
						include: { hashtag: true },
					},
					categoryRef: true,
				},
				orderBy: { [input.sortField]: input.sortDir },
				take: input.limit,
				skip: input.cursor,
			});
			return {
				items,
				nextCursor: items.length === input.limit ? input.cursor + input.limit : undefined,
			};
		}),

	count: protectedProcedure
		.input(
			z.object({
				type: z.enum(["INCOME", "EXPENSE"]).optional(),
				search: z.string().optional(),
				hashtag: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.transaction.count({
				where: {
					userId: ctx.session.user.id,
					...(input.type && { type: input.type as never }),
					...(input.search && {
						description: {
							contains: input.search,
							mode: "insensitive" as never,
						},
					}),
					...(input.hashtag && {
						hashtags: {
							some: {
								hashtag: {
									normalizedName: input.hashtag.replace(/^#/, "").toLowerCase(),
								},
							},
						},
					}),
				},
			});
		}),

	getMonthlyAggregates: protectedProcedure
		.input(
			z.object({
				months: z.number().min(1).max(60).default(24),
			}),
		)
		.query(async ({ ctx, input }) => {
			const startDate = startOfMonth(subMonths(new Date(), input.months - 1));

			const transactions = await ctx.db.transaction.findMany({
				where: {
					userId: ctx.session.user.id,
					date: { gte: startDate },
				},
				select: { date: true, amount: true, type: true },
				orderBy: { date: "asc" },
			});

			// Group by year-month
			const grouped = new Map<
				string,
				{ income: number; expenses: number; netGain: number }
			>();

			for (const tx of transactions) {
				const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
				const existing = grouped.get(key) ?? {
					income: 0,
					expenses: 0,
					netGain: 0,
				};
				if (tx.type === "INCOME") {
					existing.income += tx.amount;
				} else {
					existing.expenses += tx.amount;
				}
				existing.netGain = existing.income - existing.expenses;
				grouped.set(key, existing);
			}

			return Array.from(grouped.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, data]) => ({ month, ...data }));
		}),

	getSummaryMetrics: protectedProcedure.query(async ({ ctx }) => {
		const startDate = startOfMonth(subMonths(new Date(), 11));

		const transactions = await ctx.db.transaction.findMany({
			where: {
				userId: ctx.session.user.id,
				date: { gte: startDate },
			},
			select: { amount: true, type: true, date: true },
		});

		// Group by month
		const monthlyMap = new Map<string, { income: number; expenses: number }>();
		for (const tx of transactions) {
			const key = `${tx.date.getFullYear()}-${tx.date.getMonth()}`;
			const m = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
			if (tx.type === "INCOME") m.income += tx.amount;
			else m.expenses += tx.amount;
			monthlyMap.set(key, m);
		}

		const months = Array.from(monthlyMap.values());
		const count = months.length || 1;

		const avgIncome = months.reduce((s, m) => s + m.income, 0) / count;
		const avgExpenses = months.reduce((s, m) => s + m.expenses, 0) / count;
		const avgNetGain = avgIncome - avgExpenses;

		return { avgIncome, avgExpenses, avgNetGain, monthCount: count };
	}),

	bulkUpdateType: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.string()).min(1),
				type: z.enum(["INCOME", "EXPENSE"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transaction.updateMany({
				where: { id: { in: input.ids }, userId: ctx.session.user.id },
				data: { type: input.type as never },
			});
			return { success: true };
		}),

	bulkDelete: protectedProcedure
		.input(z.object({ ids: z.array(z.string()).min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transaction.deleteMany({
				where: { id: { in: input.ids }, userId: ctx.session.user.id },
			});
			return { success: true };
		}),

	updateCategory: protectedProcedure
		.input(z.object({ id: z.string(), categoryName: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			let cat = await ctx.db.category.findFirst({
				where: {
					OR: [
						{ userId: ctx.session.user.id, name: { equals: input.categoryName, mode: "insensitive" } },
						{ userId: null, name: { equals: input.categoryName, mode: "insensitive" } },
					],
				},
			});
			if (!cat) {
				cat = await ctx.db.category.create({
					data: { userId: ctx.session.user.id, name: input.categoryName },
				});
			}
			await ctx.db.transaction.updateMany({
				where: { id: input.id, userId: ctx.session.user.id },
				data: { categoryId: cat.id, category: cat.name },
			});
			return { categoryId: cat.id, categoryName: cat.name };
		}),

	updateType: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				type: z.enum(["INCOME", "EXPENSE"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transaction.updateMany({
				where: { id: input.id, userId: ctx.session.user.id },
				data: { type: input.type as never },
			});
			return { success: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.transaction.deleteMany({
				where: { id: input.id, userId: ctx.session.user.id },
			});
			return { success: true };
		}),

	deleteImport: protectedProcedure
		.input(z.object({ importId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const csvImport = await ctx.db.csvImport.findFirst({
				where: { id: input.importId, userId: ctx.session.user.id },
			});
			if (!csvImport) throw new Error("Import not found");

			await ctx.db.transaction.deleteMany({
				where: { importId: input.importId, userId: ctx.session.user.id },
			});
			await ctx.db.csvImport.delete({ where: { id: input.importId } });

			return { success: true };
		}),

	getImports: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.csvImport.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { createdAt: "desc" },
		});
	}),
});
