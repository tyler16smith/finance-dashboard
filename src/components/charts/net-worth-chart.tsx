"use client";

import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useForecast } from "~/context/forecast-context";
import {
	buildNetWorthSeries,
	formatCurrency,
	formatMonthLabel,
	type MonthlyDataPoint,
	SCENARIO_PRESETS,
	type ScenarioMultipliers,
} from "~/lib/forecasting";
import { api } from "~/trpc/react";

interface Props {
	monthlyData: MonthlyDataPoint[];
	activeScenario?: Partial<ScenarioMultipliers> | null;
	isLoading?: boolean;
}

export function NetWorthChart({ monthlyData, activeScenario, isLoading }: Props) {
	const { forecastMonths } = useForecast();
	const { data: investments, isLoading: invLoading } = api.investment.getAll.useQuery();
	const { data: realEstateProperties, isLoading: reLoading } = api.realEstate.list.useQuery();

	if (isLoading || invLoading || reLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	const currentInvestmentTotal =
		(investments?.reduce((sum, inv) => sum + inv.startingBalance, 0) ?? 0) +
		(realEstateProperties?.reduce(
			(sum, p) => sum + (p.currentEstimatedValue - p.currentLoanBalance),
			0,
		) ?? 0);

	const baseSeries = buildNetWorthSeries(
		monthlyData,
		currentInvestmentTotal,
		forecastMonths,
		undefined,
	);

	const scenarioSeries = activeScenario
		? buildNetWorthSeries(monthlyData, currentInvestmentTotal, forecastMonths, activeScenario)
		: null;

	const conservativeSeries = buildNetWorthSeries(
		monthlyData,
		currentInvestmentTotal,
		forecastMonths,
		SCENARIO_PRESETS.CONSERVATIVE,
	);

	const aggressiveSeries = buildNetWorthSeries(
		monthlyData,
		currentInvestmentTotal,
		forecastMonths,
		SCENARIO_PRESETS.AGGRESSIVE,
	);

	const allMonths = new Set([
		...baseSeries.map((p) => p.month),
		...(scenarioSeries?.map((p) => p.month) ?? []),
	]);

	const baseMap = new Map(baseSeries.map((p) => [p.month, p]));
	const scenMap = scenarioSeries
		? new Map(scenarioSeries.map((p) => [p.month, p]))
		: null;
	const consMap = new Map(conservativeSeries.map((p) => [p.month, p]));
	const aggMap = new Map(aggressiveSeries.map((p) => [p.month, p]));

	const chartData = Array.from(allMonths)
		.sort()
		.map((month) => {
			const base = baseMap.get(month);
			return {
				month,
				label: formatMonthLabel(month),
				netWorth: base?.isForecast ? undefined : (base?.netWorth ?? 0),
				forecast: base?.isForecast ? (base?.netWorth ?? 0) : undefined,
				conservative: consMap.get(month)?.isForecast
					? consMap.get(month)?.netWorth
					: undefined,
				aggressive: aggMap.get(month)?.isForecast
					? aggMap.get(month)?.netWorth
					: undefined,
				scenario: scenMap?.get(month)?.isForecast
					? scenMap?.get(month)?.netWorth
					: undefined,
			};
		});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Net Worth</CardTitle>
				{currentInvestmentTotal > 0 && (
					<p className="mt-0.5 text-muted-foreground text-xs">
						Includes {formatCurrency(currentInvestmentTotal)} in investments &amp; real estate equity
					</p>
				)}
			</CardHeader>
			<CardContent>
				<ResponsiveContainer height={300} width="100%">
					<LineChart data={chartData}>
						<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
						<XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
						<YAxis
							tick={{ fontSize: 11 }}
							tickFormatter={(v: number) => formatCurrency(v)}
							tickLine={false}
							width={80}
						/>
						<Tooltip
							formatter={(value) => [formatCurrency(Number(value)), ""]}
							labelFormatter={(l) => l}
						/>
						<Legend />
						<Line
							dataKey="netWorth"
							dot={false}
							name="Historical"
							stroke="#3b82f6"
							strokeWidth={2}
							type="monotone"
						/>
						<Line
							dataKey="forecast"
							dot={false}
							name="Forecast"
							stroke="#94a3b8"
							strokeDasharray="5 5"
							strokeWidth={1.5}
							type="monotone"
						/>
						<Line
							dataKey="conservative"
							dot={false}
							name="Conservative"
							stroke="#f59e0b"
							strokeDasharray="3 3"
							strokeOpacity={0.6}
							strokeWidth={1.5}
							type="monotone"
						/>
						<Line
							dataKey="aggressive"
							dot={false}
							name="Aggressive"
							stroke="#10b981"
							strokeDasharray="3 3"
							strokeOpacity={0.6}
							strokeWidth={1.5}
							type="monotone"
						/>
						{scenarioSeries && (
							<Line
								dataKey="scenario"
								dot={false}
								name="Custom Scenario"
								stroke="#8b5cf6"
								strokeDasharray="4 4"
								strokeWidth={1.5}
								type="monotone"
							/>
						)}
					</LineChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
