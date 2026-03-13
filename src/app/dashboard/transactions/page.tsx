"use client";

import { format } from "date-fns";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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

// ─── Fuzzy search ─────────────────────────────────────────────────────────────

function fuzzyScore(candidate: string, query: string): number | null {
	if (!query) return null;
	const c = candidate.toLowerCase();
	const q = query.toLowerCase();
	if (c === q) return 1000;
	if (c.startsWith(q)) return 900 - c.length;
	// subsequence match
	let ci = 0;
	let qi = 0;
	while (ci < c.length && qi < q.length) {
		if (c[ci] === q[qi]) qi++;
		ci++;
	}
	if (qi < q.length) return null; // not a match
	return 500 - ci; // penalise longer spans
}

// ─── Inline Hashtag Editor ────────────────────────────────────────────────────

type TxRecord = Record<string, unknown> & { id: string };
type PatchCache = (updater: (tx: TxRecord) => TxRecord | null) => void;

function HashtagCell({
	transactionId,
	hashtags,
	allHashtags,
	patchCache,
}: {
	transactionId: string;
	hashtags: { hashtag: { name: string; normalizedName: string } }[];
	allHashtags: { name: string; normalizedName: string }[];
	patchCache: PatchCache;
}) {
	const [editing, setEditing] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [savingTags, setSavingTags] = useState<Set<string>>(new Set());
	const [removedTags, setRemovedTags] = useState<Set<string>>(new Set());
	const [activeIndex, setActiveIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);

	const setHashtags = api.hashtag.setOnTransaction.useMutation({
		onSuccess: (_, vars) => {
			const newHashtags = vars.hashtags.map((name) => ({
				hashtag: { name, normalizedName: name.toLowerCase() },
			}));
			patchCache((tx) =>
				tx.id === vars.transactionId ? { ...tx, hashtags: newHashtags } : tx,
			);
		},
		onError: () => {
			toast.error("Failed to update hashtags");
			setSavingTags(new Set());
		},
	});

	const serverNames = hashtags.map((h) => h.hashtag.name);
	const displayNames = [
		...new Set([...serverNames, ...Array.from(savingTags)]),
	].filter((n) => !removedTags.has(n));

	// Suggestions: fuzzy-match existing hashtags, exclude ones already on this tx
	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		if (!query) return [];
		const serverNamesLower = new Set(serverNames.map((n) => n.toLowerCase()));
		return allHashtags
			.filter((h) => !serverNamesLower.has(h.name.toLowerCase()))
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5)
			.map((x) => x.name);
	}, [inputValue, allHashtags, serverNames]);

	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	// Reset active index when suggestions change
	useEffect(() => {
		setActiveIndex(-1);
	}, [suggestions.length, inputValue]);

	function commit(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw) {
			setEditing(false);
			return;
		}
		setSavingTags((prev) => new Set(prev).add(raw));
		const next = [...new Set([...serverNames, raw])];
		setHashtags.mutate(
			{ transactionId, hashtags: next },
			{
				onSettled: () => {
					setSavingTags((prev) => {
						const s = new Set(prev);
						s.delete(raw);
						return s;
					});
				},
			},
		);
		setInputValue("");
		setEditing(false);
	}

	function removeTag(name: string) {
		setRemovedTags((prev) => new Set(prev).add(name));
		const next = serverNames.filter((n) => n !== name);
		setHashtags.mutate(
			{ transactionId, hashtags: next },
			{
				onError: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
					toast.error("Failed to delete hashtag. Please try again later.");
				},
				onSuccess: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
				},
			},
		);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			const chosen = activeIndex >= 0 ? suggestions[activeIndex] : inputValue;
			commit(chosen ?? "");
		} else if (e.key === "Escape") {
			setEditing(false);
			setInputValue("");
		}
	}

	function handleBlur() {
		// Small delay so clicks on suggestion items register first
		setTimeout(() => {
			setEditing(false);
			setInputValue("");
		}, 120);
	}

	return (
		<div className="flex flex-wrap items-center gap-1 min-w-[120px]">
			{displayNames.map((name) => {
				const isSaving = savingTags.has(name);
				return (
					<span
						key={name}
						className={[
							"inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
							isSaving
								? "bg-muted text-muted-foreground/50 animate-pulse"
								: "bg-muted text-muted-foreground",
						].join(" ")}
					>
						#{name}
						{!isSaving && (
							<button
								onClick={() => removeTag(name)}
								className="ml-0.5 hover:text-foreground transition-colors"
								aria-label={`Remove #${name}`}
							>
								<X className="h-2.5 w-2.5" />
							</button>
						)}
					</span>
				);
			})}
			{editing ? (
				<div className="relative">
					<input
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
						placeholder="tag"
						className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
					/>
					{suggestions.length > 0 && (
						<ul className="absolute left-0 top-full mt-1 z-50 min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
							{suggestions.map((name, i) => (
								<li key={name}>
									<button
										onMouseDown={(e) => {
											e.preventDefault(); // keep input focused until we commit
											commit(name);
										}}
										className={[
											"w-full px-3 py-1 text-left text-xs transition-colors",
											i === activeIndex
												? "bg-accent text-accent-foreground"
												: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
										].join(" ")}
									>
										#{name}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			) : (
				<button
					onClick={() => { setEditing(true); setInputValue(""); }}
					className="rounded pl-2 pr-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors"
				>
					+ tag
				</button>
			)}
		</div>
	);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
	const [sortKey, setSortKey] = useState<SortKey>("date-desc");
	const [hashtagFilter, setHashtagFilter] = useState<string>("");
	const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkPending, setBulkPending] = useState(false);

	const utils = api.useUtils();
	const queryClient = useQueryClient();
	const sentinelRef = useRef<HTMLDivElement>(null);

	const sortField = sortKey.split("-")[0] as "date" | "amount" | "account";
	const sortDir = sortKey.split("-")[1] as "asc" | "desc";

	const { data: allHashtags } = api.hashtag.list.useQuery();

	const { data: totalCount } = api.transaction.count.useQuery({
		type: typeFilter === "ALL" ? undefined : typeFilter,
		search: search || undefined,
		hashtag: hashtagFilter || undefined,
	});

	const {
		data,
		isLoading,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = api.transaction.getAll.useInfiniteQuery(
		{
			type: typeFilter === "ALL" ? undefined : typeFilter,
			search: search || undefined,
			hashtag: hashtagFilter || undefined,
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
					const q = old as { pages: { items: TxRecord[] }[]; pageParams: unknown[] };
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

	const visibleIds = transactions.map((t) => t.id);
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
				{/* Hashtag filter */}
				<Select
					value={hashtagFilter || "__all__"}
					onValueChange={(v) => setHashtagFilter(v === "__all__" ? "" : v)}
				>
					<SelectTrigger className="w-40 h-9 text-xs">
						<SelectValue placeholder="All hashtags" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__" className="text-xs">
							All hashtags
						</SelectItem>
						{allHashtags?.map((h) => (
							<SelectItem key={h.id} value={h.normalizedName} className="text-xs">
								#{h.name}{" "}
								<span className="text-muted-foreground">({h._count.transactions})</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
						{totalCount ?? transactions.length} transactions
					</span>
				)}
			</div>

			{/* Active hashtag filter badge */}
			{hashtagFilter && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Filtered by:</span>
					<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
						#{hashtagFilter}
						<button
							onClick={() => setHashtagFilter("")}
							className="hover:text-primary/70 transition-colors"
						>
							<X className="h-3 w-3" />
						</button>
					</span>
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
					) : transactions.length === 0 ? (
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

			{/* Infinite scroll sentinel */}
			<div ref={sentinelRef} className="h-1" />
			{isFetchingNextPage && (
				<div className="flex justify-center py-4">
					<span className="text-muted-foreground text-sm">Loading more...</span>
				</div>
			)}

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
