import { z } from "zod";
import { calculateRealEstateProjection } from "~/lib/real-estate-forecasting";
import { createTRPCRouter, demoOrProtectedProcedure } from "~/server/api/trpc";
import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";
import {
	getPropertiesOverlay,
	upsertOverlayProperty,
	deleteOverlayProperty,
} from "~/server/services/demo/demo-overlay.service";
import { mergeProperties, resolveProperty } from "~/server/services/demo/demo-merge.service";

const PropertyTypeEnum = z.enum([
  "SINGLE_FAMILY",
  "MULTI_FAMILY",
  "CONDO",
  "COMMERCIAL",
  "LAND",
  "OTHER",
]);

const UsageTypeEnum = z.enum([
  "PRIMARY_RESIDENCE",
  "RENTAL",
  "VACATION_HOME",
  "MIXED_USE",
]);

const ForecastScenarioEnum = z.enum(["MODERATE", "STANDARD", "AGGRESSIVE"]);

const realEstateInput = z.object({
  name: z.string().min(1),
  propertyType: PropertyTypeEnum,
  usageType: UsageTypeEnum,
  currentEstimatedValue: z.number().min(0),
  currentLoanBalance: z.number().min(0),
  purchasePrice: z.number().min(0).optional(),
  purchaseDate: z.coerce.date().optional(),
  downPayment: z.number().min(0).optional(),
  closingCosts: z.number().min(0).optional(),
  rehabCosts: z.number().min(0).optional(),
  interestRate: z.number().min(0).max(1).optional(),
  loanTermYears: z.number().int().min(1).optional(),
  remainingTermMonths: z.number().int().min(0).optional(),
  monthlyMortgagePayment: z.number().min(0).optional(),
  monthlyRent: z.number().min(0).optional(),
  otherMonthlyIncome: z.number().min(0).optional(),
  vacancyRate: z.number().min(0).max(1).optional(),
  totalMonthlyExpenses: z.number().min(0).optional(),
  monthlyPropertyTax: z.number().min(0).optional(),
  monthlyInsurance: z.number().min(0).optional(),
  monthlyHOA: z.number().min(0).optional(),
  monthlyUtilities: z.number().min(0).optional(),
  monthlyMaintenance: z.number().min(0).optional(),
  monthlyManagement: z.number().min(0).optional(),
  monthlyOtherExpenses: z.number().min(0).optional(),
  appreciationRate: z.number().min(0).max(1).optional(),
  expenseGrowthRate: z.number().min(0).max(1).optional(),
  forecastScenario: ForecastScenarioEnum.optional(),
});

export const realEstateRouter = createTRPCRouter({
  list: demoOrProtectedProcedure.query(async ({ ctx }) => {
    if (ctx.isDemoMode) {
      const demoUserId = await requireDemoUserId();
      const seeded = await ctx.db.realEstateInvestment.findMany({
        where: { userId: demoUserId },
        orderBy: { createdAt: "asc" },
      });
      if (!ctx.demoOverlaySessionKey) return seeded;
      const overlay = await getPropertiesOverlay(ctx.demoOverlaySessionKey);
      return mergeProperties(seeded, overlay);
    }
    return ctx.db.realEstateInvestment.findMany({
      where: { userId: ctx.session!.user.id },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: demoOrProtectedProcedure
    .input(realEstateInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoMode) {
        if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
        const demoUserId = await requireDemoUserId();
        const now = new Date();
        const overlayProperty = {
          id: crypto.randomUUID(),
          userId: demoUserId,
          ...input,
          purchaseDate: input.purchaseDate ?? null,
          purchasePrice: input.purchasePrice ?? null,
          downPayment: input.downPayment ?? null,
          closingCosts: input.closingCosts ?? null,
          rehabCosts: input.rehabCosts ?? null,
          interestRate: input.interestRate ?? null,
          loanTermYears: input.loanTermYears ?? null,
          remainingTermMonths: input.remainingTermMonths ?? null,
          monthlyMortgagePayment: input.monthlyMortgagePayment ?? null,
          monthlyRent: input.monthlyRent ?? null,
          otherMonthlyIncome: input.otherMonthlyIncome ?? null,
          vacancyRate: input.vacancyRate ?? null,
          totalMonthlyExpenses: input.totalMonthlyExpenses ?? null,
          monthlyPropertyTax: input.monthlyPropertyTax ?? null,
          monthlyInsurance: input.monthlyInsurance ?? null,
          monthlyHOA: input.monthlyHOA ?? null,
          monthlyUtilities: input.monthlyUtilities ?? null,
          monthlyMaintenance: input.monthlyMaintenance ?? null,
          monthlyManagement: input.monthlyManagement ?? null,
          monthlyOtherExpenses: input.monthlyOtherExpenses ?? null,
          appreciationRate: input.appreciationRate ?? null,
          expenseGrowthRate: input.expenseGrowthRate ?? null,
          forecastScenario: input.forecastScenario ?? "STANDARD",
          createdAt: now,
          updatedAt: now,
          _isOverlay: true as const,
        };
        return upsertOverlayProperty(ctx.demoOverlaySessionKey, overlayProperty);
      }
      return ctx.db.realEstateInvestment.create({
        data: { ...input, userId: ctx.session!.user.id },
      });
    }),

  update: demoOrProtectedProcedure
    .input(z.object({ id: z.string() }).merge(realEstateInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoMode) {
        if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
        const demoUserId = await requireDemoUserId();
        const seeded = await ctx.db.realEstateInvestment.findMany({
          where: { userId: demoUserId },
        });
        const overlay = await getPropertiesOverlay(ctx.demoOverlaySessionKey);
        const merged = mergeProperties(seeded, overlay);
        const existing = merged.find((p) => p.id === input.id);
        if (!existing) throw new Error("Property not found");
        const { id, ...data } = input;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        return upsertOverlayProperty(ctx.demoOverlaySessionKey, updated);
      }
      const { id, ...data } = input;
      return ctx.db.realEstateInvestment.update({
        where: { id, userId: ctx.session!.user.id },
        data,
      });
    }),

  delete: demoOrProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoMode) {
        if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
        await deleteOverlayProperty(ctx.demoOverlaySessionKey, input.id);
        return { id: input.id };
      }
      return ctx.db.realEstateInvestment.delete({
        where: { id: input.id, userId: ctx.session!.user.id },
      });
    }),

  getProjection: demoOrProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        scenario: ForecastScenarioEnum.optional(),
        years: z.number().int().min(1).max(5).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let property: Awaited<ReturnType<typeof ctx.db.realEstateInvestment.findUniqueOrThrow>>;

      if (ctx.isDemoMode) {
        const demoUserId = await requireDemoUserId();
        const seeded = await ctx.db.realEstateInvestment.findMany({
          where: { userId: demoUserId },
        });
        const overlayItems = ctx.demoOverlaySessionKey
          ? (await getPropertiesOverlay(ctx.demoOverlaySessionKey)).items
          : [];
        const found = resolveProperty(input.id, seeded, overlayItems);
        if (!found) throw new Error("Property not found");
        property = found;
      } else {
        property = await ctx.db.realEstateInvestment.findUniqueOrThrow({
          where: { id: input.id, userId: ctx.session!.user.id },
        });
      }

      const scenario = input.scenario ?? property.forecastScenario;
      return calculateRealEstateProjection(
        {
          currentEstimatedValue: property.currentEstimatedValue,
          currentLoanBalance: property.currentLoanBalance,
          monthlyRent: property.monthlyRent ?? undefined,
          otherMonthlyIncome: property.otherMonthlyIncome ?? undefined,
          vacancyRate: property.vacancyRate ?? undefined,
          totalMonthlyExpenses: property.totalMonthlyExpenses ?? undefined,
          monthlyPropertyTax: property.monthlyPropertyTax ?? undefined,
          monthlyInsurance: property.monthlyInsurance ?? undefined,
          monthlyHOA: property.monthlyHOA ?? undefined,
          monthlyUtilities: property.monthlyUtilities ?? undefined,
          monthlyMaintenance: property.monthlyMaintenance ?? undefined,
          monthlyManagement: property.monthlyManagement ?? undefined,
          monthlyOtherExpenses: property.monthlyOtherExpenses ?? undefined,
          interestRate: property.interestRate ?? undefined,
          loanTermYears: property.loanTermYears ?? undefined,
          remainingTermMonths: property.remainingTermMonths ?? undefined,
          monthlyMortgagePayment: property.monthlyMortgagePayment ?? undefined,
          appreciationRate: property.appreciationRate ?? undefined,
          expenseGrowthRate: property.expenseGrowthRate ?? undefined,
          forecastScenario: scenario,
        },
        scenario,
        input.years ?? 5,
      );
    }),
});
