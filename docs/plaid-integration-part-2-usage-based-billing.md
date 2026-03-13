# Feature Implementation Spec — Phase 2 Usage Tracking + Stripe Billing for Plaid

Implement **Phase 2** of the Finance Dashboard Plaid system: a **transparent usage-tracking and monthly Stripe billing system** that charges each user for the exact Plaid-related costs their activity generates.

This spec assumes **Phase 1 Plaid integration already exists** with:
- Plaid Link connection flow
- Plaid item and account persistence
- transaction sync
- balance refresh
- reconnect / disconnect flows
- incremental sync cursors
- deduplication and pending → posted handling

This Phase 2 work must integrate cleanly with the Phase 1 services and data model.

---

# Goals

Build a system that:

1. Records **billable usage events** whenever a user action causes Plaid cost
2. Stores the **exact unit cost and total cost at event time**
3. Preserves historical pricing even if prices change later
4. Aggregates uninvoiced usage monthly
5. Creates **Stripe invoice items**
6. Finalizes a monthly invoice in Stripe
7. Marks included usage events as invoiced
8. Exposes a UI for:
   - current estimated monthly charges
   - detailed usage ledger
   - billing history / invoice history
   - billing setup status

---

# Architectural Rules

## Canonical sources of truth

- **App database** is the source of truth for:
  - usage events
  - pricing snapshots
  - invoice aggregation state
  - local billing status

- **Stripe** is the source of truth for:
  - customer identity
  - payment methods
  - invoice hosting
  - collections / payment results

## Billing model

Do **not** use Stripe meters as the primary billing engine.

Use this model instead:

1. App records immutable usage events in DB
2. Monthly job aggregates those events
3. App creates Stripe invoice items from grouped usage
4. App finalizes invoice in Stripe
5. App marks DB usage events as invoiced

## Pricing model

Pricing must be stored in the app database, not hardcoded in Plaid services.

Every `UsageEvent` must store:
- `quantity`
- `unitCost`
- `totalCost`
- `currency`

So future pricing changes do not alter historical billing.

## Idempotency

All usage event creation must be idempotent.

Plaid sync retries, reconnect retries, webhook retries, and job retries must **never** double-charge users.

---

# Required Prisma Schema Changes

Add the following enums and models.

## Enums

```prisma
enum UsageEventType {
  PLAID_LINK_CONNECT
  PLAID_ITEM_EXCHANGE
  PLAID_ACCOUNTS_SYNC
  PLAID_TRANSACTIONS_SYNC
  PLAID_BALANCE_REFRESH
  PLAID_ITEM_RECONNECT
  PLAID_ITEM_WEBHOOK_SYNC
  PLAID_MANUAL_SYNC
}

enum BillingInvoiceStatus {
  DRAFT
  FINALIZED
  OPEN
  PAID
  VOID
  FAILED
}
````

## BillingProfile

One per user.

```prisma
model BillingProfile {
  id                    String   @id @default(cuid())
  userId                String   @unique

  stripeCustomerId      String   @unique
  stripeDefaultPmId     String?
  billingEmail          String?
  currency              String   @default("usd")

  billingEnabled        Boolean  @default(false)
  autoFinalizeInvoices  Boolean  @default(true)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoices              BillingInvoice[]
  usageEvents           UsageEvent[]
}
```

## BillingPrice

Stores active pricing rules over time.

```prisma
model BillingPrice {
  id                    String   @id @default(cuid())
  eventType             UsageEventType
  unitCost              Decimal  @db.Decimal(10, 4)
  currency              String   @default("usd")
  isActive              Boolean  @default(true)
  effectiveFrom         DateTime
  effectiveTo           DateTime?

  createdAt             DateTime @default(now())

  @@index([eventType, effectiveFrom, effectiveTo])
}
```

## BillingInvoice

Local representation of each invoicing cycle per user.

```prisma
model BillingInvoice {
  id                    String   @id @default(cuid())
  userId                String
  billingProfileId      String

  billingPeriodStart    DateTime
  billingPeriodEnd      DateTime

  subtotal              Decimal  @db.Decimal(12, 2)
  total                 Decimal  @db.Decimal(12, 2)
  currency              String   @default("usd")

  status                BillingInvoiceStatus
  stripeInvoiceId       String?  @unique
  stripeInvoiceUrl      String?
  finalizedAt           DateTime?
  paidAt                DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  billingProfile        BillingProfile  @relation(fields: [billingProfileId], references: [id], onDelete: Cascade)
  usageEvents           UsageEvent[]

  @@index([userId, billingPeriodStart, billingPeriodEnd])
}
```

## UsageEvent

Immutable billing ledger entry.

```prisma
model UsageEvent {
  id                    String   @id @default(cuid())
  userId                String
  billingProfileId      String?

  eventType             UsageEventType

  quantity              Int
  unitCost              Decimal  @db.Decimal(10, 4)
  totalCost             Decimal  @db.Decimal(12, 4)
  currency              String   @default("usd")

  billingPeriodStart    DateTime
  billingPeriodEnd      DateTime
  occurredAt            DateTime

  plaidItemId           String?
  plaidAccountId        String?
  syncSessionId         String?

  idempotencyKey        String   @unique
  metadata              Json?

  invoicedAt            DateTime?
  billingInvoiceId      String?
  stripeInvoiceItemId   String?
  stripeInvoiceId       String?

  createdAt             DateTime @default(now())

  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  billingProfile        BillingProfile?   @relation(fields: [billingProfileId], references: [id], onDelete: SetNull)
  billingInvoice        BillingInvoice?   @relation(fields: [billingInvoiceId], references: [id], onDelete: SetNull)

  @@index([userId, occurredAt])
  @@index([userId, billingPeriodStart, billingPeriodEnd])
  @@index([userId, invoicedAt])
  @@index([eventType, occurredAt])
}
```

## Optional: BillingRun

Recommended for safe monthly invoicing and retry handling.

```prisma
model BillingRun {
  id                    String   @id @default(cuid())
  billingPeriodStart    DateTime
  billingPeriodEnd      DateTime

  userId                String?
  status                String
  startedAt             DateTime @default(now())
  completedAt           DateTime?
  errorMessage          String?

  createdInvoiceId      String?
  stripeInvoiceId       String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([billingPeriodStart, billingPeriodEnd])
  @@index([userId, status])
}
```

---

# Seed Data Requirements

Create seed data for `BillingPrice`.

Initial seeded rows should include one active price per supported billable event type.

Example seed structure:

```ts
[
  {
    eventType: "PLAID_LINK_CONNECT",
    unitCost: "0.30",
    currency: "usd",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    isActive: true,
  },
  {
    eventType: "PLAID_TRANSACTIONS_SYNC",
    unitCost: "0.30",
    currency: "usd",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    isActive: true,
  },
  {
    eventType: "PLAID_BALANCE_REFRESH",
    unitCost: "0.10",
    currency: "usd",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    isActive: true,
  }
]
```

Use placeholder pricing values for now, but make the system fully price-driven from DB.

---

# Billable Event Definitions

Do **not** treat every low-level API request as a user-facing invoice line.

Define billable events as app-level actions tied to cost-incurring Plaid operations.

## Required billable event mappings

### `PLAID_LINK_CONNECT`

Triggered after a successful institution link flow is completed and persisted.

### `PLAID_ITEM_EXCHANGE`

Triggered after a successful `public_token -> access_token` exchange and Plaid item creation.

### `PLAID_ACCOUNTS_SYNC`

Triggered after successful account retrieval / refresh flow if this is considered billable in your pricing model.

### `PLAID_TRANSACTIONS_SYNC`

Triggered after a full successful transaction sync job is completed for an item.

Important:

* bill **once per completed sync session**
* do **not** bill per paginated `has_more` page
* do **not** bill for failed sync attempts unless explicitly desired later

### `PLAID_BALANCE_REFRESH`

Triggered after a successful balance refresh for a Plaid item or account set.

### `PLAID_ITEM_RECONNECT`

Triggered after a successful reconnect flow completes.

### `PLAID_ITEM_WEBHOOK_SYNC`

Triggered only if webhook-driven syncs are intentionally billable separately.

### `PLAID_MANUAL_SYNC`

Optional separate event if you want to distinguish user-triggered manual sync from automatic sync.

---

# Metadata Requirements for Usage Events

Each usage event should store structured metadata in `metadata` JSON.

Minimum expected examples:

```ts
{
  plaidItemId: "item_xxx",
  institutionName: "Chase",
  accountCount: 4,
  plaidEndpoint: "/transactions/sync",
  syncOrigin: "manual",
  transactionAddedCount: 32,
  transactionModifiedCount: 2,
  transactionRemovedCount: 1,
  pricingVersion: "2026-01-01",
}
```

Store enough metadata for:

* debugging
* customer support
* reconciliation
* invoice detail display in app

Do not rely on metadata for financial calculations after write time.

---

# Required Server-Side Services

Create the following services.

---

## `src/server/services/billing/billing-price.service.ts`

### Responsibilities

* resolve active price for a given event type at a given time
* enforce effective date rules
* return unit cost + currency

### Required API

```ts
getBillingPriceForEvent(input: {
  eventType: UsageEventType
  occurredAt?: Date
}): Promise<{
  billingPriceId: string
  unitCost: Prisma.Decimal
  currency: string
}>
```

### Rules

* choose the active price where:

  * `effectiveFrom <= occurredAt`
  * `effectiveTo is null OR effectiveTo > occurredAt`
  * `isActive = true`
* throw a typed error if no applicable pricing exists

---

## `src/server/services/billing/usage-ledger.service.ts`

### Responsibilities

* create immutable usage events
* enforce idempotency
* calculate billing period
* snapshot cost data
* expose queries for ledger and monthly estimates

### Required API

```ts
recordUsageEvent(input: {
  userId: string
  billingProfileId?: string | null
  eventType: UsageEventType
  quantity?: number
  occurredAt?: Date
  plaidItemId?: string
  plaidAccountId?: string
  syncSessionId?: string
  metadata?: Record<string, unknown>
  idempotencyKey: string
}): Promise<UsageEvent>
```

### Behavior

* default `quantity = 1`
* default `occurredAt = new Date()`
* load active price from `billing-price.service`
* compute `totalCost = quantity * unitCost`
* compute billing period boundaries for the event month
* insert row atomically
* if `idempotencyKey` already exists, return existing row instead of creating another

### Additional required APIs

```ts
getCurrentMonthUsageEstimate(input: {
  userId: string
}): Promise<{
  subtotal: Prisma.Decimal
  currency: string
  grouped: Array<{
    eventType: UsageEventType
    quantity: number
    totalCost: Prisma.Decimal
  }>
}>
```

```ts
getUsageLedger(input: {
  userId: string
  page: number
  pageSize: number
  from?: Date
  to?: Date
  eventType?: UsageEventType
  invoicedStatus?: "PENDING" | "INVOICED"
}): Promise<{
  items: UsageEvent[]
  totalCount: number
}>
```

---

## `src/server/services/billing/billing-profile.service.ts`

### Responsibilities

* create and manage per-user billing profile
* link Stripe customer to app user
* expose setup status

### Required API

```ts
getOrCreateBillingProfile(input: {
  userId: string
  email?: string | null
}): Promise<BillingProfile>
```

```ts
getBillingProfileByUserId(input: {
  userId: string
}): Promise<BillingProfile | null>
```

```ts
enableBilling(input: {
  userId: string
}): Promise<BillingProfile>
```

```ts
disableBilling(input: {
  userId: string
}): Promise<BillingProfile>
```

### Rules

* create Stripe customer if none exists
* persist `stripeCustomerId`
* billing should not be enabled unless a billing profile exists

---

## `src/server/services/stripe/stripe-customer.service.ts`

### Responsibilities

* thin wrapper around Stripe customer operations
* keep Stripe code isolated

### Required API

```ts
createCustomer(input: {
  userId: string
  email?: string | null
  name?: string | null
}): Promise<{
  stripeCustomerId: string
}>
```

```ts
createBillingSetupIntent(input: {
  stripeCustomerId: string
}): Promise<{
  clientSecret: string
}>
```

---

## `src/server/services/stripe/stripe-invoice.service.ts`

### Responsibilities

* create draft invoices
* create grouped invoice items
* finalize invoices
* read hosted invoice URLs

### Required API

```ts
createDraftInvoice(input: {
  stripeCustomerId: string
  currency: string
  autoFinalize?: boolean
  metadata?: Record<string, string>
}): Promise<{
  stripeInvoiceId: string
}>
```

```ts
createInvoiceItem(input: {
  stripeCustomerId: string
  stripeInvoiceId: string
  amountInCents: number
  currency: string
  description: string
  metadata?: Record<string, string>
}): Promise<{
  stripeInvoiceItemId: string
}>
```

```ts
finalizeInvoice(input: {
  stripeInvoiceId: string
}): Promise<{
  stripeInvoiceId: string
  status: string
  hostedInvoiceUrl?: string | null
}>
```

```ts
retrieveInvoice(input: {
  stripeInvoiceId: string
}): Promise<{
  stripeInvoiceId: string
  status: string
  hostedInvoiceUrl?: string | null
}>
```

---

## `src/server/services/billing/monthly-billing.service.ts`

### Responsibilities

* aggregate uninvoiced events for a billing period
* create Stripe invoice items
* create/update local BillingInvoice
* mark usage events as invoiced
* support retry-safe operation

### Required API

```ts
runMonthlyBillingForUser(input: {
  userId: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
}): Promise<{
  billingInvoiceId: string
  stripeInvoiceId?: string
  total: Prisma.Decimal
  currency: string
}>
```

```ts
runMonthlyBillingBatch(input: {
  billingPeriodStart: Date
  billingPeriodEnd: Date
}): Promise<{
  processedUserCount: number
  createdInvoiceCount: number
}>
```

### Required logic

For each user:

1. load billing profile
2. skip if billing not enabled
3. select all uninvoiced `UsageEvent`s in billing period
4. skip if none
5. group usage events by:

   * `eventType`
   * `unitCost`
   * `currency`
6. create draft Stripe invoice
7. create one Stripe invoice item per group
8. create local `BillingInvoice`
9. finalize invoice if configured
10. update all included usage events with:

* `billingInvoiceId`
* `stripeInvoiceId`
* `invoicedAt`

11. persist invoice URL / status locally

### Important grouping rule

Do not create one Stripe invoice item per raw event by default.

Create grouped lines like:

* Plaid transaction syncs — 22 × $0.30
* Plaid balance refreshes — 9 × $0.10

### Required safety behavior

* must be retry-safe
* must not double-invoice same usage events
* must detect existing local invoice for same user + period
* if Stripe fails before DB commit, do not mark usage events invoiced
* if invoice already exists for that period, return existing or resume safely

---

## `src/server/services/billing/billing-period.service.ts`

### Responsibilities

* derive billing period boundaries consistently

### Required API

```ts
getBillingPeriodForDate(input: {
  date: Date
}): {
  start: Date
  end: Date
}
```

### Rule

Use calendar month boundaries in UTC unless your app already standardizes another billing timezone.

---

# Plaid Integration Touchpoints

Integrate usage recording directly into the existing Phase 1 Plaid services.

Do **not** record usage in the UI.

Usage must be recorded only after successful server-side completion of billable actions.

## Required touchpoints

### Institution link completion

After successful public token exchange + item persistence:

* record `PLAID_LINK_CONNECT`
* optionally also record `PLAID_ITEM_EXCHANGE` if you want separate internal visibility

### Initial account fetch

After successful account sync:

* record `PLAID_ACCOUNTS_SYNC` if billable

### Transaction sync job

After a full successful sync session completes:

* record `PLAID_TRANSACTIONS_SYNC`

Metadata should include:

* item ID
* sync origin
* counts of added / modified / removed transactions
* final cursor used
* institution name if available

### Balance refresh

After a successful balance refresh:

* record `PLAID_BALANCE_REFRESH`

### Reconnect

After successful reconnect flow:

* record `PLAID_ITEM_RECONNECT`

---

# Idempotency Rules

All usage events must include a deterministic `idempotencyKey`.

## Example patterns

```ts
`plaid:link-connect:${plaidItemId}`
`plaid:item-exchange:${plaidItemId}`
`plaid:manual-sync:${plaidItemId}:${finalCursor}`
`plaid:webhook-sync:${plaidItemId}:${webhookCode}:${finalCursor}`
`plaid:balance-refresh:${plaidItemId}:${yyyyMMddHH}`
`plaid:reconnect:${plaidItemId}:${reconnectSessionId}`
```

## Required behavior

If the same event is retried:

* do not create a second charge
* return the existing `UsageEvent`

---

# Stripe Webhook Requirements

Add Stripe webhook handling for invoice lifecycle events.

Create:

`src/server/api/webhooks/stripe/route.ts`

Handle at minimum:

* `invoice.finalized`
* `invoice.paid`
* `invoice.payment_failed`
* `invoice.voided`

## Required behavior

For incoming invoice webhooks:

1. verify Stripe signature
2. locate local `BillingInvoice` by `stripeInvoiceId`
3. update local fields:

   * `status`
   * `finalizedAt`
   * `paidAt`
   * `stripeInvoiceUrl` if present

## Status mapping

Map Stripe statuses into local `BillingInvoiceStatus`.

Example:

* Stripe `draft` -> `DRAFT`
* Stripe `open` -> `OPEN`
* Stripe `paid` -> `PAID`
* Stripe `void` -> `VOID`
* payment failure case -> `FAILED`

---

# tRPC Router Requirements

Create a dedicated `billingRouter`.

Suggested file:

`src/server/api/routers/billing.ts`

## Public authenticated procedures

### `getBillingProfile`

Return:

* whether billing profile exists
* whether billing is enabled
* customer email
* default payment method presence
* currency

### `createBillingSetupIntent`

Return Stripe setup intent client secret for collecting a payment method.

### `enableBilling`

Enable billing after payment method setup is complete.

### `disableBilling`

Disable future billing activity.

### `getCurrentMonthEstimate`

Return:

* month subtotal
* grouped event totals by event type
* uninvoiced count

### `getUsageLedger`

Paginated ledger query.

Inputs:

```ts
{
  page: z.number().min(1),
  pageSize: z.number().min(1).max(100),
  from: z.date().optional(),
  to: z.date().optional(),
  eventType: z.nativeEnum(UsageEventType).optional(),
  invoicedStatus: z.enum(["PENDING", "INVOICED"]).optional(),
}
```

### `getBillingHistory`

Return paginated prior `BillingInvoice` rows.

### `getInvoiceDetails`

Return one invoice plus grouped summary and linked usage events.

### `getHostedInvoiceUrl`

Return hosted Stripe invoice URL for a given local invoice ID.

## Internal/admin procedures

These can be protected admin-only or internal server procedures.

### `previewBillingPeriod`

Returns grouped totals for a user and billing period without creating invoices.

### `runMonthlyBillingForUser`

Triggers billing for one user.

### `runMonthlyBillingBatch`

Triggers billing for all users in a billing period.

### `reconcileStripeInvoiceStatuses`

Refreshes local invoice status from Stripe.

---

# Cron Jobs / Scheduled Jobs

Implement scheduled jobs for monthly billing and optional reconciliation.

## 1. Monthly billing job

Suggested schedule:

* run shortly after month-end
* for example, 1st day of month at 02:00 UTC

### Job name

`runMonthlyBillingBatch`

### Behavior

* determine previous calendar month
* call `monthly-billing.service`
* process all billing-enabled users

## 2. Invoice reconciliation job

Suggested schedule:

* daily

### Job name

`reconcileStripeInvoiceStatuses`

### Behavior

* find recent local invoices not in terminal state
* fetch Stripe invoice state
* sync local status

## 3. Optional failed billing retry job

Suggested schedule:

* daily

### Behavior

* identify `FAILED` or partially created runs
* retry safely using billing run state

---

# UI Requirements

Use existing stack:

* Next.js App Router
* TypeScript
* Tailwind
* shadcn/ui
* tRPC

Create a billing area in settings or a dedicated billing page.

Suggested route structure:

* `/settings/billing`
* or `/dashboard/billing`

---

## 1. Billing Overview Card

Show:

* current estimated charges this month
* next invoice period end date
* billing enabled / disabled state
* payment method on file status
* Stripe customer setup status

### Required actions

* set up billing
* update payment method
* enable billing
* disable billing

### UI components

* `Card`
* `Badge`
* `Button`
* `Alert`

---

## 2. Cost Transparency Breakdown

Show grouped current-month usage by event type.

Example rows:

* Plaid transaction syncs
* Plaid balance refreshes
* Plaid reconnects

Each row should show:

* event type label
* quantity
* unit cost
* subtotal

### UI components

* `Card`
* `Table`

---

## 3. Usage Ledger Table

Display raw usage events.

### Required columns

* Date / time
* Event type
* Institution or item reference
* Quantity
* Unit cost
* Total cost
* Status
* Actions

### Status values

* Pending invoice
* Invoiced
* Paid

### Row actions

* view metadata/details drawer

### Filters

* date range
* event type
* invoiced status

### UI components

* `DataTable` or shadcn `Table`
* `Select`
* `Popover`
* `Sheet` or `Dialog` for metadata details
* `Pagination`

---

## 4. Billing History

Show prior invoices.

### Required columns

* Billing period
* Invoice total
* Status
* Created at
* Paid at
* Open in Stripe-hosted invoice

### Row actions

* open hosted invoice
* view invoice details inside app

### UI components

* `Card`
* `Table`
* `Badge`
* `Button`

---

## 5. Invoice Detail View

Show:

* billing period summary
* grouped line items
* linked usage events
* hosted invoice URL

### UI components

* `Dialog` or dedicated page
* `Card`
* `Table`
* `Separator`

---

# UI Copy Requirements

The UI should clearly communicate that:

* billing is usage-based
* users are charged only for tracked billable Plaid activity
* current month totals are estimated until invoiced

Example copy:

* “Your current total is an estimate based on tracked Plaid usage this billing period.”
* “Charges are grouped into a monthly invoice at the end of each billing cycle.”
* “Historical charges preserve the exact pricing active when each event occurred.”

---

# Required Utility / Formatting Helpers

Create reusable helpers for:

## Currency formatting

```ts
formatCurrency(amount: Decimal | number, currency = "usd")
```

## Event type labeling

```ts
getUsageEventTypeLabel(eventType: UsageEventType): string
```

## Billing status labeling

```ts
getBillingInvoiceStatusLabel(status: BillingInvoiceStatus): string
```

## Stripe amount conversion

```ts
decimalDollarsToIntegerCents(value: Decimal | string | number): number
```

Avoid floating point math for final invoice calculations.

---

# Validation / Zod Requirements

Add Zod schemas for:

* billing setup actions
* usage ledger query filters
* billing history query filters
* invoice detail request
* monthly billing preview request

All billing mutation procedures must validate authenticated ownership.

---

# Implementation Constraints

## Decimal handling

Use Prisma Decimal for all persisted cost math.

Do not use JS floats for:

* unitCost
* totalCost
* subtotal
* invoice total

Convert to integer cents only at the Stripe boundary.

## Invoice item descriptions

Descriptions must be human-readable.

Examples:

* `Plaid transaction syncs — 22 × $0.30`
* `Plaid balance refreshes — 9 × $0.10`

## Ownership

Users must only access:

* their own billing profile
* their own usage events
* their own invoices

## Failure behavior

If Stripe invoice creation fails:

* do not mark usage events invoiced
* preserve local error state
* allow safe retry

---

# Suggested File Structure

```text
src/
  server/
    api/
      routers/
        billing.ts
      webhooks/
        stripe/
          route.ts
    services/
      billing/
        billing-price.service.ts
        billing-period.service.ts
        billing-profile.service.ts
        usage-ledger.service.ts
        monthly-billing.service.ts
        billing-reconciliation.service.ts
      stripe/
        stripe-customer.service.ts
        stripe-invoice.service.ts
      plaid/
        ...existing plaid services updated to call usage-ledger.service
  app/
    (dashboard)/
      settings/
        billing/
          page.tsx
          _components/
            billing-overview-card.tsx
            billing-setup-card.tsx
            current-month-breakdown.tsx
            usage-ledger-table.tsx
            billing-history-table.tsx
            invoice-detail-dialog.tsx
  lib/
    billing/
      formatters.ts
      labels.ts
      stripe.ts
      zod.ts
prisma/
  schema.prisma
  seed/
    billing-prices.ts
```

---

# Required End-to-End Flows

## Flow 1 — User sets up billing

1. User opens Billing page
2. System loads or creates `BillingProfile`
3. User adds payment method via Stripe setup intent
4. User enables billing
5. UI confirms billing is active

## Flow 2 — User performs billable Plaid action

1. User runs manual sync or link flow
2. Existing Plaid service completes successfully
3. Plaid service calls `recordUsageEvent`
4. Event is stored with exact cost snapshot
5. UI current-month estimate reflects updated subtotal

## Flow 3 — Month-end invoice generation

1. Scheduled job selects previous billing period
2. System loads uninvoiced events
3. System groups events
4. Stripe invoice + invoice items created
5. Local `BillingInvoice` created
6. Usage events marked invoiced
7. Stripe invoice finalized
8. User sees invoice in billing history

## Flow 4 — Invoice payment update

1. Stripe sends `invoice.paid`
2. Webhook verifies event
3. Local `BillingInvoice.status` becomes `PAID`
4. Billing history UI updates

---

# Testing Requirements

Implement tests for all critical billing logic.

## Unit tests

### `billing-price.service`

* resolves correct active price
* rejects missing price
* respects effective date ranges

### `usage-ledger.service`

* creates event with correct cost math
* stores correct billing period
* enforces idempotency
* returns existing row on duplicate key

### `monthly-billing.service`

* groups uninvoiced events correctly
* creates invoice only once per period
* marks events invoiced
* does not mark invoiced when Stripe call fails
* handles empty event set safely

### billing period utility

* produces correct month boundaries

## Integration tests

* billing-enabled user can create setup intent
* manual sync records usage event
* month-end run creates local invoice row
* Stripe webhook updates local invoice status

## UI tests

* billing page renders overview
* ledger filters work
* billing history displays invoice status
* invoice detail dialog shows grouped lines

---

# Acceptance Criteria

The feature is complete when all of the following are true:

1. A user can create a Stripe-backed billing profile
2. Billing can be enabled and disabled per user
3. Successful Plaid billable actions create immutable usage events
4. Usage events snapshot exact cost at event time
5. Duplicate retries do not create duplicate charges
6. Current month estimate is queryable and visible in UI
7. Usage ledger is paginated and filterable
8. Monthly billing job aggregates uninvoiced usage correctly
9. Stripe invoice items are created from grouped usage
10. Local `BillingInvoice` rows are persisted and linked
11. Usage events are marked invoiced only after successful invoice creation flow
12. Stripe invoice webhooks update local invoice statuses
13. Billing history is visible in the UI
14. Users can open hosted Stripe invoices from the app
15. The system is retry-safe and does not double-bill

---

# Implementation Notes for the Coding Agent

* Reuse existing auth/session patterns already present in the app
* Reuse existing tRPC protected procedure helpers
* Reuse existing dashboard table UI patterns where possible
* Keep Stripe code isolated from core billing ledger logic
* Keep Plaid services focused on Plaid operations and call billing services only after successful completion
* Favor small, composable services over a single large billing module
* Preserve full TypeScript typing throughout
* Add clear server-side logs around billing runs and Stripe failures
* Do not block Plaid sync success if billing event recording fails silently without logging; instead:

  * log the billing failure
  * return operational success for Plaid action if business decision is to avoid UX disruption
  * or fail the action explicitly only if strict accounting consistency is required

Preferred default:

* Plaid operational success should remain primary
* billing event creation failure should be logged and surfaced internally for reconciliation unless product requirements say otherwise

---

# Final Deliverable

Implement all code required for:

* Prisma schema changes
* seed data
* billing services
* Stripe services
* Plaid integration touchpoints
* tRPC router
* Stripe webhook route
* scheduled job entrypoints
* billing UI pages and components
* tests for critical billing flows
