# Storage Check-Out Tracker

A mobile-first PWA for logging items taken out of and returned to a physical
storage room, backed by Google Sheets and Vercel Blob. Supports multi-item cart
checkouts, soft stock validation warnings, single batch checkout photo uploads,
and a stock discrepancy & audit dashboard.

**Docs:**

- [Architecture & flow diagrams](./docs/architecture.md)
- [User guide](./docs/user-guide.md)
- [Admin guide](./docs/admin-guide.md) — Google Sheets + Vercel Blob setup, environment variables, deployment

## Key Features

- **Multi-Item Cart Flow**: Select action, add multiple items with editable quantities to an interactive running list, and submit all at once in a single batch.
- **Soft Stock Validation**: Never blocks checkouts — friendly inline warnings for low/negative stock, flagged with `StockFlag = Discrepancy` in the audit log.
- **Single Batch Checkout Photo via Vercel Blob**: One camera snap per batch (required for Return, optional for others) uploaded to Vercel Blob and embedded into the Sheet via `=IMAGE(...)` formula thumbnails.
- **Zero Login / No Accounts Required**: Anyone with the QR code or link can immediately check out items and upload photos without creating an account or logging in.
- **Secret Admin Access & Stock Adjustments**: Dashboard is hidden from regular users behind a 5-tap header easter egg and protected with an Admin Password.
- **PWA & Mobile-First**: Installable to iOS/Android home screens, big tactile touch targets.

## Stack

- Next.js (App Router) — frontend + API route handlers
- Google Sheets API (via Google Cloud Service Account)
- Vercel Blob — photo storage for batch checkout photos
- Tailwind CSS — mobile-first styling
- PWA manifest + service worker

## Quick Start

1. Follow [`docs/admin-guide.md`](./docs/admin-guide.md) to create the Google Sheet (Tabs: `Items`, `People`, `Log`), enable the Sheets API on Google Cloud, share it with your Service Account email, and create a Vercel Blob store.
2. Copy [`.env.local.example`](./.env.local.example) to `.env.local` and populate:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEET_ID`
   - `BLOB_READ_WRITE_TOKEN`
   - `ADMIN_PASSWORD` (default: `admin123`)
3. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Project Layout

```
app/page.tsx                  Server Component — fetches Items/People live, renders cart form
app/tracker-header.tsx        Client Component — header with 5-tap secret admin unlock modal
app/transaction-form.tsx      Client Component — interactive multi-item cart & batch photo capture
app/dashboard/page.tsx        Server Component — dashboard with discrepancy alerts & stock audit
app/dashboard/dashboard-view.tsx  Client Component — password gate, discrepancy filter & stock adjustments
app/api/transaction/route.ts  API route — handles multi-item batch checkouts & Blob photo upload
app/api/adjust-stock/route.ts API route — handles manual stock adjustments with admin password verification
app/api/verify-admin/route.ts API route — verifies admin password
lib/sheets.ts                 Google Sheets API helper & Vercel Blob upload module
app/manifest.json, public/sw.js  PWA support & offline app-shell caching
docs/                         Architecture diagrams, user guide, admin guide
```

