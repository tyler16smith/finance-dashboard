"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency } from "~/lib/forecasting";
import { api } from "~/trpc/react";

const PALETTE = [
	"#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899",
	"#06b6d4", "#f97316", "#84cc16", "#ef4444", "#6366f1", "#94a3b8",
];

function getCategoryColor(index: number): string {
	return PALETTE[index % PALETTE.length] ?? "#94a3b8";
}

export default function SpendingPage() {
	const { data: breakdown, isLoading: breakdownLoading } =
		api.spending.getCategoryBreakdown.useQuery({ months: 3 });

	const { data: trends, isLoading: trendsLoading } =
		api.spending.getCategoryTrends.useQuery({ months: 12 });

	const { data: recurring, isLoading: recurringLoading } =
		api.spending.getRecurringExpenses.useQuery();

	const { data: anomalies } = api.spending.getAnomalies.useQuery();

	const trendCategories = Array.from(
		new Set(trends?.flatMap((t) => Object.keys(t).filter((k) => k !== "month")) ?? [])
	);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">
					Spending Intelligence
				</h1>
				<p className="text-muted-foreground text-sm">
					Insights into your spending patterns, recurring charges, and anomalies
				</p>
			</div>

			{/* Anomaly alerts */}
			{(anomalies?.length ?? 0) > 0 && (
				<div className="space-y-2">
					{anomalies?.map((a) => (
						<div
							className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
							key={a.category}
						>
							<span className="text-amber-600">⚠</span>
							<span>
								<strong>{a.category}</strong>{" "}
								spending is unusually high:{" "}
								<strong>{formatCurrency(a.currentAmount)}</strong> vs{" "}
								{formatCurrency(a.averageAmount)} average ({a.ratio.toFixed(1)}×
								normal)
							</span>
						</div>
					))}
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Top categories */}
				<Card>
					<CardHeader>
						<CardTitle>Top Spending Categories</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{breakdownLoading
							? Array.from({ length: 5 }, (_, i) => (
									<Skeleton className="h-8 w-full" key={i} />
								))
							: breakdown?.slice(0, 8).map((cat, index) => (
									<div className="space-y-1" key={cat.category}>
										<div className="flex items-center justify-between text-sm">
											<div className="flex items-center gap-2">
												<span
													className="h-2.5 w-2.5 rounded-full"
													style={{
														backgroundColor: getCategoryColor(index),
													}}
												/>
												<span>{cat.category}</span>
											</div>
											<div className="flex items-center gap-3">
												<span className="text-muted-foreground text-xs">
													{formatCurrency(cat.monthlyAvg)}/mo
												</span>
												<span className="w-12 text-right font-medium">
													{cat.percentage.toFixed(0)}%
												</span>
											</div>
										</div>
										<Progress
											className="h-1.5"
											style={
												{
													"--progress-color": getCategoryColor(index),
												} as React.CSSProperties
											}
											value={(cat.total / (breakdown[0]?.total ?? 1)) * 100}
										/>
									</div>
								))}
					</CardContent>
				</Card>

				{/* Pie chart */}
				<Card>
					<CardHeader>
						<CardTitle>Spending Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						{breakdownLoading ? (
							<Skeleton className="h-64 w-full" />
						) : (
							<Tabs defaultValue="pie">
								<TabsList className="mb-4">
									<TabsTrigger value="pie">Pie</TabsTrigger>
									<TabsTrigger value="bar">Bar</TabsTrigger>
								</TabsList>
								<TabsContent value="pie">
									<ResponsiveContainer height={240} width="100%">
										<PieChart>
											<Pie
												cx="50%"
												cy="50%"
												data={breakdown?.slice(0, 8).map((d) => ({
													name: d.category,
													value: d.total,
												}))}
												dataKey="value"
												label={({
													name,
													percent,
												}: {
													name?: string;
													percent?: number;
												}) =>
													`${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
												}
												labelLine={false}
												outerRadius={90}
											>
												{breakdown?.slice(0, 8).map((d, index) => (
													<Cell
														fill={getCategoryColor(index)}
														key={d.category}
													/>
												))}
											</Pie>
											<Tooltip formatter={(v) => formatCurrency(Number(v))} />
										</PieChart>
									</ResponsiveContainer>
								</TabsContent>
								<TabsContent value="bar">
									<ResponsiveContainer height={240} width="100%">
										<BarChart
											data={breakdown?.slice(0, 8).map((d, index) => ({
												name: d.category,
												total: d.total,
												fill: getCategoryColor(index),
											}))}
										>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis dataKey="name" tick={{ fontSize: 10 }} />
											<YAxis
												tickFormatter={(v: number) => formatCurrency(v)}
												width={72}
											/>
											<Tooltip formatter={(v) => formatCurrency(Number(v))} />
											<Bar dataKey="total" radius={[4, 4, 0, 0]}>
												{breakdown?.slice(0, 8).map((d, index) => (
													<Cell
														fill={getCategoryColor(index)}
														key={d.category}
													/>
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</TabsContent>
							</Tabs>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Category trends */}
			<Card>
				<CardHeader>
					<CardTitle>Category Trends</CardTitle>
				</CardHeader>
				<CardContent>
					{trendsLoading ? (
						<Skeleton className="h-64 w-full" />
					) : (
						<ResponsiveContainer height={280} width="100%">
							<BarChart data={trends}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="month" tick={{ fontSize: 10 }} />
								<YAxis
									tickFormatter={(v: number) => formatCurrency(v)}
									width={72}
								/>
								<Tooltip formatter={(v) => formatCurrency(Number(v))} />
								<Legend />
								{trendCategories.map((cat, index) => (
									<Bar
										dataKey={cat}
										fill={getCategoryColor(index)}
										key={cat}
										name={cat}
										stackId="stack"
									/>
								))}
							</BarChart>
						</ResponsiveContainer>
					)}
				</CardContent>
			</Card>

			{/* Recurring expenses */}
			<Card>
				<CardHeader>
					<CardTitle>Recurring Expenses</CardTitle>
				</CardHeader>
				<CardContent>
					{recurringLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 4 }, (_, i) => (
								<Skeleton className="h-8 w-full" key={i} />
							))}
						</div>
					) : (recurring?.length ?? 0) === 0 ? (
						<p className="py-4 text-center text-muted-foreground text-sm">
							No recurring expenses detected yet.
						</p>
					) : (
						<div className="divide-y">
							{recurring?.map((r) => (
								<div
									className="flex items-center justify-between py-3"
									key={r.description}
								>
									<div>
										<p className="font-medium text-sm capitalize">
											{r.description}
										</p>
										<p className="text-muted-foreground text-xs">
											{r.occurrences} months detected
										</p>
									</div>
									<Badge variant="secondary">
										{formatCurrency(r.monthlyAmount)}/mo
									</Badge>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
