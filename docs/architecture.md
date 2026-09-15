# Architecture

The Storage Check-Out Tracker is a single Next.js app (frontend + backend in one)
that reads and writes a Google Sheet through a Google Cloud service account, and
uploads batch checkout photos to Vercel Blob.
There is no database and no external server infrastructure needed.

## Components

| Component | Role |
|---|---|
| **Browser / PWA** (phone) | Loads the app, supports multi-item cart flow, batch camera photo capture, "Add to Home Screen" |
| **Next.js Server Component** (`app/page.tsx`) | Runs on page load; fetches live `Items` + `People` data for the cart form |
| **Dashboard Page** (`app/dashboard/page.tsx`) | Audit overview, filtered `⚠ Stock Discrepancies` log, live catalog, stock adjustments |
| **Next.js Route Handlers** (`app/api/transaction`, `app/api/adjust-stock`) | Validates batch inputs, uploads batch photo to Vercel Blob, mutates sheet quantities, appends log rows |
| **`lib/sheets.ts`** | The central helper module for Google Sheets API operations & Vercel Blob photo uploads |
| **Vercel Blob** | Free tier object store for single batch checkout photos; returns public URLs for in-sheet thumbnail formulas |
| **Google Sheets API** | Accessed with a service account (no end-user OAuth login) |
| **Google Sheet** | Three tabs: `Items`, `People`, `Log` — the entire data store |

## High-level flow

```mermaid
flowchart TD
    subgraph Phone["User's phone (PWA)"]
        A["Open URL / scan QR code"] --> B["Page loads"]
        B --> C["1. Select Action: Take Out / Return / Used Up"]
        C --> D["2. Pick Item + Qty -> 'Add to list' (Multi-item cart)"]
        D --> E{"Exceeds stock or low threshold?"}
        E -->|Yes| F["Show soft inline warning: 'System shows X left — continue anyway?'"]
        F --> G["Flag item as Discrepancy & Add to Cart"]
        E -->|No| G
        G --> H["3. Pick Person + Optional Note"]
        H --> I["4. Snap batch photo (Required for Return, optional for others)"]
        I --> J["5. Tap Submit Batch"]
    end

    subgraph Backend["Next.js Backend (Vercel)"]
        J --> K["POST /api/transaction (multipart/form-data)"]
        K --> L["Upload Photo to Vercel Blob (if present)"]
        L --> M["Obtain public Blob URL\nFormat formula =IMAGE(blobUrl)"]
        K --> N["updateItemQuantities() on Items tab"]
        K --> O["appendLogBatch() on Log tab (one row per item, same BatchID & Timestamp)"]
    end

    subgraph Storage["External Storage"]
        Blob[("Vercel Blob Store\n(BLOB_READ_WRITE_TOKEN)")]
        Sheet[("Google Sheet\n• Items: Item | Type | Qty | Image URL | LowStockThreshold\n• People: Name\n• Log: Timestamp | Person | Action | Item | Qty | Note | Photo URL | BatchID | StockFlag")]
    end

    L --> Blob
    N --> Sheet
    O --> Sheet
```

## What happens on batch submit (`/api/transaction`)

```mermaid
sequenceDiagram
    participant U as Browser (TransactionForm)
    participant N as Route Handler (/api/transaction)
    participant B as Vercel Blob
    participant S as Google Sheets API

    U->>N: POST FormData (action, person, note, items JSON, optional/required photo)
    N->>N: Validate action, person, items array, and return photo requirement
    alt Invalid input or missing return photo
        N-->>U: 400 { success:false, error }
    else Valid input
        opt Photo included
            N->>B: put(fileName, buffer, { access: 'public' })
            B-->>N: public url -> =IMAGE(url) formula
        end
        N->>S: values.get Items!A2:E
        N->>S: batchUpdate Items!C{row} for each item (Quantity ± delta)
        N->>S: values.append Log rows (one row per item, same BatchID & Timestamp)
        N-->>U: 200 { success:true, batchId, updatedQuantities }
    end
```

## Key design decisions

- **Multi-item cart flow**: users build a running list of items, edit quantities or
  remove lines, and submit the entire batch in one transaction.
- **Soft stock validation**: the app never blocks a checkout because of computed
  stock. It displays a friendly inline confirmation and tags the row with
  `StockFlag = Discrepancy` in the `Log` tab.
- **Single batch checkout photo via Vercel Blob**: one camera snap per batch
  (required for Returns, optional for Take Out/Used Up). The backend uploads it to
  Vercel Blob and writes `=IMAGE("https://...")` into the Sheet's `Photo URL` column so
  the live thumbnail renders directly in Google Sheets.
- **Stock adjustments**: admins can correct stock counts from the Dashboard (`/dashboard`),
  which records an explicit `Action = StockAdjustment` audit row in the `Log` tab.
- **Access control**: Zero accounts or sign-ins required for regular users (anyone with the link or QR code can check out items). The Dashboard is protected via an Admin Password and hidden behind a discreet 5-tap header easter egg.

## Nothing is deployed

This project has **not** been deployed or connected to any live Google Sheet,
Vercel project, or domain. See [`docs/admin-guide.md`](./admin-guide.md) for the
steps to connect credentials and deploy.
