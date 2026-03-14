"use client";

import { endOfMonth, format } from "date-fns";
import { BarChart2, LineChartIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useForecast } from "~/context/forecast-context";
import {
	forecastNetGains,
	formatCurrency,
	formatMonthLabel,
	type MonthlyDataPoint,
	type ScenarioMultipliers,
} from "~/lib/forecasting";
import { ForecastSelector } from "./forecast-selector";

function monthToDateRange(month: string) {
	const date = new Date(`${month}-01`);
	return {
		from: format(date, "yyyy-MM-dd"),
		to: format(endOfMonth(date), "yyyy-MM-dd"),
	};
}

function LineTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: { name: string; value: number; color: string }[];
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{payload.map((entry) => (
				<div key={entry.name} className="flex items-center gap-2">
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium">{formatCurrency(entry.value)}</span>
				</div>
			))}
			<p className="mt-2 border-t pt-1.5 text-muted-foreground">
				Click to see transactions
			</p>
		</div>
	);
}

function BarTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: { name: string; value: number; color: string }[];
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	// Ensure income is always rendered before expenses
	const sorted = [...payload].sort((a) => (a.name === "Income" ? -1 : 1));
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{sorted.map((entry) => (
				<div key={entry.name} className="flex items-center gap-2">
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium">{formatCurrency(entry.value)}</span>
				</div>
			))}
			<p className="mt-2 border-t pt-1.5 text-muted-foreground">
				Click to see transactions
			</p>
		</div>
	);
}

interface Props {
	monthlyData: MonthlyDataPoint[];
	activeScenario?: Partial<ScenarioMultipliers> | null;
	isLoading?: boolean;
}

export function MonthlyNetGainsChart({
	monthlyData,
	activeScenario,
	isLoading,
}: Props) {
	const { forecastMonths } = useForecast();
	const [chartType, setChartType] = useState<"line" | "bar">("line");
	const router = useRouter();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	const forecasted = forecastNetGains(
		monthlyData,
		forecastMonths,
		activeScenario ?? undefined,
	);

	const historicalData = monthlyData.map((d) => ({
		month: d.month,
		label: formatMonthLabel(d.month),
		netGain: d.netGain,
		income: d.income,
		expenses: d.expenses,
		forecast: undefined as number | undefined,
	}));

	const forecastData = forecasted.map((f) => ({
		month: f.month,
		label: formatMonthLabel(f.month),
		netGain: undefined as number | undefined,
		income: undefined as number | undefined,
		expenses: undefined as number | undefined,
		forecast: f.value,
	}));

	const chartData = [...historicalData, ...forecastData];

	const handleChartClick = (state: unknown) => {
		const data = state as { activeIndex?: string | number } | null;
		const index = data?.activeIndex;
		if (index === undefined || index === null) return;
		const idx = typeof index === "string" ? parseInt(index, 10) : index;
		const item = chartType === "bar" ? historicalData[idx] : chartData[idx];
		const month = item?.month;
		if (!month) return;
		const { from, to } = monthToDateRange(month);
		router.push(`/dashboard/transactions?from=${from}&to=${to}`);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Monthly Net Gains</CardTitle>
				<div className="flex items-center gap-2">
					<Tabs
						value={chartType}
						onValueChange={(v) => setChartType(v as "line" | "bar")}
						className="rounded-[11px] border border-gray-200 dark:border-gray-800"
					>
						<TabsList className="h-8">
							<TabsTrigger value="line" className="px-2.5">
								<LineChartIcon className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="bar" className="px-2.5">
								<BarChart2 className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<ForecastSelector />
				</div>
			</CardHeader>
			<CardContent>
				<div style={{ cursor: "pointer" }}>
					<ResponsiveContainer height={280} width="100%">
						{chartType === "line" ? (
							<LineChart
								data={chartData}
								onClick={handleChartClick}
								className="cursor-pointer"
							>
								<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11 }}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => formatCurrency(v)}
									tickLine={false}
									width={80}
								/>
								<Tooltip content={<LineTooltip />} />
								<Legend />
								<ReferenceLine stroke="#e2e8f0" strokeDasharray="2 2" y={0} />
								<Line
									dataKey="netGain"
									dot={false}
									name="Net Gain"
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
									strokeOpacity={0.7}
									strokeWidth={1.5}
									type="monotone"
								/>
							</LineChart>
						) : (
							<BarChart
								data={historicalData}
								onClick={handleChartClick}
								className="cursor-pointer"
							>
								<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11 }}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => formatCurrency(v)}
									tickLine={false}
									width={80}
								/>
								<Tooltip content={<BarTooltip />} />
								<Legend />
								<ReferenceLine stroke="#e2e8f0" strokeDasharray="2 2" y={0} />
								<Bar
									dataKey="income"
									fill="#10b981"
									name="Income"
									radius={[2, 2, 0, 0]}
								/>
								<Bar
									dataKey="expenses"
									fill="#f43f5e"
									name="Expenses"
									radius={[2, 2, 0, 0]}
								/>
							</BarChart>
						)}
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
