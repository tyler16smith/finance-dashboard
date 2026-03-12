"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { InvestmentGrowthChart } from "~/components/charts/investment-growth-chart";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatCurrency } from "~/lib/forecasting";
import { api } from "~/trpc/react";

interface InvestmentData {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
}

interface Props {
	investment: InvestmentData;
	scenarioReturnRate?: number;
	onMutated: () => void;
}

export function InvestmentCard({
	investment,
	scenarioReturnRate,
	onMutated,
}: Props) {
	const [editOpen, setEditOpen] = useState(false);
	const [form, setForm] = useState({
		name: investment.name,
		startingBalance: String(investment.startingBalance),
		monthlyContribution: String(investment.monthlyContribution),
		annualReturnRate: String((investment.annualReturnRate * 100).toFixed(1)),
	});

	const update = api.investment.update.useMutation({
		onSuccess: () => {
			toast.success("Investment updated");
			setEditOpen(false);
			onMutated();
		},
	});
	const remove = api.investment.delete.useMutation({
		onSuccess: () => {
			toast.success("Investment deleted");
			onMutated();
		},
	});

	function handleSave() {
		update.mutate({
			id: investment.id,
			name: form.name,
			startingBalance: Number(form.startingBalance),
			monthlyContribution: Number(form.monthlyContribution),
			annualReturnRate: Number(form.annualReturnRate) / 100,
		});
	}

	return (
		<>
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="text-base">{investment.name}</CardTitle>
							<div className="mt-1 flex gap-2 text-muted-foreground text-xs">
								<span>
									Balance: {formatCurrency(investment.startingBalance)}
								</span>
								<span>·</span>
								<span>
									+{formatCurrency(investment.monthlyContribution)}/mo
								</span>
								<span>·</span>
								<span>
									{(investment.annualReturnRate * 100).toFixed(1)}% return
								</span>
							</div>
						</div>
						<div className="flex gap-1">
							<Button
								onClick={() => setEditOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							<Button
								onClick={() => remove.mutate({ id: investment.id })}
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-3.5 w-3.5 text-destructive" />
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<InvestmentGrowthChart
						annualReturnRate={investment.annualReturnRate}
						monthlyContribution={investment.monthlyContribution}
						scenarioReturnRate={scenarioReturnRate}
						startingBalance={investment.startingBalance}
					/>
				</CardContent>
			</Card>

			<Dialog onOpenChange={setEditOpen} open={editOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit investment</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-1">
							<Label>Name</Label>
							<Input
								onChange={(e) =>
									setForm((p) => ({ ...p, name: e.target.value }))
								}
								value={form.name}
							/>
						</div>
						<div className="space-y-1">
							<Label>Starting balance ($)</Label>
							<Input
								onChange={(e) =>
									setForm((p) => ({ ...p, startingBalance: e.target.value }))
								}
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
								type="number"
								value={form.monthlyContribution}
							/>
						</div>
						<div className="space-y-1">
							<Label>Annual return (%)</Label>
							<Input
								onChange={(e) =>
									setForm((p) => ({ ...p, annualReturnRate: e.target.value }))
								}
								type="number"
								value={form.annualReturnRate}
							/>
						</div>
						<Button
							className="w-full"
							disabled={update.isPending}
							onClick={handleSave}
						>
							Save
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
