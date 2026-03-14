"use client";

import { Building2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RealEstateRoiChart } from "~/components/charts/real-estate-roi-chart";
import { RealEstateEntryDialog } from "~/components/dashboard/real-estate-entry-dialog";
import type { RealEstateFormValues } from "~/components/dashboard/real-estate-entry-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/forecasting";
import { api } from "~/trpc/react";

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

interface RealEstateData {
  id: string;
  name: string;
  propertyType: PropertyType;
  usageType: UsageType;
  currentEstimatedValue: number;
  currentLoanBalance: number;
  monthlyRent: number | null;
  totalMonthlyExpenses: number | null;
  monthlyMortgagePayment: number | null;
  forecastScenario: ForecastScenario;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SINGLE_FAMILY: "Single Family",
  MULTI_FAMILY: "Multi Family",
  CONDO: "Condo",
  COMMERCIAL: "Commercial",
  LAND: "Land",
  OTHER: "Other",
};

const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  PRIMARY_RESIDENCE: "Primary",
  RENTAL: "Rental",
  VACATION_HOME: "Vacation",
  MIXED_USE: "Mixed Use",
};

interface Props {
  property: RealEstateData;
  onMutated: () => void;
}

export function RealEstateCard({ property, onMutated }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const { data: projection } = api.realEstate.getProjection.useQuery({
    id: property.id,
  });

  const update = api.realEstate.update.useMutation({
    onSuccess: () => {
      toast.success("Property updated");
      setEditOpen(false);
      onMutated();
    },
    onError: () => toast.error("Failed to update property"),
  });

  const remove = api.realEstate.delete.useMutation({
    onSuccess: () => {
      toast.success("Property deleted");
      onMutated();
    },
    onError: () => toast.error("Failed to delete property"),
  });

  const equity = property.currentEstimatedValue - property.currentLoanBalance;
  const monthlyCashFlow =
    (property.monthlyRent ?? 0) -
    (property.totalMonthlyExpenses ?? 0) -
    (property.monthlyMortgagePayment ?? 0);

  function handleEdit(values: RealEstateFormValues) {
    const toNum = (v: string) => (v !== "" ? parseFloat(v) : undefined);
    const toInt = (v: string) => (v !== "" ? parseInt(v, 10) : undefined);

    update.mutate({
      id: property.id,
      name: values.name,
      propertyType: values.propertyType,
      usageType: values.usageType,
      currentEstimatedValue: parseFloat(values.currentEstimatedValue),
      currentLoanBalance: parseFloat(values.currentLoanBalance),
      monthlyRent: values.isRented ? toNum(values.monthlyRent) : undefined,
      totalMonthlyExpenses: toNum(values.totalMonthlyExpenses),
      forecastScenario: values.forecastScenario,
      purchasePrice: toNum(values.purchasePrice),
      purchaseDate: values.purchaseDate ? new Date(values.purchaseDate) : undefined,
      downPayment: toNum(values.downPayment),
      closingCosts: toNum(values.closingCosts),
      rehabCosts: toNum(values.rehabCosts),
      interestRate: toNum(values.interestRate) !== undefined ? toNum(values.interestRate)! / 100 : undefined,
      loanTermYears: toInt(values.loanTermYears),
      remainingTermMonths: toInt(values.remainingTermMonths),
      monthlyMortgagePayment: toNum(values.monthlyMortgagePayment),
      otherMonthlyIncome: toNum(values.otherMonthlyIncome),
      vacancyRate: toNum(values.vacancyRate) !== undefined ? toNum(values.vacancyRate)! / 100 : undefined,
      monthlyPropertyTax: toNum(values.monthlyPropertyTax),
      monthlyInsurance: toNum(values.monthlyInsurance),
      monthlyHOA: toNum(values.monthlyHOA),
      monthlyUtilities: toNum(values.monthlyUtilities),
      monthlyMaintenance: toNum(values.monthlyMaintenance),
      monthlyManagement: toNum(values.monthlyManagement),
      monthlyOtherExpenses: toNum(values.monthlyOtherExpenses),
      appreciationRate: toNum(values.appreciationRate) !== undefined ? toNum(values.appreciationRate)! / 100 : undefined,
      expenseGrowthRate: toNum(values.expenseGrowthRate) !== undefined ? toNum(values.expenseGrowthRate)! / 100 : undefined,
    });
  }

  const roi5yr = projection?.[4]?.roiPercent;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <CardTitle className="text-base truncate">{property.name}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {PROPERTY_TYPE_LABELS[property.propertyType]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {USAGE_TYPE_LABELS[property.usageType]}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button onClick={() => setEditOpen(true)} size="icon" variant="ghost">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => remove.mutate({ id: property.id })}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
            <div>
              <p>Value</p>
              <p className="font-medium text-foreground">
                {formatCurrency(property.currentEstimatedValue)}
              </p>
            </div>
            <div>
              <p>Equity</p>
              <p className="font-medium text-foreground">{formatCurrency(equity)}</p>
            </div>
            <div>
              <p>Mo. Cash Flow</p>
              <p
                className={
                  monthlyCashFlow >= 0
                    ? "font-medium text-green-600"
                    : "font-medium text-red-500"
                }
              >
                {formatCurrency(monthlyCashFlow)}
              </p>
            </div>
          </div>

          {roi5yr !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              5-yr ROI:{" "}
              <span
                className={
                  roi5yr >= 0 ? "font-medium text-green-600" : "font-medium text-red-500"
                }
              >
                {roi5yr.toFixed(1)}%
              </span>
              <span className="ml-1.5 text-muted-foreground/60">
                ({property.forecastScenario.toLowerCase()} scenario)
              </span>
            </p>
          )}
        </CardHeader>

        {projection && projection.length > 0 && (
          <CardContent className="pt-0">
            <RealEstateRoiChart data={projection} />
          </CardContent>
        )}
      </Card>

      <RealEstateEntryDialog
        isPending={update.isPending}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        open={editOpen}
        title="Edit property"
        initialValues={{
          name: property.name,
          propertyType: property.propertyType,
          usageType: property.usageType,
          currentEstimatedValue: String(property.currentEstimatedValue),
          currentLoanBalance: String(property.currentLoanBalance),
          isRented: !!property.monthlyRent,
          monthlyRent: property.monthlyRent ? String(property.monthlyRent) : "",
          totalMonthlyExpenses: property.totalMonthlyExpenses
            ? String(property.totalMonthlyExpenses)
            : "",
          forecastScenario: property.forecastScenario,
        }}
      />
    </>
  );
}
