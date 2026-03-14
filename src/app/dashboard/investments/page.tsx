"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ForecastSelector } from "~/components/charts/forecast-selector";
import { InvestmentCard } from "~/components/dashboard/investment-card";
import { RealEstateCard } from "~/components/dashboard/real-estate-card";
import type { RealEstateFormValues } from "~/components/dashboard/real-estate-entry-dialog";
import { RealEstateFormBody } from "~/components/dashboard/real-estate-entry-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency } from "~/lib/forecasting";
import { api } from "~/trpc/react";

const INVESTMENT_TYPES = [
	{ value: "STOCKS", label: "Stocks" },
	{ value: "REAL_ESTATE", label: "Real Estate" },
	{ value: "ROTH_IRA", label: "Roth IRA" },
	{ value: "FOUR01K", label: "401(k)" },
	{ value: "HSA", label: "HSA" },
] as const;

type InvestmentTypeValue = (typeof INVESTMENT_TYPES)[number]["value"];

const DEFAULT_STANDARD_FORM = {
	name: "",
	startingBalance: "",
	monthlyContribution: "",
	annualReturnRate: "",
};

export default function InvestmentsPage() {
	const utils = api.useUtils();
	const { data: investments, isLoading } = api.investment.getAll.useQuery();
	const { data: realEstateProperties, isLoading: isLoadingRE } =
		api.realEstate.list.useQuery();
	const { data: scenarios } = api.scenario.getAll.useQuery();
	const activeScenario = scenarios?.find((s) => s.isActive);

	const [addOpen, setAddOpen] = useState(false);
	const [selectedType, setSelectedType] = useState<InvestmentTypeValue>("STOCKS");
	const [standardForm, setStandardForm] = useState(DEFAULT_STANDARD_FORM);

	const create = api.investment.create.useMutation({
		onSuccess: async () => {
			toast.success("Investment added");
			setAddOpen(false);
			setStandardForm(DEFAULT_STANDARD_FORM);
			await utils.investment.getAll.invalidate();
		},
	});

	const createRE = api.realEstate.create.useMutation({
		onSuccess: async () => {
			toast.success("Property added");
			setAddOpen(false);
			await utils.realEstate.list.invalidate();
		},
		onError: () => toast.error("Failed to add property"),
	});

	function handleCreateStandard() {
		create.mutate({
			type: selectedType,
			name: standardForm.name,
			startingBalance: Number(standardForm.startingBalance),
			monthlyContribution: Number(standardForm.monthlyContribution),
			annualReturnRate: Number(standardForm.annualReturnRate) / 100,
		});
	}

	function handleCreateRE(values: RealEstateFormValues) {
		const toNum = (v: string) => (v !== "" ? parseFloat(v) : undefined);
		const toInt = (v: string) => (v !== "" ? parseInt(v, 10) : undefined);

		createRE.mutate({
			name: values.name,
			propertyType: values.propertyType,
			usageType: values.usageType,
			currentEstimatedValue: parseFloat(values.currentEstimatedValue),
			currentLoanBalance: parseFloat(values.currentLoanBalance || "0"),
			monthlyRent: values.isRented ? toNum(values.monthlyRent) : undefined,
			totalMonthlyExpenses: toNum(values.totalMonthlyExpenses),
			forecastScenario: values.forecastScenario,
			purchasePrice: toNum(values.purchasePrice),
			purchaseDate: values.purchaseDate ? new Date(values.purchaseDate) : undefined,
			downPayment: toNum(values.downPayment),
			closingCosts: toNum(values.closingCosts),
			rehabCosts: toNum(values.rehabCosts),
			interestRate:
				toNum(values.interestRate) !== undefined
					? toNum(values.interestRate)! / 100
					: undefined,
			loanTermYears: toInt(values.loanTermYears),
			remainingTermMonths: toInt(values.remainingTermMonths),
			monthlyMortgagePayment: toNum(values.monthlyMortgagePayment),
			otherMonthlyIncome: toNum(values.otherMonthlyIncome),
			vacancyRate:
				toNum(values.vacancyRate) !== undefined
					? toNum(values.vacancyRate)! / 100
					: undefined,
			monthlyPropertyTax: toNum(values.monthlyPropertyTax),
			monthlyInsurance: toNum(values.monthlyInsurance),
			monthlyHOA: toNum(values.monthlyHOA),
			monthlyUtilities: toNum(values.monthlyUtilities),
			monthlyMaintenance: toNum(values.monthlyMaintenance),
			monthlyManagement: toNum(values.monthlyManagement),
			monthlyOtherExpenses: toNum(values.monthlyOtherExpenses),
			appreciationRate:
				toNum(values.appreciationRate) !== undefined
					? toNum(values.appreciationRate)! / 100
					: undefined,
			expenseGrowthRate:
				toNum(values.expenseGrowthRate) !== undefined
					? toNum(values.expenseGrowthRate)! / 100
					: undefined,
		});
	}

	function handleOpenChange(open: boolean) {
		setAddOpen(open);
		if (!open) {
			// Reset type selector and standard form when dialog closes
			setSelectedType("STOCKS");
			setStandardForm(DEFAULT_STANDARD_FORM);
		}
	}

	const isRealEstate = selectedType === "REAL_ESTATE";

	const totalBalance =
		investments?.reduce((s, i) => s + i.startingBalance, 0) ?? 0;
	const totalMonthly =
		investments?.reduce((s, i) => s + i.monthlyContribution, 0) ?? 0;
	const totalRealEstateEquity =
		realEstateProperties?.reduce(
			(s, p) => s + (p.currentEstimatedValue - p.currentLoanBalance),
			0,
		) ?? 0;

	return (
		<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">Investments</h1>
						<p className="text-muted-foreground text-sm">
							Track and forecast your investment portfolio
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ForecastSelector />
						<Dialog onOpenChange={handleOpenChange} open={addOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="mr-1.5 h-4 w-4" />
								Add investment
							</Button>
						</DialogTrigger>
						<DialogContent
							className={
								isRealEstate
									? "max-h-[90vh] max-w-xl overflow-y-auto"
									: undefined
							}
						>
							<DialogHeader>
								<DialogTitle>Add investment</DialogTitle>
							</DialogHeader>

							{/* Type selector — always visible */}
							<div className="space-y-1">
								<Label>Type</Label>
								<Select
									onValueChange={(v) => setSelectedType(v as InvestmentTypeValue)}
									value={selectedType}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{INVESTMENT_TYPES.map((t) => (
											<SelectItem key={t.value} value={t.value}>
												{t.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{isRealEstate ? (
								<>
									<Separator />
									{/* key resets RE form state when type switches to RE or dialog reopens */}
									<RealEstateFormBody
										key={String(addOpen)}
										onSubmit={handleCreateRE}
										isPending={createRE.isPending}
										submitLabel="Add real estate"
									/>
								</>
							) : (
								<div className="space-y-3">
									<div className="space-y-1">
										<Label>Name / label</Label>
										<Input
											onChange={(e) =>
												setStandardForm((p) => ({ ...p, name: e.target.value }))
											}
											placeholder="e.g. Vanguard S&P 500"
											value={standardForm.name}
										/>
									</div>
									<div className="space-y-1">
										<Label>Current balance ($)</Label>
										<Input
											onChange={(e) =>
												setStandardForm((p) => ({
													...p,
													startingBalance: e.target.value,
												}))
											}
											placeholder="0"
											type="number"
											value={standardForm.startingBalance}
										/>
									</div>
									<div className="space-y-1">
										<Label>Monthly contribution ($)</Label>
										<Input
											onChange={(e) =>
												setStandardForm((p) => ({
													...p,
													monthlyContribution: e.target.value,
												}))
											}
											placeholder="0"
											type="number"
											value={standardForm.monthlyContribution}
										/>
									</div>
									<div className="space-y-1">
										<Label>Expected annual return (%)</Label>
										<Input
											onChange={(e) =>
												setStandardForm((p) => ({
													...p,
													annualReturnRate: e.target.value,
												}))
											}
											placeholder="7"
											type="number"
											value={standardForm.annualReturnRate}
										/>
									</div>
									<Button
										className="w-full"
										disabled={create.isPending || !standardForm.name}
										onClick={handleCreateStandard}
									>
										Add investment
									</Button>
								</div>
							)}
						</DialogContent>
					</Dialog>
					</div>
				</div>

				{/* Summary */}
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Total Portfolio
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{formatCurrency(totalBalance + totalRealEstateEquity)}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Monthly Contributions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{formatCurrency(totalMonthly)}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Total Investments
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{(investments?.length ?? 0) + (realEstateProperties?.length ?? 0)}</p>
						</CardContent>
					</Card>
				</div>

				{/* By type tabs */}
				<Tabs defaultValue="ALL">
					<TabsList>
						<TabsTrigger value="ALL">All</TabsTrigger>
						{INVESTMENT_TYPES.map((t) => (
							<TabsTrigger key={t.value} value={t.value}>
								{t.label}
							</TabsTrigger>
						))}
					</TabsList>

					{["ALL", ...INVESTMENT_TYPES.map((t) => t.value)].map((tab) => {
						const tabInvestments =
							tab === "ALL"
								? investments
								: investments?.filter((i) => i.type === tab);
						const tabRealEstate =
							tab === "ALL" || tab === "REAL_ESTATE"
								? realEstateProperties
								: [];
						const isEmpty =
							(tabInvestments?.length ?? 0) === 0 &&
							(tabRealEstate?.length ?? 0) === 0;
						const tabLoading =
							isLoading || (tab === "ALL" || tab === "REAL_ESTATE" ? isLoadingRE : false);

						return (
							<TabsContent className="mt-4" key={tab} value={tab}>
								{tabLoading ? (
									<div className="grid gap-4 sm:grid-cols-2">
										<Skeleton className="h-64 w-full" />
										<Skeleton className="h-64 w-full" />
									</div>
								) : isEmpty ? (
									<p className="py-8 text-center text-muted-foreground text-sm">
										No{" "}
										{tab === "ALL"
											? ""
											: INVESTMENT_TYPES.find((t) => t.value === tab)?.label + " "}
										investments yet.
									</p>
								) : (
									<div className="grid gap-4 sm:grid-cols-2">
										{tabInvestments?.map((inv) => (
											<InvestmentCard
												investment={inv}
												key={inv.id}
												onMutated={() => utils.investment.getAll.invalidate()}
												scenarioReturnRate={activeScenario?.investmentReturn}
											/>
										))}
										{tabRealEstate?.map((p) => (
											<RealEstateCard
												key={p.id}
												onMutated={() => utils.realEstate.list.invalidate()}
												property={p}
											/>
										))}
									</div>
								)}
							</TabsContent>
						);
					})}
				</Tabs>
			</div>
	);
}
