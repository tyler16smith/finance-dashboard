import type { SortKey, TxClassification } from "./types";

export function fuzzyScore(candidate: string, query: string): number | null {
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

export const formatAmount = (value: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);

export const SORT_LABELS: Record<SortKey, string> = {
	"date-desc": "Date (newest)",
	"date-asc": "Date (oldest)",
	"amount-desc": "Amount (high → low)",
	"amount-asc": "Amount (low → high)",
	"account-asc": "Account (A → Z)",
	"account-desc": "Account (Z → A)",
};

export const CLASSIFICATION_LABELS: Record<TxClassification, string> = {
	INCOME: "✅ Income",
	EXPENSE: "💸 Expense",
	SKIP: "🚫 Skip",
};
