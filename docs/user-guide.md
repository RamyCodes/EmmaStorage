# EmmaStorage Tracker: User Guide

Open the Emmanuel app link or scan its QR code with your phone. No account or
login is required. Your typed name is self-reported, not verified identity.

## Record an Activity

1. Enter your name as free text, up to 100 characters.
2. Choose **Take**, **Return**, or **Consume** using the segmented selection.
3. Take or select a clear photo. A photo is required for **all three actions**.
4. Submit and wait for confirmation before leaving the page.

These are the only inputs. There are no item lists, quantities, notes, stock
counts or people dropdowns in the submission form.

## Admin Access

Click the header logo and enter the admin password to open the activity log.
Administrators can search by name, filter actions, open photos, refresh the
log, and sign out. Regular submissions do not need this password.

Photos are resized on your device to a maximum 1600px dimension and converted
to JPEG at quality `0.82`. The API accepts JPEG, PNG, or WebP photos up to 3 MB
and checks their file signatures. A successful submission records one row in
the Google Sheet's `Activity` tab.

## Photos and Submission Problems

Avoid private or sensitive photos: anyone with a photo's public URL can access
it. The Sheet displays a URL-backed `IMAGE` preview, not an archived copy.
Images **must not be deleted unless separately archived**. Excel exports may
not embed images; the operator must verify exports and archive photos separately.

If a submission fails, the photo may already have uploaded. If it times out,
the activity may already be recorded. Ask the operator to check the Sheet
before retrying to avoid duplicates. The app does not automatically retry.
Loading the home page is not proof that submission services are working.

## Add to Home Screen

- **iPhone / iPad:** open the link in Safari, choose **Share**, then **Add to
  Home Screen**.
- **Android:** open the link in Chrome and choose **Add to Home screen** or
  **Install app** from the browser menu.

Installation is optional. An internet connection is needed to submit.
