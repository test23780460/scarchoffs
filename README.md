# PlayLedger

**Your play. Your numbers.** A private recordkeeping and analytics app for scratch-off tickets, game sessions, and other gambling activity. It does not offer gambling or predict outcomes.

## Stack

React, TypeScript, Tailwind CSS, customized shadcn-style UI primitives built on Radix and CVA, Lucide, Recharts, and Supabase Auth/PostgreSQL/Storage. Money is stored in integer USD cents. Pending activities are excluded from realized financial totals. Costs include wagers and fees; payouts are gross amounts received.

## Run locally

```bash
npm ci
npm run dev
```

Without environment variables, the app runs in a **clearly labeled local preview mode** and stores entries in this browser's local storage. This is useful for interface review, but it is not cloud storage or private account authentication. Ticket image upload requires Supabase.

## Connect Supabase

The deployed site uses the existing **NorthStar** project. The PlayLedger SQL migration has been applied there; its existing `gambling_entries` table and `delete-account` function were left intact.

1. For another project, apply `supabase/migrations/20261012000000_initial.sql` through the Supabase SQL editor or CLI.
2. Copy `.env.example` to `.env.local`, set the project URL and public publishable or anon key, and restart the dev server.
3. In Supabase Auth URL configuration, add the local development URL and `https://test23780460.github.io/scarchoffs/` as allowed redirect URLs. Configure your email provider and password reset template.

Row Level Security policies restrict activities, settings, and ticket images to their owner. The site uses Supabase's public anon key; access is controlled by user JWTs and RLS.

## GitHub Pages

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions secrets, then select **GitHub Actions** as the Pages build source. A push to `main` builds, tests, and deploys the app. The workflow fails when cloud settings are absent so a browser-only preview is not mistaken for production.

## Checks

```bash
npm test
npm run build
```

CSV export includes all records and financial amounts in integer cents. The Settings deletion action removes only PlayLedger records, ticket images, and spending limits. It keeps the shared NorthStar Auth user and all other application data.
