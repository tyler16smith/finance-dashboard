"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
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
import { api } from "~/trpc/react";
import type { PatchCache, TxRecord } from "./types";
import { fuzzyScore } from "./utils";

interface Props {
	transaction: TxRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	patchCache: PatchCache;
	allHashtags: { name: string; normalizedName: string }[];
	onAddRule: (tx: TxRecord) => void;
}

export function EditTransactionDialog({
	transaction: tx,
	open,
	onOpenChange,
	patchCache,
	allHashtags,
	onAddRule,
}: Props) {
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [tagActiveIndex, setTagActiveIndex] = useState(-1);
	const [saving, setSaving] = useState(false);
	const tagInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!tx) return;
		setDescription((tx.description as string) ?? "");
		setAmount(String(tx.amount));
		setTxType((tx.type as "INCOME" | "EXPENSE") ?? "EXPENSE");
		const existingTags = (tx.hashtags as { hashtag: { name: string } }[]).map(
			(h) => h.hashtag.name,
		);
		setTags(existingTags);
		setTagInput("");
		setTagActiveIndex(-1);
	}, [tx]);

	const tagSuggestions = useMemo(() => {
		const query = tagInput.trim().replace(/^#/, "");
		if (!query) return [];
		const currentTagsLower = new Set(tags.map((t) => t.toLowerCase()));
		return allHashtags
			.filter((h) => !currentTagsLower.has(h.name.toLowerCase()))
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5)
			.map((x) => x.name);
	}, [tagInput, allHashtags, tags]);

	const updateFields = api.transaction.update.useMutation();
	const setHashtags = api.hashtag.setOnTransaction.useMutation();

	function addTag(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw || tags.map((t) => t.toLowerCase()).includes(raw.toLowerCase()))
			return;
		setTags((prev) => [...prev, raw]);
		setTagInput("");
		setTagActiveIndex(-1);
	}

	function removeTag(name: string) {
		setTags((prev) => prev.filter((t) => t !== name));
	}

	function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setTagActiveIndex((i) => Math.min(i + 1, tagSuggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setTagActiveIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			const chosen =
				tagActiveIndex >= 0 ? tagSuggestions[tagActiveIndex] : tagInput;
			addTag(chosen ?? "");
		} else if (e.key === "Escape") {
			setTagInput("");
			setTagActiveIndex(-1);
		} else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
			setTags((prev) => prev.slice(0, -1));
		}
	}

	async function handleSave() {
		if (!tx) return;
		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) {
			toast.error("Please enter a valid amount");
			return;
		}
		setSaving(true);
		try {
			await Promise.all([
				updateFields.mutateAsync({
					id: tx.id,
					description: description || undefined,
					amount: parsedAmount,
					type: txType,
				}),
				setHashtags.mutateAsync({ transactionId: tx.id, hashtags: tags }),
			]);
			patchCache((t) =>
				t.id === tx.id
					? {
							...t,
							description,
							amount: parsedAmount,
							type: txType,
							hashtags: tags.map((name) => ({
								hashtag: { name, normalizedName: name.toLowerCase() },
							})),
						}
					: t,
			);
			toast.success("Transaction updated");
			onOpenChange(false);
		} catch {
			toast.error("Failed to update transaction");
		} finally {
			setSaving(false);
		}
	}

	function handleAddRule() {
		if (!tx) return;
		const parsedAmount = parseFloat(amount);
		onAddRule({
			...tx,
			description,
			amount: isNaN(parsedAmount) ? tx.amount : parsedAmount,
			type: txType,
		});
	}

	if (!tx) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Transaction</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Description */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-description">Description</Label>
						<Input
							id="edit-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Transaction description"
						/>
					</div>

					{/* Amount */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-amount">Amount</Label>
						<Input
							id="edit-amount"
							type="number"
							min="0"
							step="0.01"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder="0.00"
						/>
					</div>

					{/* Type */}
					<div className="space-y-1.5">
						<Label>Type</Label>
						<Select
							value={txType}
							onValueChange={(v) => setTxType(v as "INCOME" | "EXPENSE")}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="INCOME">✅ Income</SelectItem>
								<SelectItem value="EXPENSE">💸 Expense</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Hashtags */}
					<div className="space-y-1.5">
						<Label>Hashtags</Label>
						<div
							className="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2"
							onClick={() => tagInputRef.current?.focus()}
						>
							{tags.map((name) => (
								<span
									key={name}
									className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
								>
									#{name}
									<button
										type="button"
										aria-label={`Remove #${name}`}
										className="ml-0.5 transition-colors hover:text-foreground"
										onClick={(e) => {
											e.stopPropagation();
											removeTag(name);
										}}
									>
										<X className="h-2.5 w-2.5" />
									</button>
								</span>
							))}
							<div className="relative min-w-[80px] flex-1">
								<input
									ref={tagInputRef}
									className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
									placeholder={tags.length === 0 ? "Add tags..." : ""}
									value={tagInput}
									onChange={(e) => {
										setTagInput(e.target.value);
										setTagActiveIndex(-1);
									}}
									onKeyDown={handleTagKeyDown}
								/>
								{tagSuggestions.length > 0 && (
									<ul className="absolute left-0 top-full z-50 mt-1 min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
										{tagSuggestions.map((name, i) => (
											<li key={name}>
												<button
													type="button"
													className={[
														"w-full px-3 py-1 text-left text-xs transition-colors",
														i === tagActiveIndex
															? "bg-accent text-accent-foreground"
															: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
													].join(" ")}
													onMouseDown={(e) => {
														e.preventDefault();
														addTag(name);
													}}
												>
													#{name}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>

					{/* Account (read-only) */}
					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Account</Label>
						<div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
							{(tx.account as string) ?? "—"}
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between pt-2">
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={handleAddRule}
					>
						+ Add rule
					</Button>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={saving}
						>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={saving}>
							{saving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
