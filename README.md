# Finance Dashboard

A personal finance forecasting dashboard. Import transactions via CSV, track net worth over time, model investment growth, and run scenario forecasts.

## Stack

- **Next.js 15** (App Router)
- **tRPC v11** — type-safe API layer
- **Prisma 6** + **Neon Postgres** — database
- **NextAuth v5** — Google SSO + email/password auth
- **Tailwind v4** + **shadcn/ui** — UI components
- **Recharts** — charts
- **Biome** — linting and formatting

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables** — copy `.env.example` to `.env` and fill in:
   ```
   AUTH_SECRET=
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=
   DATABASE_URL=
   ```

3. **Push the database schema**
   ```bash
   npx prisma db push
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run check        # Lint (Biome)
npm run check:write  # Lint + auto-fix
npm run db:studio    # Open Prisma Studio
```

## Features

- **CSV Import** — Upload bank exports with column mapping UI and auto-categorization
- **Net Worth Chart** — Historical + multi-scenario forecasts (conservative / expected / aggressive)
- **Investments** — Track investment accounts with projected growth
- **Scenario Modeling** — Custom salary growth, return rate, expense, and inflation assumptions
- **Spending Intelligence** — Category breakdowns and month-over-month trends
