# PlayLedger

**Your play. Your numbers.** A private recordkeeping and analytics app for scratch-off tickets, game sessions, and other gambling activity. It does not offer gambling or predict outcomes.

## Stack

React, TypeScript, Tailwind CSS, customized shadcn-style UI primitives built on Radix and CVA, Lucide, Recharts, and Supabase Auth/PostgreSQL/Storage. Money is stored in integer USD cents. Pending activities are excluded from realized financial totals. Costs include wagers and fees; payouts are gross amounts received.

## Run locally

```bash
npm ci
npm run dev
```

Without environment variables, the app runs in a **clearly labeled local preview mode** and stores entries in this browser's local storage. This is useful for interface review, but it is not cloud storage or private account authentication. Ticket image upload and account deletion require Supabase.

## Connect Supabase

1. Create a Supabase project.
2. Apply `supabase/migrations/20261012000000_initial.sql` through the Supabase SQL editor or CLI.
3. Deploy `supabase/functions/delete-account` as an Edge Function with JWT verification enabled. The function uses Supabase's managed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-side variables. Never place the service role key in the frontend.
4. Copy `.env.example` to `.env.local`, set the project URL and public anon key, and restart the dev server.
5. In Supabase Auth URL configuration, add the local development URL and `https://test23780460.github.io/scarchoffs/` as allowed redirect URLs. Configure your email provider and password reset template.

Row Level Security policies restrict activities, settings, and ticket images to their owner. The site uses Supabase's public anon key; access is controlled by user JWTs and RLS.

## GitHub Pages

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions secrets, then select **GitHub Actions** as the Pages build source. A push to `main` builds, tests, and deploys the app. The workflow fails when cloud settings are absent so a browser-only preview is not mistaken for production.

## Checks

```bash
npm test
npm run build
```

CSV export includes all records and financial amounts in integer cents. Account deletion calls the authenticated Edge Function, removes private ticket images, and deletes the Auth user, cascading to records and settings.
