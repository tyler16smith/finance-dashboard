import type { RuleField, RuleOperator, TransactionRuleCondition } from "../../../generated/prisma";

export type MatchableTransaction = {
	description: string | null;
	account: string | null;
	amount: number;
	category: string;
	date: Date;
	// merchant and notes are not yet columns; fall back to description/null
};

function getFieldValue(tx: MatchableTransaction, field: RuleField): string | number | Date | null {
	switch (field) {
		case "MERCHANT":
		case "DESCRIPTION":
			return tx.description;
		case "AMOUNT":
			return tx.amount;
		case "CATEGORY":
			return tx.category;
		case "DATE":
			return tx.date;
		case "ACCOUNT":
			return tx.account;
		case "NOTES":
			return null;
	}
}

function matchText(value: string | null, op: RuleOperator, target: string): boolean {
	const v = (value ?? "").toLowerCase();
	const t = target.toLowerCase();
	switch (op) {
		case "CONTAINS":     return v.includes(t);
		case "NOT_CONTAINS": return !v.includes(t);
		case "STARTS_WITH":  return v.startsWith(t);
		case "ENDS_WITH":    return v.endsWith(t);
		case "EQUALS":       return v === t;
		case "NOT_EQUALS":   return v !== t;
		case "IS_EMPTY":     return v.trim() === "";
		case "IS_NOT_EMPTY": return v.trim() !== "";
		default:             return false;
	}
}

function matchNumber(value: number, op: RuleOperator, target: number, second?: number): boolean {
	switch (op) {
		case "EQUALS":                return value === target;
		case "NOT_EQUALS":            return value !== target;
		case "GREATER_THAN":          return value > target;
		case "GREATER_THAN_OR_EQUAL": return value >= target;
		case "LESS_THAN":             return value < target;
		case "LESS_THAN_OR_EQUAL":    return value <= target;
		case "BETWEEN":               return second !== undefined ? value >= target && value <= second : false;
		case "IS_EMPTY":              return false;
		case "IS_NOT_EMPTY":          return true;
		default:                      return false;
	}
}

function matchDate(value: Date, op: RuleOperator, target: Date, second?: Date): boolean {
	const v = value.getTime();
	const t = target.getTime();
	switch (op) {
		case "ON":      return new Date(v).toDateString() === new Date(t).toDateString();
		case "BEFORE":  return v < t;
		case "AFTER":   return v > t;
		case "BETWEEN": return second !== undefined ? v >= t && v <= second.getTime() : false;
		default:        return false;
	}
}

export function matchCondition(
	tx: MatchableTransaction,
	condition: Pick<
		TransactionRuleCondition,
		"field" | "operator" | "valueText" | "valueNumber" | "valueDate" | "secondValueNumber" | "secondValueDate"
	>,
): boolean {
	const raw = getFieldValue(tx, condition.field);
	const op = condition.operator;

	// Numeric field
	if (condition.field === "AMOUNT") {
		const num = typeof raw === "number" ? raw : Number(raw);
		const target = condition.valueNumber ?? 0;
		const second = condition.secondValueNumber ?? undefined;
		return matchNumber(num, op, target, second ?? undefined);
	}

	// Date field
	if (condition.field === "DATE") {
		const d = raw instanceof Date ? raw : new Date(String(raw));
		const target = condition.valueDate ?? new Date(0);
		const second = condition.secondValueDate ?? undefined;
		return matchDate(d, op, target, second ?? undefined);
	}

	// Text fields
	if (op === "IS_EMPTY" || op === "IS_NOT_EMPTY") {
		return matchText(String(raw ?? ""), op, "");
	}
	return matchText(String(raw ?? ""), op, condition.valueText ?? "");
}

export function matchAllConditions(
	tx: MatchableTransaction,
	conditions: Parameters<typeof matchCondition>[1][],
): boolean {
	return conditions.every((c) => matchCondition(tx, c));
}
