# Category Classification Step — Onboarding Plan

## Problem

The current import pipeline misclassifies transactions in two ways that corrupt the dashboard numbers:

1. **Transfers and credit card payments are included.** Banks export everything — including internal transfers (checking → savings) and credit card payment rows — as real transactions. These inflate both income and expenses depending on their sign/direction.

2. **Income/expense inference is unreliable.** When no `type` column is mapped, we fall back to the sign of the amount. Many bank exports (Chase, Capital One) use all-positive amounts with a separate column indicating debit vs. credit. Without that column mapped correctly, everything becomes income.

The root fix: **let the user tell us, once, what each unique category value means** — Income, Expense, or Skip — before any data is committed.

---

## Current Flow

```
Upload CSV → Map Columns → Import → Done
```

---

## Proposed Flow

```
Upload CSV → Map Columns → Classify Categories → Import → Done
```

A new **"Classify Categories"** step is inserted between column mapping and import. It:
- Reads all unique values from the mapped category column (and/or type column)
- Pre-fills smart defaults based on known keywords
- Lets the user override any value
- Sends the final classification map to the import API

---

## New Step: Classify Categories

### When it appears

After the user clicks "Continue" on the column mapping step. Only shown if the user has mapped a `category` **or** `type` column. If neither is mapped, we skip straight to import (the user gets a warning that accuracy may be lower).

### What the user sees

A table of every unique raw value found in those columns, with a dropdown next to each:

| Raw value from CSV      | Classify as       |
|-------------------------|-------------------|
| Income                  | ✅ Income          |
| Direct Deposit          | ✅ Income          |
| Groceries               | 💸 Expense         |
| Shopping                | 💸 Expense         |
| Credit Card Payment     | 🚫 Skip            |
| Transfer                | 🚫 Skip            |
| Payment                 | 🚫 Skip            |

Options per row: **Income / Expense / Skip (do not import)**

A small count badge shows how many rows each value represents, so the user understands the impact of their choices (e.g. "Transfer — 14 rows").

### Smart defaults

Pre-fill based on keyword matching on the raw value (case-insensitive):

| Default    | Keywords to match                                                                      |
|------------|----------------------------------------------------------------------------------------|
| Income     | income, paycheck, salary, direct deposit, deposit, refund, reward, credit, bonus       |
| Skip       | transfer, payment, credit card payment, balance transfer, internal transfer, zelle, wire |
| Expense    | everything else                                                                         |

---

## Data Flow Changes

### 1. `onboarding-flow.tsx`

- Add a new `Step` value: `"categorize"`
- After column mapping is confirmed, parse the full CSV client-side to collect unique values from the mapped category + type columns
- Render the classification table UI
- Store the result as `categoryMap: Record<string, "INCOME" | "EXPENSE" | "SKIP">`
- Pass `categoryMap` to the import API alongside the existing `mapping`

State additions:
```ts
type Step = "upload" | "mapping" | "categorize" | "importing" | "done";

// unique values → { classification, count }
type CategoryClassification = "INCOME" | "EXPENSE" | "SKIP";
type CategoryEntry = { classification: CategoryClassification; count: number };
const [categoryMap, setCategoryMap] = useState<Record<string, CategoryEntry>>({});
```

### 2. `src/app/api/import/route.ts`

Accept a new optional field in the request body:
```ts
categoryClassifications: Record<string, "INCOME" | "EXPENSE" | "SKIP">
```

When processing each row:
1. Look up the row's category/type raw value in `categoryClassifications`
2. If `"SKIP"` → skip the row (increment skippedCount)
3. If `"INCOME"` or `"EXPENSE"` → use that, ignore `inferType`
4. If not found in the map (or no map provided) → fall back to existing `inferType` logic

```ts
// Priority order for type resolution:
// 1. categoryClassifications lookup (user-defined)
// 2. inferType (sign-based fallback)
```

### 3. `src/lib/category-normalize.ts`

Add two new exports:

```ts
// Returns smart default classification for a raw category string
export function suggestClassification(
  rawValue: string
): "INCOME" | "EXPENSE" | "SKIP"

// Builds the initial categoryMap from an array of { value, count } entries
export function buildDefaultClassifications(
  entries: { value: string; count: number }[]
): Record<string, { classification: CategoryClassification; count: number }>
```

---

## Replace vs. Append on Re-import

When a user imports a new CSV (e.g. a fresh monthly export), they should be able to **replace all existing transaction data** rather than append to it. Investment data is never touched.

### Why

- Storage is not free — there's no reason to accumulate overlapping or stale transaction history
- A fresh full export from the bank is the source of truth; old data becomes noise
- Appending causes duplicate transactions if date ranges overlap between exports

### How it works

On the upload step, if the user already has transaction data, show a choice:

```
○ Replace existing data  (default)
  Deletes all current income/expense transactions and imports this file fresh.

○ Add to existing data
  Appends without removing anything. Use this if your CSV covers a new date range only.
```

Default is **Replace**. This is the safe choice for the common case: user downloads their full history from the bank once a month and re-uploads.

The selected mode is passed to the import API as `mode: "replace" | "append"`.

### API change (`src/app/api/import/route.ts`)

```ts
// Accept mode in request body
mode: z.enum(["replace", "append"]).default("replace")

// If mode === "replace", delete all existing transactions for the user
// before inserting the new batch. Investments are untouched.
if (mode === "replace") {
  await db.transaction.deleteMany({ where: { userId: session.user.id } });
}
```

This runs inside the same request before `createMany`, so if the insert fails the user at least knows their old data was cleared (we can wrap in a transaction to be safe and roll back on failure).

### State addition (`onboarding-flow.tsx`)

```ts
const [importMode, setImportMode] = useState<"replace" | "append">("replace");
```

The mode selector appears on the upload step, but only if `api.transaction.hasData()` returns true (i.e. this is not a first-time import). First-time users never see the choice.

---

## Files to Change

| File | Change |
|------|--------|
| `src/app/onboarding/onboarding-flow.tsx` | Add `categorize` step, collect unique values, render classification UI, pass `categoryMap` and `mode` to API; show replace/append toggle on upload step when existing data exists |
| `src/app/api/import/route.ts` | Accept + apply `categoryClassifications`; rows with `SKIP` are excluded; if `mode === "replace"`, delete all user transactions before insert |
| `src/lib/category-normalize.ts` | Add `suggestClassification()` and `buildDefaultClassifications()` |

---

## What Stays the Same

- The existing column mapping step is unchanged
- `normalizeCategory()` (keyword → FOOD / HOUSING / etc.) is still used after type is determined — it handles the expense sub-category, not income/expense classification
- The `inferType` fallback is kept for cases where the user skips the classify step
- Investment data (`Investment` table) is never modified by any import operation

---

## Open Questions

- **Persist the classification map per-user?** After the first import, save the `categoryMap` so re-imports pre-fill it automatically. Saves users from re-classifying "Transfer" every time. Could store as JSON on a `UserSettings` table or in the existing `CsvColumnMapping` model.
- **What if neither category nor type column is mapped?** Skip the classify step entirely, warn the user that all transactions will be classified by amount sign only.
- **Should "Skip" rows still be stored?** No. Drop at parse time, count in `skippedCount` only.
