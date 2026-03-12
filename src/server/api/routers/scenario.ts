import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const ScenarioTypeEnum = z.enum([
	"CONSERVATIVE",
	"EXPECTED",
	"AGGRESSIVE",
	"CUSTOM",
]);

export const scenarioRouter = createTRPCRouter({
	getAll: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.forecastScenario.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				type: ScenarioTypeEnum,
				investmentReturn: z.number(),
				inflationRate: z.number(),
				salaryGrowth: z.number(),
				contributionChange: z.number(),
				expenseGrowth: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.forecastScenario.create({
				data: { ...input, userId: ctx.session.user.id },
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				investmentReturn: z.number().optional(),
				inflationRate: z.number().optional(),
				salaryGrowth: z.number().optional(),
				contributionChange: z.number().optional(),
				expenseGrowth: z.number().optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.db.forecastScenario.update({
				where: { id, userId: ctx.session.user.id },
				data,
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.forecastScenario.delete({
				where: { id: input.id, userId: ctx.session.user.id },
			});
		}),

	setActive: protectedProcedure
		.input(z.object({ id: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			// Deactivate all
			await ctx.db.forecastScenario.updateMany({
				where: { userId: ctx.session.user.id },
				data: { isActive: false },
			});
			// Activate selected
			if (input.id) {
				await ctx.db.forecastScenario.update({
					where: { id: input.id, userId: ctx.session.user.id },
					data: { isActive: true },
				});
			}
			return { success: true };
		}),

	seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
		const existing = await ctx.db.forecastScenario.count({
			where: { userId: ctx.session.user.id },
		});
		if (existing > 0) return { seeded: false };

		await ctx.db.forecastScenario.createMany({
			data: [
				{
					userId: ctx.session.user.id,
					name: "Conservative",
					type: "CONSERVATIVE",
					investmentReturn: 0.04,
					inflationRate: 0.04,
					salaryGrowth: 0.01,
					contributionChange: 0,
					expenseGrowth: 0.04,
				},
				{
					userId: ctx.session.user.id,
					name: "Expected",
					type: "EXPECTED",
					investmentReturn: 0.07,
					inflationRate: 0.03,
					salaryGrowth: 0.03,
					contributionChange: 0.02,
					expenseGrowth: 0.03,
					isActive: true,
				},
				{
					userId: ctx.session.user.id,
					name: "Aggressive",
					type: "AGGRESSIVE",
					investmentReturn: 0.1,
					inflationRate: 0.02,
					salaryGrowth: 0.06,
					contributionChange: 0.05,
					expenseGrowth: 0.02,
				},
			],
		});

		return { seeded: true };
	}),
});
