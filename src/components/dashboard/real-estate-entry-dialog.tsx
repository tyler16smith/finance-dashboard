"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { formatCurrency } from "~/lib/forecasting";
import { calculateRealEstateProjection } from "~/lib/real-estate-forecasting";

type PropertyType =
  | "SINGLE_FAMILY"
  | "MULTI_FAMILY"
  | "CONDO"
  | "COMMERCIAL"
  | "LAND"
  | "OTHER";

type UsageType =
  | "PRIMARY_RESIDENCE"
  | "RENTAL"
  | "VACATION_HOME"
  | "MIXED_USE";

type ForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

export interface RealEstateFormValues {
  name: string;
  propertyType: PropertyType;
  usageType: UsageType;
  currentEstimatedValue: string;
  currentLoanBalance: string;
  isRented: boolean;
  monthlyRent: string;
  totalMonthlyExpenses: string;
  forecastScenario: ForecastScenario;
  // Advanced — Mortgage
  purchasePrice: string;
  purchaseDate: string;
  downPayment: string;
  closingCosts: string;
  rehabCosts: string;
  interestRate: string;
  loanTermYears: string;
  remainingTermMonths: string;
  monthlyMortgagePayment: string;
  // Advanced — Income
  otherMonthlyIncome: string;
  vacancyRate: string;
  // Advanced — Expenses
  monthlyPropertyTax: string;
  monthlyInsurance: string;
  monthlyHOA: string;
  monthlyUtilities: string;
  monthlyMaintenance: string;
  monthlyManagement: string;
  monthlyOtherExpenses: string;
  // Advanced — Forecast
  appreciationRate: string;
  expenseGrowthRate: string;
}

export const DEFAULT_RE_FORM: RealEstateFormValues = {
  name: "",
  propertyType: "SINGLE_FAMILY",
  usageType: "PRIMARY_RESIDENCE",
  currentEstimatedValue: "",
  currentLoanBalance: "",
  isRented: false,
  monthlyRent: "",
  totalMonthlyExpenses: "",
  forecastScenario: "STANDARD",
  purchasePrice: "",
  purchaseDate: "",
  downPayment: "",
  closingCosts: "",
  rehabCosts: "",
  interestRate: "",
  loanTermYears: "",
  remainingTermMonths: "",
  monthlyMortgagePayment: "",
  otherMonthlyIncome: "",
  vacancyRate: "",
  monthlyPropertyTax: "",
  monthlyInsurance: "",
  monthlyHOA: "",
  monthlyUtilities: "",
  monthlyMaintenance: "",
  monthlyManagement: "",
  monthlyOtherExpenses: "",
  appreciationRate: "",
  expenseGrowthRate: "",
};

function n(v: string): number | undefined {
  const parsed = parseFloat(v);
  return isNaN(parsed) ? undefined : parsed;
}

// ─── RealEstateFormBody ───────────────────────────────────────────────────────
// Self-contained form with its own state. No Dialog chrome.
// Use a `key` prop on the parent to reset when needed (e.g. key={String(open)}).

interface FormBodyProps {
  onSubmit: (values: RealEstateFormValues) => void;
  isPending?: boolean;
  initialValues?: Partial<RealEstateFormValues>;
  submitLabel?: string;
}

export function RealEstateFormBody({
  onSubmit,
  isPending,
  initialValues,
  submitLabel = "Add real estate",
}: FormBodyProps) {
  const [form, setForm] = useState<RealEstateFormValues>({
    ...DEFAULT_RE_FORM,
    ...initialValues,
  });

  function set<K extends keyof RealEstateFormValues>(
    key: K,
    value: RealEstateFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-calc loan balance from purchase price + down payment if not yet set
  useEffect(() => {
    const pp = n(form.purchasePrice);
    const dp = n(form.downPayment);
    if (pp !== undefined && dp !== undefined && !form.currentLoanBalance) {
      set("currentLoanBalance", String(Math.max(0, pp - dp)));
    }
  }, [form.purchasePrice, form.downPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    const value = n(form.currentEstimatedValue) ?? 0;
    const loan = n(form.currentLoanBalance) ?? 0;
    const equity = value - loan;

    const rent = form.isRented ? (n(form.monthlyRent) ?? 0) : 0;
    const expenses = n(form.totalMonthlyExpenses) ?? 0;
    const mortgage = n(form.monthlyMortgagePayment) ?? 0;
    const monthlyCashFlow = rent - expenses - mortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    const projection =
      value > 0
        ? calculateRealEstateProjection(
            {
              currentEstimatedValue: value,
              currentLoanBalance: loan,
              monthlyRent: rent,
              totalMonthlyExpenses: expenses,
              monthlyMortgagePayment: mortgage || undefined,
              interestRate:
                n(form.interestRate) !== undefined
                  ? n(form.interestRate)! / 100
                  : undefined,
              remainingTermMonths: n(form.remainingTermMonths),
            },
            form.forecastScenario,
            5,
          )
        : [];

    return { equity, monthlyCashFlow, annualCashFlow, roi5yr: projection[4]?.roiPercent ?? null };
  }, [
    form.currentEstimatedValue,
    form.currentLoanBalance,
    form.isRented,
    form.monthlyRent,
    form.totalMonthlyExpenses,
    form.monthlyMortgagePayment,
    form.forecastScenario,
    form.interestRate,
    form.remainingTermMonths,
  ]);

  const canSubmit =
    form.name.trim().length > 0 && (n(form.currentEstimatedValue) ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* ── Property Snapshot ── */}
      <section className="space-y-3">
        <p className="font-medium text-sm">Property Snapshot</p>

        <div className="space-y-1">
          <Label>Property Name</Label>
          <Input
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. 123 Main St"
            value={form.name}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Property Type</Label>
            <Select
              onValueChange={(v) => set("propertyType", v as PropertyType)}
              value={form.propertyType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE_FAMILY">Single Family</SelectItem>
                <SelectItem value="MULTI_FAMILY">Multi Family</SelectItem>
                <SelectItem value="CONDO">Condo / Townhome</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="LAND">Land</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Usage Type</Label>
            <Select
              onValueChange={(v) => set("usageType", v as UsageType)}
              value={form.usageType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIMARY_RESIDENCE">Primary Residence</SelectItem>
                <SelectItem value="RENTAL">Rental Property</SelectItem>
                <SelectItem value="VACATION_HOME">Vacation Home</SelectItem>
                <SelectItem value="MIXED_USE">Mixed Use</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Current Estimated Value ($)</Label>
            <Input
              onChange={(e) => set("currentEstimatedValue", e.target.value)}
              placeholder="400000"
              type="number"
              value={form.currentEstimatedValue}
            />
          </div>
          <div className="space-y-1">
            <Label>Current Loan Balance ($)</Label>
            <Input
              onChange={(e) => set("currentLoanBalance", e.target.value)}
              placeholder="300000"
              type="number"
              value={form.currentLoanBalance}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Income & Costs ── */}
      <section className="space-y-3">
        <p className="font-medium text-sm">Income & Costs</p>

        <div className="flex items-center gap-2">
          <Switch
            checked={form.isRented}
            id="is-rented"
            onCheckedChange={(v) => set("isRented", v)}
          />
          <Label htmlFor="is-rented">This property is rented</Label>
        </div>

        {form.isRented && (
          <div className="space-y-1">
            <Label>Monthly Rent ($)</Label>
            <Input
              onChange={(e) => set("monthlyRent", e.target.value)}
              placeholder="2000"
              type="number"
              value={form.monthlyRent}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label>Total Monthly Expenses ($)</Label>
          <p className="text-muted-foreground text-xs">
            Quick estimate — overridden by itemized expenses below
          </p>
          <Input
            onChange={(e) => set("totalMonthlyExpenses", e.target.value)}
            placeholder="1500"
            type="number"
            value={form.totalMonthlyExpenses}
          />
        </div>
      </section>

      <Separator />

      {/* ── Forecast Scenario ── */}
      <section className="space-y-3">
        <p className="font-medium text-sm">Forecast Scenario</p>
        <div className="space-y-1">
          <Label>Scenario</Label>
          <Select
            onValueChange={(v) => set("forecastScenario", v as ForecastScenario)}
            value={form.forecastScenario}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MODERATE">Moderate (2% rent growth)</SelectItem>
              <SelectItem value="STANDARD">Standard (4% rent growth)</SelectItem>
              <SelectItem value="AGGRESSIVE">Aggressive (6% rent growth)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* ── Live Summary Preview ── */}
      <Card className="bg-muted/40">
        <CardContent className="pb-3 pt-4">
          <p className="mb-3 font-medium text-sm">Preview</p>
          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">Current Equity</span>
            <span className="font-medium">{formatCurrency(preview.equity)}</span>

            <span className="text-muted-foreground">Monthly Cash Flow</span>
            <span
              className={
                preview.monthlyCashFlow >= 0
                  ? "font-medium text-green-600"
                  : "font-medium text-red-500"
              }
            >
              {formatCurrency(preview.monthlyCashFlow)}
            </span>

            <span className="text-muted-foreground">Annual Cash Flow</span>
            <span
              className={
                preview.annualCashFlow >= 0
                  ? "font-medium text-green-600"
                  : "font-medium text-red-500"
              }
            >
              {formatCurrency(preview.annualCashFlow)}
            </span>

            <span className="text-muted-foreground">5-Year ROI Preview</span>
            <span className="font-medium">
              {preview.roi5yr !== null ? `${preview.roi5yr.toFixed(1)}%` : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Advanced Details ── */}
      <div>
        <p className="mb-2 font-medium text-muted-foreground text-sm">
          Add more details for a more accurate forecast
        </p>
        <Accordion collapsible type="single">
          <AccordionItem value="mortgage">
            <AccordionTrigger className="text-sm">Mortgage Details</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Purchase Price ($)</Label>
                  <Input
                    onChange={(e) => set("purchasePrice", e.target.value)}
                    placeholder="380000"
                    type="number"
                    value={form.purchasePrice}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Purchase Date</Label>
                  <Input
                    onChange={(e) => set("purchaseDate", e.target.value)}
                    type="date"
                    value={form.purchaseDate}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Down Payment ($)</Label>
                  <Input
                    onChange={(e) => set("downPayment", e.target.value)}
                    placeholder="80000"
                    type="number"
                    value={form.downPayment}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Closing Costs ($)</Label>
                  <Input
                    onChange={(e) => set("closingCosts", e.target.value)}
                    placeholder="5000"
                    type="number"
                    value={form.closingCosts}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Initial Rehab / Improvements ($)</Label>
                  <Input
                    onChange={(e) => set("rehabCosts", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.rehabCosts}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    onChange={(e) => set("interestRate", e.target.value)}
                    placeholder="6.5"
                    type="number"
                    value={form.interestRate}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Loan Term (Years)</Label>
                  <Input
                    onChange={(e) => set("loanTermYears", e.target.value)}
                    placeholder="30"
                    type="number"
                    value={form.loanTermYears}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Remaining Term (Months)</Label>
                  <Input
                    onChange={(e) => set("remainingTermMonths", e.target.value)}
                    placeholder="300"
                    type="number"
                    value={form.remainingTermMonths}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Monthly Mortgage Payment ($)</Label>
                  <p className="text-muted-foreground text-xs">
                    Leave blank to auto-calculate from rate & term
                  </p>
                  <Input
                    onChange={(e) => set("monthlyMortgagePayment", e.target.value)}
                    placeholder="1900"
                    type="number"
                    value={form.monthlyMortgagePayment}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="income">
            <AccordionTrigger className="text-sm">Income Details</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monthly Rent ($)</Label>
                  <Input
                    onChange={(e) => set("monthlyRent", e.target.value)}
                    placeholder="2000"
                    type="number"
                    value={form.monthlyRent}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Other Monthly Income ($)</Label>
                  <Input
                    onChange={(e) => set("otherMonthlyIncome", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.otherMonthlyIncome}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vacancy Rate (%)</Label>
                  <Input
                    onChange={(e) => set("vacancyRate", e.target.value)}
                    placeholder="5"
                    type="number"
                    value={form.vacancyRate}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="expenses">
            <AccordionTrigger className="text-sm">Expense Breakdown</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <p className="text-muted-foreground text-xs">
                Itemized expenses override Total Monthly Expenses above.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Property Tax ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyPropertyTax", e.target.value)}
                    placeholder="400"
                    type="number"
                    value={form.monthlyPropertyTax}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Insurance ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyInsurance", e.target.value)}
                    placeholder="120"
                    type="number"
                    value={form.monthlyInsurance}
                  />
                </div>
                <div className="space-y-1">
                  <Label>HOA ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyHOA", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.monthlyHOA}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Utilities ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyUtilities", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.monthlyUtilities}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Maintenance ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyMaintenance", e.target.value)}
                    placeholder="200"
                    type="number"
                    value={form.monthlyMaintenance}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Property Mgmt ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyManagement", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.monthlyManagement}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Other Expenses ($/mo)</Label>
                  <Input
                    onChange={(e) => set("monthlyOtherExpenses", e.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.monthlyOtherExpenses}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="forecast">
            <AccordionTrigger className="text-sm">Forecast Assumptions</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Annual Appreciation Rate (%)</Label>
                  <p className="text-muted-foreground text-xs">Default: 3%</p>
                  <Input
                    onChange={(e) => set("appreciationRate", e.target.value)}
                    placeholder="3"
                    type="number"
                    value={form.appreciationRate}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Annual Expense Growth Rate (%)</Label>
                  <p className="text-muted-foreground text-xs">Default: 2%</p>
                  <Input
                    onChange={(e) => set("expenseGrowthRate", e.target.value)}
                    placeholder="2"
                    type="number"
                    value={form.expenseGrowthRate}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Button
        className="w-full"
        disabled={isPending ?? !canSubmit}
        onClick={() => onSubmit(form)}
      >
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

// ─── RealEstateEntryDialog ────────────────────────────────────────────────────
// Thin Dialog wrapper around RealEstateFormBody. Used by the edit flow.

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RealEstateFormValues) => void;
  isPending?: boolean;
  initialValues?: Partial<RealEstateFormValues>;
  title?: string;
}

export function RealEstateEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialValues,
  title = "Edit property",
}: DialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* key resets form state whenever the dialog opens/closes */}
        <RealEstateFormBody
          initialValues={initialValues}
          isPending={isPending}
          key={String(open)}
          onSubmit={onSubmit}
          submitLabel={title}
        />
      </DialogContent>
    </Dialog>
  );
}
