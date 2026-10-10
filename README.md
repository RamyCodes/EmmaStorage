# EmmaStorage Tracker

A mobile-first Emmanuel activity logger backed by Google Sheets and Vercel
Blob. The form has exactly three inputs: a free-text name, a **Take / Return /
Consume** segmented selection, and a **required photo for every action**.
There is no stock tracking, catalog, or people list. Clicking the header logo
opens password-protected access to a read-only activity dashboard.

## Documentation

- [User guide](./docs/user-guide.md)
- [Setup and operations](./docs/admin-guide.md)
- [Architecture](./docs/architecture.md)

## Quick Start

Follow the [setup guide](./docs/admin-guide.md) to enable Google Sheets API,
share a spreadsheet with a service account as Editor, and configure a public
Vercel Blob store. Set these four server-side variables in your local environment:

```dotenv
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-spreadsheet-id
BLOB_READ_WRITE_TOKEN=your-blob-token
```

Set `ADMIN_PASSWORD` to a strong, unique password to enable the admin dashboard.
There is no default password. Keep credentials out of source control.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page is static and
does not read Google Sheets. On submission, the backend auto-creates an
`Activity` tab with `Time UTC`, `Name`, `Action`, `Photo`, `Photo URL`, and
`Entry ID` columns. Existing `Items`, `People`, and `Log` tabs are untouched.

## Implementation

- [app/page.tsx](./app/page.tsx): static home page.
- [app/activity-form.tsx](./app/activity-form.tsx): form and client photo resizing
   to a maximum 1600px dimension, JPEG quality `0.82`.
- [lib/activity.ts](./lib/activity.ts): input validation; names limited to 100
   characters and API photos to 3 MB with JPEG, PNG, or WebP signature checks.
- [app/api/transaction/route.ts](./app/api/transaction/route.ts): single activity
   API endpoint, `POST /api/transaction`.
- [lib/activity-store.ts](./lib/activity-store.ts): `google-auth-library` JWT,
   Sheets REST requests, and public Vercel Blob photo storage.

Next.js App Router, Tailwind CSS, and PWA support remain. The visual theme is
inspired by cobalt, teal, and gold. The supplied logos are bundled locally;
static PNGs provide browser, iOS, and installed-app icons.

## Privacy and Retention

Regular activity submission requires no login and a typed name is not verified identity. Anyone with a
photo's public URL can access it; avoid private or sensitive photos.
The Sheet's `IMAGE` formula is URL-backed, not an embedded archive. Images
**must not be deleted unless separately archived**. Excel exports may not embed
images: verify the export and archive photos separately.

An upload can succeed while the Sheet append fails, leaving a retained orphan
photo. An append timeout can leave the outcome unknown, so retrying may create
a duplicate. There are no automatic retries.

## Validation and Deployment

```bash
npm test
npm run lint
npm run build
```

No deployment has been performed. These checks do not establish a live
end-to-end test of Google Sheets and Blob; verify an actual submission before
rolling out the app.

