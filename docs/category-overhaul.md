# Category Overhaul Plan

## Conceptual Model (Important)

There are two separate, independent axes on every transaction:

| Field | Values | Purpose |
|-------|--------|---------|
| `type` | `INCOME \| EXPENSE \| SKIP` | Cash flow — drives all financial calculations |
| `category` | "Eating Out", "Groceries", etc. | Spending analysis only — has no effect on calculations |

The onboarding classify step sets **`type`**. Categories tell you *where* money went, not *which direction* it flowed. These must not be conflated.

---

## Goals

- Replace the keyword-based `normalizeCategory()` heuristic with a proper `Category` table
- Seed a set of global default categories that all users share
- Allow users to bring in their own categories during CSV import, which override/extend the defaults
- Migrate existing transaction `category` strings to the new system (best-effort; remainder → "Uncategorized")
- Keep the UI showing categories from the new table, with a management page for CRUD

---

## Schema Changes

### New `Category` model

```prisma
model Category {
    id        String   @id @default(cuid())
    userId    String?  // null = global default; set = user-specific
    name      String
    isDefault Boolean  @default(false)
    sortOrder Int      @default(0)

    user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
    transactions Transaction[]

    @@unique([userId, name])   // per-user names must be unique; nulls excluded by postgres
    @@index([userId])
}
```

Notes:
- `userId = null` → global default visible to all users
- `userId = <id>` → user's own category (created during import or manually)
- No `type` field — categories are purely descriptive and have no relationship to INCOME/EXPENSE/SKIP
- No `color` field for now; can add later

### Changes to `Transaction`

Add a nullable FK alongside the existing `category` string:

```prisma
model Transaction {
    ...
    categoryId  String?
    category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
    ...
}
```

> **Migration strategy:** after seeding/migrating, the old `category String @default("OTHER")` column can be dropped in a follow-up migration once the UI is fully switched over. For now keep both during the transition to avoid breaking existing queries.

---

## Default Categories (Seed Data)

Seeded as global defaults (`userId = null`). No type — purely organizational names.

| Name | sortOrder |
|------|-----------|
| Income | 0 |
| Salary | 1 |
| Reimbursement | 2 |
| Eating Out | 10 |
| Groceries | 11 |
| Coffee | 12 |
| Mortgage & Rent | 20 |
| Home | 21 |
| Bills & Utilities | 22 |
| Insurance | 23 |
| Auto & Transport | 30 |
| Gas | 31 |
| Cars | 32 |
| Travel | 40 |
| Flights | 41 |
| Shopping | 50 |
| Clothing | 51 |
| Entertainment | 60 |
| Sports & Fitness | 61 |
| Health & Medical | 70 |
| Kids | 80 |
| Gifts | 90 |
| Gifts & Donations | 91 |
| Donations | 92 |
| Business Services | 100 |
| Investments | 110 |
| Loans | 120 |
| Taxes | 130 |
| Fees | 140 |
| Uncategorized | 999 |

Seeded via a Prisma seed script (`prisma/seed.ts`). Re-running the seed is idempotent (upsert by `userId=null, name`).

---

## Import Flow Changes

### The classify step sets type, not category

The classify step UI maps raw CSV values (e.g. "Transfer", "Eating out") → `INCOME | EXPENSE | SKIP`. This result sets `transaction.type` and controls which rows are skipped entirely. **It does not set the category.**

The raw CSV category string (e.g. "Eating out") separately drives which `Category` record gets linked to the transaction.

These are two independent operations happening in the same step.

### What changes in `/api/import`

After the file is parsed and before transactions are inserted:

1. **Resolve categories** — for each unique non-SKIP raw CSV category value, look up a matching `Category` for this user:
   - First check user-specific categories (`userId = session.user.id`) by name (case-insensitive)
   - Fall back to global defaults (`userId = null`) by name (case-insensitive)
   - If no match, create a new user-specific `Category` with the raw name
2. **Build a `rawValue → categoryId` map** in memory for the import batch
3. **Set `categoryId`** on each transaction row instead of calling `normalizeCategory()`
4. SKIP-classified rows continue to be dropped during import (no change)

Drop `normalizeCategory()` from the import path entirely.

### Handling rows with no category column

If the CSV has no category column mapped, assign the "Uncategorized" global default.

---

## Migration Plan

Run a one-time migration script after deploying the schema changes:

1. Ensure seed data exists (global defaults)
2. For each existing transaction, match the old normalized `category` string to a global default:

| Old `category` string | Maps to global default |
|-----------------------|------------------------|
| FOOD | Eating Out |
| HOUSING | Mortgage & Rent |
| TRANSPORTATION | Auto & Transport |
| ENTERTAINMENT | Entertainment |
| SUBSCRIPTIONS | Bills & Utilities |
| UTILITIES | Bills & Utilities |
| TRAVEL | Travel |
| SHOPPING | Shopping |
| HEALTHCARE | Health & Medical |
| EDUCATION | Uncategorized |
| OTHER | Uncategorized |

3. Set `categoryId` on each transaction to the matched global default's id
4. Any unmatched `category` string → "Uncategorized"

This runs as a standalone `ts-node` script after the schema migration.

---

## New API Routes / tRPC Procedures

Add a `category` router (`src/server/api/routers/category.ts`):

| Procedure | Description |
|-----------|-------------|
| `category.list` | Returns global defaults + user's own categories |
| `category.create` | Creates a user-specific category |
| `category.update` | Rename a user category |
| `category.delete` | Delete a user category; transactions fall back to "Uncategorized" |

Register in `src/server/api/root.ts`.

---

## UI Changes

### Transactions page
- Category column shows `transaction.category` (string) — switch to `transaction.category.name` via the relation
- Category filter dropdown switches from old string values to category names

### New: Category management page
- Route: `/dashboard/categories`
- Shows global defaults (read-only, labeled as such) + user's own categories (editable)
- Add category form: name only
- Inline rename / delete for user categories
- Add to sidebar nav

### Spending page
- Switch category grouping from the old string to `categoryId` / `category.name`

### Onboarding / re-import classify step
- No UI change needed — behavior is unchanged from the user's perspective

---

## Files to Change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `Category` model, add `categoryId` FK on `Transaction` |
| `prisma/seed.ts` | Create/upsert global default categories |
| `src/app/api/import/route.ts` | Replace `normalizeCategory()` with category resolution logic |
| `src/lib/category-normalize.ts` | Remove `normalizeCategory()`; keep `suggestClassification`, `buildDefaultClassifications`, `suggestMapping` |
| `src/server/api/routers/category.ts` | New file — list/create/update/delete procedures |
| `src/server/api/root.ts` | Register `category` router |
| `src/server/api/routers/transaction.ts` | Update queries to include `category` relation |
| `src/app/dashboard/transactions/page.tsx` | Switch category display to relation |
| `src/app/dashboard/spending/page.tsx` | Switch category grouping to relation |
| `src/app/dashboard/categories/page.tsx` | New page — category management |
| `src/components/layout/sidebar.tsx` | Add Categories nav item |
| `prisma/migrations/...` | Schema migration + data migration script |

---

## Open Questions

- **Merging duplicates on re-import**: if a user imports a second CSV and the raw value "eating out" (lowercase) already exists as "Eating Out" — the case-insensitive lookup handles this. No fuzzy matching for now.
- **Rules engine**: the `CATEGORY` rule condition currently matches against the old string values (e.g. `"FOOD"`). After migration it should match against `category.name`. The condition matcher needs updating to fetch/compare the name from the relation.
