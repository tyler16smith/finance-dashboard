export type TxRecord = Record<string, unknown> & { id: string };
export type PatchCache = (updater: (tx: TxRecord) => TxRecord | null) => void;

export type TxClassification = "INCOME" | "EXPENSE" | "SKIP";
export type TypeFilter = "ALL" | "INCOME" | "EXPENSE";
export type SortKey =
	| "date-desc"
	| "date-asc"
	| "amount-desc"
	| "amount-asc"
	| "account-asc"
	| "account-desc";
