"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { InvestmentCard } from "~/components/dashboard/investment-card";
import { Badge } from "~/components/ui/badge";
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
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ForecastProvider } from "~/context/forecast-context";
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

export default function InvestmentsPage() {
	const utils = api.useUtils();
	const { data: investments, isLoading } = api.investment.getAll.useQuery();
	const { data: scenarios } = api.scenario.getAll.useQuery();
	const activeScenario = scenarios?.find((s) => s.isActive);

	const [addOpen, setAddOpen] = useState(false);
	const [form, setForm] = useState({
		type: "STOCKS" as InvestmentTypeValue,
		name: "",
		startingBalance: "",
		monthlyContribution: "",
		annualReturnRate: "",
	});

	const create = api.investment.create.useMutation({
		onSuccess: async () => {
			toast.success("Investment added");
			setAddOpen(false);
			setForm({
				type: "STOCKS",
				name: "",
				startingBalance: "",
				monthlyContribution: "",
				annualReturnRate: "",
			});
			await utils.investment.getAll.invalidate();
		},
	});

	function handleCreate() {
		create.mutate({
			type: form.type,
			name: form.name,
			startingBalance: Number(form.startingBalance),
			monthlyContribution: Number(form.monthlyContribution),
			annualReturnRate: Number(form.annualReturnRate) / 100,
		});
	}

	const totalBalance =
		investments?.reduce((s, i) => s + i.startingBalance, 0) ?? 0;
	const totalMonthly =
		investments?.reduce((s, i) => s + i.monthlyContribution, 0) ?? 0;

	return (
		<ForecastProvider>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">Investments</h1>
						<p className="text-muted-foreground text-sm">
							Track and forecast your investment portfolio
						</p>
					</div>
					<Dialog onOpenChange={setAddOpen} open={addOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="mr-1.5 h-4 w-4" />
								Add investment
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add investment</DialogTitle>
							</DialogHeader>
							<div className="space-y-3">
								<div className="space-y-1">
									<Label>Type</Label>
									<Select
										onValueChange={(v) =>
											setForm((p) => ({ ...p, type: v as InvestmentTypeValue }))
										}
										value={form.type}
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
								<div className="space-y-1">
									<Label>Name / label</Label>
									<Input
										onChange={(e) =>
											setForm((p) => ({ ...p, name: e.target.value }))
										}
										placeholder="e.g. Vanguard S&P 500"
										value={form.name}
									/>
								</div>
								<div className="space-y-1">
									<Label>Current balance ($)</Label>
									<Input
										onChange={(e) =>
											setForm((p) => ({
												...p,
												startingBalance: e.target.value,
											}))
										}
										placeholder="0"
										type="number"
										value={form.startingBalance}
									/>
								</div>
								<div className="space-y-1">
									<Label>Monthly contribution ($)</Label>
									<Input
										onChange={(e) =>
											setForm((p) => ({
												...p,
												monthlyContribution: e.target.value,
											}))
										}
										placeholder="0"
										type="number"
										value={form.monthlyContribution}
									/>
								</div>
								<div className="space-y-1">
									<Label>Expected annual return (%)</Label>
									<Input
										onChange={(e) =>
											setForm((p) => ({
												...p,
												annualReturnRate: e.target.value,
											}))
										}
										placeholder="7"
										type="number"
										value={form.annualReturnRate}
									/>
								</div>
								<Button
									className="w-full"
									disabled={create.isPending || !form.name}
									onClick={handleCreate}
								>
									Add investment
								</Button>
							</div>
						</DialogContent>
					</Dialog>
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
							<p className="font-bold text-2xl">
								{formatCurrency(totalBalance)}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Monthly Contributions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{formatCurrency(totalMonthly)}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Total Investments
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{investments?.length ?? 0}</p>
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

					{["ALL", ...INVESTMENT_TYPES.map((t) => t.value)].map((tab) => (
						<TabsContent className="mt-4" key={tab} value={tab}>
							{isLoading ? (
								<div className="grid gap-4 sm:grid-cols-2">
									<Skeleton className="h-64 w-full" />
									<Skeleton className="h-64 w-full" />
								</div>
							) : (
								<div className="grid gap-4 sm:grid-cols-2">
									{(tab === "ALL"
										? investments
										: investments?.filter((i) => i.type === tab)
									)?.map((inv) => (
										<InvestmentCard
											investment={inv}
											key={inv.id}
											onMutated={() => utils.investment.getAll.invalidate()}
											scenarioReturnRate={activeScenario?.investmentReturn}
										/>
									))}
									{((tab === "ALL"
										? investments
										: investments?.filter((i) => i.type === tab)
									)?.length ?? 0) === 0 && (
										<p className="col-span-2 py-8 text-center text-muted-foreground text-sm">
											No{" "}
											{tab === "ALL"
												? ""
												: INVESTMENT_TYPES.find((t) => t.value === tab)?.label +
													" "}
											investments yet.
										</p>
									)}
								</div>
							)}
						</TabsContent>
					))}
				</Tabs>
			</div>
		</ForecastProvider>
	);
}
