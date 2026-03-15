"use client";

import { useQueryClient } from "@tanstack/react-query";
import { endOfDay, format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { HistoricalApplyDialog } from "~/app/dashboard/rules/historical-apply-dialog";
import {
	RuleBuilderDialog,
	type RulePrefill,
} from "~/app/dashboard/rules/rule-builder-dialog";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
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
import { api } from "~/trpc/react";
import CategoryCell from "./category-editor";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import HashtagCell from "./hashtag";
import type { SortKey, TxClassification, TxRecord, TypeFilter } from "./types";
import { CLASSIFICATION_LABELS, formatAmount, SORT_LABELS } from "./utils";

function TransactionsPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
		const t = searchParams.get("type")?.toUpperCase();
		return t === "INCOME" || t === "EXPENSE" ? t : "ALL";
	});
	const [sortKey, setSortKey] = useState<SortKey>(() => {
		const s = searchParams.get("sort");
		return s && s in SORT_LABELS ? (s as SortKey) : "date-desc";
	});
	const [hashtagFilter, setHashtagFilter] = useState<string>(
		() => searchParams.get("hashtag") ?? "",
	);
	const fromParam = searchParams.get("from");
	const toParam = searchParams.get("to");

	const parseDateParam = (dateStr: string) => {
		const parts = dateStr.split("-").map(Number);
		return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
	};

	const urlDateRange =
		fromParam && toParam
			? { from: parseDateParam(fromParam), to: parseDateParam(toParam) }
			: undefined;

	const [dateRange, setDateRange] = useState<DateRange | undefined>(
		urlDateRange,
	);
	const prevUrlKey = useRef<string | null>(null);
	const isInitialized = useRef(false);

	const urlKey = `${fromParam ?? ""}-${toParam ?? ""}`;
	if (urlKey !== prevUrlKey.current && urlDateRange) {
		prevUrlKey.current = urlKey;
		setDateRange(urlDateRange);
		isInitialized.current = true;
	}

	useEffect(() => {
		if (!isInitialized.current && (urlDateRange || urlKey === "-")) {
			isInitialized.current = true;
		}
	}, [urlDateRange, urlKey]);

	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkPending, setBulkPending] = useState(false);
	const [editingTx, setEditingTx] = useState<TxRecord | null>(null);
	const ruleReturnTx = useRef<TxRecord | null>(null);
	const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
	const [rulePrefill, setRulePrefill] = useState<RulePrefill | null>(null);
	const [historyRule, setHistoryRule] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const _utils = api.useUtils();
	const queryClient = useQueryClient();
	const sentinelRef = useRef<HTMLDivElement>(null);
	const hoveredRowId = useRef<string | null>(null);

	const toggleRow = useCallback((id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key !== "x") return;
			const tag = (e.target as HTMLElement).tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
			if (!hoveredRowId.current) return;
			toggleRow(hoveredRowId.current);
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [toggleRow]);

	const sortField = sortKey.split("-")[0] as "date" | "amount" | "account";
	const sortDir = sortKey.split("-")[1] as "asc" | "desc";

	const { data: allHashtags } = api.hashtag.list.useQuery();
	const { data: allCategories } = api.transaction.listCategories.useQuery();

	const appliedDateRange =
		dateRange?.from &&
		dateRange?.to &&
		dateRange.from.getTime() !== dateRange.to.getTime()
			? dateRange
			: undefined;

	// Sync filters + sort to URL query params (skip until initialized from URL)
	useEffect(() => {
		if (!isInitialized.current) return;

		const params = new URLSearchParams();
		if (search) params.set("q", search);
		if (typeFilter !== "ALL") params.set("type", typeFilter.toLowerCase());
		if (sortKey !== "date-desc") params.set("sort", sortKey);
		if (hashtagFilter) params.set("hashtag", hashtagFilter);
		const isFullRange =
			dateRange?.from &&
			dateRange?.to &&
			dateRange.from.getTime() !== dateRange.to.getTime();
		if (isFullRange) {
			params.set("from", format(dateRange!.from!, "yyyy-MM-dd"));
			params.set("to", format(dateRange!.to!, "yyyy-MM-dd"));
		}
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}, [search, typeFilter, sortKey, hashtagFilter, dateRange, pathname, router]);

	const sharedFilterArgs = {
		type: typeFilter === "ALL" ? undefined : typeFilter,
		search: search || undefined,
		hashtag: hashtagFilter || undefined,
		startDate: appliedDateRange?.from,
		endDate: appliedDateRange?.to ? endOfDay(appliedDateRange.to) : undefined,
	} as const;

	const { data: totalCount } = api.transaction.count.useQuery(sharedFilterArgs);
	const { data: summary } =
		api.transaction.getSummary.useQuery(sharedFilterArgs);

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		api.transaction.getAll.useInfiniteQuery(
			{
				...sharedFilterArgs,
				sortField,
				sortDir,
				limit: 100,
			},
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
				initialCursor: 0,
			},
		);

	const transactions = useMemo(
		() => data?.pages.flatMap((p) => p.items) ?? [],
		[data],
	);

	// Infinite scroll: fetch next page when sentinel enters viewport
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: "300px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Patches every cached getAll variant (handles infinite query pages format).
	// updater returns null to remove the row, or the updated record to replace it.
	function patchCache(updater: (tx: TxRecord) => TxRecord | null) {
		queryClient.setQueriesData(
			{ queryKey: [["transaction", "getAll"]] },
			(old: unknown) => {
				if (!old || typeof old !== "object") return old;
				// Infinite query shape: { pages: [{ items: [] }], pageParams: [] }
				if ("pages" in old) {
					const q = old as {
						pages: { items: TxRecord[] }[];
						pageParams: unknown[];
					};
					return {
						...q,
						pages: q.pages.map((page) => ({
							...page,
							items: page.items.flatMap((tx) => {
								const result = updater(tx);
								return result ? [result] : [];
							}),
						})),
					};
				}
				return old;
			},
		);
	}

	const updateType = api.transaction.updateType.useMutation({
		onSuccess: (_, vars) => {
			patchCache((tx) => (tx.id === vars.id ? { ...tx, type: vars.type } : tx));
		},
		onError: () => toast.error("Failed to update transaction"),
	});

	const deleteTransaction = api.transaction.delete.useMutation({
		onSuccess: (_, vars) => {
			patchCache((tx) => (tx.id === vars.id ? null : tx));
			toast.success("Transaction removed");
		},
		onError: () => toast.error("Failed to delete transaction"),
	});

	const bulkUpdateType = api.transaction.bulkUpdateType.useMutation({
		onSuccess: (_, vars) => {
			const idSet = new Set(vars.ids);
			patchCache((tx) => (idSet.has(tx.id) ? { ...tx, type: vars.type } : tx));
		},
		onError: () => toast.error("Failed to update transactions"),
	});

	const bulkDelete = api.transaction.bulkDelete.useMutation({
		onSuccess: (_, vars) => {
			const idSet = new Set(vars.ids);
			patchCache((tx) => (idSet.has(tx.id) ? null : tx));
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
				toast.success(
					`Removed ${ids.length} transaction${ids.length > 1 ? "s" : ""}`,
				);
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

	const visibleIds = transactions.map((t) => t.id);
	const allSelected =
		visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
	const someSelected = visibleIds.some((id) => selected.has(id));

	function toggleSelectAll() {
		if (allSelected) {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const id of visibleIds) {
					next.delete(id);
				}
				return next;
			});
		} else {
			setSelected((prev) => new Set([...prev, ...visibleIds]));
		}
	}

	const selectedCount = selected.size;

	function handleAddRule() {
		const firstId = Array.from(selected)[0];
		const tx = transactions.find((t) => t.id === firstId);
		if (!tx) return;

		const conditions: RulePrefill["conditions"] = [];
		if (tx.description) {
			conditions.push({
				field: "DESCRIPTION",
				operator: "CONTAINS",
				valueText: tx.description as string,
				valueNumber: "",
			});
		}
		if (tx.amount) {
			conditions.push({
				field: "AMOUNT",
				operator: "EQUALS",
				valueText: "",
				valueNumber: String(tx.amount),
			});
		}
		if (tx.account) {
			conditions.push({
				field: "ACCOUNT",
				operator: "EQUALS",
				valueText: tx.account as string,
				valueNumber: "",
			});
		}
		const categoryName =
			(tx.categoryRef as { name: string } | null)?.name ??
			(tx.category as string);
		if (
			categoryName &&
			categoryName !== "Uncategorized" &&
			categoryName !== "OTHER"
		) {
			conditions.push({
				field: "CATEGORY",
				operator: "EQUALS",
				valueText: categoryName,
				valueNumber: "",
			});
		}

		setRulePrefill({
			conditions:
				conditions.length > 0
					? conditions
					: [
							{
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "",
								valueNumber: "",
							},
						],
		});
		setRuleDialogOpen(true);
	}

	function handleAddRuleForTx(tx: TxRecord) {
		const conditions: RulePrefill["conditions"] = [];
		if (tx.description) {
			conditions.push({
				field: "DESCRIPTION",
				operator: "CONTAINS",
				valueText: tx.description as string,
				valueNumber: "",
			});
		}
		if (tx.amount) {
			conditions.push({
				field: "AMOUNT",
				operator: "EQUALS",
				valueText: "",
				valueNumber: String(tx.amount),
			});
		}
		if (tx.account) {
			conditions.push({
				field: "ACCOUNT",
				operator: "EQUALS",
				valueText: tx.account as string,
				valueNumber: "",
			});
		}
		setRulePrefill({
			conditions:
				conditions.length > 0
					? conditions
					: [
							{
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "",
								valueNumber: "",
							},
						],
		});
		ruleReturnTx.current = tx;
		setEditingTx(null);
		setRuleDialogOpen(true);
	}

	return (
		<div className="space-y-6 pb-24">
			<div className="space-y-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Transactions</h1>
					<p className="text-muted-foreground text-sm">
						Review and correct individual transactions to fix income/expense
						totals
					</p>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-center gap-3">
					<Input
						className="max-w-xs"
						placeholder="Search description..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<Select
						value={typeFilter}
						onValueChange={(v) => setTypeFilter(v as TypeFilter)}
					>
						<SelectTrigger className="h-9 w-36 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL" className="text-xs">
								All
							</SelectItem>
							<SelectItem value="INCOME" className="text-xs">
								✅ Income
							</SelectItem>
							<SelectItem value="EXPENSE" className="text-xs">
								💸 Expenses
							</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={hashtagFilter || "__all__"}
						onValueChange={(v) => setHashtagFilter(v === "__all__" ? "" : v)}
					>
						<SelectTrigger className="h-9 w-40 text-xs">
							<SelectValue placeholder="All hashtags" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all__" className="text-xs">
								All hashtags
							</SelectItem>
							{allHashtags?.map((h) => (
								<SelectItem
									key={h.id}
									value={h.normalizedName}
									className="text-xs"
								>
									#{h.name}{" "}
									<span className="text-muted-foreground">
										({h._count.transactions})
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={[
									"h-9 justify-start gap-2 text-xs font-normal",
									appliedDateRange ? "w-52" : "w-36",
									!appliedDateRange && "text-muted-foreground",
								]
									.filter(Boolean)
									.join(" ")}
							>
								<CalendarIcon className="h-3.5 w-3.5 shrink-0" />
								{appliedDateRange ? (
									<>
										{format(appliedDateRange.from!, "MMM d, yyyy")} –{" "}
										{format(appliedDateRange.to!, "MMM d, yyyy")}
									</>
								) : (
									"Date range"
								)}
								{appliedDateRange && (
									<button
										type="button"
										className="mx-auto"
										onPointerDown={(e) => e.stopPropagation()}
										onClick={(e) => {
											e.stopPropagation();
											setDateRange(undefined);
										}}
									>
										<X className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100" />
									</button>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="range"
								selected={dateRange}
								onSelect={(range) => {
									setDateRange(range);
									// Only auto-close once a real range (two different dates) is picked
									if (
										range?.from &&
										range?.to &&
										range.from.getTime() !== range.to.getTime()
									) {
										setDatePickerOpen(false);
									}
								}}
								numberOfMonths={2}
								initialFocus
							/>
						</PopoverContent>
					</Popover>
					<Select
						value={sortKey}
						onValueChange={(v) => setSortKey(v as SortKey)}
					>
						<SelectTrigger className="ml-auto h-9 w-48 text-xs">
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
				</div>

				{/* Active filter badges */}
				{(typeFilter !== "ALL" || hashtagFilter || appliedDateRange) && (
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm text-muted-foreground">Filtered by:</span>
						{typeFilter !== "ALL" && (
							<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
								{typeFilter === "INCOME" ? "✅ Income" : "💸 Expenses"}
								<button
									type="button"
									className="transition-colors hover:text-primary/70"
									onClick={() => setTypeFilter("ALL")}
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						)}
						{hashtagFilter && (
							<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
								#{hashtagFilter}
								<button
									type="button"
									className="transition-colors hover:text-primary/70"
									onClick={() => setHashtagFilter("")}
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						)}
						{appliedDateRange && (
							<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
								{format(appliedDateRange.from!, "MMM d, yyyy")} –{" "}
								{format(appliedDateRange.to!, "MMM d, yyyy")}
								<button
									type="button"
									className="transition-colors hover:text-primary/70"
									onClick={() => setDateRange(undefined)}
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						)}
					</div>
				)}
			</div>

			{/* Summary strip */}
			<div className="flex items-center gap-6 text-sm">
				<span className="text-muted-foreground">
					Income:{" "}
					<span className="font-medium text-foreground">
						{summary ? formatAmount(summary.incomeSum) : "—"}
					</span>
					{summary && (
						<span className="text-muted-foreground">
							{" "}
							({summary.incomeCount})
						</span>
					)}
				</span>
				<span className="text-muted-foreground">
					Expenses:{" "}
					<span className="font-medium text-foreground">
						{summary ? formatAmount(summary.expenseSum) : "—"}
					</span>
					{summary && (
						<span className="text-muted-foreground">
							{" "}
							({summary.expenseCount})
						</span>
					)}
				</span>
				{summary &&
					(() => {
						const net = summary.incomeSum - summary.expenseSum;
						return (
							<span className="text-muted-foreground">
								Net:{" "}
								<span
									className={[
										"font-medium",
										net >= 0
											? "text-emerald-600 dark:text-emerald-400"
											: "text-rose-600 dark:text-rose-400",
									].join(" ")}
								>
									{net >= 0 ? "+" : ""}
									{formatAmount(Math.abs(net))}
								</span>
							</span>
						);
					})()}
				{(typeFilter !== "ALL" ||
					search ||
					hashtagFilter ||
					appliedDateRange) && (
					<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
						filtered
					</span>
				)}
			</div>

			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">All transactions</CardTitle>
						{!isLoading && (
							<span className="text-muted-foreground text-sm">
								{totalCount ?? transactions.length} transactions
							</span>
						)}
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="space-y-2 p-4">
							{Array.from({ length: 8 }, (_, i) => (
								<Skeleton className="h-10 w-full" key={i} />
							))}
						</div>
					) : transactions.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No transactions found.
						</p>
					) : (
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-card">
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
									<TableHead>Category</TableHead>
									<TableHead>Hashtags</TableHead>
									<TableHead>Type</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{transactions.map((tx) => {
									const isPending = pendingUpdates.has(tx.id);
									const isSelected = selected.has(tx.id);
									return (
										<TableRow
											key={tx.id}
											onMouseEnter={() => {
												hoveredRowId.current = tx.id;
											}}
											onMouseLeave={() => {
												hoveredRowId.current = null;
											}}
											onClick={(e) => {
												const target = e.target as HTMLElement;
												if (target.closest('button, input, [role="combobox"], [role="option"], [role="listbox"]')) return;
												setEditingTx(tx);
											}}
											className={[
												"cursor-pointer",
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
												{tx.type === "EXPENSE"
													? `-${formatAmount(tx.amount)}`
													: formatAmount(tx.amount)}
											</TableCell>
											<TableCell>
												<CategoryCell
													allCategories={allCategories ?? []}
													category={
														(tx.categoryRef as { name: string } | null)?.name ??
														(tx.category as string) ??
														"Uncategorized"
													}
													patchCache={patchCache}
													transactionId={tx.id}
												/>
											</TableCell>
											<TableCell>
												<HashtagCell
													transactionId={tx.id}
													hashtags={tx.hashtags}
													allHashtags={allHashtags ?? []}
													patchCache={patchCache}
												/>
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
															[
																"INCOME",
																"EXPENSE",
																"SKIP",
															] as TxClassification[]
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
					{/* Infinite scroll sentinel */}
					<div ref={sentinelRef} className="h-1" />
					{isFetchingNextPage && (
						<div className="flex justify-center py-4">
							<span className="text-muted-foreground text-sm">
								Loading more...
							</span>
						</div>
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
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs"
							onClick={handleAddRule}
						>
							+ Add rule
						</Button>
						<div className="h-4 w-px bg-border" />
						<button
							type="button"
							className="text-xs text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => setSelected(new Set())}
						>
							Clear
						</button>
					</div>
				</div>
			)}

			<EditTransactionDialog
				transaction={editingTx}
				open={!!editingTx}
				onOpenChange={(open) => {
					if (!open) setEditingTx(null);
				}}
				patchCache={patchCache}
				allHashtags={allHashtags ?? []}
				onAddRule={handleAddRuleForTx}
			/>

			<RuleBuilderDialog
				open={ruleDialogOpen}
				onOpenChange={(open) => {
					setRuleDialogOpen(open);
					if (!open && ruleReturnTx.current) {
						setEditingTx(ruleReturnTx.current);
						ruleReturnTx.current = null;
					}
				}}
				editingRule={null}
				prefill={rulePrefill}
				onSaved={(rule) => {
					setRuleDialogOpen(false);
					setHistoryRule(rule);
				}}
			/>

			{historyRule && (
				<HistoricalApplyDialog
					rule={historyRule}
					open={!!historyRule}
					onOpenChange={(open) => {
						if (!open) setHistoryRule(null);
					}}
				/>
			)}
		</div>
	);
}

export default function TransactionsPageWrapper() {
	return (
		<Suspense>
			<TransactionsPage />
		</Suspense>
	);
}
