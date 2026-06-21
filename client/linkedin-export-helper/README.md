# StellarSync Plugin

This extension captures the current browser tab into StellarSync and keeps the existing LinkedIn exporter as one tab inside the plugin. It does not collect passwords, does not scrape via a server, and does not run background automation.

## Primary tabs

- Save Inspo: captures the active page or social post URL, title, notes, tags, and platform/source, then opens StellarSync to save into Inspo.
- Save Note: captures the active page or social post URL and note text, then opens StellarSync to save into Notes.
- LinkedIn Exporter: exports LinkedIn posts that are already visible in the active LinkedIn tab for local JSON/CSV/TSV import.

## What the LinkedIn Exporter exports

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
4. Select the unzipped `linkedin-export-helper/` folder.
5. Click the StellarSync Plugin icon.
6. Use Save Inspo or Save Note for general pages and social links.
7. For LinkedIn exports, open your LinkedIn activity or profile page, scroll until the posts you want are visible, open the LinkedIn Exporter tab, then click `Export Visible Posts`.

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
