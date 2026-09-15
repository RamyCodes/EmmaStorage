# User Guide — Storage Check-Out Tracker

A quick way to log what you take out of, return to, or use up from the storage
room. No account, no password — just open the link and go.

## Getting the app

Someone with access to the storage room will give you a **link or QR code**.

- **Scan the QR code** with your phone's camera app, or
- **Open the link** in your phone's browser.

There's nothing to install and nothing to sign in to.

### Add it to your Home Screen (recommended)

This makes it open like a regular app, full-screen, with one tap.

**iPhone / iPad (Safari):**
1. Open the link in Safari.
2. Tap the **Share** icon (square with an arrow) at the bottom.
3. Tap **Add to Home Screen**, then **Add**.

**Android (Chrome):**
1. Open the link in Chrome.
2. Tap the **⋮** menu in the top right.
3. Tap **Add to Home screen** (or **Install app**), then confirm.

## Logging items (Multi-item cart flow)

1. **Choose what you're doing:**
   - **Take Out** 📤 — borrowing tools or returnable gear.
   - **Return** 📥 — bringing items back.
   - **Used Up** 🗑️ — consuming supplies (tape, gloves, etc.).
2. **Add items to your list:**
   - Pick an item from the dropdown.
   - Set the quantity using the `+` / `−` buttons or numeric input.
   - If stock is low, a friendly notice appears: *"System shows only X left — continue anyway?"*. You can tap **"Continue anyway & add"** — the app will never block you from completing your work.
   - Tap **"+ Add to list"**.
   - Repeat for as many items as you want! You can adjust quantities or remove lines directly in the running list.
3. **Select your name:**
   - Choose who you are from the "Who are you?" dropdown.
4. *(Optional)* **Add a note:**
   - e.g. "Job #402" or "Found drill bit blunt".
5. **Snap a batch photo:**
   - **Required for Return 📥**: Snap a clear photo of the items being returned.
   - **Optional for Take Out 📤 / Used Up 🗑️**: Helpful for visual record keeping.
   - Tap the camera button to open your phone camera. You'll see an instant preview with a "Retake" button.
6. Tap **Submit**:
   - The app uploads the photo to Vercel Blob and records all items in a single batch in the Google Sheet.

You'll see a confirmation like:

> ✅ Recorded: Alex Kim took out 2 × Cordless Drill, 1 × Extension Cord

## Viewing the Dashboard (Admin)

The Dashboard is discreetly hidden from everyday users. If you are an administrator:
1. Tap the **📦 Storage Check-Out** title 5 times in quick succession.
2. Enter the Admin Password in the popup modal.
3. The **📊 Dashboard** will unlock, allowing you to view discrepancy logs, live inventory levels, and perform stock adjustments.
