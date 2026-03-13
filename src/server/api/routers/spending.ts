import { startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const spendingRouter = createTRPCRouter({
	getCategoryBreakdown: protectedProcedure
		.input(
			z.object({
				months: z.number().min(1).max(60).default(3),
			}),
		)
		.query(async ({ ctx, input }) => {
			const startDate = startOfMonth(subMonths(new Date(), input.months - 1));

			const transactions = await ctx.db.transaction.findMany({
				where: {
					userId: ctx.session.user.id,
					type: "EXPENSE",
					date: { gte: startDate },
				},
				select: { categoryRef: { select: { name: true } }, amount: true },
			});

			const totals = new Map<string, number>();
			for (const tx of transactions) {
				const category = tx.categoryRef?.name ?? "Uncategorized";
				totals.set(category, (totals.get(category) ?? 0) + tx.amount);
			}

			const totalSpend = Array.from(totals.values()).reduce((s, v) => s + v, 0);

			return Array.from(totals.entries())
				.map(([category, total]) => ({
					category,
					total,
					monthlyAvg: total / input.months,
					percentage: totalSpend > 0 ? (total / totalSpend) * 100 : 0,
				}))
				.sort((a, b) => b.total - a.total);
		}),

	getCategoryTrends: protectedProcedure
		.input(z.object({ months: z.number().min(1).max(24).default(12) }))
		.query(async ({ ctx, input }) => {
			const startDate = startOfMonth(subMonths(new Date(), input.months - 1));

			const transactions = await ctx.db.transaction.findMany({
				where: {
					userId: ctx.session.user.id,
					type: "EXPENSE",
					date: { gte: startDate },
				},
				select: { categoryRef: { select: { name: true } }, amount: true, date: true },
			});

			// { month -> { category -> total } }
			const grouped = new Map<string, Map<string, number>>();

			for (const tx of transactions) {
				const month = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
				const category = tx.categoryRef?.name ?? "Uncategorized";
				if (!grouped.has(month)) grouped.set(month, new Map());
				const cats = grouped.get(month)!;
				cats.set(category, (cats.get(category) ?? 0) + tx.amount);
			}

			return Array.from(grouped.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, cats]) => ({
					month,
					...Object.fromEntries(cats),
				}));
		}),

	getRecurringExpenses: protectedProcedure.query(async ({ ctx }) => {
		const startDate = startOfMonth(subMonths(new Date(), 5));

		const transactions = await ctx.db.transaction.findMany({
			where: {
				userId: ctx.session.user.id,
				type: "EXPENSE",
				date: { gte: startDate },
				description: { not: null },
			},
			select: { description: true, amount: true, date: true },
		});

		// Group by normalized description
		const groups = new Map<
			string,
			{ amounts: number[]; months: Set<string> }
		>();

		for (const tx of transactions) {
			if (!tx.description) continue;
			const key = tx.description.toLowerCase().trim();
			const month = `${tx.date.getFullYear()}-${tx.date.getMonth()}`;
			if (!groups.has(key)) groups.set(key, { amounts: [], months: new Set() });
			const g = groups.get(key)!;
			g.amounts.push(tx.amount);
			g.months.add(month);
		}

		// Keep entries that appear in 2+ distinct months with similar amounts
		return Array.from(groups.entries())
			.filter(([, g]) => g.months.size >= 2)
			.filter(([, g]) => {
				const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
				return g.amounts.every((a) => Math.abs(a - avg) / avg < 0.1);
			})
			.map(([description, g]) => ({
				description,
				monthlyAmount: g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length,
				occurrences: g.months.size,
			}))
			.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
	}),

	getAnomalies: protectedProcedure.query(async ({ ctx }) => {
		const startDate = startOfMonth(subMonths(new Date(), 5));
		const currentMonthStart = startOfMonth(new Date());

		const transactions = await ctx.db.transaction.findMany({
			where: {
				userId: ctx.session.user.id,
				type: "EXPENSE",
				date: { gte: startDate },
			},
			select: { categoryRef: { select: { name: true } }, amount: true, date: true },
		});

		// Group by category and month
		const catMonthly = new Map<string, Map<string, number>>();

		for (const tx of transactions) {
			const category = tx.categoryRef?.name ?? "Uncategorized";
			const month = `${tx.date.getFullYear()}-${tx.date.getMonth()}`;
			if (!catMonthly.has(category)) catMonthly.set(category, new Map());
			const m = catMonthly.get(category)!;
			m.set(month, (m.get(month) ?? 0) + tx.amount);
		}

		const currentMonthKey = `${currentMonthStart.getFullYear()}-${currentMonthStart.getMonth()}`;
		const anomalies: {
			category: string;
			currentAmount: number;
			averageAmount: number;
			ratio: number;
		}[] = [];

		for (const [category, monthMap] of catMonthly) {
			const currentAmount = monthMap.get(currentMonthKey) ?? 0;
			if (currentAmount === 0) continue;

			const historicalAmounts = Array.from(monthMap.entries())
				.filter(([m]) => m !== currentMonthKey)
				.map(([, v]) => v);

			if (historicalAmounts.length < 2) continue;

			const avg =
				historicalAmounts.reduce((s, v) => s + v, 0) / historicalAmounts.length;

			if (avg > 0 && currentAmount > avg * 1.75) {
				anomalies.push({
					category,
					currentAmount,
					averageAmount: avg,
					ratio: currentAmount / avg,
				});
			}
		}

		return anomalies.sort((a, b) => b.ratio - a.ratio);
	}),
});
