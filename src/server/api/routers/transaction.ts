import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const transactionRouter = createTRPCRouter({
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
				limit: z.number().min(1).max(500).default(100),
				offset: z.number().default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.transaction.findMany({
				where: {
					userId: ctx.session.user.id,
					...(input.startDate && { date: { gte: input.startDate } }),
					...(input.endDate && { date: { lte: input.endDate } }),
					...(input.category && { category: input.category as never }),
					...(input.type && { type: input.type as never }),
				},
				orderBy: { date: "desc" },
				take: input.limit,
				skip: input.offset,
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
