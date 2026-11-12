# Wolt Kandidati — Android panel v0.3

This APK packages the existing mobile-first Wolt Kandidati web UI into a native Android shell.

## Currently implemented
- Local record of candidates imported from a CSV/XLSX file selected on the device.
- First import marked as baseline: previously existing candidates are archived.
- Phone number de-duplication and search.
- Editable greeting, eligibility question and reminder templates.
- Approved FAQ library, question similarity lookup, safe fallback and review list.
- Local JSON backup of approved answers and CSV export of candidate ledger.

## Not implemented (deliberately not misrepresented)
- No automatic Google Drive / Meta lead sync; separate user OAuth/authorized backend required.
- No automatic WhatsApp/Viber outbound messaging or incoming message reading.
- No background task while the device is locked.
- No writing status to source Excel.
- No push notifications.
- The HTML uses a CDN-hosted spreadsheet parser for XLSX. A data connection is needed to import XLSX; CSV import can be used when offline.

## Data
The app keeps imported names and phone numbers in local WebView storage. It does not send them to the GitHub source repository or any central server. Device backups may contain data; for production use, proper encryption and access control are required.

## Build
On every commit to main touching either the web UI or Android wrapper, GitHub Actions builds a debug APK for sideloading and publishes an app release. No Google Play account needed. Debug keys vary by build, so upgrading the APK in-place is not guaranteed until a stable signing key is configured.

## Policy
WhatsApp Business forbids unauthorized bulk messaging. This project does not attempt to bypass blocks or automate WhatsApp UI taps.
