const EXPORT_COLUMNS = [
  "platform",
  "post_type",
  "is_repost",
  "author",
  "original_author",
  "date_label",
  "timestamp",
  "text",
  "rawText",
  "url",
  "impressions",
  "reactions",
  "comments",
  "reposts",
  "media_count",
  "source_url",
  "exported_at"
];

const CONTENT_SCRIPT_FILE = "content.js";
const LINKEDIN_READY_SOURCE = "stellarsync-linkedin-export-helper";

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
  [
    "copy-tsv-btn",
    "download-json-btn",
    "download-csv-btn",
    "download-tsv-btn"
  ].forEach((id) => {
    $(id).disabled = !enabled;
  });
}

function csvEscape(value, delimiter) {
  const text = String(value == null ? "" : value);
  if (delimiter === "\t") return text.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toExportRows(payload) {
  const exportedAt = payload.generated_at || new Date().toISOString();
  return (payload.items || []).map((item) => ({
    platform: "linkedin",
    post_type: String(item.post_type || "").trim(),
    is_repost: item.is_repost ? "true" : "false",
    author: String(item.author || "").trim(),
    original_author: String(item.original_author || "").trim(),
    date_label: String(item.date_label || "").trim(),
    timestamp: String(item.timestamp || "").trim(),
    text: String(item.text || "").trim(),
    rawText: String(item.rawText || "").trim(),
    url: String(item.post_url || item.url || "").trim(),
    impressions: String(item.impression_count || item.metrics?.impressions || "").trim(),
    reactions: String(item.reaction_count || item.metrics?.reactions || "").trim(),
    comments: String(item.comment_count || item.metrics?.comments || "").trim(),
    reposts: String(item.repost_count || item.metrics?.reposts || "").trim(),
    media_count: String(item.media_count || (item.media_urls || []).length || 0),
    source_url: String(payload.source_url || "").trim(),
    exported_at: exportedAt
  }));
}

function serializeDelimited(rows, delimiter) {
  const header = EXPORT_COLUMNS.join(delimiter);
  const lines = rows.map((row) => EXPORT_COLUMNS.map((column) => csvEscape(row[column], delimiter)).join(delimiter));
  return [header].concat(lines).join("\n");
}

function downloadBlob(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    {
      url,
      filename,
      saveAs: true
    },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  );
}

function isLinkedInUrl(url) {
  return /^https:\/\/(?:www\.)?linkedin\.com\//i.test(String(url || ""));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No active tab was found.");
  }
  return tab;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE]
  });
}

function isReceivingEndError(error) {
  return /receiving end does not exist/i.test(String(error && error.message ? error.message : error));
}

async function ensureContentScriptReady(tab) {
  try {
    const response = await sendTabMessage(tab.id, { type: "ping" });
    if (response && response.ok && response.ready) {
      return response;
    }
  } catch (error) {
    if (!isReceivingEndError(error)) {
      throw error;
    }
  }

  try {
    await injectContentScript(tab.id);
    const retry = await sendTabMessage(tab.id, { type: "ping" });
    if (retry && retry.ok && retry.ready && retry.source === LINKEDIN_READY_SOURCE) {
      return retry;
    }
  } catch (error) {
    if (isReceivingEndError(error)) {
      throw new Error("Could not load the capture helper in this LinkedIn tab. Refresh LinkedIn and try again.");
    }
    throw error;
  }

  throw new Error("Could not load the capture helper in this LinkedIn tab. Refresh LinkedIn and try again.");
}

function renderDiagnosticsFromPayload(payload) {
  if (payload && payload.diagnostics) {
    setDiagnostics(payload.diagnostics);
    return;
  }
  setDiagnostics("No diagnostics returned.");
}

async function requireLinkedInReady() {
  const tab = await getActiveTab();
  if (!isLinkedInUrl(tab.url)) {
    throw new Error("Open a LinkedIn activity/profile page first.");
  }
  await ensureContentScriptReady(tab);
  return tab;
}

async function exportVisiblePosts() {
  setStatus("Exporting visible LinkedIn posts from the active tab...");
  try {
    const tab = await requireLinkedInReady();
    const response = await sendTabMessage(tab.id, { type: "exportVisiblePosts" });
    if (!response || !response.ok || !response.payload) {
      throw new Error(response && response.error ? response.error : "The capture helper did not return export data.");
    }
    latestPayload = response.payload;
    const rows = toExportRows(latestPayload);
    setButtonsEnabled(rows.length > 0);
    setStatus(`${rows.length} visible post${rows.length === 1 ? "" : "s"} ready. Download JSON/CSV/TSV or copy TSV for Google Sheets.`);
    renderDiagnosticsFromPayload(latestPayload);
  } catch (error) {
    latestPayload = null;
    setButtonsEnabled(false);
    setStatus(error && error.message ? error.message : "Export failed.");
    setDiagnostics("No export run yet.");
  }
}

async function showDiagnostics() {
  setStatus("Checking the active LinkedIn tab...");
  try {
    const tab = await requireLinkedInReady();
    const response = await sendTabMessage(tab.id, { type: "getDiagnostics" });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "The capture helper did not return diagnostics.");
    }
    setStatus("Diagnostics loaded from the active LinkedIn tab.");
    setDiagnostics(response);
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not load diagnostics.");
    setDiagnostics("Diagnostics unavailable until the helper loads in the active LinkedIn tab.");
  }
}

function requirePayload() {
  if (!latestPayload) {
    throw new Error("Run Export Visible Posts first.");
  }
  return latestPayload;
}

async function copyTsv() {
  try {
    const payload = requirePayload();
    const text = serializeDelimited(toExportRows(payload), "\t");
    await navigator.clipboard.writeText(text);
    setStatus("TSV copied. Paste it into Google Sheets or StellarSync.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not copy TSV.");
  }
}

function downloadJson() {
  try {
    const payload = requirePayload();
    downloadBlob(
      `linkedin-visible-posts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      "application/json",
      JSON.stringify(payload, null, 2)
    );
    setStatus("JSON download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download JSON.");
  }
}

function downloadCsv() {
  try {
    const payload = requirePayload();
    downloadBlob(
      `linkedin-visible-posts-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
      "text/csv;charset=utf-8",
      serializeDelimited(toExportRows(payload), ",")
    );
    setStatus("CSV download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download CSV.");
  }
}

function downloadTsv() {
  try {
    const payload = requirePayload();
    downloadBlob(
      `linkedin-visible-posts-${new Date().toISOString().replace(/[:.]/g, "-")}.tsv`,
      "text/tab-separated-values;charset=utf-8",
      serializeDelimited(toExportRows(payload), "\t")
    );
    setStatus("TSV download started.");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not download TSV.");
  }
}

$("export-btn").addEventListener("click", exportVisiblePosts);
$("show-diagnostics-btn").addEventListener("click", showDiagnostics);
$("copy-tsv-btn").addEventListener("click", copyTsv);
$("download-json-btn").addEventListener("click", downloadJson);
$("download-csv-btn").addEventListener("click", downloadCsv);
$("download-tsv-btn").addEventListener("click", downloadTsv);
