const EXPORT_COLUMNS = [
  "platform",
  "post_type",
  "is_repost",
  "author",
  "repost_author",
  "original_author",
  "repost_commentary",
  "original_post_excerpt",
  "date_label",
  "relative_date_label",
  "timestamp",
  "decoded_post_date",
  "date_confidence",
  "text",
  "rawText",
  "url",
  "impressions",
  "reactions",
  "comments",
  "reposts",
  "media_count",
  "source_url",
  "source_type",
  "capture_mode",
  "exported_at"
];

const CONTENT_SCRIPT_FILE = "content.js";
const LINKEDIN_READY_SOURCE = "stellarsync-linkedin-export-helper";
const HELPER_VERSION = "0.1.1";

let latestPayload = null;

function $(id) {
  return document.getElementById(id);
}

function setStatus(message) {
  $("status").textContent = message;
}

function setDiagnostics(value) {
  $("diagnostics").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setButtonsEnabled(enabled) {
  ["copy-tsv-btn", "download-json-btn", "download-csv-btn", "download-tsv-btn", "download-media-manifest-btn", "import-media-btn"].forEach(function(id) {
    $(id).disabled = !enabled;
  });
}

function mediaManifestFromPayload(payload) {
  if (payload && payload.media_manifest && payload.media_manifest.items && payload.media_manifest.items.length) {
    return {
      generated_at: payload.generated_at || payload.generatedAt,
      source_url: payload.source_url,
      page_type: payload.page_type,
      total_items_with_media: payload.media_manifest.total_items_with_media,
      total_media_count: payload.media_manifest.total_media_count,
      media_types: payload.media_manifest.media_types || {},
      items: payload.media_manifest.items
    };
  }
  var items = (payload && payload.items) || [];
  var mediaItems = [];
  items.forEach(function(item) {
    var itemMedia = item.media || [];
    if (!itemMedia.length) return;
    mediaItems.push({
      capture_index: item.capture_index,
      linkedin_url: item.url || "",
      post_text: (item.text || item.rawText || "").slice(0, 200),
      media: itemMedia
    });
  });
  if (!mediaItems.length) return null;
  return {
    generated_at: payload.generated_at || payload.generatedAt,
    source_url: payload.source_url,
    page_type: payload.page_type,
    total_items_with_media: mediaItems.length,
    total_media_count: mediaItems.reduce(function(sum, m) { return sum + m.media.length; }, 0),
    media_types: {},
    items: mediaItems
  };
}

function csvEscape(value, delimiter) {
  var text = String(value == null ? "" : value);
  if (delimiter === "\t") return text.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  if (!/[",\r\n]/.test(text)) return text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function toExportRows(payload) {
  var exportedAt = payload.generated_at || new Date().toISOString();
  return (payload.items || []).map(function(item) {
    var metrics = item.metrics || {};
    var mediaUrls = item.media_urls || item.mediaUrls || [];
    return {
      platform: "linkedin",
      post_type: String(item.post_type || item.postType || "").trim(),
      is_repost: item.is_repost ? "true" : "false",
      author: String(item.author || "").trim(),
      repost_author: String(item.repost_author || item.repostAuthor || "").trim(),
      original_author: String(item.original_author || item.originalAuthor || "").trim(),
      repost_commentary: String(item.repost_commentary || item.repostCommentary || "").trim(),
      original_post_excerpt: String(item.original_post_excerpt || item.originalPostExcerpt || "").trim(),
      date_label: String(item.date_label || item.dateLabel || "").trim(),
      relative_date_label: String(item.relative_date_label || item.relativeDateLabel || "").trim(),
      timestamp: String(item.timestamp || "").trim(),
      decoded_post_date: String(item.decoded_post_date || item.decodedPostDate || "").trim(),
      date_confidence: String(item.date_confidence || item.dateConfidence || "").trim(),
      text: String(item.text || "").trim(),
      rawText: String(item.rawText || "").trim(),
      url: String(item.url || item.post_url || "").trim(),
      impressions: String(metrics.impressions || item.impression_count || item.impressions || ""),
      reactions: String(metrics.reactions || item.reaction_count || item.reactions || ""),
      comments: String(metrics.comments || item.comment_count || item.comments || ""),
      reposts: String(metrics.reposts || item.repost_count || item.reposts || ""),
      media_count: String(mediaUrls.length || item.media_count || "0"),
      source_url: String(payload.source_url || "").trim(),
      source_type: String(item.source_type || item.sourceType || "").trim(),
      capture_mode: String(payload.capture_mode || payload.used_fallback ? "fallback" : "card_detection").trim(),
      exported_at: exportedAt
    };
  });
}

function serializeDelimited(rows, delimiter) {
  var header = EXPORT_COLUMNS.join(delimiter);
  var lines = rows.map(function(row) {
    return EXPORT_COLUMNS.map(function(column) { return csvEscape(row[column], delimiter); }).join(delimiter);
  });
  return [header].concat(lines).join("\n");
}

function downloadBlob(filename, mimeType, content) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  chrome.downloads.download({ url: url, filename: filename, saveAs: true }, function() {
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  });
}

function isLinkedInUrl(url) {
  return /^https:\/\/(?:www\.)?linkedin\.com\//i.test(String(url || ""));
}

async function getActiveTab() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab || !tab.id) throw new Error("No active tab was found.");
  return tab;
}

function sendTabMessage(tabId, message) {
  return new Promise(function(resolve, reject) {
    chrome.tabs.sendMessage(tabId, message, function(response) {
      var err = chrome.runtime.lastError;
      if (err) { reject(new Error(err.message)); return; }
      resolve(response);
    });
  });
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId: tabId }, files: [CONTENT_SCRIPT_FILE] });
}

function isReceivingEndError(error) {
  return /receiving end does not exist/i.test(String(error && error.message ? error.message : error));
}

async function ensureContentScriptReady(tab) {
  try {
    var response = await sendTabMessage(tab.id, { type: "ping" });
    if (response && response.ready && response.source === LINKEDIN_READY_SOURCE) return response;
  } catch (e) {
    if (!isReceivingEndError(e)) throw e;
  }
  try {
    await injectContentScript(tab.id);
    var retry = await sendTabMessage(tab.id, { type: "ping" });
    if (retry && retry.ready && retry.source === LINKEDIN_READY_SOURCE) return retry;
  } catch (e) {
    if (isReceivingEndError(e)) throw new Error("Could not load the capture helper in this LinkedIn tab. Refresh LinkedIn and try again.");
    throw e;
  }
  throw new Error("Could not load the capture helper in this LinkedIn tab. Refresh LinkedIn and try again.");
}

function renderDiagnosticsFromPayload(payload) {
  if (payload && payload.diagnostics) {
    var diag = payload.diagnostics;
    var lines = [];
    lines.push("Page URL: " + (diag.pageUrl || "unknown"));
    lines.push("Helper version: " + (payload.helper_version || payload.helperVersion || HELPER_VERSION));
    if (payload.page_type) lines.push("Page type: " + payload.page_type);
    if (payload.capture_mode) lines.push("Capture mode: " + payload.capture_mode);
    if (payload.used_fallback) lines.push("Fallback: yes");
    if (diag.cardsDetected != null) lines.push("Cards detected: " + diag.cardsDetected);
    if (diag.itemsDetected != null) lines.push("Items extracted: " + diag.itemsDetected);
    if (diag.itemsWithRawText != null) lines.push("Items with raw text: " + diag.itemsWithRawText);
    if (diag.bodyTextLength != null) lines.push("Body text length: " + diag.bodyTextLength);
    if (diag.mainTextLength != null) lines.push("Main text length: " + diag.mainTextLength);
    if (diag.visibleTextCandidateCount != null) lines.push("Text candidates: " + diag.visibleTextCandidateCount);
    if (diag.fallbackCandidatesDetected != null) lines.push("Fallback candidates: " + diag.fallbackCandidatesDetected);
    if (diag.selectionTextLength != null) lines.push("Selection text length: " + diag.selectionTextLength);
    if (diag.selectorsTried && diag.selectorsTried.length) {
      lines.push("Selectors:");
      diag.selectorsTried.forEach(function(sel) {
        var count = (diag.selectorCounts || {})[sel] || 0;
        lines.push("  " + sel + ": " + count);
      });
    }
    if (diag.skippedReasons && diag.skippedReasons.length) {
      lines.push("Skipped: " + diag.skippedReasons.join(", "));
    }
    if (diag.sampleRawTextFirst300 && diag.sampleRawTextFirst300.length) {
      diag.sampleRawTextFirst300.forEach(function(snippet, idx) {
        if (snippet) lines.push("Snippet " + (idx + 1) + ": " + snippet.slice(0, 150));
      });
    }
    if (diag.itemsDetected === 0 && !payload.used_fallback) {
      lines.push("");
      lines.push("Automatic card detection found 0 posts. Try Capture visible page text or highlight posts and click Capture selected text.");
    }
    setDiagnostics(lines.join("\n"));
    return;
  }
  setDiagnostics("No diagnostics returned.");
}

async function requireLinkedInReady() {
  var tab = await getActiveTab();
  if (!isLinkedInUrl(tab.url)) throw new Error("Open a LinkedIn activity/profile page first.");
  await ensureContentScriptReady(tab);
  return tab;
}

async function handleCaptureResponse(response) {
  if (!response || response.error) {
    throw new Error(response && response.error ? response.error : "The capture helper did not return data.");
  }
  latestPayload = response;
  var items = response.items || [];
  var rows = toExportRows(latestPayload);
  setButtonsEnabled(rows.length > 0);
  var mode = response.capture_mode || (response.used_fallback ? "fallback" : "card_detection");
  setStatus(rows.length + " item" + (rows.length === 1 ? "" : "s") + " ready via " + mode + ". Download JSON/CSV/TSV or copy TSV for Google Sheets.");
  renderDiagnosticsFromPayload(latestPayload);
}

async function exportVisiblePosts() {
  setStatus("Exporting visible LinkedIn posts from the active tab...");
  try {
    var tab = await requireLinkedInReady();
    var response = await sendTabMessage(tab.id, { type: "exportVisiblePosts" });
    await handleCaptureResponse(response);
  } catch (error) {
    latestPayload = null;
    setButtonsEnabled(false);
    setStatus(error && error.message ? error.message : "Export failed.");
    setDiagnostics("No export run yet.");
  }
}

async function capturePageText() {
  setStatus("Capturing visible page text from the active tab...");
  try {
    var tab = await requireLinkedInReady();
    var response = await sendTabMessage(tab.id, { type: "capturePageText" });
    await handleCaptureResponse(response);
  } catch (error) {
    latestPayload = null;
    setButtonsEnabled(false);
    setStatus(error && error.message ? error.message : "Page text capture failed.");
    setDiagnostics("No export run yet.");
  }
}

async function captureSelectedText() {
  setStatus("Capturing selected text from the active tab...");
  try {
    var tab = await requireLinkedInReady();
    var response = await sendTabMessage(tab.id, { type: "captureSelectedText" });
    await handleCaptureResponse(response);
  } catch (error) {
    latestPayload = null;
    setButtonsEnabled(false);
    setStatus(error && error.message ? error.message : "Selection capture failed.");
    setDiagnostics("No export run yet.");
  }
}

async function showDiagnostics() {
  setStatus("Checking the active LinkedIn tab...");
  try {
    var tab = await requireLinkedInReady();
    var response = await sendTabMessage(tab.id, { type: "getDiagnostics" });
    if (!response || response.error) {
      throw new Error(response && response.error ? response.error : "The capture helper did not return diagnostics.");
    }
    setStatus("Diagnostics loaded from the active LinkedIn tab.");
    var lines = [];
    lines.push("Page URL: " + (response.pageUrl || "unknown"));
    if (response.pageType) lines.push("Page type: " + response.pageType);
    if (response.cardsDetected != null) lines.push("Cards detected: " + response.cardsDetected);
    if (response.itemsDetected != null) lines.push("Items extracted: " + response.itemsDetected);
    if (response.itemsWithRawText != null) lines.push("Items with raw text: " + response.itemsWithRawText);
    if (response.items != null) lines.push("Total items: " + response.items);
    if (response.bodyTextLength != null) lines.push("Body text length: " + response.bodyTextLength);
    if (response.mainTextLength != null) lines.push("Main text length: " + response.mainTextLength);
    if (response.visibleTextCandidateCount != null) lines.push("Text candidates: " + response.visibleTextCandidateCount);
    if (response.fallbackCandidatesDetected != null) lines.push("Fallback candidates: " + response.fallbackCandidatesDetected);
    if (response.selectionTextLength != null) lines.push("Selection text length: " + response.selectionTextLength);
    if (response.selectorsTried) {
      lines.push("Selectors:");
      response.selectorsTried.forEach(function(sel) {
        var count = (response.selectorCounts || {})[sel] || 0;
        lines.push("  " + sel + ": " + count);
      });
    }
    if (response.sampleRawTextFirst300 && response.sampleRawTextFirst300.length) {
      response.sampleRawTextFirst300.forEach(function(snippet, idx) {
        if (snippet) lines.push("Snippet " + (idx + 1) + ": " + snippet.slice(0, 150));
      });
    }
    if (response.cardsDetected === 0 && response.itemsDetected === 0) {
      lines.push("");
      lines.push("Automatic card detection found 0 posts. Try Capture visible page text or highlight posts and click Capture selected text.");
    }
    setDiagnostics(lines.join("\n"));
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not load diagnostics.");
    setDiagnostics("Diagnostics unavailable until the helper loads in the active LinkedIn tab.");
  }
}

function requirePayload() {
  if (!latestPayload) throw new Error("Run Export Visible Posts, Capture Visible Page Text, or Capture Selected Text first.");
  return latestPayload;
}

async function copyTsv() {
  try {
    var payload = requirePayload();
    var text = serializeDelimited(toExportRows(payload), "\t");
    await navigator.clipboard.writeText(text);
    setStatus("TSV copied. Paste it into Google Sheets or StellarSync.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not copy TSV.");
  }
}

function downloadJson() {
  try {
    var payload = requirePayload();
    downloadBlob("linkedin-visible-posts-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json", "application/json", JSON.stringify(payload, null, 2));
    setStatus("JSON download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download JSON.");
  }
}

function downloadCsv() {
  try {
    var payload = requirePayload();
    downloadBlob("linkedin-visible-posts-" + new Date().toISOString().replace(/[:.]/g, "-") + ".csv", "text/csv;charset=utf-8", serializeDelimited(toExportRows(payload), ","));
    setStatus("CSV download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download CSV.");
  }
}

function downloadTsv() {
  try {
    var payload = requirePayload();
    downloadBlob("linkedin-visible-posts-" + new Date().toISOString().replace(/[:.]/g, "-") + ".tsv", "text/tab-separated-values;charset=utf-8", serializeDelimited(toExportRows(payload), "\t"));
    setStatus("TSV download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download TSV.");
  }
}

function downloadMediaManifest() {
  try {
    var payload = requirePayload();
    var manifest = mediaManifestFromPayload(payload);
    if (!manifest || !manifest.items || !manifest.items.length) {
      setStatus("No media found in the captured payload.");
      return;
    }
    downloadBlob("linkedin-media-manifest-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json", "application/json", JSON.stringify(manifest, null, 2));
    setStatus(manifest.total_media_count + " media items (" + manifest.total_items_with_media + " posts). JSON download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download media manifest.");
  }
}

async function importMediaToStellarSync() {
  try {
    var payload = requirePayload();
    var manifest = mediaManifestFromPayload(payload);
    if (!manifest || !manifest.items || !manifest.items.length) {
      setStatus("No media found in the captured payload.");
      return;
    }
    var json = JSON.stringify(manifest, null, 2);
    await navigator.clipboard.writeText(json);
    setStatus("Media manifest copied to clipboard (" + manifest.total_media_count + " media items). Paste into StellarSync LinkedIn import modal.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not copy media manifest.");
  }
}

$("export-btn").addEventListener("click", exportVisiblePosts);
$("capture-page-text-btn").addEventListener("click", capturePageText);
$("capture-selected-text-btn").addEventListener("click", captureSelectedText);
$("show-diagnostics-btn").addEventListener("click", showDiagnostics);
$("copy-tsv-btn").addEventListener("click", copyTsv);
$("download-json-btn").addEventListener("click", downloadJson);
$("download-csv-btn").addEventListener("click", downloadCsv);
$("download-tsv-btn").addEventListener("click", downloadTsv);
$("download-media-manifest-btn").addEventListener("click", downloadMediaManifest);
$("import-media-btn").addEventListener("click", importMediaToStellarSync);
