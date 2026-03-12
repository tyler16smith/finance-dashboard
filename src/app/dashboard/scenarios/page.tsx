"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
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
import { SCENARIO_PRESETS } from "~/lib/forecasting";
import { api } from "~/trpc/react";

const SCENARIO_COLORS: Record<string, string> = {
	CONSERVATIVE: "bg-amber-100 text-amber-800",
	EXPECTED: "bg-blue-100 text-blue-800",
	AGGRESSIVE: "bg-green-100 text-green-800",
	CUSTOM: "bg-purple-100 text-purple-800",
};

export default function ScenariosPage() {
	const utils = api.useUtils();
	const { data: scenarios, isLoading } = api.scenario.getAll.useQuery();
	const seedDefaults = api.scenario.seedDefaults.useMutation({
		onSuccess: () => utils.scenario.getAll.invalidate(),
	});
	const setActive = api.scenario.setActive.useMutation({
		onSuccess: () => {
			toast.success("Scenario updated");
			utils.scenario.getAll.invalidate();
		},
	});
	const deleteScenario = api.scenario.delete.useMutation({
		onSuccess: () => {
			toast.success("Scenario deleted");
			utils.scenario.getAll.invalidate();
		},
	});

	const [addOpen, setAddOpen] = useState(false);
	const [form, setForm] = useState({
		name: "",
		type: "CUSTOM",
		investmentReturn: "7",
		inflationRate: "3",
		salaryGrowth: "3",
		contributionChange: "0",
		expenseGrowth: "3",
	});

	const create = api.scenario.create.useMutation({
		onSuccess: () => {
			toast.success("Scenario created");
			setAddOpen(false);
			utils.scenario.getAll.invalidate();
		},
	});

	function applyPreset(type: keyof typeof SCENARIO_PRESETS) {
		const preset = SCENARIO_PRESETS[type]!;
		setForm((p) => ({
			...p,
			investmentReturn: String((preset.annualReturnRate * 100).toFixed(1)),
			inflationRate: String((preset.inflationRate * 100).toFixed(1)),
			salaryGrowth: String((preset.salaryGrowth * 100).toFixed(1)),
			contributionChange: String((preset.contributionChange * 100).toFixed(1)),
			expenseGrowth: String((preset.expenseGrowth * 100).toFixed(1)),
		}));
	}

	if (!isLoading && (scenarios?.length ?? 0) === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-24">
				<p className="text-muted-foreground">No scenarios yet.</p>
				<Button onClick={() => seedDefaults.mutate()} variant="outline">
					Load default scenarios
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Scenario Modeling
					</h1>
					<p className="text-muted-foreground text-sm">
						Simulate different financial futures and see how they affect your
						projections
					</p>
				</div>
				<Dialog onOpenChange={setAddOpen} open={addOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="mr-1.5 h-4 w-4" /> New scenario
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create scenario</DialogTitle>
						</DialogHeader>
						<div className="space-y-3">
							<div className="space-y-1">
								<Label>Name</Label>
								<Input
									onChange={(e) =>
										setForm((p) => ({ ...p, name: e.target.value }))
									}
									placeholder="My scenario"
									value={form.name}
								/>
							</div>
							<div className="flex gap-2">
								{(["CONSERVATIVE", "EXPECTED", "AGGRESSIVE"] as const).map(
									(t) => (
										<Button
											key={t}
											onClick={() => {
												setForm((p) => ({ ...p, type: t }));
												applyPreset(t);
											}}
											size="sm"
											type="button"
											variant={form.type === t ? "default" : "outline"}
										>
											{t.charAt(0) + t.slice(1).toLowerCase()}
										</Button>
									),
								)}
							</div>
							<Separator />
							{[
								{ key: "investmentReturn", label: "Investment return (%)" },
								{ key: "inflationRate", label: "Inflation rate (%)" },
								{ key: "salaryGrowth", label: "Salary growth (%)" },
								{ key: "contributionChange", label: "Contribution change (%)" },
								{ key: "expenseGrowth", label: "Expense growth (%)" },
							].map((field) => (
								<div className="space-y-1" key={field.key}>
									<Label>{field.label}</Label>
									<Input
										onChange={(e) =>
											setForm((p) => ({ ...p, [field.key]: e.target.value }))
										}
										step="0.1"
										type="number"
										value={form[field.key as keyof typeof form]}
									/>
								</div>
							))}
							<Button
								className="w-full"
								disabled={create.isPending || !form.name}
								onClick={() =>
									create.mutate({
										name: form.name,
										type: form.type as never,
										investmentReturn: Number(form.investmentReturn) / 100,
										inflationRate: Number(form.inflationRate) / 100,
										salaryGrowth: Number(form.salaryGrowth) / 100,
										contributionChange: Number(form.contributionChange) / 100,
										expenseGrowth: Number(form.expenseGrowth) / 100,
									})
								}
							>
								Create scenario
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{isLoading
					? Array.from({ length: 3 }, (_, i) => (
							<Skeleton className="h-48 w-full" key={i} />
						))
					: scenarios?.map((scenario) => (
							<Card
								className={`transition-all ${scenario.isActive ? "ring-2 ring-primary" : ""}`}
								key={scenario.id}
							>
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between">
										<div>
											<CardTitle className="text-base">
												{scenario.name}
											</CardTitle>
											<Badge
												className={`mt-1 text-xs ${SCENARIO_COLORS[scenario.type] ?? ""}`}
												variant="outline"
											>
												{scenario.type}
											</Badge>
										</div>
										<Button
											onClick={() => deleteScenario.mutate({ id: scenario.id })}
											size="icon"
											variant="ghost"
										>
											<Trash2 className="h-3.5 w-3.5 text-destructive" />
										</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-1.5 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Investment return
										</span>
										<span className="font-medium">
											{(scenario.investmentReturn * 100).toFixed(1)}%
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Inflation</span>
										<span className="font-medium">
											{(scenario.inflationRate * 100).toFixed(1)}%
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Salary growth</span>
										<span className="font-medium">
											{(scenario.salaryGrowth * 100).toFixed(1)}%
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Expense growth
										</span>
										<span className="font-medium">
											{(scenario.expenseGrowth * 100).toFixed(1)}%
										</span>
									</div>
									<Separator />
									<Button
										className="w-full"
										onClick={() =>
											setActive.mutate({
												id: scenario.isActive ? null : scenario.id,
											})
										}
										size="sm"
										variant={scenario.isActive ? "default" : "outline"}
									>
										{scenario.isActive
											? "Active — click to deactivate"
											: "Apply to charts"}
									</Button>
								</CardContent>
							</Card>
						))}
			</div>

			<Card className="bg-muted/40">
				<CardHeader>
					<CardTitle className="text-sm">How scenarios work</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					<p>
						Activate a scenario to overlay its projections on all forecast
						charts across the dashboard — including Net Worth, Monthly Net
						Gains, and Investment growth charts. Only one scenario can be active
						at a time.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
