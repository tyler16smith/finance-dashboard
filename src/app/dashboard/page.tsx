"use client";

import { MonthlyNetGainsChart } from "~/components/charts/monthly-net-gains-chart";
import { NetWorthChart } from "~/components/charts/net-worth-chart";
import { SummaryMetricCard } from "~/components/dashboard/summary-metric-card";
import { ForecastProvider } from "~/context/forecast-context";
import { api } from "~/trpc/react";

export default function DashboardPage() {
	const { data: monthlyData, isLoading: monthlyLoading } =
		api.transaction.getMonthlyAggregates.useQuery({ months: 24 });

	const { data: summary, isLoading: summaryLoading } =
		api.transaction.getSummaryMetrics.useQuery();

	const { data: scenarios } = api.scenario.getAll.useQuery();
	const activeScenario = scenarios?.find((s) => s.isActive) ?? null;

	return (
		<ForecastProvider>
			<div className="space-y-6">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Overview</h1>
					<p className="text-muted-foreground text-sm">
						Your financial summary and projections
					</p>
				</div>

				<NetWorthChart
					activeScenario={activeScenario}
					isLoading={monthlyLoading}
					monthlyData={monthlyData ?? []}
				/>

				<MonthlyNetGainsChart
					activeScenario={activeScenario}
					isLoading={monthlyLoading}
					monthlyData={monthlyData ?? []}
				/>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<SummaryMetricCard
						description="Last 12 months average"
						isLoading={summaryLoading}
						title="Avg Net Gain / Month"
						value={summary?.avgNetGain ?? 0}
						variant={(summary?.avgNetGain ?? 0) >= 0 ? "positive" : "negative"}
					/>
					<SummaryMetricCard
						description="Last 12 months average"
						isLoading={summaryLoading}
						title="Avg Income / Month"
						value={summary?.avgIncome ?? 0}
						variant="positive"
					/>
					<SummaryMetricCard
						description="Last 12 months average"
						isLoading={summaryLoading}
						title="Avg Expenses / Month"
						value={summary?.avgExpenses ?? 0}
						variant="negative"
					/>
				</div>
			</div>
		</ForecastProvider>
	);
}
