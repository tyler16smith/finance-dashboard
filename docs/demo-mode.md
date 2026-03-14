# Feature Implementation Spec — Demo Mode with Temporary User Edits

## Objective

Implement a **Demo Mode** for the finance dashboard that allows users to:

- enter a realistic, pre-seeded demo workspace
- switch between **their real account data** and **demo data** without logging out
- make demo-only changes such as adding investments, real estate, and forecast assumptions
- see those temporary changes reflected throughout the UI
- understand clearly that demo changes are **temporary and not saved**

This feature should support both:

1. **logged-in users**, who can switch between their own workspace and demo mode
2. **logged-out users**, who can view demo mode as a product preview (see Phase 2 note in Scope)

---

# Product Requirements

## Core UX

### 1. Workspace-style switching
Demo Mode must behave like a **data context switch**, not an authentication switch.

The user remains logged in as themselves, but the app changes its active data context from:

- `personal workspace`
to
- `demo workspace`

### 2. No logout required
Entering demo mode must **not** log the user out of their real account.

Users should be able to switch back and forth instantly.

### 3. Demo data is realistic
Demo mode must start from a **seeded demo workspace** in the database containing realistic financial data:
- transactions (with varied account strings, categories, hashtags)
- categories
- hashtags
- rules
- investments
- real estate examples
- forecast scenarios / assumptions

### 4. Demo edits are allowed
In demo mode, users should be able to:
- add investments
- add real estate / property data
- adjust forecast assumptions
- edit scenario inputs
- manipulate planning inputs that help them imagine their own financial future

These edits should affect the UI as though they were real, but they must **not** be permanently saved.

### 5. Demo edits are temporary
Show clear product messaging:

> Demo mode is active. Changes here are temporary and won't be saved.

Use:
- a persistent banner
- a first-time modal or dismissible notice
- subtle labels near forms where appropriate

### 6. Demo mode should feel real
The app should still:
- render charts normally
- recalculate projections
- update summaries
- reflect temporary edits in the same way persisted data would

The point is not to create a toy mock. The point is to let the user meaningfully explore the app.

---

# Recommended Architecture

## High-Level Strategy

Use a **hybrid architecture**:

### Base layer
A **real seeded demo workspace** stored in the database, owned by a dedicated system user.

### Overlay layer
A **temporary session-scoped overlay** for demo edits.

The rendered demo experience becomes:

```ts
renderedDemoState = merge(baseDemoWorkspaceData, demoOverlayState)
````

This gives:

* realistic relational data
* credible charting and summaries
* temporary personalized experimentation
* no persistent pollution of shared demo data

---

# Scope Recommendation

## Phase 1 (v1)

Implement demo overlays for the highest-value modeling features:

* investments
* real estate / properties
* forecast scenarios (the `ForecastScenario` model — see disambiguation below)

All other routers (transactions, categories, hashtags, rules, spending) are **read-only** from the demo workspace in Phase 1. They render demo seed data but do not support overlay writes. Explicitly:

| Router | Phase 1 behavior |
|--------|-----------------|
| `transactionRouter` | read-only from demo user |
| `categoryRouter` | read-only from demo user |
| `hashtagRouter` | read-only from demo user |
| `ruleRouter` | read-only from demo user |
| `spendingRouter` | derived from transactions — read-only |
| `investmentRouter` | **overlay writes supported** |
| `realEstateRouter` | **overlay writes supported** |
| `scenarioRouter` | **overlay writes supported** |

## Phase 2

Optionally expand overlay behavior to:

* transaction tags
* rules previews
* fake imports
* temporary transaction edits
* anonymous (logged-out) demo access (see note below)

> **Note on anonymous access:** The spec lists logged-out users as a supported use case, but anonymous demo access requires non-trivial changes to the middleware, tRPC procedure types, and the dashboard layout's `hasData()` guard. Defer anonymous access to Phase 2 and focus Phase 1 on authenticated users switching between personal and demo context. When Phase 2 begins, review the middleware and `demoOrProtectedProcedure` sections below.

Do **not** block Phase 1 on simulating every write path in the app.

---

# Technical Architecture

## 1. Data Context Model

Introduce the concept of an **active app context**.

### Context Types

* `personal`
* `demo`

### Resolution Priority

The active context should be resolved from:

1. explicit context cookie
2. fallback to user personal workspace if logged in
3. fallback to demo for public demo route if logged out (Phase 2)

### Recommended storage

Use a **cookie** rather than localStorage so server-rendered pages and tRPC procedures can resolve the active context consistently.

Example cookie:

```txt
activeAppContext=personal
```

When in demo mode:

```txt
activeAppContext=demo
demoOverlaySessionKey=uuid-or-cuid
```

---

## 2. Database Model

### ⚠️ Important: No Workspace Abstraction Needed for v1

The spec originally called for introducing a full `Workspace` model. **This is not required for Phase 1.** The entire codebase is currently `userId`-scoped — every financial model (`Transaction`, `Investment`, `RealEstateInvestment`, `ForecastScenario`, `Category`, `Hashtag`, `TransactionRule`, `UserSettings`, etc.) filters by `userId`. Adding `workspaceId` to all of them would require a foundational breaking migration: new FK columns on 10+ tables, updated queries in every router, Prisma migrations with data backfill, and potentially a full day or more of refactoring before any demo feature ships.

**Recommended v1 approach — dedicated demo system user:**

1. Create a system user in the DB: `demo@internal.system` (seeded, never exposed to login)
2. Seed all demo data (transactions, investments, properties, scenarios, etc.) under that user's `userId`
3. In demo mode, the tRPC context resolves the "active data user ID" to the demo user's ID for all reads
4. Overlay writes go into `DemoOverlaySession` (see below), not into the demo user's tables
5. No `workspaceId` column changes needed — existing `userId`-scoped queries work as-is

The workspace abstraction can be revisited in a future refactor when multi-household or team features are needed. For now it adds complexity without benefit.

If you do want to introduce a Workspace model in the future, be aware of the following constraints:

- `Account` is **already a NextAuth model** (OAuth provider linking). Do not name a financial accounts model `Account` — it will conflict. In this codebase, "bank accounts" are just a `String?` field on `Transaction` (e.g., `"Chase Checking"`), so there is no separate financial account model to workspace-scope.
- Use `forecastScenarios ForecastScenario[]` — not `forecastProfiles ForecastProfile[]`. The model is `ForecastScenario`. `ForecastProfile` does not exist.
- Include `categories Category[]` — the `Transaction` model has a `categoryId` FK pointing to `Category`, so categories must be scoped alongside transactions.

---

## 3. Prisma Schema Additions

Add a `DemoOverlaySession` model for temporary demo edits. This is the **only** schema addition needed for Phase 1.

```prisma
model DemoOverlaySession {
  id               String   @id @default(cuid())
  sessionKey       String   @unique
  userId           String?
  demoUserId       String   // points to the seeded demo system user's ID
  isActive         Boolean  @default(true)

  expiresAt        DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  investmentsJson  Json?
  propertiesJson   Json?
  scenariosJson    Json?
  uiStateJson      Json?

  user             User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### Notes

* `demoUserId` points to the seeded demo system user (`demo@internal.system`)
* `userId` is the real logged-in user (nullable for future anonymous support)
* `sessionKey` identifies the browser/session context
* `expiresAt` enables cleanup
* JSON is acceptable for v1 because this is temporary overlay data, not primary source-of-truth finance data

---

# Session Strategy

## Logged-in users

When entering demo mode:

* keep current auth session
* create or reuse a `DemoOverlaySession`
* set cookie for demo context

## Logged-out users (Phase 2 only)

When viewing demo mode:

* create an anonymous `DemoOverlaySession`
* set cookie for demo context and session key

### Suggested cookies

```txt
activeAppContext=demo
demoOverlaySessionKey=uuid-or-cuid
```

---

# Data Loading Model

## Base data

Fetch from the seeded demo system user's records in the real database (using `demoUserId`).

## Overlay data

Fetch from `DemoOverlaySession`.

## Merge layer

Create a server-side merge function that combines:

* canonical demo user data
* session-specific temporary demo edits

This merged result is what the UI should consume.

---

# Merge Rules

Create domain-specific merge utilities.

## Example categories of merge behavior

### Investments

* base investments from DB (demo user's records)
* appended temporary investments from overlay JSON
* temporary edits override matching seeded records by `id`
* temporary deletions can be represented by a hidden/deleted ID list in overlay JSON

### Properties

* same pattern as investments

### Forecast scenarios

* overlay scenario values override seeded scenarios by `id`
* new scenarios in overlay are appended

### Manual assets/liabilities (Phase 2)

* append or override depending on identifier

---

# ForecastScenario vs RealEstateForecastScenario — Disambiguation

> **Important:** The codebase has two different "forecast scenario" concepts. Do not confuse them.

| Name | Type | Location | Purpose |
|------|------|----------|---------|
| `ForecastScenario` | Prisma **model** | `prisma/schema.prisma` | What-if planning model with `investmentReturn`, `inflationRate`, `salaryGrowth`, `contributionChange`, `expenseGrowth`. Managed by `scenarioRouter`. This is what "forecast assumptions" demo overlay means. |
| `RealEstateForecastScenario` | Prisma **enum** | `prisma/schema.prisma` | `MODERATE \| STANDARD \| AGGRESSIVE` — a field on `RealEstateInvestment` that selects appreciation rate presets. Not a separate model, not overlay-able independently. |

When the spec refers to "forecast assumptions overlay," it means `ForecastScenario` records managed by `scenarioRouter`.

---

# Demo Mode Service Layer

Create a dedicated service layer for demo behavior.

## Suggested files

```txt
src/server/services/demo/demo-mode.service.ts
src/server/services/demo/demo-overlay.service.ts
src/server/services/demo/demo-merge.service.ts
src/server/services/demo/demo-session.service.ts
```

## Responsibilities

### `demo-mode.service.ts`

* resolve current app context
* determine whether request is in demo mode
* resolve active demo user ID (the seeded system user)

### `demo-session.service.ts`

* create/find overlay session
* rotate or expire session
* attach anonymous or logged-in user session

### `demo-overlay.service.ts`

* read/write overlay payload sections
* clear overlay
* expire overlay

### `demo-merge.service.ts`

* merge seeded demo user data with overlay data
* expose domain-specific merge helpers per router

---

# tRPC Changes

## 1. Add context resolution

Your tRPC context must resolve:

* authenticated user
* active app context
* demo user ID (the seeded system user's ID, resolved when in demo mode)
* demo overlay session key if present
* `isDemoMode`

### Cookie parsing

Cookies are available via `opts.headers` in `createTRPCContext`. Parse them explicitly:

```ts
// src/server/api/trpc.ts
import { parseCookies } from 'some-cookie-library'; // or roll a simple manual parse

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  const cookieHeader = opts.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);

  const isDemoMode = cookies['activeAppContext'] === 'demo';
  const demoOverlaySessionKey = cookies['demoOverlaySessionKey'] ?? null;

  return {
    db,
    session,
    isDemoMode,
    demoOverlaySessionKey,
    ...opts,
  };
};
```

### Example context shape

```ts
type AppContextMode = "personal" | "demo";

interface RequestContext {
  session: Session | null;
  db: PrismaClient;
  isDemoMode: boolean;
  demoOverlaySessionKey?: string | null;
}
```

---

## 2. Add a `demoOrProtectedProcedure`

Every existing router uses `protectedProcedure`, which throws `UNAUTHORIZED` when there's no session. Demo-supported routers need a procedure type that allows access in demo mode even without a real session (required for Phase 2 anonymous support, but define it now so routers are ready).

```ts
// src/server/api/trpc.ts
export const demoOrProtectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user && !ctx.isDemoMode) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({ ctx });
  });
```

Switch all demo-supported routers (`investmentRouter`, `realEstateRouter`, `scenarioRouter`) from `protectedProcedure` to `demoOrProtectedProcedure`. Keep non-demo routers on `protectedProcedure`.

---

## 3. Centralize context resolution

Create:

```txt
src/server/context/resolve-active-context.ts
```

Responsibilities:

* read cookies from request headers
* infer personal vs demo
* in demo mode, resolve `demoUserId` by looking up the system demo user
* in personal mode, resolve `userId` from the auth session
* ensure demo mode never exposes personal user data

---

## 4. Add demo router

Create:

```txt
src/server/api/routers/demo.ts
```

### Suggested procedures

#### `enterDemoMode`

* create or reuse overlay session
* return success + banner metadata

#### `exitDemoMode`

* return to personal workspace if authenticated
* if anonymous, return to marketing/home

#### `getDemoStatus`

Returns:

* `isDemoMode`
* `overlayExpiresAt`
* `hasUnsavedDemoChanges`

#### `resetDemoOverlay`

Clears temporary changes for the current demo session.

#### `dismissDemoNotice`

Optional UI helper if you want a dismissible modal/banner state.

---

# Middleware — Required Update

`src/middleware.ts` currently redirects all unauthenticated traffic to `/auth/signin` except `/auth/*` and `/api/*`. For Phase 2 anonymous demo access at `/demo`, the middleware must be updated:

```ts
// src/middleware.ts
const isPublic =
  isAuthPage ||
  isApiRoute ||
  nextUrl.pathname.startsWith("/demo"); // add this for Phase 2

if (!isLoggedIn && !isPublic) {
  return Response.redirect(new URL("/auth/signin", nextUrl));
}
```

> **Phase 1 note:** For authenticated-only demo mode, this change is not yet required. Add it when anonymous access is implemented in Phase 2.

---

# Dashboard Layout — `hasData()` Guard

`src/app/dashboard/layout.tsx` currently does:

```ts
const hasData = await api.transaction.hasData();
if (!hasData) redirect("/onboarding");
```

This presents two problems in demo mode:

1. **Authenticated users with no personal data** switching to demo mode will be redirected to `/onboarding` because `hasData()` checks their own transactions, not the demo user's.
2. **Anonymous demo users** (Phase 2) will trigger a `UNAUTHORIZED` error because `hasData()` uses `protectedProcedure`.

**Fix:** Make `hasData()` demo-aware in the tRPC context:

```ts
// If in demo mode, skip the hasData check — demo workspace always has data
const hasData = ctx.isDemoMode ? true : await api.transaction.hasData();
if (!hasData) redirect("/onboarding");
```

Or alternatively: give `/demo/*` routes their own layout that omits this guard entirely.

---

# Existing Domain Routers — Required Changes

For routes that load demo-supported data, change reads/writes to be demo-aware.

## Reads

When `ctx.isDemoMode === true`:

* read from the seeded demo user's data (using `demoUserId` instead of `session.user.id`)
* merge overlay state before returning response

## Writes

When `ctx.isDemoMode === true`:

* do **not** write to canonical finance tables
* instead update the overlay session JSON payload

When `ctx.isDemoMode === false`:

* perform normal DB writes

## Routers requiring changes

### `investmentRouter`

All procedures: switch to `demoOrProtectedProcedure` and add demo mode branching.

### `realEstateRouter`

All procedures: switch to `demoOrProtectedProcedure` and add demo mode branching.

**Important note on `getProjection`:** The current implementation does:
```ts
const property = await ctx.db.realEstateInvestment.findUniqueOrThrow({
  where: { id: input.id, userId: ctx.session.user.id },
});
```
Overlay-only properties have temporary IDs that do not exist in the DB. This will throw for any property added via demo overlay. In demo mode, `getProjection` must:
1. First look up the property from the overlay JSON by `id`
2. Fall back to a DB lookup only if not found in overlay
3. Compute the projection from whichever source was found

### `scenarioRouter`

All procedures (`getAll`, `create`, `update`, `delete`, `setActive`, `seedDefaults`): switch to `demoOrProtectedProcedure` and add demo mode branching. Overlay writes go into `scenariosJson` of `DemoOverlaySession`.

## Routers that stay read-only in Phase 1 (no changes required for overlay)

These routers simply need their queries to use `demoUserId` when `ctx.isDemoMode` is true, but do not need overlay write support:

* `transactionRouter`
* `categoryRouter`
* `hashtagRouter`
* `ruleRouter`
* `spendingRouter`

---

# Demo-Supported Write Paths

## Investments router

Supported in demo mode:

* create investment
* update investment
* delete investment

Behavior:

* write into `investmentsJson` overlay
* return the merged investment list as if persisted

## Properties / Real Estate router

Supported in demo mode:

* create property
* update property
* delete property
* get projection (see overlay lookup note above)

Behavior:

* write into `propertiesJson` overlay
* for `getProjection`, resolve property from overlay first before DB fallback

## Forecast scenarios router (`scenarioRouter`)

Supported in demo mode:

* create scenario
* update scenario
* delete scenario
* set active scenario

Behavior:

* write into `scenariosJson` overlay

> Reminder: "forecast scenarios" here refers to the `ForecastScenario` **model** — the what-if planning records with `investmentReturn`, `inflationRate`, etc. — not the `RealEstateForecastScenario` enum on properties.

## Optional later (Phase 2)

* manual net worth entries
* liabilities
* planning goals

---

# Example Procedure Pattern

## Normal mode

```ts
if (!ctx.isDemoMode) {
  return ctx.db.investment.create({
    data: {
      userId: ctx.session!.user.id,
      ...
    },
  });
}
```

## Demo mode

```ts
if (ctx.isDemoMode) {
  return demoOverlayService.addInvestment({
    sessionKey: ctx.demoOverlaySessionKey!,
    investment: input,
  });
}
```

Then return merged read model.

---

# UI Requirements

## 1. Workspace Switcher

Add a workspace/context switcher in the app shell.

### Example options

* My Dashboard
* Demo Mode

### Behavior

Switching to demo mode:

* calls `demo.enterDemoMode`
* sets demo context
* redirects or refreshes current page into demo data

Switching back:

* calls `demo.exitDemoMode`
* restores personal workspace context

---

## 2. Demo Banner

Show a persistent banner whenever `isDemoMode === true`.

### Copy

```txt
Demo mode is active. Changes here are temporary and won't be saved.
```

### Actions

* Reset demo changes
* Exit demo mode

---

## 3. First-Entry Modal

Show on first entry to demo mode or first mutating action.

### Suggested copy

```txt
You're in Demo Mode

You can try adding investments, properties, and planning inputs here.
Changes are temporary and won't be saved to your account.
```

Buttons:

* Continue
* Exit Demo Mode

Optional checkbox:

* Don't show again

---

## 4. Form Messaging

On forms that support demo edits, add subtle helper text:

```txt
Changes in demo mode are temporary.
```

This is especially useful on:

* Add Investment
* Add Property
* Forecast Scenario settings

---

## 5. Reset Demo Button

Allow users to reset only their temporary demo changes without leaving demo mode.

This should:

* clear overlay JSON
* preserve canonical seeded demo user data
* refresh charts and summaries back to original demo state

---

## 6. Demo Mode Context Provider

The app already has `ForecastContext` (in `src/context/forecast-context.tsx`) wrapped by `DashboardProviders` (`src/components/layout/dashboard-providers.tsx`). Add a separate `DemoModeContext` provider alongside it — do **not** merge demo state into `ForecastContext`. Add `DemoModeProvider` to `DashboardProviders` so it is available throughout the dashboard shell.

`DemoModeContext` should expose:
* `isDemoMode: boolean`
* `overlayExpiresAt: Date | null`
* `hasUnsavedDemoChanges: boolean`
* `enterDemoMode(): void`
* `exitDemoMode(): void`
* `resetDemoOverlay(): void`

---

## 7. Anonymous Demo Access (Phase 2)

For logged-out visitors:

* allow entering demo mode from landing page
* show a CTA to create account or start real dashboard

### Suggested CTA copy

* Start Your Real Dashboard
* Save Your Own Financial Data
* Create an Account to Keep Your Data

---

# Routing

## Recommended route behavior

### Option A — single app with mode context

Keep users on the same route tree and switch data context via cookies and server context resolution.

### Option B — dedicated demo route prefix

Use routes like:

* `/demo`
* `/demo/investments`
* `/demo/forecast`

This is easier to reason about for public demo access.

## Recommendation

Use a hybrid:

* authenticated users can toggle demo mode inside app shell (Phase 1)
* public visitors can access `/demo` (Phase 2 — requires middleware update and `demoOrProtectedProcedure`)
* both resolve to the same demo user data + overlay behavior

---

# Data Seeding Requirements

Create a demo seed script that populates:

* **Demo system user** — a seed user with email `demo@internal.system`, never exposed to login UI. This user's ID is the `demoUserId` used throughout.
* **Transactions** — sample monthly transactions with varied `account` strings (e.g., `"Chase Checking"`, `"Amex Gold"`, `"Vanguard Brokerage"`). Note: there is no separate financial account model in this app — account is a string field on `Transaction`.
* **Categories** — seed categories under the demo user's ID. System-default categories (`userId = null`) are already available; seed additional user-level categories for demo-specific groupings.
* **Hashtags** — seed hashtags used in demo transactions
* **TransactionRules** — at least 2–3 realistic rules with conditions and actions
* **UserSettings** — a `UserSettings` record for the demo user with sensible defaults (e.g., `ruleExecutionPreference: ALWAYS_ASK`) so the rules settings panel renders correctly
* **Investments** — at least two investments (e.g., a 401k and a brokerage account)
* **RealEstateInvestment** — at least one rental property or home asset with realistic figures
* **ForecastScenario** — seed conservative, expected, and aggressive scenarios (matching the `ScenarioType` enum values)

## Goals for the seed data

The demo should visually show:

* positive and negative months
* growth over time
* account diversity (multiple account strings in transactions)
* meaningful forecast curves
* realistic enough numbers to feel like a serious tool

### Suggested files

```txt
prisma/seeds/demo-workspace.seed.ts
src/server/demo/demo-seed-data.ts
```

---

# Session Expiration and Cleanup

## Expiration

Set demo overlay sessions to expire automatically.

### Suggested TTL

* anonymous users (Phase 2): 24 hours
* logged-in users in demo mode: 7 days is acceptable, or 24 hours if you want stricter cleanup

## Cleanup job

Create a cron job or scheduled cleanup task that deletes expired `DemoOverlaySession` records.

### Example responsibility

```txt
Delete all demo overlay sessions where expiresAt < now()
```

---

# Security Requirements

## 1. Demo user isolation

Never allow a demo context to access the real user's personal data.

In demo mode:

* all reads use `demoUserId` (the seeded system user), never the real user's `userId`
* overlay writes only affect `DemoOverlaySession`, never canonical finance tables

In personal mode:

* all reads use the authenticated user's `userId` as normal

## 2. No accidental writes to real data

All demo-supported writes must bypass canonical finance tables.

## 3. No canonical demo mutation

Never mutate the seeded demo user's data from user interactions. All changes go into the overlay session.

## 4. Safe anonymous behavior (Phase 2)

Anonymous users can only access demo data, never private user data.

---

# Analytics / Product Instrumentation

Track demo usage so you can understand product interest.

## Suggested events

* entered demo mode
* exited demo mode
* added demo investment
* added demo property
* changed forecast assumptions
* reset demo changes
* clicked create-account from demo
* switched from demo to real dashboard

This will help you understand:

* what users experiment with
* where demo mode is effective
* what should be emphasized in onboarding

---

# Recommended Implementation Order

## Step 1 — Demo system user + seed data

Create the `demo@internal.system` user and seed all demo data under their ID: transactions, categories, hashtags, rules, UserSettings, investments, real estate properties, and forecast scenarios.

## Step 2 — `DemoOverlaySession` schema

Add the `DemoOverlaySession` Prisma model and run migration.

## Step 3 — Context switching (cookies + tRPC)

* Add cookie parsing to `createTRPCContext`
* Implement `resolve-active-context.ts`
* Add `isDemoMode` and `demoOverlaySessionKey` to the tRPC context
* Define `demoOrProtectedProcedure`

## Step 4 — Demo service layer

Implement:

* `demo-mode.service.ts` — context resolution, demoUserId lookup
* `demo-session.service.ts` — create/find overlay session
* `demo-overlay.service.ts` — read/write overlay JSON sections
* `demo-merge.service.ts` — domain-specific merge helpers

## Step 5 — Demo tRPC router

Add `demo.ts` router with `enterDemoMode`, `exitDemoMode`, `getDemoStatus`, `resetDemoOverlay`, `dismissDemoNotice`.

## Step 6 — Fix `hasData()` guard in dashboard layout

Update `src/app/dashboard/layout.tsx` to skip the `hasData()` redirect when `isDemoMode === true` (demo workspace always has data).

## Step 7 — Banner + modal + `DemoModeContext`

* Add `DemoModeProvider` and `DemoModeContext`
* Wire it into `DashboardProviders` alongside the existing `ForecastProvider`
* Add persistent demo banner component
* Add first-entry modal

## Step 8 — Workspace switcher in app shell

Add the My Dashboard / Demo Mode switcher to the app shell (e.g., in `TopNav` or `Sidebar`).

## Step 9 — Demo-aware investments

* Switch `investmentRouter` procedures to `demoOrProtectedProcedure`
* Add demo mode branching: reads use `demoUserId`, writes go to overlay
* Return merged investment list

## Step 10 — Demo-aware properties

* Switch `realEstateRouter` procedures to `demoOrProtectedProcedure`
* Add demo mode branching
* Fix `getProjection` to resolve property from overlay JSON first, then DB fallback
* Return merged property list

## Step 11 — Demo-aware forecast scenarios

* Switch `scenarioRouter` procedures to `demoOrProtectedProcedure`
* Add demo mode branching for `getAll`, `create`, `update`, `delete`, `setActive`
* Return merged scenario list

## Step 12 — Read-only demo mode for remaining routers

* Update `transactionRouter`, `categoryRouter`, `hashtagRouter`, `ruleRouter`, `spendingRouter` to use `demoUserId` for reads when `ctx.isDemoMode` is true (no overlay writes needed)

## Step 13 — Reset + cleanup

* Wire up reset action to clear overlay JSON
* Add expiration cleanup cron job for `DemoOverlaySession`

## Step 14 — Public demo mode (Phase 2)

* Update middleware to allow `/demo/*` for unauthenticated users
* Implement anonymous `DemoOverlaySession` creation
* Expose `/demo` landing and dashboard for unauthenticated visitors
* Add CTA to create account

## Step 15 — Instrumentation

Track demo actions and conversion events.

---

# Acceptance Criteria

## Context switching

* authenticated user can switch between personal and demo mode without logging out
* active context survives navigation and refresh
* switching to demo does not redirect to `/onboarding` even if user has no personal transactions

## Demo data realism

* seeded demo workspace contains realistic dashboard data
* charts and summary metrics render correctly

## Temporary edits

* user can add/edit demo-supported entities (investments, properties, scenarios)
* changes affect charts and summaries
* changes are not written to canonical finance tables
* changes can be reset

## Messaging

* demo banner is visible in demo mode
* first-entry notice explains changes are temporary
* forms indicate temporary behavior where relevant

## Safety

* no accidental writes to real user data
* no accidental mutation of canonical demo user data
* demo context never resolves to personal user data

## Maintenance

* expired overlay sessions are cleaned up
* demo seed can be re-run safely
* code paths for demo vs personal mode are centralized and predictable

---

# Recommended Non-Goals for v1

Avoid expanding initial scope to include:

* full fake CSV import pipeline in demo mode
* full transaction editing parity in overlay
* rules engine persistence simulation across all transaction workflows
* sharing demo overlays across devices
* cloning full demo workspaces per user
* anonymous / logged-out demo access (Phase 2)

These can come later if needed.

---

# Implementation Notes for the Coding Agent

## Important design rules

1. Treat demo mode as a **data context**, not an auth context.
2. Never write demo changes into the canonical finance tables.
3. Never mutate the seeded demo user's data from user activity.
4. Centralize mode resolution in `createTRPCContext` and `resolve-active-context.ts`.
5. Keep Phase 1 focused on investments, properties, and forecast scenarios.
6. Use `demoUserId` (the seeded system user) for all base reads in demo mode — do not introduce a Workspace model for v1.
7. `demoOrProtectedProcedure` allows demo mode reads without a real session — define it early and use it for all demo-supported routers.

## Preferred tradeoffs

* favor correctness and maintainability over over-engineered generic abstractions
* use JSON overlay storage for v1 to move quickly
* keep merge logic explicit per domain instead of trying to build an overly generic patch engine
* no Workspace abstraction in v1 — use the dedicated demo system user pattern

---

# Deliverables

The implementation should include:

* `DemoOverlaySession` Prisma model
* demo system user + seed script
* cookie-based context resolution (`createTRPCContext` + `resolve-active-context.ts`)
* `demoOrProtectedProcedure` procedure type
* demo tRPC router
* demo service layer (mode, session, overlay, merge services)
* `DemoModeContext` + `DemoModeProvider`
* app-shell workspace switcher
* demo banner + first-entry modal
* `hasData()` guard fix in dashboard layout
* demo-aware investments flow
* demo-aware properties flow (including `getProjection` overlay fix)
* demo-aware forecast scenarios flow
* read-only demo mode for transactions, categories, hashtags, rules, spending
* reset overlay action
* expired-session cleanup job
* basic analytics events
* middleware update for `/demo` public access (Phase 2)
