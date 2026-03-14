// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

export interface RealEstateInputs {
  currentEstimatedValue: number;
  currentLoanBalance: number;
  monthlyRent?: number;
  otherMonthlyIncome?: number;
  vacancyRate?: number;
  totalMonthlyExpenses?: number;
  // Itemized expenses (override totalMonthlyExpenses if provided)
  monthlyPropertyTax?: number;
  monthlyInsurance?: number;
  monthlyHOA?: number;
  monthlyUtilities?: number;
  monthlyMaintenance?: number;
  monthlyManagement?: number;
  monthlyOtherExpenses?: number;
  // Mortgage
  interestRate?: number;
  loanTermYears?: number;
  remainingTermMonths?: number;
  monthlyMortgagePayment?: number;
  // Appreciation / expense growth overrides
  appreciationRate?: number;
  expenseGrowthRate?: number;
  forecastScenario?: ForecastScenario;
}

export interface RealEstateProjectionPoint {
  year: number;
  projectedPropertyValue: number;
  projectedLoanBalance: number;
  projectedEquity: number;
  annualCashFlow: number;
  cumulativeCashFlow: number;
  totalGain: number;
  totalCashInvested: number;
  roiPercent: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RENT_GROWTH_RATES: Record<ForecastScenario, number> = {
  MODERATE: 0.02,
  STANDARD: 0.04,
  AGGRESSIVE: 0.06,
};

const DEFAULT_APPRECIATION_RATE = 0.03;
const DEFAULT_EXPENSE_GROWTH_RATE = 0.02;
const DEFAULT_VACANCY_RATE = 0.05;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculates the monthly payment for an amortized loan.
 */
function calcMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 12;
  return (principal * r * (1 + r) ** termMonths) / ((1 + r) ** termMonths - 1);
}

/**
 * Projects the remaining loan balance after `monthsPaid` additional payments.
 */
function projectedBalance(
  principal: number,
  annualRate: number,
  totalTermMonths: number,
  monthsPaid: number,
): number {
  if (annualRate === 0) {
    return Math.max(0, principal - (principal / totalTermMonths) * monthsPaid);
  }
  const r = annualRate / 12;
  const n = totalTermMonths;
  const m = monthsPaid;
  return principal * ((1 + r) ** n - (1 + r) ** m) / ((1 + r) ** n - 1);
}

// ─── Main Calculation ─────────────────────────────────────────────────────────

export function calculateRealEstateProjection(
  property: RealEstateInputs,
  scenario: ForecastScenario = "STANDARD",
  years = 5,
): RealEstateProjectionPoint[] {
  const {
    currentEstimatedValue,
    currentLoanBalance,
    monthlyRent = 0,
    otherMonthlyIncome = 0,
    vacancyRate = DEFAULT_VACANCY_RATE,
    appreciationRate = DEFAULT_APPRECIATION_RATE,
    expenseGrowthRate = DEFAULT_EXPENSE_GROWTH_RATE,
    interestRate,
    remainingTermMonths,
  } = property;

  // Normalize scenario
  const rentGrowthRate = RENT_GROWTH_RATES[scenario];
  const currentEquity = currentEstimatedValue - currentLoanBalance;

  // Resolve effective monthly expenses (itemized overrides total)
  const itemizedExpenses =
    (property.monthlyPropertyTax ?? 0) +
    (property.monthlyInsurance ?? 0) +
    (property.monthlyHOA ?? 0) +
    (property.monthlyUtilities ?? 0) +
    (property.monthlyMaintenance ?? 0) +
    (property.monthlyManagement ?? 0) +
    (property.monthlyOtherExpenses ?? 0);

  const hasItemized = itemizedExpenses > 0;
  const baseMonthlyExpenses = hasItemized
    ? itemizedExpenses
    : (property.totalMonthlyExpenses ?? 0);

  const currentAnnualExpenses = baseMonthlyExpenses * 12;

  // Resolve annual debt service
  let annualDebtService = 0;
  if (currentLoanBalance > 0) {
    let payment = property.monthlyMortgagePayment ?? 0;
    if (!payment && interestRate && remainingTermMonths) {
      payment = calcMonthlyPayment(currentLoanBalance, interestRate, remainingTermMonths);
    }
    annualDebtService = payment * 12;
  }

  // totalCashInvested = current equity (what's at risk / already put in from today's standpoint)
  const totalCashInvested = Math.max(currentEquity, 1); // avoid division by zero

  const points: RealEstateProjectionPoint[] = [];
  let cumulativeCashFlow = 0;

  for (let y = 1; y <= years; y++) {
    // Appreciation
    const projectedPropertyValue =
      currentEstimatedValue * (1 + appreciationRate) ** y;

    // Loan balance
    let projLoanBalance = 0;
    if (currentLoanBalance > 0) {
      if (interestRate && remainingTermMonths) {
        projLoanBalance = projectedBalance(
          currentLoanBalance,
          interestRate,
          remainingTermMonths,
          y * 12,
        );
      } else {
        // Simple linear paydown estimate if no rate/term info
        projLoanBalance = Math.max(0, currentLoanBalance - annualDebtService * y);
      }
    }

    const projectedEquity = projectedPropertyValue - projLoanBalance;

    // Income
    const projectedAnnualRent =
      (monthlyRent + otherMonthlyIncome) * 12 * (1 + rentGrowthRate) ** y;
    const effectiveRent = projectedAnnualRent * (1 - vacancyRate);

    // Expenses
    const projectedExpenses = currentAnnualExpenses * (1 + expenseGrowthRate) ** y;

    // Cash flow
    const annualCashFlow = effectiveRent - projectedExpenses - annualDebtService;
    cumulativeCashFlow += annualCashFlow;

    // Gains
    const equityGain = projectedEquity - currentEquity;
    const totalGain = equityGain + cumulativeCashFlow;
    const roiPercent = (totalGain / totalCashInvested) * 100;

    points.push({
      year: y,
      projectedPropertyValue,
      projectedLoanBalance: projLoanBalance,
      projectedEquity,
      annualCashFlow,
      cumulativeCashFlow,
      totalGain,
      totalCashInvested,
      roiPercent,
    });
  }

  return points;
}
