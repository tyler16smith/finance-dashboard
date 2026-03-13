"use client";

import { format } from "date-fns";
import { ArrowRight, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
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
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RuleField =
	| "MERCHANT"
	| "DESCRIPTION"
	| "AMOUNT"
	| "CATEGORY"
	| "DATE"
	| "ACCOUNT"
	| "NOTES";
type RuleOperator =
	| "CONTAINS"
	| "NOT_CONTAINS"
	| "STARTS_WITH"
	| "ENDS_WITH"
	| "EQUALS"
	| "NOT_EQUALS"
	| "IS_EMPTY"
	| "IS_NOT_EMPTY"
	| "GREATER_THAN"
	| "GREATER_THAN_OR_EQUAL"
	| "LESS_THAN"
	| "LESS_THAN_OR_EQUAL"
	| "BETWEEN"
	| "BEFORE"
	| "AFTER"
	| "ON";
type RuleActionType =
	| "SET_CATEGORY"
	| "SET_DESCRIPTION"
	| "SET_TYPE"
	| "ADD_HASHTAG";

type ConditionRow = {
	id: string;
	field: RuleField;
	operator: RuleOperator;
	valueText: string;
	valueNumber: string;
};

type ActionRow = {
	id: string;
	type: RuleActionType;
	valueText: string;
	hashtagId: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELDS: {
	value: RuleField;
	label: string;
	kind: "text" | "number" | "date";
}[] = [
	{ value: "MERCHANT", label: "Merchant", kind: "text" },
	{ value: "DESCRIPTION", label: "Description", kind: "text" },
	{ value: "AMOUNT", label: "Amount", kind: "number" },
	{ value: "CATEGORY", label: "Category", kind: "text" },
	{ value: "ACCOUNT", label: "Account", kind: "text" },
	{ value: "NOTES", label: "Notes", kind: "text" },
];

const TEXT_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: "CONTAINS", label: "contains" },
	{ value: "NOT_CONTAINS", label: "does not contain" },
	{ value: "STARTS_WITH", label: "starts with" },
	{ value: "ENDS_WITH", label: "ends with" },
	{ value: "EQUALS", label: "equals" },
	{ value: "NOT_EQUALS", label: "does not equal" },
	{ value: "IS_EMPTY", label: "is empty" },
	{ value: "IS_NOT_EMPTY", label: "is not empty" },
];

const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: "EQUALS", label: "equals" },
	{ value: "NOT_EQUALS", label: "does not equal" },
	{ value: "GREATER_THAN", label: "greater than" },
	{ value: "GREATER_THAN_OR_EQUAL", label: "greater than or equal" },
	{ value: "LESS_THAN", label: "less than" },
	{ value: "LESS_THAN_OR_EQUAL", label: "less than or equal" },
];


const NO_VALUE_OPS = new Set<RuleOperator>(["IS_EMPTY", "IS_NOT_EMPTY"]);

// ─── Category fuzzy input ─────────────────────────────────────────────────────

function fuzzyScore(candidate: string, query: string): number | null {
	if (!query) return null;
	const c = candidate.toLowerCase();
	const q = query.toLowerCase();
	if (c === q) return 1000;
	if (c.startsWith(q)) return 900 - c.length;
	let ci = 0;
	let qi = 0;
	while (ci < c.length && qi < q.length) {
		if (c[ci] === q[qi]) qi++;
		ci++;
	}
	if (qi < q.length) return null;
	return 500 - ci;
}

function CategoryInput({
	className,
	onChange,
	placeholder,
	value,
}: {
	className?: string;
	onChange: (v: string) => void;
	placeholder?: string;
	value: string;
}) {
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const { data: dbCategories } = api.transaction.listCategories.useQuery();

	const suggestions = useMemo(() => {
		if (!dbCategories) return [];
		const query = value.trim();
		if (!query) return dbCategories.slice(0, 6);
		return dbCategories
			.map((c) => ({ name: c, score: fuzzyScore(c, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((x) => x.name);
	}, [value, dbCategories]);

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter" && activeIndex >= 0) {
			e.preventDefault();
			if (suggestions[activeIndex]) onChange(suggestions[activeIndex]);
			setOpen(false);
		} else if (e.key === "Escape") {
			setOpen(false);
		}
	}

	return (
		<div className={cn("relative", className)}>
			<Input
				className="h-8 w-full text-xs"
				onBlur={() => setTimeout(() => setOpen(false), 120)}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder ?? "category"}
				value={value}
			/>
			{open && suggestions.length > 0 && (
				<div className="absolute top-full left-0 z-50 mt-0.5 w-full min-w-[160px] overflow-hidden rounded-md border bg-popover py-1 shadow-md">
					{suggestions.map((cat, i) => (
						<button
							className={cn(
								"w-full px-3 py-1.5 text-left text-xs hover:bg-accent",
								i === activeIndex && "bg-accent",
							)}
							key={cat}
							onMouseDown={(e) => {
								e.preventDefault();
								onChange(cat);
								setOpen(false);
							}}
							type="button"
						>
							{cat}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function getOperators(field: RuleField) {
	const f = FIELDS.find((x) => x.value === field);
	if (f?.kind === "number") return NUMBER_OPERATORS;
	return TEXT_OPERATORS;
}

function getFieldKind(field: RuleField) {
	return FIELDS.find((x) => x.value === field)?.kind ?? "text";
}

function uid() {
	return Math.random().toString(36).slice(2);
}

function emptyCondition(): ConditionRow {
	return {
		id: uid(),
		field: "DESCRIPTION",
		operator: "CONTAINS",
		valueText: "",
		valueNumber: "",
	};
}

function emptyAction(): ActionRow {
	return { id: uid(), type: "SET_CATEGORY", valueText: "", hashtagId: null };
}

// ─── Condition Row Component ──────────────────────────────────────────────────

function ConditionRowUI({
	row,
	onUpdate,
	onRemove,
	canRemove,
}: {
	row: ConditionRow;
	onUpdate: (partial: Partial<ConditionRow>) => void;
	onRemove: () => void;
	canRemove: boolean;
}) {
	const operators = getOperators(row.field);
	const kind = getFieldKind(row.field);
	const noValue = NO_VALUE_OPS.has(row.operator);

	function handleFieldChange(field: RuleField) {
		const newOps = getOperators(field);
		const sameOp = newOps.find((o) => o.value === row.operator);
		onUpdate({
			field,
			operator: sameOp ? row.operator : (newOps[0]?.value ?? row.operator),
		});
	}

	return (
		<div className="flex w-full items-center gap-2">
			<Select
				onValueChange={(v) => handleFieldChange(v as RuleField)}
				value={row.field}
			>
				<SelectTrigger className="h-8 w-36 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{FIELDS.map((f) => (
						<SelectItem className="text-xs" key={f.value} value={f.value}>
							{f.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				onValueChange={(v) => onUpdate({ operator: v as RuleOperator })}
				value={row.operator}
			>
				<SelectTrigger className="h-8 w-44 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{operators.map((o) => (
						<SelectItem className="text-xs" key={o.value} value={o.value}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{!noValue && kind === "number" && (
				<Input
					className="h-8 w-28 text-xs"
					onChange={(e) => onUpdate({ valueNumber: e.target.value })}
					placeholder="value"
					type="number"
					value={row.valueNumber}
				/>
			)}
			{!noValue && kind === "text" && row.field === "CATEGORY" && (
				<CategoryInput
					className="w-40"
					onChange={(v) => onUpdate({ valueText: v })}
					placeholder="category"
					value={row.valueText}
				/>
			)}
			{!noValue && kind === "text" && row.field !== "CATEGORY" && (
				<Input
					className="h-8 flex-1 text-xs"
					onChange={(e) => onUpdate({ valueText: e.target.value })}
					placeholder="value"
					value={row.valueText}
				/>
			)}
			{noValue && <div className="flex-1" />}

			{canRemove && (
				<button
					className="text-muted-foreground transition-colors hover:text-destructive"
					onClick={onRemove}
					type="button"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);
}

// ─── Action Row Component ─────────────────────────────────────────────────────

function ActionRowUI({
	row,
	onUpdate,
	onRemove,
	canRemove,
	hashtags,
}: {
	row: ActionRow;
	onUpdate: (partial: Partial<ActionRow>) => void;
	onRemove: () => void;
	canRemove: boolean;
	hashtags: { id: string; name: string }[];
}) {
	return (
		<div className="flex w-full items-center gap-2">
			<Select
				onValueChange={(v) =>
					onUpdate({
						type: v as RuleActionType,
						valueText: "",
						hashtagId: null,
					})
				}
				value={row.type}
			>
				<SelectTrigger className="h-8 w-44 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem className="text-xs" value="SET_CATEGORY">
						Set category
					</SelectItem>
					<SelectItem className="text-xs" value="SET_DESCRIPTION">
						Set description
					</SelectItem>
					<SelectItem className="text-xs" value="SET_TYPE">
						Set type
					</SelectItem>
					<SelectItem className="text-xs" value="ADD_HASHTAG">
						Add hashtag
					</SelectItem>
				</SelectContent>
			</Select>

			<span className="shrink-0 text-muted-foreground text-xs">→</span>

			{row.type === "SET_CATEGORY" && (
				<CategoryInput
					className="flex-1"
					onChange={(v) => onUpdate({ valueText: v })}
					placeholder="e.g. Mortgage and Rent"
					value={row.valueText}
				/>
			)}

			{row.type === "SET_DESCRIPTION" && (
				<Input
					className="h-8 flex-1 text-xs"
					onChange={(e) => onUpdate({ valueText: e.target.value })}
					placeholder="new description"
					value={row.valueText}
				/>
			)}

			{row.type === "SET_TYPE" && (
				<Select
					onValueChange={(v) => onUpdate({ valueText: v })}
					value={row.valueText}
				>
					<SelectTrigger className="h-8 w-36 text-xs">
						<SelectValue placeholder="pick type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="text-xs" value="INCOME">
							Income
						</SelectItem>
						<SelectItem className="text-xs" value="EXPENSE">
							Expense
						</SelectItem>
						<SelectItem className="text-xs" value="SKIP">
							Skip (delete)
						</SelectItem>
					</SelectContent>
				</Select>
			)}

			{row.type === "ADD_HASHTAG" && (
				<div className="flex flex-1 items-center gap-2">
					{hashtags.length > 0 && (
						<Select
							onValueChange={(v) => {
								if (v === "__new__") {
									onUpdate({ hashtagId: null });
								} else {
									const h = hashtags.find((x) => x.id === v);
									onUpdate({ hashtagId: v, valueText: h?.name ?? "" });
								}
							}}
							value={row.hashtagId ?? "__new__"}
						>
							<SelectTrigger className="h-8 w-40 text-xs">
								<SelectValue placeholder="existing tag" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem className="text-xs" value="__new__">
									+ New tag
								</SelectItem>
								{hashtags.map((h) => (
									<SelectItem className="text-xs" key={h.id} value={h.id}>
										#{h.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{!row.hashtagId && (
						<Input
							className="h-8 flex-1 text-xs"
							onChange={(e) => onUpdate({ valueText: e.target.value })}
							placeholder="#tagname"
							value={row.valueText}
						/>
					)}
				</div>
			)}

			{canRemove && (
				<button
					className="text-muted-foreground transition-colors hover:text-destructive"
					onClick={onRemove}
					type="button"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);
}

// ─── Preview ──────────────────────────────────────────────────────────────────

type PreviewTx = {
	id: string;
	date: Date;
	description: string | null;
	amount: number;
	type: string;
	category: string;
	account: string | null;
	hashtags: string[];
};

function applyActionsToPreview(tx: PreviewTx, actions: ActionRow[]): PreviewTx {
	let result = { ...tx, hashtags: [...tx.hashtags] };
	for (const a of actions) {
		if (a.type === "SET_CATEGORY" && a.valueText)
			result = { ...result, category: a.valueText };
		if (a.type === "SET_DESCRIPTION" && a.valueText)
			result = { ...result, description: a.valueText };
		if (a.type === "SET_TYPE" && a.valueText)
			result = { ...result, type: a.valueText };
		if (a.type === "ADD_HASHTAG") {
			const tag = a.valueText.replace(/^#/, "").trim();
			if (tag && !result.hashtags.includes(tag))
				result = { ...result, hashtags: [...result.hashtags, tag] };
		}
	}
	return result;
}

function hasActionsSet(actions: ActionRow[]) {
	return actions.some((a) => a.valueText.trim() || a.hashtagId);
}

function PreviewRow({
	before,
	after,
	showAfter,
}: {
	before: PreviewTx;
	after: PreviewTx;
	showAfter: boolean;
}) {
	const categoryChanged = showAfter && after.category !== before.category;
	const descChanged = showAfter && after.description !== before.description;
	const typeChanged = showAfter && after.type !== before.type;
	const newTags = showAfter
		? after.hashtags.filter((t) => !before.hashtags.includes(t))
		: [];

	return (
		<div className="grid grid-cols-[80px_1fr_72px] gap-x-3 gap-y-0.5 border-b py-2 text-xs last:border-0">
			<span className="text-muted-foreground tabular-nums">
				{format(new Date(before.date), "MMM d, yyyy")}
			</span>
			<div className="flex min-w-0 flex-col gap-0.5">
				<span
					className={
						descChanged
							? "truncate text-muted-foreground/50 line-through"
							: "truncate"
					}
				>
					{before.description ?? "—"}
				</span>
				{descChanged && (
					<span className="truncate font-medium text-green-600">
						{after.description}
					</span>
				)}
				<div className="mt-0.5 flex flex-wrap gap-1">
					{before.hashtags.map((t) => (
						<span
							className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground"
							key={t}
						>
							#{t}
						</span>
					))}
					{newTags.map((t) => (
						<span
							className="rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-700"
							key={t}
						>
							+#{t}
						</span>
					))}
				</div>
			</div>
			<div className="flex flex-col items-end gap-0.5 text-right">
				<span className="font-mono tabular-nums">
					${Math.abs(before.amount).toFixed(2)}
				</span>
				<span
					className={
						typeChanged
							? "text-[10px] text-muted-foreground/50 line-through"
							: "text-[10px] text-muted-foreground"
					}
				>
					{before.type.toLowerCase()}
				</span>
				{typeChanged && (
					<span
						className={
							after.type === "SKIP"
								? "font-medium text-[10px] text-destructive"
								: "font-medium text-[10px] text-green-600"
						}
					>
						{after.type.toLowerCase()}
					</span>
				)}
				<span
					className={
						categoryChanged
							? "text-[10px] text-muted-foreground/50 line-through"
							: "text-[10px] text-muted-foreground"
					}
				>
					{before.category}
				</span>
				{categoryChanged && (
					<span className="font-medium text-[10px] text-green-600">
						{after.category}
					</span>
				)}
			</div>
		</div>
	);
}

function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setDebounced(value), delay);
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, [value, delay]);
	return debounced;
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

type ExistingRule = {
	id: string;
	name: string;
	isActive: boolean;
	priority: number;
	conditions: {
		field: string;
		operator: string;
		valueText: string | null;
		valueNumber: number | null;
	}[];
	actions: {
		type: string;
		valueText: string | null;
		hashtagId: string | null;
		hashtag: { id: string; name: string } | null;
	}[];
};

export type RulePrefill = {
	conditions: {
		field: RuleField;
		operator: RuleOperator;
		valueText: string;
		valueNumber: string;
	}[];
};

export function RuleBuilderDialog({
	open,
	onOpenChange,
	editingRule,
	onSaved,
	prefill,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingRule: ExistingRule | null;
	onSaved: (rule: ExistingRule) => void;
	prefill?: RulePrefill | null;
}) {
	const utils = api.useUtils();
	const { data: hashtags } = api.hashtag.list.useQuery();

	const [name, setName] = useState("");
	const [conditions, setConditions] = useState<ConditionRow[]>([
		emptyCondition(),
	]);
	const [actions, setActions] = useState<ActionRow[]>([emptyAction()]);

	// Build query-ready conditions, debounced to avoid firing on every keystroke
	const builtConditions = useMemo(
		() =>
			conditions
				.filter((c) => {
					if (NO_VALUE_OPS.has(c.operator)) return true;
					const kind = getFieldKind(c.field);
					return kind === "number"
						? c.valueNumber !== ""
						: c.valueText.trim() !== "";
				})
				.map((c) => {
					const kind = getFieldKind(c.field);
					return {
						field: c.field,
						operator: c.operator,
						valueText: kind === "text" ? c.valueText || null : null,
						valueNumber:
							kind === "number" ? parseFloat(c.valueNumber) || null : null,
						valueDate: null,
						secondValueNumber: null,
						secondValueDate: null,
					};
				}),
		[conditions],
	);
	const debouncedConditions = useDebounced(builtConditions, 500);

	const { data: previewRows, isFetching: previewLoading } =
		api.rule.previewConditions.useQuery(
			{ conditions: debouncedConditions },
			{ enabled: open && debouncedConditions.length > 0 },
		);

	// Populate form when editing or pre-filling from a transaction
	useEffect(() => {
		if (!open) return;
		if (editingRule) {
			setName(editingRule.name);
			setConditions(
				editingRule.conditions.map((c) => ({
					id: uid(),
					field: c.field as RuleField,
					operator: c.operator as RuleOperator,
					valueText: c.valueText ?? "",
					valueNumber: c.valueNumber?.toString() ?? "",
				})),
			);
			setActions(
				editingRule.actions.map((a) => ({
					id: uid(),
					type: a.type as RuleActionType,
					valueText: a.valueText ?? a.hashtag?.name ?? "",
					hashtagId: a.hashtagId,
				})),
			);
		} else if (prefill) {
			setName("");
			setConditions(prefill.conditions.map((c) => ({ ...c, id: uid() })));
			setActions([emptyAction()]);
		} else {
			setName("");
			setConditions([emptyCondition()]);
			setActions([emptyAction()]);
		}
	}, [open, editingRule, prefill]);

	const createRule = api.rule.create.useMutation({
		onSuccess: (rule) => {
			void utils.rule.list.invalidate();
			onSaved(rule as ExistingRule);
		},
		onError: () => toast.error("Failed to save rule"),
	});

	const updateRule = api.rule.update.useMutation({
		onSuccess: (rule) => {
			void utils.rule.list.invalidate();
			onSaved(rule as ExistingRule);
		},
		onError: () => toast.error("Failed to save rule"),
	});

	const isPending = createRule.isPending || updateRule.isPending;

	function updateCondition(id: string, partial: Partial<ConditionRow>) {
		setConditions((prev) =>
			prev.map((c) => (c.id === id ? { ...c, ...partial } : c)),
		);
	}

	function updateAction(id: string, partial: Partial<ActionRow>) {
		setActions((prev) =>
			prev.map((a) => (a.id === id ? { ...a, ...partial } : a)),
		);
	}

	function handleSave() {
		if (!name.trim()) {
			toast.error("Rule name is required");
			return;
		}

		const builtConditions = conditions.map((c) => {
			const kind = getFieldKind(c.field);
			return {
				field: c.field,
				operator: c.operator,
				valueText: kind === "text" ? c.valueText || null : null,
				valueNumber:
					kind === "number" ? parseFloat(c.valueNumber) || null : null,
				valueDate: null,
				secondValueNumber: null,
				secondValueDate: null,
			};
		});

		const builtActions = actions.map((a) => ({
			type: a.type,
			valueText:
				a.type !== "ADD_HASHTAG"
					? a.valueText || null
					: a.hashtagId
						? null
						: a.valueText.replace(/^#/, "") || null,
			hashtagId: a.type === "ADD_HASHTAG" ? a.hashtagId || null : null,
		}));

		if (editingRule) {
			updateRule.mutate({
				id: editingRule.id,
				name: name.trim(),
				conditions: builtConditions,
				actions: builtActions,
			});
		} else {
			createRule.mutate({
				name: name.trim(),
				conditions: builtConditions,
				actions: builtActions,
			});
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[90vh] w-[600px] max-w-[80vw] sm:max-w-[90vw] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{editingRule ? "Edit rule" : "New rule"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-5 py-2">
					{/* Name */}
					<div className="space-y-1.5">
						<Label className="font-medium text-xs">Rule name</Label>
						<Input
							className="h-8 text-sm"
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Rental Property Repairs"
							value={name}
						/>
					</div>

					{/* Conditions */}
					<div className="space-y-2">
						<Label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							IF — all conditions match
						</Label>
						<div className="space-y-2">
							{conditions.map((c, i) => (
								<div className="flex items-center gap-2" key={c.id}>
									{i > 0 && (
										<span className="w-8 shrink-0 text-center font-medium text-muted-foreground text-xs">
											AND
										</span>
									)}
									{i === 0 && <div className="w-8 shrink-0" />}
									<div className="flex-1">
										<ConditionRowUI
											canRemove={conditions.length > 1}
											onRemove={() =>
												setConditions((prev) =>
													prev.filter((x) => x.id !== c.id),
												)
											}
											onUpdate={(p) => updateCondition(c.id, p)}
											row={c}
										/>
									</div>
								</div>
							))}
						</div>
						<Button
							className="h-7 gap-1 text-muted-foreground text-xs"
							onClick={() =>
								setConditions((prev) => [...prev, emptyCondition()])
							}
							size="sm"
							type="button"
							variant="ghost"
						>
							<Plus className="h-3 w-3" /> Add condition
						</Button>
					</div>

					{/* Actions */}
					<div className="space-y-2">
						<Label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							THEN — apply these actions
						</Label>
						<div className="space-y-2">
							{actions.map((a) => (
								<ActionRowUI
									canRemove={actions.length > 1}
									hashtags={hashtags ?? []}
									key={a.id}
									onRemove={() =>
										setActions((prev) => prev.filter((x) => x.id !== a.id))
									}
									onUpdate={(p) => updateAction(a.id, p)}
									row={a}
								/>
							))}
						</div>
						<Button
							className="h-7 gap-1 text-muted-foreground text-xs"
							onClick={() => setActions((prev) => [...prev, emptyAction()])}
							size="sm"
							type="button"
							variant="ghost"
						>
							<Plus className="h-3 w-3" /> Add action
						</Button>
					</div>
				</div>

				{/* Live preview */}
				{debouncedConditions.length > 0 && (
					<div className="space-y-1.5">
						<div className="flex items-center gap-2">
							<Label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Preview
							</Label>
							{hasActionsSet(actions) && (
								<span className="flex items-center gap-1 text-muted-foreground text-xs">
									<ArrowRight className="h-3 w-3" /> showing changes
								</span>
							)}
						</div>
						<div className="rounded-md border bg-muted/30 px-3">
							{previewLoading ? (
								<div className="space-y-2 py-3">
									{[0, 1, 2].map((i) => (
										<div
											className="h-4 animate-pulse rounded bg-muted"
											key={i}
										/>
									))}
								</div>
							) : !previewRows || previewRows.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-xs">
									No matching transactions found
								</p>
							) : (
								<div>
									{previewRows.map((tx) => {
										const after = applyActionsToPreview(
											tx as PreviewTx,
											actions,
										);
										return (
											<PreviewRow
												after={after}
												before={tx as PreviewTx}
												key={tx.id}
												showAfter={hasActionsSet(actions)}
											/>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						size="sm"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={isPending} onClick={handleSave} size="sm">
						{isPending ? "Saving…" : "Save rule"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
