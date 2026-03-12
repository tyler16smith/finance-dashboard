import { z } from "zod";
import { forecastInvestmentGrowth } from "~/lib/forecasting";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const InvestmentTypeEnum = z.enum([
	"STOCKS",
	"REAL_ESTATE",
	"ROTH_IRA",
	"FOUR01K",
	"HSA",
]);

export const investmentRouter = createTRPCRouter({
	getAll: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.investment.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: protectedProcedure
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
			return ctx.db.investment.create({
				data: { ...input, userId: ctx.session.user.id },
			});
		}),

	update: protectedProcedure
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
			const { id, ...data } = input;
			return ctx.db.investment.update({
				where: { id, userId: ctx.session.user.id },
				data,
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.investment.delete({
				where: { id: input.id, userId: ctx.session.user.id },
			});
		}),

	getForecast: protectedProcedure
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
			const investments = await ctx.db.investment.findMany({
				where: { userId: ctx.session.user.id },
			});

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
