/**
 * StellarSync Managed Mirror — Google Sheets ↔ Supabase
 *
 * Supabase is canonical. Sheets is an optional editable mirror.
 * Designed for managed/hybrid workspaces with sheet_sync_enabled = true.
 *
 * Tabs: POSTS, NOTES, INSPO, AI_DRAFTS, CAMPAIGNS, MEDIA,
 *       SETTINGS, BRAND_FRAMEWORK, SCHEMA_NOTES, AI_CHAIN_SETTINGS,
 *       FLOW_EVENT_LOG
 */

const MANAGED_SHEET_TABS = [
  "POSTS", "NOTES", "INSPO", "AI_DRAFTS", "CAMPAIGNS", "MEDIA",
  "MEDIA_ATTACHMENTS",
  "SETTINGS", "BRAND_FRAMEWORK", "SCHEMA_NOTES", "AI_CHAIN_SETTINGS",
  "FLOW_EVENT_LOG"
];

const TAB_SCHEMAS = {
  POSTS: ["post_id","workspace_id","title","description","body","caption","post_type","format","platform","platforms","campaign_id","campaign_name","pillar","status","flow_state","media_ids","media_id","linked_note_id","linked_inspo_id","linked_ai_draft_id","source_type","source_url","scheduled_at","published_at","created_at","updated_at","archived_at","pinned","is_converted","impressions","engagement","sync_status","synced_at","sync_error"],
  NOTES: ["note_id","workspace_id","title","body","summary","source_type","source_url","campaign_id","campaign_name","pillar","linked_post_id","linked_ai_draft_id","flow_state","converted_post_id","bullets","suggested_platform","suggested_pillar","archived_at","created_at","updated_at","sync_status","synced_at","sync_error"],
  INSPO: ["inspo_id","workspace_id","title","summary","body","source_url","source_type","source_label","source_title","campaign_id","campaign_name","pillar","linked_post_id","linked_ai_draft_id","flow_state","converted_post_id","type","archived_at","created_at","updated_at","sync_status","synced_at","sync_error"],
  AI_DRAFTS: ["ai_draft_id","workspace_id","title","draft_text","generated_output","source_type","source_id","prompt","generation_mode","draft_status","campaign_id","campaign_name","pillar","platform_targets","media_ids","created_post_id","parent_artifact_id","root_artifact_id","derived_from_ids","archived_at","created_at","updated_at","sync_status","synced_at","sync_error"],
  CAMPAIGNS: ["campaign_id","workspace_id","campaign_name","campaign_label","description","status","start_date","end_date","platform","pillar","post_types","post_count","goal","archived_at","created_at","updated_at","sync_status","synced_at","sync_error"],
  MEDIA: ["workspace_id","media_asset_id","title","filename","media_url","storage_path","media_type","mime_type","alt_text","tags","linked_post_id","linked_post_title","created_at","updated_at","sync_status","synced_at","sync_error"],
  MEDIA_ATTACHMENTS: ["workspace_id","post_id","post_title","media_asset_id","storage_path","filename","media_url","media_type","sort_order","relationship_type","sync_status","synced_at","sync_error","updated_at"],
  SETTINGS: ["workspace_id","workspace_slug","backend_type","key","value","settings_json","avatar_mode","icon","avatar_initials","short_name","brand_voice","default_platforms","default_pillars","default_statuses","default_post_types","current_month","current_year","queue_limit","media_bucket","synced_at","sync_status","sync_error"],
  BRAND_FRAMEWORK: ["framework_key","workspace_id","section","rule_type","title","content","importance","strictness","applies_to_platform","applies_to_post_type","anti_pattern","preferred_pattern","semantic_category","enabled","examples","sort_order","created_at","updated_at","sync_status","synced_at","sync_error"],
  SCHEMA_NOTES: ["schema_key","workspace_id","table_name","field_name","display_name","description","required","editable_in_sheet","formula_managed","validation_rule","example_value","sort_order","sync_status","synced_at","sync_error"],
  AI_CHAIN_SETTINGS: ["workspace_id","default_ai_provider","default_generation_mode","brand_framework_version","prompt_style","review_required","auto_create_post_from_ai_draft","settings_json","sync_status","synced_at","sync_error"],
  FLOW_EVENT_LOG: ["event_id","workspace_id","from_type","from_id","to_type","to_id","relationship_type","event_type","created_at","sync_status","synced_at","sync_error"]
};

function jsonResponse_(data, status) {
  status = status || 200;
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRequestData_(e) {
  if (e && e.parameter && Object.keys(e.parameter).length) return e.parameter;
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) { return {}; }
  }
  return {};
}

function getSpreadsheet_(sheetId) {
  if (!sheetId) throw new Error("sheet_id is required");
  var ss = SpreadsheetApp.openById(sheetId);
  if (!ss) throw new Error("Spreadsheet not found: " + sheetId);
  return ss;
}

function ensureTab_(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (sheet) return sheet;
  sheet = ss.insertSheet(tabName);
  var schema = TAB_SCHEMAS[tabName];
  if (schema && schema.length) {
    var headerRow = sheet.getRange(1, 1, 1, schema.length);
    headerRow.setValues([schema]);
    headerRow.setFontWeight("bold");
  }
  return sheet;
}

function ensureAllTabs_(ss) {
  var created = [];
  for (var i = 0; i < MANAGED_SHEET_TABS.length; i++) {
    var tab = MANAGED_SHEET_TABS[i];
    try {
      ensureTab_(ss, tab);
      created.push(tab);
    } catch (err) {
      console.error("Failed to ensure tab " + tab + ": " + err.message);
    }
  }
  return created;
}

function sheetToObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, ""); });
  var formulaManaged = TAB_SCHEMAS[sheet.getName()] || [];
  var formulaSet = {};
  for (var f = 0; f < formulaManaged.length; f++) {
    formulaSet[formulaManaged[f].toLowerCase()] = true;
  }
  var result = [];
  for (var r = 1; r < data.length; r++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < headers.length && c < data[r].length; c++) {
      var val = data[r][c];
      if (val !== "" && val !== null && val !== undefined) empty = false;
      row[headers[c]] = val;
    }
    if (!empty) result.push(row);
  }
  return result;
}

function objectsToSheet_(sheet, objects, idField) {
  idField = idField || "id";
  var schema = TAB_SCHEMAS[sheet.getName()] || [];
  var formulaSet = {};
  for (var f = 0; f < schema.length; f++) {
    formulaSet[schema[f].toLowerCase()] = true;
  }
  var existingData = sheet.getDataRange().getValues();
  var existingHeaders = existingData.length > 0
    ? existingData[0].map(function(h) { return String(h || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, ""); })
    : [];
  var idIndex = existingHeaders.indexOf(idField);

  var canonHeaders = schema.length ? schema.map(function(h) { return h.toLowerCase(); }) : existingHeaders;
  var canonIdIndex = canonHeaders.indexOf(idField);
  if (schema.length) {
    sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
    sheet.getRange(1, 1, 1, schema.length).setFontWeight("bold");
  }

  var byId = {};
  if (idIndex >= 0) {
    for (var r = 1; r < existingData.length; r++) {
      var idVal = String(existingData[r][idIndex] || "").trim();
      if (idVal) byId[idVal] = r + 1;
    }
  }

  var rowsToWrite = [];
  for (var o = 0; o < objects.length; o++) {
    var obj = objects[o];
    var rowId = String(obj[idField] || "").trim();
    var row = [];
    for (var c = 0; c < canonHeaders.length; c++) {
      var header = canonHeaders[c];
      var keyMap = header;
      if (header === idField) { row.push(rowId); continue; }
      var val = obj[header] !== undefined ? obj[header] :
               obj[header.replace("_id","id")] !== undefined ? obj[header.replace("_id","id")] :
               obj[header.replace("id","_id")] !== undefined ? obj[header.replace("id","_id")] :
               null;
      if (formulaSet[header]) { row.push(null); continue; }
      if (val === null || val === undefined) { row.push(""); continue; }
      if (typeof val === "object") { row.push(JSON.stringify(val)); continue; }
      row.push(val);
    }
    rowsToWrite.push(row);
  }

  var startRow = 1;
  if (byId[rowId = ""]) { startRow = 2; }

  if (startRow === 1 && (!existingData.length || existingData.length <= 1)) {
    sheet.getRange(1, 1, 1, canonHeaders.length).setValues([canonHeaders.map(function(h) { return h; })]);
    startRow = 2;
  }

  for (var w = 0; w < rowsToWrite.length; w++) {
    var rowData = rowsToWrite[w];
    var rid = String(rowData[canonIdIndex] || "").trim();
    var targetRow = byId[rid] || (startRow + w);
    var existingVals = targetRow <= existingData.length ? existingData[targetRow - 1] || [] : [];
    for (var cv = 0; cv < rowData.length && cv < canonHeaders.length; cv++) {
      var ch = canonHeaders[cv];
      if (formulaSet[ch]) continue;
      if (existingVals[cv] !== undefined && !formulaSet[ch]) {
        existingVals[cv] = rowData[cv];
      }
    }
    if (targetRow > existingData.length) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      for (var uv = 0; uv < rowData.length && uv < canonHeaders.length; uv++) {
        if (formulaSet[canonHeaders[uv]]) continue;
        sheet.getRange(targetRow, uv + 1).setValue(rowData[uv]);
      }
    }
  }
  return rowsToWrite.length;
}

function doGet(e) {
  var data = getRequestData_(e);
  var action = String(data.action || "").trim().toLowerCase();

  if (action === "ensure_tabs") {
    var ss = getSpreadsheet_(data.sheet_id);
    var created = ensureAllTabs_(ss);
    return jsonResponse_({ ok: true, tabs: created });
  }

  if (action === "read_tab") {
    var ss = getSpreadsheet_(data.sheet_id);
    var tabName = String(data.tab || "").trim().toUpperCase();
    if (!tabName) return jsonResponse_({ ok: false, error: "Missing tab" }, 400);
    ensureTab_(ss, tabName);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse_({ ok: false, error: "Tab not found: " + tabName }, 404);
    var objects = sheetToObjects_(sheet);
    return jsonResponse_({ ok: true, tab: tabName, count: objects.length, rows: objects });
  }

  if (action === "write_tab") {
    var ss = getSpreadsheet_(data.sheet_id);
    var tabName = String(data.tab || "").trim().toUpperCase();
    if (!tabName) return jsonResponse_({ ok: false, error: "Missing tab" }, 400);
    ensureTab_(ss, tabName);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse_({ ok: false, error: "Tab not found: " + tabName }, 404);
    var rows = data.rows;
    if (!Array.isArray(rows)) return jsonResponse_({ ok: false, error: "rows must be an array" }, 400);
    var idField = String(data.id_field || getCanonicalIdFieldForTab_(tabName) || "id").trim();
    var written = objectsToSheet_(sheet, rows, idField);
    return jsonResponse_({ ok: true, tab: tabName, written: written });
  }

  if (action === "diagnostics") {
    var ss = getSpreadsheet_(data.sheet_id);
    var tabs = MANAGED_SHEET_TABS.map(function(tabName) {
      var sheet = ss.getSheetByName(tabName);
      var info = { tab: tabName, exists: !!sheet };
      if (sheet) {
        var rows = sheet.getDataRange().getValues();
        info.rowCount = rows.length;
        info.headerCount = rows.length > 0 ? rows[0].length : 0;
        info.isEmpty = rows.length < 2;
      }
      return info;
    });
    return jsonResponse_({ ok: true, tabs: tabs });
  }

  return jsonResponse_({ ok: false, error: "Unknown action: " + action }, 400);
}

function doPost(e) {
  return doGet(e);
}

function getCanonicalIdFieldForTab_(tabName) {
  var map = {
    POSTS: "post_id",
    NOTES: "note_id",
    INSPO: "inspo_id",
    AI_DRAFTS: "ai_draft_id",
    CAMPAIGNS: "campaign_id",
    MEDIA: "media_asset_id",
    MEDIA_ATTACHMENTS: "media_attachment_id",
    SETTINGS: "workspace_id",
    BRAND_FRAMEWORK: "framework_key",
    SCHEMA_NOTES: "schema_key",
    AI_CHAIN_SETTINGS: "workspace_id",
    FLOW_EVENT_LOG: "event_id"
  };
  return map[tabName] || "id";
}
