# Feature Implementation Plan — Phase 1: Pure Plaid Integration

Implement **Phase 1 only** of Plaid support in the existing **Finance Dashboard** codebase.

This phase is strictly limited to the **core Plaid integration** and must **not** include user billing, usage-based pricing, Stripe invoicing, or usage ledger UI.

Produce **implementation-ready code** that integrates cleanly into the current stack and follows the existing project architecture and coding conventions.

---

# Goal

Add **Plaid bank account connectivity** so users can securely connect financial institutions and import account + transaction data into the app.

This feature should make Plaid an **optional sync source** alongside the existing CSV import flow.

CSV import must remain fully supported and unchanged.

---

# Scope of This Phase

This phase includes:

- Plaid Link token creation
- public token exchange
- secure access token storage
- institution connection persistence
- account sync
- transaction import
- incremental sync with cursor support
- manual sync
- reconnect flow support
- disconnect flow
- deduplication
- integration into the existing transaction system
- authenticated tRPC procedures
- React UI components using shadcn/ui

This phase does **not** include:

- usage tracking
- billing metrics
- Stripe
- invoice previews
- usage ledgers
- monthly billing aggregation
- scheduled sync automation
- Plaid webhooks
- background retry systems

Those will be implemented in a separate later phase.

---

# Project Stack

This project uses the **T3 stack**:

- Next.js (App Router)
- TypeScript
- TailwindCSS
- tRPC
- Prisma
- Postgres (Neon)
- Auth.js / NextAuth
- shadcn/ui
- Recharts

Follow the existing architecture and conventions already present in the codebase.

---

# Product Context

This app is a personal finance dashboard that already supports manual CSV imports with column mapping and transaction normalization.

Plaid should be introduced as an **additional transaction/account source**, not as a replacement for CSV import.

The transaction system should continue to support:

- raw imported values
- normalized values
- downstream rule processing
- future forecasting and reporting

Plaid-imported transactions must fit into that same data flow.

---

# Plaid Architecture Requirements

Use the **standard Plaid architecture**:

- The application owns **one Plaid developer account**
- End users do **not** provide their own Plaid credentials or API keys
- Plaid secrets remain **server-side only**

Required token flow:

1. Server creates `link_token`
2. Client launches Plaid Link
3. Client receives `public_token`
4. Server exchanges `public_token` for `access_token`
5. Server stores `access_token` in encrypted form
6. Server fetches institution/accounts/transactions and persists them

Never expose access tokens to the client.

Never store plaintext access tokens in the database.

---

# Deliverables

The implementation output should include:

- Prisma schema updates
- Plaid client/server utilities
- encryption utilities
- service-layer Plaid integration
- tRPC router/procedures
- React UI components using shadcn/ui
- transaction import + deduplication logic
- reconnect/disconnect flows
- types and helpers needed for the feature

Code should be complete enough to integrate directly into the existing app with minimal additional scaffolding.

---

# Required File Structure

Create new code in the following locations:

```txt
src/server/api/routers/plaid.ts
src/server/services/plaidService.ts
src/server/services/plaidSyncService.ts
src/server/lib/encryption.ts
src/server/lib/plaidClient.ts

src/components/plaid/ConnectInstitutionButton.tsx
src/components/plaid/ConnectedInstitutionsList.tsx
src/components/plaid/AccountCard.tsx
src/components/plaid/SyncButton.tsx
````

If small supporting files are needed, add them in the most logical existing project locations, but keep the architecture centered around the files above.

---

# Environment Variables

Add and use the required Plaid environment variables.

Expected environment variables:

```env
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
PLAID_REDIRECT_URI=
PLAID_WEBHOOK=
PLAID_ENCRYPTION_KEY=
```

Implementation requirements:

* use server-only access to env vars
* validate required env vars at startup where appropriate
* make Plaid environment configurable
* do not hardcode credentials or environments
* do not expose secrets to the client

`PLAID_ENCRYPTION_KEY` should be used for encrypting access tokens before database persistence.

---

# Prisma Schema Changes

Add the following models.

## PlaidItem

Represents one Plaid connection/login for a user.

Required fields:

* id
* userId
* plaidItemId
* institutionId
* institutionName
* accessTokenEncrypted
* lastSyncAt
* lastSuccessfulSyncAt
* lastErrorCode
* lastErrorMessage
* requiresReconnect
* cursor
* createdAt
* updatedAt

Behavior:

* belongs to a user
* stores encrypted Plaid access token
* stores Plaid item identifier
* stores cursor for incremental transaction sync
* stores reconnect/error state

Recommended constraints/indexes:

* unique on `plaidItemId`
* index on `userId`
* index on `requiresReconnect`

---

## PlaidAccount

Represents an account under a Plaid item.

Required fields:

* id
* userId
* plaidItemId
* plaidAccountId
* name
* officialName
* mask
* type
* subtype
* currentBalance
* availableBalance
* currency
* isActive
* lastBalanceSyncAt
* createdAt
* updatedAt

Behavior:

* belongs to a user
* belongs to a Plaid item
* stores latest account metadata and balances
* supports soft deactivation if account is no longer returned

Recommended constraints/indexes:

* unique on `plaidAccountId`
* index on `userId`
* index on `plaidItemId`

---

# Existing Transaction Model Integration

Extend the existing transaction model to support source-aware imports.

Add fields as needed to the existing transaction table/model:

* `source`
* `externalTransactionId`
* `plaidAccountId`
* `plaidItemId`
* `sourceAccountId`
* `importBatchId`
* `pending`

Use `source` enum values:

```txt
CSV
PLAID
MANUAL
```

Behavior requirements:

* Plaid imports must set `source = PLAID`
* `externalTransactionId` should store the Plaid transaction ID
* `plaidAccountId` should link imported transactions to the Plaid account
* `plaidItemId` should link imported transactions to the Plaid item
* `pending` should reflect Plaid pending transaction state when relevant
* imported Plaid values must preserve raw source values while still fitting into the app’s normalization pipeline

If the existing schema already has overlapping concepts, adapt carefully rather than duplicating fields.

---

# Relations

Add Prisma relations between:

* User ↔ PlaidItem
* User ↔ PlaidAccount
* PlaidItem ↔ PlaidAccount
* PlaidItem ↔ Transaction
* PlaidAccount ↔ Transaction

All relational ownership and queries must remain scoped to the authenticated user.

---

# Plaid Client Utility

Create:

```txt
src/server/lib/plaidClient.ts
```

Responsibilities:

* instantiate and export configured Plaid API client
* map env vars to correct Plaid environment
* centralize Plaid SDK setup
* avoid duplicated client configuration in services

Implementation should be server-only.

---

# Encryption Utility

Create:

```txt
src/server/lib/encryption.ts
```

Responsibilities:

* encrypt sensitive Plaid access tokens before database storage
* decrypt tokens only on the server when required for Plaid API calls

Implementation requirements:

* use modern authenticated encryption
* derive behavior from `PLAID_ENCRYPTION_KEY`
* return opaque encrypted payload strings for storage
* do not expose encryption implementation to client code
* fail safely when key is missing or malformed

Add utility functions such as:

```ts
encrypt(text: string): string
decrypt(payload: string): string
```

Use TypeScript and production-safe error handling.

---

# Plaid Service

Create:

```txt
src/server/services/plaidService.ts
```

This is the lower-level Plaid API integration layer.

Include functions similar to:

```ts
createLinkToken(userId: string)
exchangePublicToken(params)
getAccounts(accessToken: string)
getInstitution(itemOrInstitutionParams)
getItem(accessToken: string)
refreshBalances(itemId: string)
disconnectItem(itemId: string, userId: string)
```

Responsibilities:

* create a link token for authenticated user sessions
* exchange `public_token` for `access_token`
* fetch account metadata
* fetch item metadata
* fetch institution metadata if needed
* support balance refresh
* revoke/remove Plaid item access on disconnect when appropriate
* translate Plaid API failures into clean app-level errors

Do not place transaction import business logic here. That belongs in `plaidSyncService.ts`.

---

# Plaid Sync Service

Create:

```txt
src/server/services/plaidSyncService.ts
```

This is the orchestration layer for syncing Plaid data into the app database.

Responsibilities:

* initial post-connect sync
* account upsert
* transaction sync
* incremental sync using cursor
* balance refresh orchestration
* transaction import into existing transaction model
* deduplication
* pending → posted reconciliation
* last sync timestamps / reconnect flags / error persistence

Include functions similar to:

```ts
syncItem(params)
syncAllItemsForUser(userId: string)
runInitialSync(itemId: string, userId: string)
syncTransactions(itemId: string, userId: string)
refreshBalances(itemId: string, userId: string)
disconnectItem(itemId: string, userId: string)
```

---

# Initial Sync Behavior

After a user successfully connects an institution:

1. exchange public token
2. store Plaid item with encrypted access token
3. fetch institution details
4. fetch accounts
5. upsert Plaid accounts
6. fetch transactions
7. import transactions into the app transaction system
8. store returned cursor
9. update last sync timestamps
10. record reconnect/error state if needed

This should happen in a controlled server-side flow.

---

# Incremental Sync Behavior

Use **cursor-based sync** for transactions.

Requirements:

* store latest cursor on `PlaidItem`
* on subsequent syncs, fetch only changes since last cursor
* process:

  * added transactions
  * modified transactions
  * removed transactions
* persist new cursor after successful sync
* avoid losing cursor state if sync fails midway
* mark sync timestamps appropriately

This sync flow should support repeated manual syncs safely.

---

# Manual Sync Behavior

Users should be able to manually trigger a sync for an individual connected institution.

Manual sync should:

* fetch latest transactions using cursor-based sync
* refresh account balances
* upsert changed transactions
* mark deleted/removed transactions appropriately if supported by existing model strategy
* update sync timestamps
* surface reconnect state if Plaid indicates credentials are invalid

Provide a separate action to sync all connected institutions if practical in the router/service design.

---

# Account Persistence Rules

For account syncing:

* upsert by `plaidAccountId`
* update current balance, available balance, names, mask, subtype, type, and currency
* link accounts to the correct `PlaidItem` and `User`
* if Plaid no longer returns an account, mark it `isActive = false` instead of hard deleting unless there is a strong existing pattern for safe deletion
* set `lastBalanceSyncAt` when balances are refreshed

---

# Transaction Import Rules

Plaid transactions must be imported into the existing transaction system in a way that preserves compatibility with normalization and the rules engine.

Store:

* raw Plaid values
* normalized/app fields required by existing transaction architecture

Expected imported transaction data should include, where available:

* transaction date
* name / merchant name
* amount
* category information
* pending status
* account linkage
* Plaid transaction ID
* original raw payload or raw relevant fields if consistent with existing storage approach

If the app already has a raw transaction payload field or import metadata field, reuse it.

---

# Deduplication Rules

Prevent duplicate transactions.

Primary match strategy:

```txt
externalTransactionId == plaidTransactionId
```

Fallback matching strategy, where needed:

```txt
same user
same source account
same amount
same date
same merchant/name
```

Requirements:

* add unique index where appropriate for Plaid external transaction IDs
* avoid duplicate inserts across repeated syncs
* handle pending transaction updates that later settle/post
* if Plaid sends modifications for a known transaction, update the existing row instead of inserting a duplicate

Where the existing transaction schema makes a better uniqueness strategy possible, follow the project’s conventions.

---

# Pending to Posted Handling

Plaid transactions may begin as pending and later become posted/finalized.

Implementation should:

* update existing matching pending transactions when final posted data becomes available
* preserve linkage between pending and final transaction where Plaid provides identifiers
* avoid leaving both the pending and final forms as separate duplicates unless required by the raw source data model
* keep the user-facing transaction dataset clean

---

# Error Handling + Reconnect State

Support reconnect/error state on `PlaidItem`.

Requirements:

* if Plaid indicates login repair is required, set `requiresReconnect = true`
* persist `lastErrorCode` and `lastErrorMessage` for debugging/UI state
* on successful sync, clear reconnect/error state as appropriate
* do not crash the entire sync flow without storing useful status

Design the system so reconnect flows can be triggered from the UI later.

---

# Disconnect Behavior

Users must be able to disconnect a connected institution.

Disconnect should:

* verify ownership by authenticated user
* revoke/remove the item from Plaid when appropriate
* remove or deactivate local PlaidItem/PlaidAccount records according to safest app pattern
* preserve historical imported transactions unless the product explicitly requires deletion
* ensure future sync attempts cannot run on disconnected items

Recommended behavior:

* keep imported transactions for historical reporting
* remove live connection capability
* either delete or soft-disable connection records depending on schema strategy

---

# tRPC Router

Create:

```txt
src/server/api/routers/plaid.ts
```

All procedures require authentication.

Include procedures such as:

```ts
createLinkToken
exchangePublicToken
getConnectedInstitutions
syncItem
syncAll
reconnectItem
disconnectItem
```

Recommended behavior:

## `createLinkToken`

* authenticated mutation/query
* returns Plaid Link token for current user

## `exchangePublicToken`

* accepts `publicToken`
* performs secure exchange on server
* stores item
* triggers initial sync
* returns success payload and connected institution summary

## `getConnectedInstitutions`

* returns current user’s Plaid items and linked accounts
* includes sync status, reconnect state, and account info needed by UI

## `syncItem`

* manually sync a single item owned by current user

## `syncAll`

* sync all items owned by current user

## `reconnectItem`

* create/update Plaid Link flow for reconnect scenarios
* if your implementation chooses to use update mode, wire the server support for it

## `disconnectItem`

* disconnect an institution owned by current user

Use Zod input validation and existing protected procedure patterns.

---

# Authorization Requirements

Every Plaid-related database query and mutation must be scoped to the authenticated `userId`.

Users may only access:

* their own `PlaidItems`
* their own `PlaidAccounts`
* their own imported Plaid transactions

Never allow item IDs alone to grant access without verifying `userId`.

Apply this consistently in:

* routers
* service layer entry points
* disconnect/sync/reconnect flows

---

# UI Components

Use **shadcn/ui** components and existing project styling patterns.

Create the following components.

## `ConnectInstitutionButton.tsx`

Responsibilities:

* render CTA to connect a financial institution
* request link token from backend
* launch Plaid Link
* on success, send `public_token` to backend
* trigger refresh of connected institutions UI after success
* handle loading/error states cleanly

Use the standard Plaid Link client flow.

---

## `ConnectedInstitutionsList.tsx`

Responsibilities:

* list all connected institutions for current user
* display:

  * institution name
  * sync status
  * last sync time
  * reconnect required banner/state
  * child accounts
* provide actions:

  * Sync Now
  * Disconnect
  * Reconnect if needed

Should use existing app patterns for loading, empty, and error states.

---

## `AccountCard.tsx`

Responsibilities:

* display account details for a connected Plaid account

Include fields such as:

* account name
* official name if available
* masked account number
* account type/subtype
* current balance
* available balance if present
* active/inactive state if relevant

Use shadcn card styling and match existing dashboard aesthetics.

---

## `SyncButton.tsx`

Responsibilities:

* reusable sync trigger button
* supports item-level sync
* handles pending/loading/disabled states
* works inside institution list UI

---

# Suggested UI Placement

Fit Plaid UI into the app in a way that feels consistent with the existing dashboard.

Recommended layout:

* top-level “Connected Accounts” or “Linked Institutions” section
* primary CTA to connect institution
* connected institutions list beneath
* each institution expandable or grouped with its accounts
* clear manual sync action
* clear reconnect and disconnect actions

Do not build billing or usage UI in this phase.

---

# Data Formatting Expectations

Balances and account data should be prepared for user-facing display.

Requirements:

* format currency consistently
* handle null available balances safely
* handle unknown institution names gracefully
* show friendly last-sync state
* clearly indicate reconnect needed state

Reuse existing utilities if the project already has formatting helpers.

---

# Plaid Link Client Integration Notes

On the client:

* obtain link token from server
* initialize Plaid Link only when token exists
* send returned `public_token` to server immediately
* do not persist tokens client-side
* handle success, exit, and error flows gracefully

Support reconnect/update mode if practical for the architecture, even if the first pass is minimal.

---

# Transaction Normalization Compatibility

Plaid-imported transactions must integrate with the same downstream systems used by CSV imports where possible.

Requirements:

* imported transactions should be eligible for the rules engine
* normalization should still run on imported Plaid transactions
* keep raw source details available for future reprocessing if the architecture already supports raw values

If there is already an import pipeline abstraction, adapt Plaid into it rather than creating a conflicting parallel flow.

---

# Performance / Safety Requirements

Implementation should be reasonably production-safe.

Requirements:

* avoid N+1 database patterns where reasonable
* batch upserts when practical
* use transactions where appropriate for consistency
* do not overwrite cursors before sync succeeds
* do not expose Plaid internals to the client unnecessarily
* keep secrets server-only
* fail with useful typed/app-level errors

---

# Testing Requirements

Write tests covering the core logic where the project’s current testing setup supports it.

Priority test areas:

* Plaid token exchange flow
* transaction deduplication
* incremental sync cursor handling
* access control / user ownership enforcement
* reconnect state behavior
* pending → posted transaction updates

Do not add billing-related tests in this phase.

---

# Out of Scope

Do not implement any of the following in this phase:

* `UsageEvent`
* `BillingProfile`
* Stripe customer creation
* usage aggregation
* invoice previews
* usage summary cards
* usage ledger tables
* monthly invoicing
* webhook billing automation
* scheduled sync cron jobs
* background job orchestration

This prompt is intentionally limited to the **pure Plaid integration**.

---

# Expected Output

Generate **implementation-ready code** for this Phase 1 scope, including:

* Prisma schema updates
* Plaid models and relations
* transaction model extensions for Plaid source support
* Plaid API client utility
* encryption utility
* `plaidService.ts`
* `plaidSyncService.ts`
* `plaid.ts` tRPC router
* Plaid React UI components
* deduplication logic
* reconnect/disconnect support
* TypeScript types and helpers required for the feature
