import { z } from "zod";
import { calculateRealEstateProjection } from "~/lib/real-estate-forecasting";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.realEstateInvestment.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: protectedProcedure
    .input(realEstateInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.realEstateInvestment.create({
        data: { ...input, userId: ctx.session.user.id },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(realEstateInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.realEstateInvestment.update({
        where: { id, userId: ctx.session.user.id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.realEstateInvestment.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
    }),

  getProjection: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scenario: ForecastScenarioEnum.optional(),
        years: z.number().int().min(1).max(5).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.realEstateInvestment.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.session.user.id },
      });

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
