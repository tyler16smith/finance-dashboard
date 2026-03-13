export const INTERNAL_FIELDS = [
	{ key: "date", label: "Date", required: true },
	{ key: "amount", label: "Amount", required: true },
	{ key: "type", label: "Type (income/expense)", required: false },
	{ key: "description", label: "Description", required: false },
	{ key: "category", label: "Category", required: false },
	{ key: "account", label: "Account", required: false },
] as const;

export type InternalFieldKey = (typeof INTERNAL_FIELDS)[number]["key"];

const CLASSIFICATION_SKIP_KEYWORDS = [
	"transfer",
	"payment",
	"credit card payment",
	"balance transfer",
	"internal transfer",
	"zelle",
	"wire",
];

const CLASSIFICATION_INCOME_KEYWORDS = [
	"income",
	"paycheck",
	"salary",
	"direct deposit",
	"deposit",
	"refund",
	"reward",
	"credit",
	"bonus",
];

export type CategoryClassification = "INCOME" | "EXPENSE" | "SKIP";

export function suggestClassification(rawValue: string): CategoryClassification {
	const lower = rawValue.toLowerCase().trim();
	if (CLASSIFICATION_SKIP_KEYWORDS.some((kw) => lower.includes(kw))) {
		return "SKIP";
	}
	if (CLASSIFICATION_INCOME_KEYWORDS.some((kw) => lower.includes(kw))) {
		return "INCOME";
	}
	return "EXPENSE";
}

export function buildDefaultClassifications(
	entries: { value: string; count: number }[],
): Record<string, { classification: CategoryClassification; count: number }> {
	const result: Record<
		string,
		{ classification: CategoryClassification; count: number }
	> = {};
	for (const entry of entries) {
		result[entry.value] = {
			classification: suggestClassification(entry.value),
			count: entry.count,
		};
	}
	return result;
}

export function suggestMapping(headers: string[]): Record<string, string> {
	const suggestions: Record<string, string> = {};
	const fieldKeywords: Record<InternalFieldKey, string[]> = {
		date: ["date", "time", "posted", "transaction date", "trans date"],
		amount: ["amount", "sum", "total", "price", "debit", "credit", "value"],
		type: ["type", "transaction type", "credit/debit", "direction"],
		description: [
			"description",
			"memo",
			"note",
			"narration",
			"details",
			"merchant",
			"payee",
			"name",
		],
		category: ["category", "cat", "tag", "label", "type"],
		account: ["account", "acct", "bank", "card"],
	};

	for (const header of headers) {
		const lower = header.toLowerCase().trim();
		for (const [field, keywords] of Object.entries(fieldKeywords) as [
			InternalFieldKey,
			string[],
		][]) {
			if (keywords.some((kw) => lower.includes(kw))) {
				if (!suggestions[field]) {
					suggestions[field] = header;
				}
			}
		}
	}

	return suggestions;
}
