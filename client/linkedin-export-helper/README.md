# LinkedIn Post Export Helper

This extension exports the LinkedIn posts that are already visible in your browser tab. It does not collect passwords, does not scrape via a server, and does not run background automation. It runs only on the active LinkedIn tab after you click export.

## What it exports

- JSON in StellarSync-compatible format:
  - `source`
  - `generated_at`
  - `source_url`
  - `diagnostics`
  - `items`
- CSV
- TSV
- Copyable TSV for Google Sheets

## Export columns

- `platform`
- `post_type`
- `is_repost`
- `author`
- `original_author`
- `date_label`
- `timestamp`
- `text`
- `rawText`
- `url`
- `impressions`
- `reactions`
- `comments`
- `reposts`
- `media_count`
- `source_url`
- `exported_at`

## How to use

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `stellarsync/linkedin-export-helper/` folder.
5. Open your LinkedIn activity or profile page.
6. Scroll until the posts you want are visible.
7. Click the extension icon.
8. Click `Show Diagnostics` if you want to confirm the helper is active in that tab.
9. Click `Export Visible Posts`.

## StellarSync compatibility

The JSON export matches the StellarSync import envelope:

```json
{
  "source": "linkedin_browser_capture",
  "generated_at": "2026-05-18T00:00:00.000Z",
  "source_url": "https://www.linkedin.com/...",
  "diagnostics": {
    "cardsDetected": 0,
    "itemsDetected": 0,
    "itemsWithRawText": 0,
    "selectorsUsed": [],
    "skippedCount": 0
  },
  "items": []
}
```

Export your visible LinkedIn posts locally, then import the JSON or paste TSV into StellarSync.
