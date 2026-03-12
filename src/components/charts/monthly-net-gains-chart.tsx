"use client";

import {
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
		forecast: undefined as number | undefined,
	}));

	const forecastData = forecasted.map((f) => ({
		month: f.month,
		label: formatMonthLabel(f.month),
		netGain: undefined as number | undefined,
		forecast: f.value,
	}));

	const chartData = [...historicalData, ...forecastData];

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Monthly Net Gains</CardTitle>
				<ForecastSelector />
			</CardHeader>
			<CardContent>
				<ResponsiveContainer height={280} width="100%">
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
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
