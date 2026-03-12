# Financial Forecasting Dashboard — Implementation Prompt

Build a production-ready **personal finance forecasting dashboard** using the following stack:

- **Create T3 App**
- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**
- **tRPC**
- **Prisma**
- **Neon Postgres**
- **Auth.js / NextAuth**
- **shadcn/ui** for the design system
- **Recharts** for charting

The system should support:

- CSV-driven financial imports
- investment forecasting
- net worth projections
- scenario modeling
- spending intelligence
- authentication

The system should be clean, scalable, and production-ready.

Before writing code, create a **complete implementation plan** and architecture.

---

# Project Foundation

This project is structured using **Create T3 App** with:

- App Router
- tRPC
- Prisma
- Tailwind
- PostgreSQL (Neon)

Primary UI system:

**shadcn/ui**

Primary charting system:

**Recharts**

Favor:

- strong type safety
- modular architecture
- accessible UI
- responsive layouts
- scalable dashboard patterns
- reusable forecasting logic

---

# Core Technical Requirements

## Frontend

- Next.js
- TypeScript
- TailwindCSS
- shadcn/ui

## Backend / API

- tRPC

## Database

- Neon Postgres

## ORM

- Prisma

## Authentication

Use **Auth.js / NextAuth**

Support:

- **Google SSO**
- **username + password login**

Sessions and user accounts should be stored in the **Prisma database**.

All financial data should be associated with a **userId**.

---

# Authentication Requirements

The system must support two authentication methods.

## Google SSO

Implement Google OAuth login using Auth.js.

Users should be able to sign in with:

**Continue with Google**

User records should be stored in Prisma and linked to imported financial data.

## Username / Password

Support traditional login using:

- username
- email
- password

Passwords must be:

- hashed
- securely stored

Future improvements should allow:

- password reset
- email verification
- account recovery

---

# Recommended Supporting Packages

Use the following packages where appropriate:

```
recharts
papaparse
date-fns
zod
bcrypt
```

These will support:

- charting
- CSV parsing
- date aggregation
- validation
- password hashing

---

# Design System Expectations

Use **shadcn/ui** components as the design foundation.

Core components should include:

- Card
- Button
- Input
- Select
- Dialog
- Dropdown Menu
- Form
- Table
- Tabs
- Badge
- Separator

The UI should feel:

- modern
- minimal
- dashboard-focused
- consistent

---

# Starting Screen and CSV Mapping Flow

Add a **starting screen onboarding flow**.

Users should first see a page prompting them to:

**Upload a CSV file**

The dashboard should not appear until data is imported.

---

## CSV Upload

Allow users to:

- drag and drop CSV
- click to upload

The system should then parse the CSV headers.

---

## CSV Mapping Interface

After upload, display a **column mapping interface**.

Map uploaded headers to internal database fields.

Example internal fields:

- date
- category
- price
- income
- expense
- description
- account

---

## Mapping Requirements

Users must:

- map required fields
- confirm mappings
- adjust mappings if needed

Optional fields may remain unmapped.

Suggested mappings may be automatically detected.

---

## Import Behavior

Once mapping is confirmed:

1. parse rows
2. validate rows using Zod
3. transform rows into internal schema
4. store records in Neon via Prisma

Imported data becomes the **source of truth** for the dashboard.

---

# Net Worth Section

The **Net Worth chart** should be the **first chart on the dashboard**.

Position:

Top of dashboard.

---

## Net Worth Chart Requirements

- Line chart
- X-axis: month over a month
- Y-axis: total net worth

This chart represents the **primary financial overview**.

---

## Net Worth Calculation

Net worth must include:

- financial transaction data
- investments
- forecasted investment growth

Investment sources:

- Stocks
- Real Estate
- Roth IRA
- 401(k)
- HSA

---

## Net Worth Forecasting

Forecast ranges:

- 1 year (default)
- 2 years
- 3 years
- 4 years
- 5 years

Forecast lines should appear:

- faded
- gray
- dashed

---

# Monthly Net Gains Chart

Display **net profit month over a month**.

## Chart Behavior

Line chart.

X-axis:

Months.

Y-axis:

Currency.

Display:

- historical data
- forecasted data

Forecast should appear as a **light gray faded line**.

---

## Forecast Configuration

Dropdown options:

- 1 year
- 2 years
- 3 years
- 4 years
- 5 years

Dropdown should appear in the **top right of the chart card**.

---

## Forecast Logic

Forecast should use:

**average monthly net gain from historical data**.

The model should be deterministic and simple.

---

# Summary Metrics

Below the net gains chart, show three metric cards.

Metrics:

1. Average net gain (last 12 months)
2. Average income (last 12 months)
3. Average expenses (last 12 months)

Use **shadcn cards**.

---

# Investments Section

Add a dedicated **Investments section**.

Supported investment types:

- Stocks
- Real Estate
- Roth IRA
- 401(k)
- HSA

---

## Investment Inputs

Each investment module should begin with user inputs.

Examples:

- starting balance
- monthly contribution
- annual return estimate

---

## Investment Charts

Each investment type should display a **growth chart**.

Charts should:

- show historical value
- show projected value

Forecast options:

- 1 year
- 2 years
- 3 years
- 4 years
- 5 years

Charts should follow the **same forecasting configuration** as the parent dashboard.

---

# Scenario Modeling (What-If Calculator)

Add a **Scenario Modeling system** allowing users to simulate different financial futures.

---

## Scenario Types

Provide default scenarios:

- Conservative
- Expected
- Aggressive

Each scenario modifies forecasting assumptions.

---

## Scenario Inputs

Users should be able to adjust:

- investment return
- inflation rate
- salary growth
- contribution changes
- expense growth

---

## Scenario Visualization

Charts should display multiple lines when scenarios are enabled.

Example:

- Historical
- Conservative
- Expected
- Aggressive

Use clear legends and distinct colors.

---

## Charts Affected

Scenario projections should update:

- Net Worth chart
- Monthly Net Gains chart
- Investment charts

---

# Category Intelligence

Add a **Spending Intelligence system**.

This system analyzes transactions and generates insights.

---

## Category Detection

Transactions should include normalized categories such as:

- Food
- Housing
- Transportation
- Entertainment
- Subscriptions
- Utilities
- Travel
- Shopping

Categories should be normalized during import.

---

## Category Insights Dashboard

Create a new **Spending Insights section**.

This should include:

### Top Spending Categories

Example:

```
Housing → $2,300/month
Food → $820/month
Transport → $290/month
Subscriptions → $140/month
```

---

## Category Breakdown Chart

Display spending distribution using:

- pie chart
or
- stacked bar chart

---

## Category Trends

Show category spending **month over a month**.

Detect:

- spikes
- seasonal trends
- unusual patterns

---

## Recurring Expense Detection

Detect recurring charges such as:

- subscriptions
- memberships
- recurring bills

Example:

```
Spotify → $10.99/month
Netflix → $15.49/month
Gym → $49/month
```

---

## Anomaly Detection

Identify unusual spending patterns.

Example:

```
Travel spending unusually high: $2,400 vs $400 average
```

---

# Data Architecture

Prisma models should support:

- users
- financial transactions
- CSV imports
- mapping templates
- investment records
- forecast scenarios

---

# tRPC Procedures

tRPC endpoints should include:

- CSV upload
- CSV mapping
- CSV import
- dashboard data retrieval
- scenario modeling
- category insights
- investment forecasting

---

# Data Handling

The system must:

- normalize financial records
- aggregate monthly data
- detect malformed rows
- prevent duplicate imports

Use:

- `date-fns` for date grouping
- `zod` for validation

---

# UI Composition

Create reusable UI modules.

Examples:

- CSV upload dropzone
- CSV header mapping table
- onboarding flow
- dashboard layout shell
- net worth chart card
- profit chart card
- summary metric cards
- investment cards
- investment input forms
- forecast selector
- scenario controls
- spending insight cards

---

# Charting Expectations

Use **Recharts**.

Charts must support:

- responsive containers
- multiple lines
- forecast lines
- tooltips
- legends
- currency formatting
- month formatting

---

# Required Deliverables Before Coding

Before implementation provide:

1. feature breakdown
2. database schema design
3. Prisma model definitions
4. CSV ingestion strategy
5. mapping system design
6. forecasting engine design
7. scenario modeling system
8. spending intelligence system
9. tRPC architecture
10. UI architecture
11. folder structure
12. step-by-step build order

---

# Output Instructions

Do **not start coding immediately**.

First deliver:

- architecture overview
- implementation plan
- folder structure
- system flow

Then proceed to implementation.

Ensure:

- strong TypeScript typing
- modular forecasting engine
- reusable components
- scalable architecture
- production-quality code