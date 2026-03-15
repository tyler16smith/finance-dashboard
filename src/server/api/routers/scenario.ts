import { z } from "zod";
import { createTRPCRouter, demoOrProtectedProcedure } from "~/server/api/trpc";
import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";
import {
	getScenariosOverlay,
	upsertOverlayScenario,
	deleteOverlayScenario,
	setActiveOverlayScenario,
} from "~/server/services/demo/demo-overlay.service";
import { mergeScenarios } from "~/server/services/demo/demo-merge.service";

const ScenarioTypeEnum = z.enum([
	"CONSERVATIVE",
	"EXPECTED",
	"AGGRESSIVE",
	"CUSTOM",
]);

export const scenarioRouter = createTRPCRouter({
	getAll: demoOrProtectedProcedure.query(async ({ ctx }) => {
		if (ctx.isDemoMode) {
			const demoUserId = await requireDemoUserId();
			const seeded = await ctx.db.forecastScenario.findMany({
				where: { userId: demoUserId },
				orderBy: { createdAt: "asc" },
			});
			if (!ctx.demoOverlaySessionKey) return seeded;
			const overlay = await getScenariosOverlay(ctx.demoOverlaySessionKey);
			return mergeScenarios(seeded, overlay);
		}
		return ctx.db.forecastScenario.findMany({
			where: { userId: ctx.session!.user.id },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: demoOrProtectedProcedure
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
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				const demoUserId = await requireDemoUserId();
				const now = new Date();
				const overlayScenario = {
					id: crypto.randomUUID(),
					userId: demoUserId,
					...input,
					isActive: false,
					createdAt: now,
					updatedAt: now,
					_isOverlay: true as const,
				};
				return upsertOverlayScenario(ctx.demoOverlaySessionKey, overlayScenario);
			}
			return ctx.db.forecastScenario.create({
				data: { ...input, userId: ctx.session!.user.id },
			});
		}),

	update: demoOrProtectedProcedure
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
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				const demoUserId = await requireDemoUserId();
				const seeded = await ctx.db.forecastScenario.findMany({
					where: { userId: demoUserId },
				});
				const overlay = await getScenariosOverlay(ctx.demoOverlaySessionKey);
				const merged = mergeScenarios(seeded, overlay);
				const existing = merged.find((s) => s.id === input.id);
				if (!existing) throw new Error("Scenario not found");
				const { id, ...data } = input;
				const updated = { ...existing, ...data, updatedAt: new Date() };
				return upsertOverlayScenario(ctx.demoOverlaySessionKey, updated);
			}
			const { id, ...data } = input;
			return ctx.db.forecastScenario.update({
				where: { id, userId: ctx.session!.user.id },
				data,
			});
		}),

	delete: demoOrProtectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				await deleteOverlayScenario(ctx.demoOverlaySessionKey, input.id);
				return { id: input.id };
			}
			return ctx.db.forecastScenario.delete({
				where: { id: input.id, userId: ctx.session!.user.id },
			});
		}),

	setActive: demoOrProtectedProcedure
		.input(z.object({ id: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.isDemoMode) {
				if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
				await setActiveOverlayScenario(ctx.demoOverlaySessionKey, input.id);
				return { success: true };
			}
			// Deactivate all
			await ctx.db.forecastScenario.updateMany({
				where: { userId: ctx.session!.user.id },
				data: { isActive: false },
			});
			// Activate selected
			if (input.id) {
				await ctx.db.forecastScenario.update({
					where: { id: input.id, userId: ctx.session!.user.id },
					data: { isActive: true },
				});
			}
			return { success: true };
		}),

	seedDefaults: demoOrProtectedProcedure.mutation(async ({ ctx }) => {
		if (ctx.isDemoMode) {
			// Demo workspace already has seeded scenarios — nothing to do
			return { seeded: false };
		}
		const existing = await ctx.db.forecastScenario.count({
			where: { userId: ctx.session!.user.id },
		});
		if (existing > 0) return { seeded: false };

		await ctx.db.forecastScenario.createMany({
			data: [
				{
					userId: ctx.session!.user.id,
					name: "Conservative",
					type: "CONSERVATIVE",
					investmentReturn: 0.04,
					inflationRate: 0.04,
					salaryGrowth: 0.01,
					contributionChange: 0,
					expenseGrowth: 0.04,
				},
				{
					userId: ctx.session!.user.id,
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
					userId: ctx.session!.user.id,
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
