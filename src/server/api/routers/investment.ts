import { z } from "zod";
import { forecastInvestmentGrowth } from "~/lib/forecasting";
import { createTRPCRouter, demoOrProtectedProcedure } from "~/server/api/trpc";
import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";
import {
	getInvestmentsOverlay,
	upsertOverlayInvestment,
	deleteOverlayInvestment,
} from "~/server/services/demo/demo-overlay.service";
import { mergeInvestments } from "~/server/services/demo/demo-merge.service";

const InvestmentTypeEnum = z.enum([
	"STOCKS",
	"REAL_ESTATE",
	"ROTH_IRA",
	"FOUR01K",
	"HSA",
]);

export const investmentRouter = createTRPCRouter({
	getAll: demoOrProtectedProcedure.query(async ({ ctx }) => {
		if (ctx.isDemoMode) {
			const demoUserId = await requireDemoUserId();
			const seeded = await ctx.db.investment.findMany({
				where: { userId: demoUserId },
				orderBy: { createdAt: "asc" },
			});
			if (!ctx.demoOverlaySessionKey) return seeded;
			const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
			return mergeInvestments(seeded, overlay);
		}
		return ctx.db.investment.findMany({
			where: { userId: ctx.session!.user.id },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: demoOrProtectedProcedure
		.input(
			z.object({
				type: InvestmentTypeEnum,
				name: z.string().min(1),
				startingBalance: z.number().min(0),
				monthlyContribution: z.number().min(0),
				annualReturnRate: z.number().min(0).max(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				const demoUserId = await requireDemoUserId();
				const now = new Date();
				const overlayInvestment = {
					id: crypto.randomUUID(),
					userId: demoUserId,
					type: input.type,
					name: input.name,
					startingBalance: input.startingBalance,
					monthlyContribution: input.monthlyContribution,
					annualReturnRate: input.annualReturnRate,
					createdAt: now,
					updatedAt: now,
					_isOverlay: true as const,
				};
				return upsertOverlayInvestment(ctx.demoOverlaySessionKey, overlayInvestment);
			}
			return ctx.db.investment.create({
				data: { ...input, userId: ctx.session!.user.id },
			});
		}),

	update: demoOrProtectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				startingBalance: z.number().min(0).optional(),
				monthlyContribution: z.number().min(0).optional(),
				annualReturnRate: z.number().min(0).max(1).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				const demoUserId = await requireDemoUserId();
				// Find the current record (overlay or DB)
				const seeded = await ctx.db.investment.findMany({
					where: { userId: demoUserId },
				});
				const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
				const merged = mergeInvestments(seeded, overlay);
				const existing = merged.find((i) => i.id === input.id);
				if (!existing) throw new Error("Investment not found");
				const { id, ...data } = input;
				const updated = { ...existing, ...data, updatedAt: new Date() };
				return upsertOverlayInvestment(ctx.demoOverlaySessionKey, updated);
			}
			const { id, ...data } = input;
			return ctx.db.investment.update({
				where: { id, userId: ctx.session!.user.id },
				data,
			});
		}),

	delete: demoOrProtectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				await deleteOverlayInvestment(ctx.demoOverlaySessionKey, input.id);
				return { id: input.id };
			}
			return ctx.db.investment.delete({
				where: { id: input.id, userId: ctx.session!.user.id },
			});
		}),

	getForecast: demoOrProtectedProcedure
		.input(
			z.object({
				months: z.number().min(1).max(60),
				scenarioOverrides: z
					.object({
						annualReturnRate: z.number().optional(),
						monthlyContribution: z.number().optional(),
					})
					.optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			let investments: Awaited<ReturnType<typeof ctx.db.investment.findMany>>;

			if (ctx.isDemoMode) {
				const demoUserId = await requireDemoUserId();
				const seeded = await ctx.db.investment.findMany({
					where: { userId: demoUserId },
				});
				if (ctx.demoOverlaySessionKey) {
					const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
					investments = mergeInvestments(seeded, overlay);
				} else {
					investments = seeded;
				}
			} else {
				investments = await ctx.db.investment.findMany({
					where: { userId: ctx.session!.user.id },
				});
			}

			return investments.map((inv) => ({
				id: inv.id,
				name: inv.name,
				type: inv.type,
				projections: forecastInvestmentGrowth(
					{
						startingBalance: inv.startingBalance,
						monthlyContribution:
							input.scenarioOverrides?.monthlyContribution ??
							inv.monthlyContribution,
						annualReturnRate:
							input.scenarioOverrides?.annualReturnRate ?? inv.annualReturnRate,
					},
					input.months,
				),
			}));
		}),
});
