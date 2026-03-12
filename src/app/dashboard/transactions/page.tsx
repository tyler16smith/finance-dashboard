"use client";

import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { formatCurrency } from "~/lib/forecasting";
import { api } from "~/trpc/react";

const formatAmount = (value: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);

type TxClassification = "INCOME" | "EXPENSE" | "SKIP";
type TypeFilter = "ALL" | "INCOME" | "EXPENSE";
type SortKey =
	| "date-desc"
	| "date-asc"
	| "amount-desc"
	| "amount-asc"
	| "account-asc"
	| "account-desc";

const SORT_LABELS: Record<SortKey, string> = {
	"date-desc": "Date (newest)",
	"date-asc": "Date (oldest)",
	"amount-desc": "Amount (high → low)",
	"amount-asc": "Amount (low → high)",
	"account-asc": "Account (A → Z)",
	"account-desc": "Account (Z → A)",
};

const CLASSIFICATION_LABELS: Record<TxClassification, string> = {
	INCOME: "✅ Income",
	EXPENSE: "💸 Expense",
	SKIP: "🚫 Skip",
};

export default function TransactionsPage() {
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
	const [sortKey, setSortKey] = useState<SortKey>("date-desc");
	const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkPending, setBulkPending] = useState(false);

	const utils = api.useUtils();

	const { data: transactions, isLoading } = api.transaction.getAll.useQuery({
		type: typeFilter === "ALL" ? undefined : typeFilter,
		search: search || undefined,
		limit: 5000,
	});

	const updateType = api.transaction.updateType.useMutation({
		onSuccess: () => {
			void utils.transaction.getAll.invalidate();
			void utils.transaction.getSummaryMetrics.invalidate();
			void utils.transaction.getMonthlyAggregates.invalidate();
		},
		onError: () => toast.error("Failed to update transaction"),
	});

	const deleteTransaction = api.transaction.delete.useMutation({
		onSuccess: () => {
			void utils.transaction.getAll.invalidate();
			void utils.transaction.getSummaryMetrics.invalidate();
			void utils.transaction.getMonthlyAggregates.invalidate();
			toast.success("Transaction removed");
		},
		onError: () => toast.error("Failed to delete transaction"),
	});

	const bulkUpdateType = api.transaction.bulkUpdateType.useMutation({
		onSuccess: () => {
			void utils.transaction.getAll.invalidate();
			void utils.transaction.getSummaryMetrics.invalidate();
			void utils.transaction.getMonthlyAggregates.invalidate();
		},
		onError: () => toast.error("Failed to update transactions"),
	});

	const bulkDelete = api.transaction.bulkDelete.useMutation({
		onSuccess: () => {
			void utils.transaction.getAll.invalidate();
			void utils.transaction.getSummaryMetrics.invalidate();
			void utils.transaction.getMonthlyAggregates.invalidate();
		},
		onError: () => toast.error("Failed to remove transactions"),
	});

	function handleClassify(id: string, value: TxClassification) {
		setPendingUpdates((prev) => new Set(prev).add(id));
		const clearPending = () =>
			setPendingUpdates((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});

		if (value === "SKIP") {
			deleteTransaction.mutate({ id }, { onSettled: clearPending });
		} else {
			updateType.mutate({ id, type: value }, { onSettled: clearPending });
		}
	}

	async function handleBulkClassify(value: TxClassification) {
		const ids = Array.from(selected);
		if (ids.length === 0) return;
		setBulkPending(true);
		try {
			if (value === "SKIP") {
				await bulkDelete.mutateAsync({ ids });
				toast.success(`Removed ${ids.length} transaction${ids.length > 1 ? "s" : ""}`);
			} else {
				await bulkUpdateType.mutateAsync({ ids, type: value });
				toast.success(
					`Marked ${ids.length} transaction${ids.length > 1 ? "s" : ""} as ${value === "INCOME" ? "income" : "expense"}`,
				);
			}
			setSelected(new Set());
		} finally {
			setBulkPending(false);
		}
	}

	const visibleIds = transactions?.map((t) => t.id) ?? [];
	const allSelected =
		visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
	const someSelected = visibleIds.some((id) => selected.has(id));

	function toggleSelectAll() {
		if (allSelected) {
			setSelected((prev) => {
				const next = new Set(prev);
				visibleIds.forEach((id) => next.delete(id));
				return next;
			});
		} else {
			setSelected((prev) => new Set([...prev, ...visibleIds]));
		}
	}

	function toggleRow(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	const sorted = transactions ? [...transactions].sort((a, b) => {
		switch (sortKey) {
			case "date-desc": return new Date(b.date).getTime() - new Date(a.date).getTime();
			case "date-asc":  return new Date(a.date).getTime() - new Date(b.date).getTime();
			case "amount-desc": return b.amount - a.amount;
			case "amount-asc":  return a.amount - b.amount;
			case "account-asc":  return (a.account ?? "").localeCompare(b.account ?? "");
			case "account-desc": return (b.account ?? "").localeCompare(a.account ?? "");
		}
	}) : undefined;

	const allIncome =
		transactions
			?.filter((t) => t.type === "INCOME")
			.reduce((s, t) => s + t.amount, 0) ?? 0;
	const allExpenses =
		transactions
			?.filter((t) => t.type === "EXPENSE")
			.reduce((s, t) => s + t.amount, 0) ?? 0;

	const selectedCount = selected.size;

	return (
		<div className="space-y-6 pb-24">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Transactions</h1>
				<p className="text-muted-foreground text-sm">
					Review and correct individual transactions to fix income/expense totals
				</p>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex rounded-lg border p-1 gap-1">
					{(["ALL", "INCOME", "EXPENSE"] as TypeFilter[]).map((f) => (
						<Button
							key={f}
							size="sm"
							variant={typeFilter === f ? "default" : "ghost"}
							className="h-7 px-3 text-xs"
							onClick={() => setTypeFilter(f)}
						>
							{f === "ALL" ? "All" : f === "INCOME" ? "✅ Income" : "💸 Expenses"}
						</Button>
					))}
				</div>
				<Input
					className="max-w-xs"
					placeholder="Search description..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
					<SelectTrigger className="w-48 h-9 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
							<SelectItem key={k} value={k} className="text-xs">
								{SORT_LABELS[k]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{!isLoading && (
					<span className="text-muted-foreground text-sm ml-auto">
						{transactions?.length ?? 0} transactions
					</span>
				)}
			</div>

			{/* Totals summary */}
			{!isLoading && transactions && transactions.length > 0 && (
				<div className="flex flex-wrap gap-4">
					<div className="rounded-lg border bg-card px-4 py-2 text-sm">
						<span className="text-muted-foreground">Income </span>
						<span className="font-semibold text-green-600">
							{formatCurrency(allIncome)}
						</span>
					</div>
					<div className="rounded-lg border bg-card px-4 py-2 text-sm">
						<span className="text-muted-foreground">Expenses </span>
						<span className="font-semibold text-red-600">
							{formatCurrency(allExpenses)}
						</span>
					</div>
					<div className="rounded-lg border bg-card px-4 py-2 text-sm">
						<span className="text-muted-foreground">Net </span>
						<span
							className={
								allIncome - allExpenses >= 0
									? "font-semibold text-green-600"
									: "font-semibold text-red-600"
							}
						>
							{formatCurrency(allIncome - allExpenses)}
						</span>
					</div>
				</div>
			)}

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">All transactions</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="space-y-2 p-4">
							{Array.from({ length: 8 }, (_, i) => (
								<Skeleton className="h-10 w-full" key={i} />
							))}
						</div>
					) : (sorted?.length ?? 0) === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No transactions found.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10 pl-4">
										<input
											type="checkbox"
											checked={allSelected}
											ref={(el) => {
												if (el) el.indeterminate = someSelected && !allSelected;
											}}
											onChange={toggleSelectAll}
											className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
										/>
									</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Account</TableHead>
									<TableHead className="text-right">Amount</TableHead>
									<TableHead>Type</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sorted?.map((tx) => {
									const isPending = pendingUpdates.has(tx.id);
									const isSelected = selected.has(tx.id);
									return (
										<TableRow
											key={tx.id}
											className={[
												isPending ? "opacity-50" : "",
												isSelected ? "bg-muted/50" : "",
											]
												.filter(Boolean)
												.join(" ")}
										>
											<TableCell className="pl-4">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => toggleRow(tx.id)}
													className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
												/>
											</TableCell>
											<TableCell className="whitespace-nowrap text-muted-foreground text-xs">
												{format(new Date(tx.date), "MMM d, yyyy")}
											</TableCell>
											<TableCell className="max-w-xs truncate text-sm">
												{tx.description ?? "—"}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{tx.account ?? "—"}
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{formatAmount(tx.amount)}
											</TableCell>
											<TableCell>
												<Select
													disabled={isPending}
													value={tx.type}
													onValueChange={(v) =>
														handleClassify(tx.id, v as TxClassification)
													}
												>
													<SelectTrigger className="h-7 w-36 text-xs">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{(
															["INCOME", "EXPENSE", "SKIP"] as TxClassification[]
														).map((c) => (
															<SelectItem key={c} value={c} className="text-xs">
																{CLASSIFICATION_LABELS[c]}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Floating bulk action bar */}
			{selectedCount > 0 && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
					<div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-3 shadow-xl ring-1 ring-black/5">
						<span className="text-sm font-medium text-muted-foreground pr-1">
							{selectedCount} selected
						</span>
						<div className="h-4 w-px bg-border" />
						{(["INCOME", "EXPENSE", "SKIP"] as TxClassification[]).map((c) => (
							<Button
								key={c}
								size="sm"
								variant="outline"
								disabled={bulkPending}
								onClick={() => handleBulkClassify(c)}
								className="h-8 text-xs"
							>
								{CLASSIFICATION_LABELS[c]}
							</Button>
						))}
						<div className="h-4 w-px bg-border" />
						<button
							onClick={() => setSelected(new Set())}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							Clear
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
