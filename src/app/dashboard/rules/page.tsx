"use client";

import { GripVertical, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { RuleBuilderDialog } from "./rule-builder-dialog";
import { HistoricalApplyDialog } from "./historical-apply-dialog";

const FIELD_LABELS: Record<string, string> = {
	MERCHANT: "Merchant", DESCRIPTION: "Description", AMOUNT: "Amount",
	CATEGORY: "Category", DATE: "Date", ACCOUNT: "Account", NOTES: "Notes",
};
const OPERATOR_LABELS: Record<string, string> = {
	CONTAINS: "contains", NOT_CONTAINS: "does not contain", STARTS_WITH: "starts with",
	ENDS_WITH: "ends with", EQUALS: "equals", NOT_EQUALS: "does not equal",
	GREATER_THAN: ">", GREATER_THAN_OR_EQUAL: "≥", LESS_THAN: "<",
	LESS_THAN_OR_EQUAL: "≤", IS_EMPTY: "is empty", IS_NOT_EMPTY: "is not empty",
	BEFORE: "before", AFTER: "after", ON: "on", BETWEEN: "between",
};
const ACTION_LABELS: Record<string, string> = {
	SET_CATEGORY: "Set category", SET_DESCRIPTION: "Set description",
	SET_TYPE: "Set type", ADD_HASHTAG: "Add hashtag",
};

type Condition = {
	field: string; operator: string; valueText: string | null; valueNumber: number | null;
};
type RuleAction = {
	type: string; valueText: string | null; hashtagId: string | null;
	hashtag: { id: string; name: string } | null;
};
type Rule = {
	id: string; name: string; isActive: boolean; priority: number;
	conditions: Condition[];
	actions: RuleAction[];
};

function RuleSummary({ rule }: { rule: Rule }) {
	const conditions = rule.conditions
		.map((c: Condition) => {
			const field = FIELD_LABELS[c.field] ?? c.field;
			const op = OPERATOR_LABELS[c.operator] ?? c.operator;
			const val = c.valueText ?? c.valueNumber ?? "";
			return `${field} ${op} "${val}"`;
		})
		.join(" AND ");

	const actions = rule.actions
		.map((a: RuleAction) => {
			const type = ACTION_LABELS[a.type] ?? a.type;
			const val = a.hashtag?.name ? `#${a.hashtag.name}` : (a.valueText ?? "");
			return `${type} → ${val}`;
		})
		.join(", ");

	return (
		<div className="text-xs text-muted-foreground space-y-0.5 mt-1">
			<div><span className="font-medium text-foreground/70">IF </span>{conditions || "—"}</div>
			<div><span className="font-medium text-foreground/70">THEN </span>{actions || "—"}</div>
		</div>
	);
}

export default function RulesPage() {
	const utils = api.useUtils();
	const { data: rules, isLoading } = api.rule.list.useQuery();

	const [builderOpen, setBuilderOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<Rule | null>(null);
	const [historyRule, setHistoryRule] = useState<Rule | null>(null);

	const toggleActive = api.rule.toggleActive.useMutation({
		onSuccess: () => void utils.rule.list.invalidate(),
		onError: () => toast.error("Failed to update rule"),
	});

	const deleteRule = api.rule.delete.useMutation({
		onSuccess: () => {
			void utils.rule.list.invalidate();
			toast.success("Rule deleted");
		},
		onError: () => toast.error("Failed to delete rule"),
	});

	const reorder = api.rule.reorder.useMutation({
		onError: () => toast.error("Failed to reorder rules"),
	});

	function handleMoveUp(index: number) {
		if (!rules || index === 0) return;
		const ids = rules.map((r) => r.id);
		[ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
		reorder.mutate({ orderedIds: ids });
		void utils.rule.list.invalidate();
	}

	function handleMoveDown(index: number) {
		if (!rules || index === rules.length - 1) return;
		const ids = rules.map((r) => r.id);
		[ids[index + 1], ids[index]] = [ids[index]!, ids[index + 1]!];
		reorder.mutate({ orderedIds: ids });
		void utils.rule.list.invalidate();
	}

	function openCreate() {
		setEditingRule(null);
		setBuilderOpen(true);
	}

	function openEdit(rule: Rule) {
		setEditingRule(rule);
		setBuilderOpen(true);
	}

	function handleBuilderSaved(rule: Rule) {
		setBuilderOpen(false);
		setHistoryRule(rule);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Rules</h1>
					<p className="text-muted-foreground text-sm">
						Automate category, description, and hashtag assignment on import
					</p>
				</div>
				<Button onClick={openCreate} size="sm" className="gap-1.5">
					<Plus className="h-4 w-4" /> New rule
				</Button>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }, (_, i) => (
						<Skeleton key={i} className="h-24 w-full rounded-lg" />
					))}
				</div>
			) : (rules?.length ?? 0) === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-16 text-center">
						<Zap className="h-10 w-10 text-muted-foreground/40" />
						<div>
							<p className="font-medium text-sm">No rules yet</p>
							<p className="text-muted-foreground text-xs mt-1">
								Rules automatically classify and enrich transactions on import
							</p>
						</div>
						<Button onClick={openCreate} size="sm" variant="outline" className="gap-1.5 mt-1">
							<Plus className="h-4 w-4" /> Create your first rule
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-2">
					{rules?.map((rule, index) => (
						<Card
							key={rule.id}
							className={[
								"transition-opacity",
								rule.isActive ? "" : "opacity-50",
							].join(" ")}
						>
							<CardContent className="flex items-start gap-3 py-3 px-4">
								{/* Reorder controls */}
								<div className="flex flex-col gap-0.5 pt-0.5">
									<button
										onClick={() => handleMoveUp(index)}
										disabled={index === 0}
										className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
										aria-label="Move up"
									>
										<GripVertical className="h-4 w-4" />
									</button>
								</div>

								{/* Priority badge */}
								<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
									{index + 1}
								</span>

								{/* Rule content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">{rule.name}</span>
										{!rule.isActive && (
											<Badge variant="secondary" className="text-xs py-0">
												Inactive
											</Badge>
										)}
									</div>
									<RuleSummary rule={rule} />
								</div>

								{/* Actions */}
								<div className="flex items-center gap-1 shrink-0">
									<Button
										size="sm"
										variant="ghost"
										className="h-7 text-xs text-muted-foreground"
										onClick={() =>
											toggleActive.mutate({ id: rule.id, isActive: !rule.isActive })
										}
									>
										{rule.isActive ? "Disable" : "Enable"}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 w-7 p-0"
										onClick={() => openEdit(rule)}
										aria-label="Edit rule"
									>
										<Pencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 w-7 p-0 text-destructive hover:text-destructive"
										onClick={() => {
											if (confirm(`Delete rule "${rule.name}"?`)) {
												deleteRule.mutate({ id: rule.id });
											}
										}}
										aria-label="Delete rule"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<RuleBuilderDialog
				open={builderOpen}
				onOpenChange={setBuilderOpen}
				editingRule={editingRule}
				onSaved={handleBuilderSaved}
			/>

			{historyRule && (
				<HistoricalApplyDialog
					rule={historyRule}
					open={!!historyRule}
					onOpenChange={(open) => { if (!open) setHistoryRule(null); }}
				/>
			)}
		</div>
	);
}
