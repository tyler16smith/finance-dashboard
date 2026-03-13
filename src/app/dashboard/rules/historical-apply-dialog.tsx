"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

type Rule = { id: string; name: string };

export function HistoricalApplyDialog({
	rule,
	open,
	onOpenChange,
}: {
	rule: Rule;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [choice, setChoice] = useState<"historical" | "future">("future");
	const [remember, setRemember] = useState(false);

	const queryClient = useQueryClient();
	const { data: settings } = api.rule.getSettings.useQuery();
	const { data: preview, isLoading: previewLoading } =
		api.rule.previewMatchCount.useQuery({ id: rule.id }, { enabled: open });

	const applyHistorical = api.rule.applyHistorical.useMutation({
		onSuccess: (data) => {
			toast.success(
				`Rule applied to ${data.affected} transaction${data.affected !== 1 ? "s" : ""}`,
			);

			// Patch the transactions page cache without refetching
			const deletedSet = new Set(data.deletedIds);
			const updateMap = new Map(data.updates.map((u) => [u.id, u]));
			queryClient.setQueriesData(
				{ queryKey: [["transaction", "getAll"]] },
				(old: unknown) => {
					if (!old || typeof old !== "object" || !("pages" in old)) return old;
					const q = old as {
						pages: { items: Record<string, unknown>[] }[];
						pageParams: unknown[];
					};
					return {
						...q,
						pages: q.pages.map((page) => ({
							...page,
							items: page.items.flatMap((tx) => {
								const id = tx.id as string;
								if (deletedSet.has(id)) return [];
								const update = updateMap.get(id);
								if (!update) return [tx];
								return [
									{
										...tx,
										...(update.description !== undefined && {
											description: update.description,
										}),
										...(update.type && { type: update.type }),
										...(update.categoryRef && {
											category: update.category,
											categoryRef: {
												...(typeof tx.categoryRef === "object"
													? tx.categoryRef
													: {}),
												name: update.categoryRef.name,
											},
										}),
										...(update.addedHashtagNames?.length && {
											hashtags: [
												...((tx.hashtags as unknown[]) ?? []),
												...update.addedHashtagNames.map((name) => ({
													hashtag: { name, normalizedName: name },
												})),
											],
										}),
									},
								];
							}),
						})),
					};
				},
			);

			onOpenChange(false);
		},
		onError: () => toast.error("Failed to apply rule"),
	});

	const updateSettings = api.rule.updateSettings.useMutation();

	// Auto-apply saved preference
	useEffect(() => {
		if (!open || !settings) return;
		if (settings.ruleExecutionPreference === "APPLY_HISTORICAL") {
			setChoice("historical");
		} else if (settings.ruleExecutionPreference === "FUTURE_ONLY") {
			// Skip modal entirely and close
			onOpenChange(false);
		}
	}, [open, settings, onOpenChange]);

	function handleConfirm() {
		if (remember) {
			updateSettings.mutate({
				ruleExecutionPreference:
					choice === "historical" ? "APPLY_HISTORICAL" : "FUTURE_ONLY",
			});
		}
		if (choice === "historical") {
			applyHistorical.mutate({ id: rule.id });
		} else {
			onOpenChange(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Apply rule to existing transactions?</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2 text-sm">
					<p className="text-muted-foreground text-sm">
						<span className="font-medium text-foreground">"{rule.name}"</span>{" "}
						was saved. Would you like to apply it to your existing transactions?
					</p>

					{/* Match count */}
					<div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
						{previewLoading ? (
							<Skeleton className="h-4 w-40" />
						) : (
							<>
								This rule matches{" "}
								<span className="font-semibold text-foreground">
									{preview?.count ?? 0}
								</span>{" "}
								existing transaction{preview?.count !== 1 ? "s" : ""}
							</>
						)}
					</div>

					{/* Radio choice */}
					<div className="space-y-2">
						<label className="flex items-start gap-2.5 cursor-pointer">
							<input
								type="radio"
								name="apply-mode"
								value="historical"
								checked={choice === "historical"}
								onChange={() => setChoice("historical")}
								className="mt-0.5 accent-primary"
							/>
							<div>
								<div className="font-medium">
									Yes, apply to all matching transactions
								</div>
								<div className="text-xs text-muted-foreground">
									Updates category, description, and hashtags retroactively
								</div>
							</div>
						</label>
						<label className="flex items-start gap-2.5 cursor-pointer">
							<input
								type="radio"
								name="apply-mode"
								value="future"
								checked={choice === "future"}
								onChange={() => setChoice("future")}
								className="mt-0.5 accent-primary"
							/>
							<div>
								<div className="font-medium">
									No, only apply to future imports
								</div>
								<div className="text-xs text-muted-foreground">
									Existing transactions are left unchanged
								</div>
							</div>
						</label>
					</div>

					{/* Remember preference */}
					<label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground border-t pt-3">
						<input
							type="checkbox"
							checked={remember}
							onChange={(e) => setRemember(e.target.checked)}
							className="accent-primary"
						/>
						Always apply a new rule to existing transactions
					</label>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={handleConfirm}
						disabled={applyHistorical.isPending}
					>
						{applyHistorical.isPending ? "Applying…" : "Confirm"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
