# Admin Guide — Storage Check-Out Tracker

This app has **not** been connected to any live Google Sheet or deployed
anywhere. Follow these steps yourself when you're ready to go live. Nothing
here requires touching application code.

## 1. Create the Google Sheet

Create one new Google Sheet with exactly three tabs (names matter — the app
looks them up by name):

### `Items`

| Item | Type | Quantity | Image URL | LowStockThreshold |
|---|---|---|---|---|
| Cordless Drill | Returnable | 3 | https://... | 1 |
| Gaffer Tape Roll | Consumable | 12 | | 3 |

- Row 1 must be the header row shown above.
- `Type` is free text (`Returnable` or `Consumable`).
- `Quantity` is the live current-stock number. Set it once by physically counting
  stock.
- `Image URL` is optional. If provided, thumbnails appear in the cart list.
- `LowStockThreshold` is optional. When a checkout would cause stock to dip below
  this threshold (or below 0), the user gets a friendly non-blocking warning.

### `People`

| Name |
|---|
| Alex Kim |
| Jordan Lee |

- One name per row, row 1 is the header.
- This is the list of people available in the "Who are you?" dropdown.

### `Log`

| Timestamp | Person | Action | Item | Qty | Note | Photo URL | BatchID | StockFlag |
|---|---|---|---|---|---|---|---|---|

- Just add the header row — the app appends every submission batch here automatically.
- `BatchID`: groups items submitted together in the same cart transaction.
- `Photo URL`: contains `=IMAGE("https://...")` formula for live image thumbnail previews directly inside the cell.
- `StockFlag`: set to `Discrepancy` whenever a user proceeds past a soft stock warning.

Copy the spreadsheet's ID from its URL (the string between `/d/` and `/edit`):
```
https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit
```

## 2. Google Cloud Setup: Service Account for Google Sheets

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. Enable the **Google Sheets API** in **APIs & Services → Enable APIs and Services**.
3. Go to **APIs & Services → Credentials → Create Credentials → Service Account**.
   - Name it (e.g. `storage-tracker-bot`).
4. Click on the created service account → **Keys** tab → **Add Key → Create new key → JSON**.
   - This downloads a private key file.
5. Note two values from that JSON file:
   - `client_email` → for `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → for `GOOGLE_PRIVATE_KEY`

## 3. Share the Google Sheet with the Service Account

Open your Google Sheet → **Share** → paste the `client_email` → grant **Editor** access.

## 4. Setup Vercel Blob for Batch Photos

Photos are stored on **Vercel Blob** (free tier):
1. In the [Vercel Dashboard](https://vercel.com/dashboard), navigate to **Storage** (or your project's **Storage** tab).
2. Click **Create Database** → choose **Blob** → Create.
3. Copy the `BLOB_READ_WRITE_TOKEN`.
4. Photos captured during checkout (required for Return, optional for others) will automatically upload to this Blob store and generate live `=IMAGE("...")` formulas in the Sheet.

## 5. Zero Sign-In & Secret Admin Access

- **No login or account creation**: Anyone with the app link can use the tracker, pick their name, take photos, and log transactions without signing in.
- **Admin Easter Egg & Password**: 
  - The Dashboard button is hidden by default from regular users.
  - To access the dashboard, **tap the title / box icon 5 times in quick succession** on the main screen.
  - A password prompt pops up asking for `ADMIN_PASSWORD` (default: `admin123`).
  - Entering the correct password reveals the dashboard and unlocks stock adjustment capabilities.

## 6. Configure environment variables

Copy [`.env.local.example`](../.env.local.example) to `.env.local` in the project root:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=storage-tracker-bot@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token_here
ADMIN_PASSWORD=your-secret-admin-password
```

- Keep `\n` in `GOOGLE_PRIVATE_KEY` as written in the downloaded JSON file.

## 7. Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Test adding multiple items to your cart, taking a batch photo, and submitting. Check:
- Live stock is updated on the `Items` tab.
- All items appear in `Log` with matching `BatchID`, `Timestamp`, and `=IMAGE(...)` thumbnail.

## 8. Deploy to Vercel (when you're ready)

1. Push this project to your GitHub/GitLab repository.
2. In [Vercel](https://vercel.com), import the repository (framework: **Next.js**).
3. Connect your Vercel Blob store to the project (or add `BLOB_READ_WRITE_TOKEN`).
4. Add the remaining environment variables (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `ADMIN_PASSWORD`).
5. Deploy to obtain your production URL.

## 9. Dashboard & Stock Adjustments

- Access the Dashboard by tapping the main header 5 times or visiting `/dashboard` and entering your admin password.
- View **Discrepancies** to audit all checkout batches where users acknowledged low/negative stock warnings.
- Use **Adjust Stock** to correct counts after physical inventory checks. This updates the `Items` sheet and creates a `StockAdjustment` row in `Log`.

- Navigate to `/dashboard` in the web app.
- View **Discrepancies** to audit all checkout batches where users acknowledged low/negative stock warnings.
- Use **Adjust Stock** to correct counts after physical inventory checks. This updates the `Items` sheet and creates a `StockAdjustment` row in `Log`.
