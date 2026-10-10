# EmmaStorage Tracker: Setup and Operations

The Emmanuel Egypt app includes a password-protected, read-only activity log.
There is no stock tracking, catalog, or people list. Live photo submission
end-to-end operation is not claimed.

## Google Sheets

1. Create or choose a Google spreadsheet and copy the ID between `/d/` and
   `/edit` in its URL.
2. In [Google Cloud Console](https://console.cloud.google.com/), create or
   select a project and enable **Google Sheets API**.
3. Create a service account and download a JSON private key. Use `client_email`
   and `private_key` for the environment variables below. Protect the key and
   never commit it.
4. Share the spreadsheet with the service account email as **Editor**.

The backend auto-creates the `Activity` tab and its header on submission:

| Time UTC | Name | Action | Photo | Photo URL | Entry ID |
|---|---|---|---|---|---|
| UTC timestamp | Free-text name | Take, Return, or Consume | `=IMAGE("https://...")` | Public photo URL | Entry identifier |

No item or people setup is needed. Existing `Items`, `People`, and `Log` tabs
are untouched. The home page is static and performs no Sheet reads.

## Vercel Blob and Environment

Create a **public Vercel Blob store** in the Vercel dashboard and obtain its
`BLOB_READ_WRITE_TOKEN`. Configure exactly these four server-side variables
locally in the root local environment file, or in the deployment environment:

```dotenv
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-spreadsheet-id
BLOB_READ_WRITE_TOKEN=your-blob-token
```

Keep the private key's `\n` escapes when using this format. Also set
`ADMIN_PASSWORD` to a strong, unique password to enable admin access.
Do not expose these variables as public client-side configuration.

## Admin Activity Log

Click the header logo and enter `ADMIN_PASSWORD`, or visit `/dashboard`.
The dashboard shows the latest 500 valid activity rows, newest first, with
action totals, name search, action filtering, photo links, refresh, and sign-out.
No stock tools or edits are available. A missing `Activity` tab displays an
empty log without creating or changing the spreadsheet.

The server verifies the password and issues a signed, HTTP-only, same-site
cookie valid for eight hours, HTTPS-only in production. Changing the password
invalidates existing sessions. Sign-out removes the browser cookie. Dashboard
pages and API responses are not cached by the service worker.

Login attempts are limited to five per address per 15 minutes on each server
instance. This is best-effort, not a distributed rate limiter. For public
deployments, add Vercel Firewall rate limiting to `/api/admin/session`. Use a
strong password; never store it in browser storage or commit it.

## Installed App Icons

Icons are configured in this repository, not Vercel. The background-backed logo
is used in `app/icon.png`, `app/apple-icon.png`, and the 192px/512px public PNGs
referenced by the manifest. Deploy the updated project to publish them.
Some phones cache home-screen icons; remove and re-add the installed app after
deployment if the old icon remains. The header uses the transparent logo.

## Local Checks and Deployment

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To verify live integration,
submit a name, an action, and a non-sensitive photo; check the new `Activity`
row, its UTC time, action, entry ID, public URL, and rendered `IMAGE` preview.
Repeat for Take, Return, and Consume. This is a verification procedure, not a
claim that live end-to-end tests have already passed.

For deployment, import the repository into Vercel as a Next.js project, connect
the Blob store, set the four storage variables plus `ADMIN_PASSWORD`, and deploy. Verify a submission in that
environment before distributing the URL or a QR code. No deployment was
performed as part of this update.

## Privacy, Retention, and Failures

### Local Certificate Errors

If local photo storage requests fail with `SELF_SIGNED_CERT_IN_CHAIN`, your
proxy or antivirus may use a certificate trusted by Windows but not Node.
The VS Code preview task enables `NODE_USE_SYSTEM_CA=1` on supported Node
versions (Node 24, or 22.19+). Restart the task after changing its environment.
For a manually started local server, set this variable in the terminal before
running `npm run dev`. Never disable TLS verification to work around this.

Save errors identify whether spreadsheet access, photo upload, or log append
failed. A photo upload has a 20-second enforced deadline; the browser also
bounds its wait. If log confirmation fails or the connection drops, check the
entry reference before retrying, because the write may have succeeded.

- No login is required; names are self-reported and identity is not verified.
  Anyone with the app link can submit. Anyone with a public photo URL can view
  that photo. Avoid private or sensitive photos.
- `IMAGE` is URL-backed: the Sheet does not archive the image bytes. Images
  **must not be deleted unless separately archived**. Preserve a mapping from
  entry IDs and URLs to archived files.
- Excel exports may not embed images. Verify exported images and archive photos
  separately rather than treating a spreadsheet export as a complete backup.
- If upload succeeds but append fails, the uploaded orphan photo is retained.
  Inspect the Sheet and Blob store before any manual cleanup; retention rules
  still apply.
- A timed-out append may have reached Google Sheets. Check for an existing row
  before retrying, since a retry may create a duplicate. There are no automatic
  retries and no atomic transaction across Blob and Sheets.
