# Feature Specification — Real Estate Investment Model, Entry UI, and 1–5 Year ROI Forecasting

## Overview

Add a **real-estate-specific investment type** to the finance dashboard that supports:

- Dedicated **real estate entry UI**
- Structured **database model**
- **1–5 year ROI forecasting engine**
- **Scenario-based projections**
- A **single ROI projection line chart**

Real estate cannot reuse the existing generic investment form because it combines:

- Asset appreciation
- Mortgage debt
- Equity growth
- Rental income
- Vacancy assumptions
- Recurring operating expenses
- Cash flow projections

This feature introduces a **complete data model, UI workflow, and forecasting engine** tailored to real estate investments.

The dashboard should project **total ROI % over time (1–5 years)** using a single line chart.

---

# Core Product Goals

The system should allow users to:

1. Add real estate investments as their own investment type.
2. Enter data using a **progressively detailed UI** that begins simple.
3. Store full structured data even if the user initially provides minimal inputs.
4. Calculate projected equity growth, cash flow, and ROI.
5. Forecast ROI under different economic assumptions.
6. Display projections on a **1–5 year line chart**.
7. Integrate with the existing stack:

- Next.js
- TypeScript
- tRPC
- Prisma
- Neon Postgres
- Tailwind
- shadcn/ui
- Recharts

---

# UX Design Philosophy

Real estate data entry can involve many variables.

To keep the UI user-friendly, the form should use **progressive disclosure**:

- Start with a **Quick Entry layer**
- Allow **Advanced sections** to expand for more detailed modeling

The **database model should support full detail**, even if the UI initially collects only a subset of fields.

---

# Entry UI Structure

The entry UI should be implemented inside a **Dialog modal** using shadcn/ui components.

Components used:

- Dialog
- Input
- Select
- Switch
- Label
- Accordion
- Card
- Separator

---

# Tier 1 — Quick Entry (Default View)

The first layer should ask only the most important fields needed to generate an immediate forecast.

### Section: Property Snapshot

Fields:

- Property Name
- Property Type
- Usage Type
- Current Estimated Value
- Current Loan Balance

Property Type options:

- Single Family
- Multi Family
- Condo / Townhome
- Commercial
- Land
- Other

Usage Type options:

- Primary Residence
- Rental Property
- Vacation Home
- Mixed Use

---

### Section: Income & Costs

Fields:

- Is this property rented? (toggle)

If rented:

- Monthly Rent

Other fields:

- Total Monthly Expenses

This field acts as a **quick estimate override** if the user does not want to itemize expenses.

---

### Section: Forecast Scenario

Fields:

Forecast Scenario selector:

- Moderate
- Standard
- Aggressive

These scenarios control **rent growth assumptions**.

---

### Section: Live Summary Preview

Display a live summary using a Card component.

Derived fields shown:

- Current Equity
- Estimated Monthly Cash Flow
- Estimated Annual Cash Flow
- Preliminary 5-Year ROI Preview

These values update as the user types.

---

# Tier 2 — Advanced Details (Accordion Sections)

Advanced fields are optional and appear under:

**"Add more details for a more accurate forecast"**

Use Accordion sections.

---

## Accordion: Mortgage Details

Fields:

- Purchase Price
- Purchase Date
- Down Payment
- Closing Costs
- Initial Rehab / Improvements
- Loan Amount
- Interest Rate
- Loan Term (Years)
- Remaining Loan Term (Months)
- Monthly Mortgage Payment

Behavior:

- Loan amount auto-calculates if purchase price and down payment exist.
- Monthly mortgage payment can be auto-calculated or manually overridden.

---

## Accordion: Income Details

Fields:

- Monthly Rent
- Other Monthly Income
- Vacancy Rate %

Rent growth is controlled by forecast scenario in v1.

---

## Accordion: Expense Breakdown

Fields:

- Monthly Property Tax
- Monthly Insurance
- Monthly HOA
- Monthly Utilities
- Monthly Maintenance
- Monthly Property Management
- Monthly Other Expenses

If detailed fields exist, they override **Total Monthly Expenses**.

---

## Accordion: Forecast Assumptions

Fields:

- Annual Appreciation Rate %
- Annual Expense Growth Rate %

These fields allow advanced overrides for forecasting.

---

# Real Estate Forecast Chart

Use **Recharts LineChart**.

### Chart Setup

X Axis:

Year (1–5)

Y Axis:

ROI %

Single series:

Projected ROI %

### Tooltip Data

Include:

- Year
- ROI %
- Projected Property Value
- Projected Loan Balance
- Projected Equity
- Annual Cash Flow
- Cumulative Cash Flow
- Total Gain
- Total Cash Invested

---

# Forecast Calculation Model

Forecast from **current values**, not original purchase values.

Starting values:

- currentEstimatedValue
- currentLoanBalance
- monthlyRent
- monthlyExpenses

---

# ROI Definition

Projected ROI is defined as:

```

ROI % = totalGain / totalCashInvested

```

Where:

Total Gain includes:

- Equity gain from appreciation
- Equity gain from principal paydown
- Cumulative net rental cash flow

---

# Calculation Formulas

## Current Equity

```

currentEquity = currentEstimatedValue - currentLoanBalance

```

---

## Property Appreciation

For each year y:

```

projectedPropertyValue[y] = currentEstimatedValue * (1 + appreciationRate)^y

```

---

## Rent Growth (Scenario Based)

Moderate:

```

rentGrowthRate = 0.02

```

Standard:

```

rentGrowthRate = 0.04

```

Aggressive:

```

rentGrowthRate = 0.06

```

Projected rent:

```

projectedRent[y] = currentMonthlyRent * 12 * (1 + rentGrowthRate)^y

```

Vacancy adjusted:

```

effectiveRent[y] = projectedRent[y] * (1 - vacancyRate)

```

---

## Expense Growth

```

projectedExpenses[y] = currentAnnualExpenses * (1 + expenseGrowthRate)^y

```

---

## Mortgage Calculations

Monthly interest rate:

```

r = annualInterestRate / 12

```

Monthly payment:

```

payment = P * (r * (1 + r)^n) / ((1 + r)^n - 1)

```

Remaining balance:

```

balance = P * (((1 + r)^n - (1 + r)^m) / ((1 + r)^n - 1))

```

For forecasting from today:

Use:

- currentLoanBalance
- remainingTermMonths

---

## Annual Cash Flow

```

annualCashFlow[y] =
effectiveRent[y]

* projectedExpenses[y]
* annualDebtService

```

---

## Cumulative Cash Flow

```

cumulativeCashFlow[y] =
sum(annualCashFlow[1..y])

```

---

## Projected Equity

```

projectedEquity[y] =
projectedPropertyValue[y]

* projectedLoanBalance[y]

```

---

## Equity Gain

```

equityGain[y] =
projectedEquity[y]

* currentEquity

```

---

## Total Gain

```

totalGain[y] =
equityGain[y]

* cumulativeCashFlow[y]

```

---

## ROI %

```

roiPercent[y] =
(totalGain[y] / totalCashInvested) * 100

````

---

# Prisma Schema

## Enums

```prisma
enum InvestmentType {
  STOCK
  REAL_ESTATE
  RETIREMENT
  CASH
  OTHER
}

enum RealEstatePropertyType {
  SINGLE_FAMILY
  MULTI_FAMILY
  CONDO
  COMMERCIAL
  LAND
  OTHER
}

enum RealEstateUsageType {
  PRIMARY_RESIDENCE
  RENTAL
  VACATION_HOME
  MIXED_USE
}

enum ForecastScenario {
  MODERATE
  STANDARD
  AGGRESSIVE
}
````

---

## Real Estate Model

```prisma
model RealEstateInvestment {
  id                       String @id @default(cuid())
  userId                   String

  name                     String

  propertyType             RealEstatePropertyType
  usageType                RealEstateUsageType

  purchasePrice            Decimal?
  purchaseDate             DateTime?

  downPayment              Decimal?
  closingCosts             Decimal?
  rehabCosts               Decimal?

  currentEstimatedValue    Decimal
  currentLoanBalance       Decimal

  interestRate             Decimal?
  loanTermYears            Int?
  remainingTermMonths      Int?
  monthlyMortgagePayment   Decimal?

  monthlyRent              Decimal?
  otherMonthlyIncome       Decimal?
  vacancyRate              Decimal?

  totalMonthlyExpenses     Decimal?

  monthlyPropertyTax       Decimal?
  monthlyInsurance         Decimal?
  monthlyHOA               Decimal?
  monthlyUtilities         Decimal?
  monthlyMaintenance       Decimal?
  monthlyManagement        Decimal?
  monthlyOtherExpenses     Decimal?

  appreciationRate         Decimal?
  expenseGrowthRate        Decimal?

  forecastScenario         ForecastScenario @default(STANDARD)

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}
```

---

# Server Functions

Create a **forecasting service layer**.

### Function

```
calculateRealEstateProjection()
```

Inputs:

```
{
 property,
 scenario,
 years = 5
}
```

Responsibilities:

* normalize input values
* determine rent growth from scenario
* calculate mortgage amortization
* project appreciation
* project expenses
* calculate annual and cumulative cash flow
* compute equity gain
* compute ROI %

Returns:

```
RealEstateProjectionPoint[]
```

---

### Projection Type

```ts
type RealEstateProjectionPoint = {
  year: number
  projectedPropertyValue: number
  projectedLoanBalance: number
  projectedEquity: number
  annualCashFlow: number
  cumulativeCashFlow: number
  totalGain: number
  totalCashInvested: number
  roiPercent: number
}
```

---

# tRPC Procedures

Router: `realEstate`

### Procedures

Create property

```
realEstate.create
```

Update property

```
realEstate.update
```

Delete property

```
realEstate.delete
```

Get properties

```
realEstate.list
```

Get projection

```
realEstate.getProjection
```

---

# Implementation Notes

Important architectural principles:

* Forecast calculations should run **server-side**
* Inputs should be normalized before projection
* UI should support **quick entry** and **advanced modeling**
* Derived values should **not be stored in the database**
* Only raw user input values are persisted

---

# Future Enhancements

Potential future improvements:

* IRR calculation
* Cash-on-cash return
* Sale-adjusted ROI
* Refinance modeling
* Depreciation and tax impact
* Multiple loan structures
* CapEx scheduling
* Unit-level rent modeling
* Property portfolio aggregation
