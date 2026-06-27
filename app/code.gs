function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse_(obj) {
  return jsonResponse(obj);
}

function invalidImportActionResponse_(action) {
  return {
    ok: false,
    error: "Invalid action",
    action: String(action || "").trim(),
    backendVersion: APP_BACKEND_VERSION,
    importedCount: 0,
    skippedDuplicates: 0,
    updatedCount: 0,
    failedCount: 0,
    errors: [{
      message: "Invalid action"
    }]
  };
}

var CURRENT_WORKSPACE_REQUEST_CONTEXT_ = null;
var LAST_SPREADSHEET_RESOLUTION_ = null;

function isGoogleSpreadsheetId_(value) {
  var text = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{25,}$/.test(text);
}

function firstRequestValue_(sources, names) {
  for (var s = 0; s < sources.length; s += 1) {
    var source = sources[s] || {};
    for (var n = 0; n < names.length; n += 1) {
      var key = names[n];
      if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== "") {
        return source[key];
      }
    }
  }
  return "";
}

function getRequestHeaders_(e) {
  return (e && (e.headers || e.header || e.requestHeaders)) || {};
}

function getWorkspaceRequestContext_(e, body) {
  body = body || {};
  var payload = body && body.payload && typeof body.payload === "object" ? body.payload : {};
  var params = (e && e.parameter) || {};
  var headers = getRequestHeaders_(e);
  var sources = [
    params,
    body,
    payload,
    body.context,
    payload.context,
    body.workspace,
    payload.workspace,
    body.connection,
    payload.connection,
    body.workspace_connection,
    payload.workspace_connection,
    body.workspace_connection && body.workspace_connection.config,
    payload.workspace_connection && payload.workspace_connection.config,
    body.connection_config,
    payload.connection_config,
    body.metadata,
    payload.metadata,
    headers
  ];
  var spreadsheetCandidate = firstRequestValue_(sources, [
    "spreadsheet_id",
    "spreadsheetId",
    "sheet_id",
    "sheetId",
    "x-spreadsheet-id",
    "X-Spreadsheet-Id",
    "x-sheet-id",
    "X-Sheet-Id"
  ]);
  var postsSheetName = firstRequestValue_(sources, [
    "posts_sheet_name",
    "postsSheetName",
    "sheetName",
    "x-posts-sheet-name",
    "X-Posts-Sheet-Name"
  ]);
  return {
    workspace_id: String(firstRequestValue_(sources, ["workspace_id", "workspaceId", "x-workspace-id", "X-Workspace-Id"]) || "").trim(),
    workspace_slug: String(firstRequestValue_(sources, ["workspace_slug", "workspaceSlug", "slug", "x-workspace-slug", "X-Workspace-Slug"]) || "").trim(),
    workspace_name: String(firstRequestValue_(sources, ["workspace_name", "workspaceName", "x-workspace-name", "X-Workspace-Name"]) || "").trim(),
    user_id: String(firstRequestValue_(sources, ["user_id", "userId", "x-user-id", "X-User-Id"]) || "").trim(),
    user_email: String(firstRequestValue_(sources, ["user_email", "userEmail", "email", "x-user-email", "X-User-Email"]) || "").trim(),
    connection_provider: String(firstRequestValue_(sources, ["connection_provider", "connectionProvider", "provider", "x-connection-provider", "X-Connection-Provider"]) || "").trim(),
    backend_type: String(firstRequestValue_(sources, ["backend_type", "backendType", "x-backend-type", "X-Backend-Type"]) || "").trim(),
    spreadsheetId: isGoogleSpreadsheetId_(spreadsheetCandidate) ? String(spreadsheetCandidate).trim() : "",
    spreadsheet_id: isGoogleSpreadsheetId_(spreadsheetCandidate) ? String(spreadsheetCandidate).trim() : "",
    sheet_id: isGoogleSpreadsheetId_(spreadsheetCandidate) ? String(spreadsheetCandidate).trim() : "",
    postsSheetName: String(postsSheetName || "").trim()
  };
}

function setWorkspaceRequestContext_(context) {
  CURRENT_WORKSPACE_REQUEST_CONTEXT_ = context || {};
}

function getCurrentWorkspaceRequestContext_() {
  return CURRENT_WORKSPACE_REQUEST_CONTEXT_ || {};
}

function getActionFromRequest_(e, body) {
  var params = (e && e.parameter) || {};
  body = body || {};
  return String(params.route || params.action || body.route || body.action || "").trim();
}

function normalizeRouteName_(route) {
  var value = String(route || "").trim();
  var normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "readtab" || normalized === "read_tab") return "readTab";
  if (normalized === "pullworkspacetabs" || normalized === "pull_workspace_tabs") return "pullWorkspaceTabs";
  if (normalized === "getposts" || normalized === "get_posts" || normalized === "posts") return "getPosts";
  if (normalized === "savepost" || normalized === "save_post" || normalized === "updatepost" || normalized === "update_post") return "savePost";
  if (normalized === "backfillpostids" || normalized === "backfill_post_ids" || normalized === "repairpostids" || normalized === "repair_post_ids") return "backfillPostIds";
  if (normalized === "diagnostics" || normalized === "getdiagnostics" || normalized === "get_diagnostics") return "diagnostics";
  return value;
}

function getPayloadFromRequest_(e, body) {
  var params = (e && e.parameter) || {};
  body = body || {};
  var payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  return Object.assign({}, params, body, payload);
}

function buildRouteErrorResponse_(err, action, context, diagnostics) {
  return {
    ok: false,
    error: sanitizeErrorMessage_(err && err.message || err || "Unknown error"),
    action: String(action || "unknown").trim() || "unknown",
    source: "google_sheets",
    workspace_slug: context && context.workspace_slug || "",
    diagnostics: Object.assign({
      spreadsheetId: LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.spreadsheetId || "",
      spreadsheetName: LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.spreadsheetName || "",
      postsSheetName: context && context.postsSheetName || SHEETS.POSTS,
      spreadsheetResolutionSource: LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.source || "",
      legacyScriptPropertiesUsed: !!(LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.legacyScriptPropertiesUsed)
    }, diagnostics || {})
  };
}

function getSafeWritePostRouteStatus_() {
  try {
    return getDeploymentDiagnostics().writePostRouteStatus;
  } catch (err) {
    return {
      savePostActionAvailable: true,
      postsSheetReachable: false,
      requiredHeadersPresent: false,
      error: sanitizeErrorMessage_(err && err.message || err)
    };
  }
}

function describeResultType_(result) {
  if (Array.isArray(result)) return "array";
  if (result === null) return "null";
  return typeof result;
}

function getObjectKeysSafe_(value) {
  if (!value || typeof value !== "object") return [];
  try {
    return Object.keys(value);
  } catch (_) {
    return [];
  }
}

function detectPostsArrayFromResult_(result) {
  var candidates = [
    { path: "raw_array", value: result },
    { path: "result.posts", value: result && result.posts },
    { path: "result.items", value: result && result.items },
    { path: "result.data", value: result && result.data },
    { path: "result.records", value: result && result.records },
    { path: "result.rows", value: result && result.rows },
    { path: "result.payload.posts", value: result && result.payload && result.payload.posts },
    { path: "result.payload.items", value: result && result.payload && result.payload.items },
    { path: "result.result.posts", value: result && result.result && result.result.posts },
    { path: "result.result.items", value: result && result.result && result.result.items },
    { path: "result.result.data", value: result && result.result && result.result.data },
    { path: "result.diagnostics.posts", value: result && result.diagnostics && result.diagnostics.posts },
    { path: "result.diagnostics.performancePosts", value: result && result.diagnostics && result.diagnostics.performancePosts },
    { path: "result.diagnostics.performancePostsReturned", value: result && result.diagnostics && result.diagnostics.performancePostsReturned }
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i].value)) {
      return {
        posts: candidates[i].value,
        path: candidates[i].path
      };
    }
  }
  return {
    posts: [],
    path: ""
  };
}

function buildPostsResponse_(result, context, requestedRoute) {
  context = context || getCurrentWorkspaceRequestContext_();
  var detected = detectPostsArrayFromResult_(result);
  var posts = detected.posts;
  var detectedPostsPath = detected.path;
  var ss = null;
  var postsSheet = null;
  try { ss = getSpreadsheet_(); } catch (_) {}
  try { postsSheet = getPostsSheet_(); } catch (_) {}
  if (!posts.length) {
    try {
      var fallbackRows = getPostsData_().map(normalizePostSchemaAliases_);
      if (fallbackRows.length) {
        posts = fallbackRows;
        detectedPostsPath = "getPostsData_";
      }
    } catch (_) {}
  }
  var diagnostics = {
    spreadsheetId: ss && ss.getId ? ss.getId() : (LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.spreadsheetId || ""),
    spreadsheetName: ss && ss.getName ? ss.getName() : (LAST_SPREADSHEET_RESOLUTION_ && LAST_SPREADSHEET_RESOLUTION_.spreadsheetName || ""),
    postsSheetName: postsSheet && postsSheet.getName ? postsSheet.getName() : (context.postsSheetName || SHEETS.POSTS),
    rowCount: postsSheet && postsSheet.getLastRow ? Math.max(postsSheet.getLastRow() - 1, 0) : 0,
    postCount: Array.isArray(posts) ? posts.length : 0,
    headerCount: postsSheet && postsSheet.getLastColumn ? postsSheet.getLastColumn() : 0,
    originalGetPostsType: describeResultType_(result),
    originalGetPostsKeys: getObjectKeysSafe_(result),
    detectedPostsPath: detectedPostsPath,
    detectedPostsLength: Array.isArray(posts) ? posts.length : 0,
    missingPostIdCount: countPostsMissingPostIds_(posts)
  };
  var response = result && !Array.isArray(result) && typeof result === "object" ? Object.assign({}, result) : {};
  response.ok = true;
  response.routeHandled = "getPosts";
  response.requestedRoute = String(requestedRoute || "").trim();
  response.posts = posts;
  response.items = posts;
  response.data = posts;
  response.source = "google_sheets";
  response.workspace_slug = context.workspace_slug || "";
  response.missing_post_id_count = diagnostics.missingPostIdCount;
  response.missingPostIdCount = diagnostics.missingPostIdCount;
  response.diagnostics = Object.assign({}, response.diagnostics || {}, diagnostics);
  return response;
}

function readTabRows_(payload, context) {
  payload = payload || {};
  context = context || getCurrentWorkspaceRequestContext_();
  var tab = String(payload.tab || payload.sheet_tab || "").trim();
  if (!tab) throw new Error("Missing tab");

  var normalizedTab = tab.toUpperCase();
  var rows = [];
  var sheet = null;

  if (normalizedTab === "POSTS") {
    sheet = getPostsSheet_();
    rows = getPostsData_();
  } else {
    var tabKeyMap = {
      NOTES: "notes",
      INSPO: "inspo",
      AI_DRAFTS: "aiDrafts",
      MEDIA: "media",
      CAMPAIGNS: "campaign",
      CAMPAIGN: "campaign",
      SETTINGS: "settings",
      BRAND_FRAMEWORK: "brandFramework",
      SCHEMA_NOTES: "schema_notes",
      AI_CHAIN_SETTINGS: "ai_chain_settings",
      FLOW_EVENT_LOG: "flow_event_log"
    };
    var sheetKey = tabKeyMap[normalizedTab];
    if (!sheetKey) throw new Error("Unsupported tab: " + normalizedTab);
    sheet = getOptionalCoreSheet_(sheetKey);
    if (!sheet) throw new Error("Missing sheet: " + normalizedTab);
    rows = getRowsByNormalizedHeaders_(sheet, []);
  }

  return {
    ok: true,
    source: "google_sheets",
    tab: normalizedTab,
    rows: rows,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    workspace_slug: context.workspace_slug || ""
  };
}

function pullWorkspaceTabs_(payload, context) {
  payload = payload || {};
  context = context || getCurrentWorkspaceRequestContext_();
  var requestedTabs = Array.isArray(payload.tabs) ? payload.tabs : [];
  var normalizedTabs = requestedTabs
    .map(function(tab) { return String(tab || "").trim().toUpperCase(); })
    .filter(Boolean);
  if (!normalizedTabs.length) {
    normalizedTabs = ["POSTS", "CAMPAIGNS", "MEDIA", "NOTES", "INSPO", "AI_DRAFTS", "SETTINGS", "BRAND_FRAMEWORK"];
  }

  var response = {
    ok: true,
    source: "google_sheets",
    action: "pull_workspace_tabs",
    tabs: normalizedTabs,
    workspace_slug: context.workspace_slug || ""
  };

  normalizedTabs.forEach(function(tab) {
    try {
      response[tab] = readTabRows_({ tab: tab }, context);
    } catch (err) {
      response[tab] = {
        ok: true,
        source: "google_sheets",
        tab: tab,
        rows: [],
        rowCount: 0,
        workspace_slug: context.workspace_slug || "",
        warning: sanitizeErrorMessage_(err && err.message || err || "Missing sheet")
      };
    }
  });

  return response;
}

function buildDiagnosticsResponse_(diagnostics, context, requestedRoute) {
  context = context || getCurrentWorkspaceRequestContext_();
  return {
    ok: true,
    routeHandled: "diagnostics",
    requestedRoute: String(requestedRoute || "").trim(),
    backendVersion: APP_BACKEND_VERSION,
    source: "google_sheets",
    workspace_slug: context.workspace_slug || "",
    diagnostics: diagnostics
  };
}

const STELLARSYNC_BACKEND_VERSION = "core-header-schema-2026-06-07-1";
const APP_BACKEND_VERSION = STELLARSYNC_BACKEND_VERSION;
const LINKEDIN_CAPTURE_IMPORT_ACTIONS = ["importCapturedPosts", "importLinkedInCapturedPosts"];
const IMPORT_ROUTE_TEST_ACTIONS = LINKEDIN_CAPTURE_IMPORT_ACTIONS.concat(["testImportCapturedPostsRoute"]);
const LINKEDIN_REWRITE_PROTECTED_HEADERS = {
  post_id: true,
  created_at: true,
  imported_at: true,
  source_url: true,
  impressions: true,
  reach: true,
  likes: true,
  comments: true,
  shares: true,
  saves: true,
  clicks: true,
  engagement_rate: true
};

const AI_PROVIDER_CONFIG = {
  local: {
    label: "Local Creator Engine",
    apiKeyKey: "",
    modelKey: "",
    defaultModel: "LOCAL_CREATOR_ENGINE",
    baseUrlKey: "",
    defaultBaseUrl: ""
  },
  openai: {
    label: "OpenAI",
    apiKeyKey: "OPENAI_API_KEY",
    modelKey: "OPENAI_MODEL",
    defaultModel: "gpt-5.2",
    baseUrlKey: "OPENAI_API_BASE_URL",
    defaultBaseUrl: "https://api.openai.com/v1"
  },
  gemini: {
    label: "Gemini",
    apiKeyKey: "GEMINI_API_KEY",
    modelKey: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    baseUrlKey: "GEMINI_API_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta"
  },
  disabled: {
    label: "Disabled",
    apiKeyKey: "",
    modelKey: "",
    defaultModel: "",
    baseUrlKey: "",
    defaultBaseUrl: ""
  }
};

const AI_PLACEHOLDER_PATTERNS = [
  /scaffold only/i,
  /translate (the )?idea into a post manually/i,
  /translate manually/i,
  /draft carousel outline/i,
  /draft outline only/i,
  /create manually or save draft/i,
  /expand this note manually/i,
  /live ai (generation|output) is not configured/i,
  /structured scaffolds only/i,
  /manual review required/i,
  /structured draft direction/i,
  /use the ai drafting workspace/i
];

const SHEETS = {
  POSTS: "POSTS",
  NOTES: "notes",
  AI_DRAFTS: "ai_drafts",
  CALENDAR_VIEW: "CALENDAR_VIEW",
  QUEUE_VIEW: "QUEUE_VIEW",
  CONSTELLATION_VIEW: "CONSTELLATION_VIEW",
  LEDGER_VIEW: "LEDGER_VIEW",
  DASHBOARD: "DASHBOARD",
  MEDIA: "MEDIA",
  INSPO: "INSPO",
  CAMPAIGN: "CAMPAIGN",
  APP_MAPPING: "APP_MAPPING"
};

const REQUIRED_POST_HEADERS = [
  "title",
  "status",
  "publish_date",
  "publish_time",
  "platform",
  "campaign_name",
  "pillar",
  "format",
  "description",
  "post_id"
];

const POST_FORMULA_HEADERS = [
  "slug",
  "platform_key",
  "campaign_key",
  "pillar_key",
  "content_key",
  "calendar_month",
  "calendar_year",
  "calendar_day",
  "week_start",
  "month_key",
  "day_of_week",
  "character_count",
  "engagement_total",
  "engagement_rate",
  "save_rate",
  "click_rate",
  "needs_manual_review",
  "formula_status"
];

// Phase 1 Workspace Adapter Layer.
const WORKSPACE_SERVER_DEFAULTS = {
  WORKSPACE_ID: "master",
  WORKSPACE_SLUG: "master",
  SHEET_ID: "",
  MONDAY_BOARD_ID: "",
  SUPABASE_MEDIA_ENABLED: false
};

const PHASE1_WORKSPACE_POST_HEADERS = [
  "workspace_id",
  "media_id",
  "media_url",
  "media_type",
  "media_filename",
  "media_alt_text",
  "media_source",
  "storage_path",
  "monday_item_id",
  "monday_group_id",
  "monday_last_synced_at",
  "monday_sync_status"
];

const PHASE1_MEDIA_REFERENCE_HEADERS = [
  "media_id",
  "media_url",
  "media_type",
  "media_filename",
  "media_alt_text",
  "media_source",
  "storage_path"
];

const REQUIRED_MEDIA_HEADERS = [
  "asset_id",
  "asset_name",
  "asset_type",
  "linked_post_id",
  "asset_status"
];

const REQUIRED_INSPO_HEADERS = [
  "inspo_id",
  "title",
  "inspo_type",
  "source_label",
  "summary",
  "status"
];

const REQUIRED_NOTE_HEADERS = [
  "note_id",
  "title",
  "body",
  "status"
];

const REQUIRED_AI_DRAFT_HEADERS = [
  "ai_draft_id",
  "title",
  "platform",
  "post_type",
  "generation_mode",
  "prompt",
  "draft_text",
  "draft_status"
];

const REQUIRED_CAMPAIGN_HEADERS = [
  "campaign_id",
  "campaign_name",
  "pillar",
  "color"
];

const AI_DRAFT_FORMULA_HEADERS = [
  "source_id",
  "campaign_id",
  "hook_text",
  "cta_text",
  "diversity_controls",
  "anti_pattern_flags",
  "semantic_clusters",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_summary",
  "recurring_pattern_flags",
  "target_campaign_id",
  "target_date_range",
  "generated_campaign_id",
  "parent_artifact_id",
  "root_artifact_id",
  "analysis_mode",
  "derived_from_ids",
  "media_ids",
  "performance_context"
];

const SHEET_NAMES = {
  posts: [SHEETS.POSTS, "posts"],
  media: [SHEETS.MEDIA, "media"],
  inspo: [SHEETS.INSPO, "inspo"],
  notes: [SHEETS.NOTES, "NOTES"],
  aiDrafts: [SHEETS.AI_DRAFTS, "AI_DRAFTS"],
  brandFramework: ["brand_framework", "BRAND_FRAMEWORK"],
  dashboard: ["dashboard", "DASHBOARD"],
  settings: ["settings", "SETTINGS"],
  SETTINGS: ["SETTINGS", "settings"],
  campaign: ["campaigns", "CAMPAIGN", "campaign"],
  importJobs: ["Import Jobs", "IMPORT_JOBS", "import_jobs"],
  importJobItems: ["Import Job Items", "IMPORT_JOB_ITEMS", "import_job_items"],
  flowEventLog: ["Flow Event Log", "FLOW_EVENT_LOG", "flow_event_log"]
};

const SEMANTIC_FIELD_HEADERS = [
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score"
];

const MEDIA_FORMULA_HEADERS = SEMANTIC_FIELD_HEADERS.slice();
const INSPO_FORMULA_HEADERS = SEMANTIC_FIELD_HEADERS.slice();
const NOTE_FORMULA_HEADERS = SEMANTIC_FIELD_HEADERS.slice();
const CAMPAIGN_FORMULA_HEADERS = SEMANTIC_FIELD_HEADERS.slice();

const SEMANTIC_RELATIONSHIP_TYPES = [
  "related_to",
  "expands_on",
  "contrasts_with",
  "continues",
  "local_example_of",
  "infrastructure_example_of",
  "platform_example_of",
  "participation_example_of",
  "alternate_reality_of",
  "campaign_child_of",
  "semantic_neighbor",
  "repeated_pattern",
  "repeated_hook",
  "repeated_structure",
  "repeated_cta",
  "repeated_platform_signal"
];

const POST_HEADERS = [
  "post_id",
  "title",
  "platform",
  "post_type",
  "pillar",
  "scheduled_at",
  "status",
  "description",
  "asset_id",
  "hub_title",
  "hub_pillar_label",
  "queue_date_label",
  "queue_time_label",
  "calendar_month",
  "calendar_year",
  "calendar_day",
  "ledger_excerpt",
  "constellation_meta",
  "media_label",
  "created_from_inspo_id",
  "created_from_note_id",
  "source_note_id",
  "source_inspo_id",
  "source_ai_draft_id",
  "source_import_job_id",
  "created_from_flow",
  "moved_to_post_at",
  "archived_at",
  "flow_state",
  "campaign_id",
  "campaign_name",
  "notes",
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "engagement_rate",
  "source_url",
  "source_type",
  "source_platform",
  "source_title",
  "source_metadata",
  "source_import_status",
  "imported_at",
  "import_job_id",
  "original_post_date",
  "original_post_date_label",
  "date_confidence",
  "linkedin_post_id",
  "normalized_text_hash",
  "is_repost",
  "repost_author",
  "repost_commentary",
  "original_author",
  "original_post_excerpt",
  "platform_targets",
  "publish_status",
  "published_url",
  "published_at",
  "api_post_id",
  "api_error",
  "platform_caption_override",
  "platform_character_count",
  "requires_manual_review",
  "carousel_asset_ids",
  "ai_source_type",
  "ai_source_id",
  "ai_prompt",
  "ai_generation_mode",
  "ai_brand_framework_version",
  "ai_draft_status",
  "ai_review_notes",
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "workspace_id",
  "media_id",
  "media_url",
  "media_type",
  "media_filename",
  "media_alt_text",
  "media_source",
  "storage_path",
  "monday_item_id",
  "monday_group_id",
  "monday_last_synced_at",
  "monday_sync_status",
  "created_at",
  "updated_at"
];

const CAMPAIGN_HEADERS = [
  "campaign_id",
  "campaign_name",
  "pillar",
  "color",
  "x",
  "y",
  "icon_shape",
  "path_style",
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "sort_order",
  "is_archived",
  "created_at",
  "updated_at"
];

const CAMPAIGN_COMPAT_HEADERS = ["campaignID", "campaignName", "createdat", "isArchived"];

const MEDIA_HEADERS = [
  "asset_id",
  "asset_name",
  "asset_type",
  "asset_badge",
  "asset_meta",
  "linked_post_id",
  "asset_status",
  "placeholder_icon",
  "file_url",
  "campaign",
  "notes",
  "drive_file_id",
  "source_url",
  "source_type",
  "mime_type",
  "file_size_bytes",
  "original_filename",
  "imported_media_source",
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "media_id",
  "media_url",
  "media_type",
  "media_filename",
  "media_alt_text",
  "media_source",
  "storage_path",
  "created_at",
  "updated_at"
];

const IMPORT_JOB_HEADERS = [
  "job_id",
  "type",
  "status",
  "total_count",
  "processed_count",
  "imported_count",
  "skipped_duplicates",
  "updated_count",
  "failed_count",
  "verified_in_ledger_count",
  "overwrite_duplicates",
  "created_at",
  "updated_at",
  "last_error",
  "report_json"
];

const IMPORT_JOB_ITEM_HEADERS = [
  "job_item_id",
  "job_id",
  "item_index",
  "status",
  "title",
  "source_url",
  "linkedin_post_id",
  "normalized_text_hash",
  "post_id",
  "attempt_count",
  "error_message",
  "raw_json",
  "created_at",
  "updated_at"
];

const INSPO_HEADERS = [
  "inspo_id",
  "title",
  "inspo_type",
  "source_label",
  "source_type",
  "source_url",
  "summary",
  "domain_or_meta",
  "suggested_platform",
  "suggested_pillar",
  "create_post_title",
  "create_post_description",
  "create_post_type",
  "notes",
  "imported_at",
  "original_post_date",
  "metrics_json",
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "status",
  "converted_post_id",
  "source_note_id",
  "source_inspo_id",
  "source_ai_draft_id",
  "source_import_job_id",
  "created_from_flow",
  "moved_to_post_at",
  "archived_at",
  "flow_state",
  "created_at",
  "updated_at"
];

const NOTE_HEADERS = [
  "note_id",
  "title",
  "body",
  "bullets",
  "suggested_platform",
  "suggested_pillar",
  "status",
  "converted_post_id",
  "source_note_id",
  "source_inspo_id",
  "source_ai_draft_id",
  "source_import_job_id",
  "created_from_flow",
  "moved_to_post_at",
  "archived_at",
  "flow_state",
  "source_url",
  "source_platform",
  "source_label",
  "semantic_tags",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "created_at",
  "updated_at"
];

const AI_DRAFT_HEADERS = [
  "ai_draft_id",
  "idea_id",
  "artifact_id",
  "artifact_type",
  "parent_artifact_id",
  "root_artifact_id",
  "idea_prompt",
  "title",
  "platform",
  "post_type",
  "generation_mode",
  "transformation_type",
  "analysis_mode",
  "source_type",
  "source_id",
  "source_ids",
  "source_artifact_ids",
  "derived_from_ids",
  "output_type",
  "output_artifacts",
  "target_platforms",
  "target_campaign_id",
  "target_date",
  "target_date_range",
  "generation_stage",
  "generated_post_ids",
  "generated_campaign_id",
  "generated_outputs",
  "campaign_id",
  "campaign_name",
  "prompt",
  "generated_output",
  "draft_text",
  "hook_text",
  "cta_text",
  "carousel_outline",
  "brand_framework_version",
  "draft_status",
  "review_notes",
  "alignment_score",
  "diversity_controls",
  "anti_pattern_flags",
  "semantic_tags",
  "media_ids",
  "performance_context",
  "semantic_clusters",
  "semantic_neighbors",
  "semantic_strength",
  "semantic_origin",
  "semantic_relationship_type",
  "semantic_confidence",
  "semantic_embedding_version",
  "semantic_summary",
  "recurring_pattern_flags",
  "semantic_decay_score",
  "semantic_novelty_score",
  "semantic_density_score",
  "created_post_id",
  "created_at",
  "updated_at"
];

const FLOW_EVENT_HEADERS = [
  "event_id",
  "timestamp",
  "action",
  "entity_type",
  "source_id",
  "target_id",
  "result",
  "errors",
  "details_json"
];

const BRAND_FRAMEWORK_HEADERS = [
  "framework_key",
  "section",
  "rule_type",
  "title",
  "content",
  "importance",
  "strictness",
  "applies_to_platform",
  "applies_to_post_type",
  "anti_pattern",
  "preferred_pattern",
  "semantic_category",
  "enabled",
  "examples",
  "sort_order",
  "created_at",
  "updated_at"
];

const ALLOWED_ICON_SHAPES = ["leaf", "spark", "sun", "moon", "bolt", "map", "book", "star", "spiral"];
const ALLOWED_PATH_STYLES = ["straight", "squiggle", "zigzag", "arc"];
const SOCIAL_PLATFORMS = ["linkedin", "instagram", "threads", "bluesky"];
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const LINKEDIN_API_VERSION = "202411";
const LINKEDIN_OAUTH_SCOPES = ["openid", "profile", "email", "w_member_social"];
const INSTAGRAM_FACEBOOK_GRAPH_SCOPES = ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"];
const INSTAGRAM_LOGIN_SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"];
const INSTAGRAM_INVALID_LOGIN_SCOPES = ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"];
const THREADS_OAUTH_SCOPES = ["threads_basic", "threads_content_publish", "threads_read_replies", "threads_manage_replies"];
const TIKTOK_OAUTH_SCOPES = ["user.info.basic", "video.publish", "video.upload"];
const BLUESKY_DEFAULT_SERVICE = "https://bsky.social";
const BLUESKY_POST_MAX_CHARS = 300;
const PLATFORM_OAUTH_CONFIG = {
  linkedin: {
    label: "LinkedIn",
    clientIdKey: "LINKEDIN_CLIENT_ID",
    clientSecretKey: "LINKEDIN_CLIENT_SECRET",
    accessTokenKey: "LINKEDIN_ACCESS_TOKEN",
    refreshTokenKey: "LINKEDIN_REFRESH_TOKEN",
    tokenExpiresAtKey: "LINKEDIN_TOKEN_EXPIRES_AT",
    userIdKey: "LINKEDIN_PERSON_ID",
    displayNameKey: "LINKEDIN_DISPLAY_NAME",
    usernameKey: "LINKEDIN_DISPLAY_NAME",
    lastErrorKey: "LINKEDIN_LAST_ERROR",
    stateKey: "LINKEDIN_OAUTH_STATE",
    stateExpiresAtKey: "LINKEDIN_OAUTH_STATE_EXPIRES_AT",
    requiredSetupKeys: ["PUBLIC_WEBAPP_BASE_URL", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    scopes: LINKEDIN_OAUTH_SCOPES,
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    refreshSupported: true,
    supportsLongLivedExchange: false,
    scopeDelimiter: " "
  },
  instagram: {
    label: "Instagram",
    clientIdKey: "META_APP_ID",
    clientSecretKey: "META_APP_SECRET",
    accessTokenKey: "INSTAGRAM_ACCESS_TOKEN",
    refreshTokenKey: "",
    tokenExpiresAtKey: "INSTAGRAM_TOKEN_EXPIRES_AT",
    userIdKey: "INSTAGRAM_USER_ID",
    displayNameKey: "INSTAGRAM_USERNAME",
    usernameKey: "INSTAGRAM_USERNAME",
    pageIdKey: "INSTAGRAM_PAGE_ID",
    lastErrorKey: "INSTAGRAM_LAST_ERROR",
    stateKey: "OAUTH_STATE_INSTAGRAM",
    stateExpiresAtKey: "OAUTH_STATE_INSTAGRAM_EXPIRES_AT",
    apiVersionKey: "META_API_VERSION",
    requiredSetupKeys: ["PUBLIC_WEBAPP_BASE_URL", "META_APP_ID", "META_APP_SECRET", "META_API_VERSION"],
    scopes: INSTAGRAM_FACEBOOK_GRAPH_SCOPES,
    authUrlBase: "https://www.facebook.com",
    tokenUrlBase: "https://graph.facebook.com",
    graphUrlBase: "https://graph.facebook.com",
    refreshSupported: true,
    supportsLongLivedExchange: true,
    longLivedExchangePath: "/access_token",
    longLivedExchangeGrantType: "ig_exchange_token",
    refreshPath: "/refresh_access_token",
    refreshGrantType: "ig_refresh_token",
    scopeDelimiter: ","
  },
  threads: {
    label: "Threads",
    clientIdKey: "THREADS_APP_ID",
    clientSecretKey: "THREADS_APP_SECRET",
    accessTokenKey: "THREADS_ACCESS_TOKEN",
    refreshTokenKey: "",
    tokenExpiresAtKey: "THREADS_TOKEN_EXPIRES_AT",
    userIdKey: "THREADS_USER_ID",
    displayNameKey: "THREADS_USERNAME",
    usernameKey: "THREADS_USERNAME",
    lastErrorKey: "THREADS_LAST_ERROR",
    stateKey: "OAUTH_STATE_THREADS",
    stateExpiresAtKey: "OAUTH_STATE_THREADS_EXPIRES_AT",
    apiVersionKey: "THREADS_API_VERSION",
    requiredSetupKeys: ["PUBLIC_WEBAPP_BASE_URL", "THREADS_API_VERSION"],
    scopes: THREADS_OAUTH_SCOPES,
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    graphUrlBase: "https://graph.threads.net",
    refreshSupported: true,
    supportsLongLivedExchange: true,
    longLivedExchangePath: "/access_token",
    longLivedExchangeGrantType: "th_exchange_token",
    refreshPath: "/refresh_access_token",
    refreshGrantType: "th_refresh_token",
    scopeDelimiter: ","
  },
  tiktok: {
    label: "TikTok",
    clientIdKey: "TIKTOK_CLIENT_KEY",
    clientSecretKey: "TIKTOK_CLIENT_SECRET",
    accessTokenKey: "TIKTOK_ACCESS_TOKEN",
    refreshTokenKey: "TIKTOK_REFRESH_TOKEN",
    tokenExpiresAtKey: "TIKTOK_TOKEN_EXPIRES_AT",
    userIdKey: "TIKTOK_OPEN_ID",
    displayNameKey: "TIKTOK_DISPLAY_NAME",
    usernameKey: "TIKTOK_DISPLAY_NAME",
    lastErrorKey: "TIKTOK_LAST_ERROR",
    stateKey: "OAUTH_STATE_TIKTOK",
    stateExpiresAtKey: "OAUTH_STATE_TIKTOK_EXPIRES_AT",
    requiredSetupKeys: ["PUBLIC_WEBAPP_BASE_URL", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    scopes: TIKTOK_OAUTH_SCOPES,
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    graphUrlBase: "https://open.tiktokapis.com/v2",
    refreshSupported: true,
    supportsLongLivedExchange: false,
    scopeDelimiter: ","
  }
};

const BLUESKY_CONFIG = {
  label: "Bluesky",
  accessTokenKey: "BLUESKY_ACCESS_JWT",
  refreshTokenKey: "BLUESKY_REFRESH_JWT",
  userIdKey: "BLUESKY_DID",
  displayNameKey: "BLUESKY_HANDLE",
  usernameKey: "BLUESKY_HANDLE",
  handleKey: "BLUESKY_HANDLE",
  didKey: "BLUESKY_DID",
  serviceUrlKey: "BLUESKY_SERVICE_URL",
  lastErrorKey: "BLUESKY_LAST_ERROR",
  importSupported: true,
  publishSupported: true,
  maxPostLength: 300
};

const INSIGHT_METRIC_KEYS = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "engagement_rate"
];

const SETTINGS_DEFAULTS = {
  platforms: ["linkedin", "instagram", "facebook"],
  pillars: ["Advocacy", "Community", "Wellness", "Leadership"],
  statuses: ["draft", "scheduled", "published"],
  postTypes: ["carousel", "single image", "video", "short video", "text post", "newsletter", "blog", "case study", "event promotion", "quote graphic"],
  campaigns: [],
  campaignColors: {},
  months: [],
  queueLimit: "",
  currentMonth: "",
  currentYear: "",
  mediaFolderId: ""
};

var AI_PROVIDERS = [
  { id: "local_creator_engine", label: "Local Creator Engine", defaultApiUrl: "", apiKeyConfigured: true },
  { id: "openai", label: "OpenAI / ChatGPT", defaultApiUrl: "https://api.openai.com/v1", apiKeyKey: "AI_OPENAI_API_KEY" },
  { id: "claude", label: "Claude", defaultApiUrl: "https://api.anthropic.com/v1", apiKeyKey: "AI_CLAUDE_API_KEY" },
  { id: "gemini", label: "Gemini", defaultApiUrl: "https://generativelanguage.googleapis.com/v1beta", apiKeyKey: "AI_GEMINI_API_KEY" },
  { id: "deepseek", label: "DeepSeek", defaultApiUrl: "https://api.deepseek.com/v1", apiKeyKey: "AI_DEEPSEEK_API_KEY" },
  { id: "opencode", label: "OpenCode", defaultApiUrl: "", apiKeyKey: "AI_OPencode_API_KEY" },
  { id: "ollama", label: "Ollama", defaultApiUrl: "", apiKeyKey: "" },
  { id: "custom", label: "Custom OpenAI-compatible", defaultApiUrl: "", apiKeyKey: "AI_CUSTOM_API_KEY" }
];

function doGet(e) {
  const body = {};
  const context = getWorkspaceRequestContext_(e, body);
  setWorkspaceRequestContext_(context);
  const action = getActionFromRequest_(e, body);
  const route = normalizeRouteName_(action);

  try {
    const deprecatedSocialActions = [
      "startLinkedInAuth",
      "startInstagramAuth",
      "startThreadsAuth",
      "startBlueskyAuth",
      "startTikTokAuth",
      "getSocialAuthUrl",
      "handleSocialOAuthCallback",
      "linkedinCallback",
      "instagramCallback",
      "threadsCallback",
      "metaCallback",
      "tiktokCallback",
      "refreshSocialToken",
      "disconnectSocialAccount",
      "disconnectPlatform",
      "disconnectBluesky",
      "testPlatformConnection",
      "testLinkedInHistoricalAccess",
      "getLinkedInHistoricalAccessDiagnostics",
      "testBlueskyConnection",
      "testTikTokConnection",
      "blueskyConnect",
      "blueskySyncRecentPosts",
      "prepareBlueskyPayload"
    ];
    if (deprecatedSocialActions.indexOf(action) !== -1 || deprecatedSocialActions.indexOf(route) !== -1) {
      return jsonResponse({
        ok: false,
        error: "Social OAuth now uses Supabase Edge Functions."
      });
    }

    if (route === "linkedinCallback") return linkedinCallback(e);
    if (route === "instagramCallback") return instagramCallback(e);
    if (route === "threadsCallback") return threadsCallback(e);
    if (route === "metaCallback") return metaCallback(e);

    if (!action) {
      const availableActions = [
        "read_tab",
        "readTab",
        "pull_workspace_tabs",
        "pullWorkspaceTabs",
        "getPosts",
        "get_posts",
        "posts",
        "backfillPostIds",
        "backfill_post_ids",
        "repairPostIds",
        "getMedia",
        "getWorkspaceConfig",
        "getInspo",
        "getNotes",
        "getQueue",
        "getDashboard",
        "getSettings",
        "getCampaigns",
        "getAIDrafts",
        "getBrandFramework",
        "getAICreationOptions",
        "prepareAIGenerationContext",
        "generateAIDraft",
        "runStellarAssistant",
        "saveIdeaPrompt",
        "prepareIdeaGenerationContext",
        "generateIdeaDraftScaffold",
        "createPostFromIdea",
        "createCampaignFromIdea",
        "createCalendarPlanFromIdea",
        "createCarouselOutlineFromIdea",
        "getSocialImportCapabilities",
        "fetchOpenGraphMetadata",
        "fetchInstagramOEmbed",
        "getConnectedAccounts",
        "getConnectedAccountsStatus",
        "getDeploymentDiagnostics",
        "getSocialAuthUrl",
        "startLinkedInAuth",
        "startInstagramAuth",
        "startThreadsAuth",
        "handleSocialOAuthCallback",
        "linkedinCallback",
        "instagramCallback",
        "threadsCallback",
        "metaCallback",
        "testPlatformConnection",
        "testLinkedInHistoricalAccess",
        "getLinkedInHistoricalAccessDiagnostics",
        "importLinkedInPosts",
        "importCapturedPosts",
        "importLinkedInCapturedPosts",
        "testImportCapturedPostsRoute",
        "getImportJobs",
        "getImportJobStatus",
        "createImportJob",
        "runImportJobBatch",
        "cancelImportJob",
        "retryImportJobFailures",
        "importSocialPostByUrl",
        "importSocialPostById",
        "importRecentSocialPosts",
        "getSemanticMemory",
        "getDiagnostics",
        "get_diagnostics",
        "diagnostics",
        "getImportJobs",
        "getImportJobStatus",
        "getPublishingReadiness",
        "validatePostForPublishing",
        "preparePublishPayload",
        "repairDateFields",
        "cleanupImportedLinkedInPosts",
        "repairFlowIntegrity",
        "auditFlowIntegrity",
        "testRewriteImportedLinkedInRowsRoute",
        "rewriteImportedLinkedInRows",
        "updateCampaignColor",
        "mergeCampaignIntoCampaign",
        "deleteCampaignAndUnassignPosts",
        "archiveInspo",
        "testMediaSync",
        "cleanTaxonomyValues",
        "rebuildAllSchemaFormulas",
        "uploadMedia",
        "saveMediaLink",
        "saveMedia",
        "updatePost",
        "getAIProviderConfig",
        "saveAIProviderConfig",
        "testAIProviderConnection",
        "disconnectAIProvider"
      ];
      return jsonResponse({
        ok: true,
        backendVersion: APP_BACKEND_VERSION,
        codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
        actions: availableActions,
        availableActions: availableActions
      });
    }

    if (route === "getPosts") {
      const result = getPosts();
      return jsonResponse(buildPostsResponse_(result, context, action));
    }
    if (route === "readTab" || action === "read_tab") {
      return jsonResponse(readTabRows_(payloadOrParams_(e), context));
    }
    if (route === "pullWorkspaceTabs" || action === "pull_workspace_tabs") {
      return jsonResponse(pullWorkspaceTabs_(payloadOrParams_(e), context));
    }
    if (route === "backfillPostIds") return jsonResponse(backfillPostIds());
    if (action === "getWorkspaceConfig") return jsonResponse({ ok: true, workspace: getWorkspaceServerConfig_(payloadOrParams_(e)) });
    if (action === "validatePostSchema") return jsonResponse(validatePostSchema());
    if (action === "validateCoreSchema") return jsonResponse(validateCoreSchema());
    if (action === "migrateSheetOrderAndHeaders") return jsonResponse(migrateSheetOrderAndHeaders());
    if (action === "getPostMappingDiagnostics") return jsonResponse(getPostMappingDiagnostics());
    if (action === "rebuildPostFormulas") return jsonResponse({ ok: true, results: rebuildPostFormulas() });
    if (action === "rebuildAiDraftFormulas") return jsonResponse({ ok: true, results: rebuildAiDraftFormulas() });
    if (action === "rebuildNotesFormulas") return jsonResponse({ ok: true, results: rebuildNotesFormulas() });
    if (action === "rebuildMediaFormulas") return jsonResponse({ ok: true, results: rebuildMediaFormulas() });
    if (action === "rebuildInspoFormulas") return jsonResponse({ ok: true, results: rebuildInspoFormulas() });
    if (action === "rebuildAllSchemaFormulas") return jsonResponse({ ok: true, results: rebuildAllSchemaFormulas() });
    if (action === "getMedia") return jsonResponse({ ok: true, items: getMedia(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    if (action === "getInspo") return jsonResponse({ ok: true, items: getInspo() });
    if (action === "getNotes") return jsonResponse({ ok: true, items: getNotes(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    if (action === "getQueue") return jsonResponse({ ok: true, items: getQueue() });
    if (action === "getDashboard") return jsonResponse({ ok: true, summary: getDashboardSummary() });
    if (action === "getSettings") return jsonResponse({ ok: true, settings: getSettingsRegistry() });
    if (action === "getCampaigns") return jsonResponse({ ok: true, items: getCampaigns(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    if (action === "getAIDrafts") return jsonResponse({ ok: true, items: getAIDrafts() });
    if (action === "getBrandFramework") return jsonResponse({ ok: true, items: getBrandFramework() });
    if (action === "getAICreationOptions") return jsonResponse({ ok: true, options: getAICreationOptions(payloadOrParams_(e)) });
    if (action === "prepareAIGenerationContext") return jsonResponse({ ok: true, context: prepareAIGenerationContext(payloadOrParams_(e)) });
    if (action === "generateAIDraft") return jsonResponse({ ok: true, draft: generateAIDraft(payloadOrParams_(e)) });
    if (action === "runStellarAssistant") return jsonResponse(runStellarAssistant(payloadOrParams_(e)));
    if (action === "saveAIDraft" || action === "saveAiDraft") return jsonResponse({ ok: true, draft: saveAIDraft(payloadOrParams_(e)) });
    if (action === "promoteAiDraftToPost") return jsonResponse(promoteAiDraftToPost(payloadOrParams_(e)));
    if (action === "approveAiDraft") return jsonResponse(approveAiDraft(payloadOrParams_(e)));
    if (action === "sendAiDraftToLedger") return jsonResponse(sendAiDraftToLedger(payloadOrParams_(e)));
    if (action === "saveIdeaPrompt") return jsonResponse({ ok: true, idea: saveIdeaPrompt(payloadOrParams_(e)) });
    if (action === "prepareIdeaGenerationContext") return jsonResponse({ ok: true, context: prepareIdeaGenerationContext(payloadOrParams_(e)) });
    if (action === "generateIdeaDraftScaffold") return jsonResponse({ ok: true, scaffold: generateIdeaDraftScaffold(payloadOrParams_(e)) });
    if (action === "createPostFromIdea") return jsonResponse({ ok: true, result: createPostFromIdea(payloadOrParams_(e)) });
    if (action === "createCampaignFromIdea") return jsonResponse({ ok: true, result: createCampaignFromIdea(payloadOrParams_(e)) });
    if (action === "createCalendarPlanFromIdea") return jsonResponse({ ok: true, result: createCalendarPlanFromIdea(payloadOrParams_(e)) });
    if (action === "createCarouselOutlineFromIdea") return jsonResponse({ ok: true, result: createCarouselOutlineFromIdea(payloadOrParams_(e)) });
    if (action === "getSocialImportCapabilities") return jsonResponse({ ok: true, capabilities: getSocialImportCapabilities(payloadOrParams_(e)) });
    if (action === "fetchOpenGraphMetadata") return jsonResponse({ ok: true, result: fetchOpenGraphMetadata(payloadOrParams_(e)) });
    if (action === "fetchInstagramOEmbed") return jsonResponse({ ok: true, result: fetchInstagramOEmbed(payloadOrParams_(e)) });
    if (action === "getConnectedAccounts") return jsonResponse({ ok: true, accounts: getConnectedAccounts() });
    if (action === "getConnectedAccountsStatus") return jsonResponse(getConnectedAccountsStatus());
    if (action === "getDeploymentDiagnostics") return jsonResponse(getDeploymentDiagnostics());
    if (action === "getSocialAuthUrl") return jsonResponse({ ok: true, auth: getSocialAuthUrl(payloadOrParams_(e)) });
    if (action === "startLinkedInAuth") return jsonResponse(startLinkedInAuth());
    if (action === "startInstagramAuth") return jsonResponse(startInstagramAuth());
    if (action === "startThreadsAuth") return jsonResponse(startThreadsAuth());
    if (action === "startBlueskyAuth") return jsonResponse(startBlueskyAuth());
    if (action === "startTikTokAuth") return jsonResponse(startTikTokAuth());
    if (action === "blueskyConnect") return jsonResponse(blueskyConnect(payloadOrParams_(e)));
    if (action === "testBlueskyConnection") return jsonResponse(testBlueskyConnection());
    if (action === "disconnectBluesky") return jsonResponse(disconnectBluesky());
    if (action === "blueskySyncRecentPosts") return jsonResponse(blueskySyncRecentPosts());
    if (action === "prepareBlueskyPayload") return jsonResponse(prepareBlueskyPayload(payloadOrParams_(e)));
    if (action === "tiktokCallback") return tiktokCallback(e);
    if (action === "testTikTokConnection") return jsonResponse(testTikTokConnection());
    if (action === "handleSocialOAuthCallback") return jsonResponse({ ok: true, result: handleSocialOAuthCallback(payloadOrParams_(e)) });
    if (action === "testPlatformConnection") return jsonResponse(testPlatformConnection(payloadOrParams_(e)));
    if (action === "testLinkedInHistoricalAccess") return jsonResponse(testLinkedInHistoricalAccess(payloadOrParams_(e)));
    if (action === "getLinkedInHistoricalAccessDiagnostics") return jsonResponse(testLinkedInHistoricalAccess(payloadOrParams_(e)));
    if (action === "importLinkedInPosts") return jsonResponse(importLinkedInPosts(payloadOrParams_(e)));
    if (action === "testImportCapturedPostsRoute") return jsonResponse(testImportCapturedPostsRoute());
    if (action === "getImportJobs") return jsonResponse({ ok: true, items: getImportJobs(payloadOrParams_(e)) });
    if (action === "getImportJobStatus") return jsonResponse(getImportJobStatus(payloadOrParams_(e)));
    if (action === "importSocialPostByUrl") return jsonResponse({ ok: true, imported: importSocialPostByUrl(payloadOrParams_(e)) });
    if (action === "importSocialPostById") return jsonResponse({ ok: true, imported: importSocialPostById(payloadOrParams_(e)) });
    if (action === "importRecentSocialPosts") return jsonResponse({ ok: true, items: importRecentSocialPosts(payloadOrParams_(e)) });
    if (action === "getSemanticMemory") return jsonResponse({ ok: true, semanticMemory: getSemanticMemory(payloadOrParams_(e)) });
    if (route === "diagnostics") return jsonResponse(buildDiagnosticsResponse_(getDiagnostics(payloadOrParams_(e)), context, action));
    if (action === "getPublishingReadiness") return jsonResponse({ ok: true, readiness: getPublishingReadiness(payloadOrParams_(e)) });
    if (action === "validatePostForPublishing") return jsonResponse({ ok: true, validation: validatePostForPublishing(payloadOrParams_(e)) });
    if (action === "preparePublishPayload") return jsonResponse({ ok: true, payload: preparePublishPayload(payloadOrParams_(e)) });
    if (action === "repairDateFields") return jsonResponse({ ok: true, results: repairDateFields(payloadOrParams_(e)) });
    if (action === "cleanupImportedLinkedInPosts") return jsonResponse({ ok: true, results: cleanupImportedLinkedInPosts(payloadOrParams_(e)) });
    if (action === "repairFlowIntegrity") return jsonResponse({ ok: true, results: repairFlowIntegrity(payloadOrParams_(e)) });
    if (action === "testRewriteImportedLinkedInRowsRoute") return jsonResponse(testRewriteImportedLinkedInRowsRoute());
    if (action === "rewriteImportedLinkedInRows") return jsonResponse({ ok: true, results: rewriteImportedLinkedInRows(payloadOrParams_(e)) });
    if (action === "archiveInspo") return jsonResponse({ ok: true, inspo: archiveInspo({ inspoId: (e && e.parameter && e.parameter.inspoId) || "", convertedPostId: (e && e.parameter && e.parameter.convertedPostId) || "" }) });
    if (action === "testMediaSync") return jsonResponse({ ok: true, diagnostics: testMediaSync_() });
    if (action === "cleanTaxonomyValues") return jsonResponse({ ok: true, results: cleanTaxonomyValues() });

    if (action === "getAIProviderConfig") return jsonResponse(getAIProviderConfig(payloadOrParams_(e)));
    if (action === "saveAIProviderConfig") return jsonResponse(saveAIProviderConfig(payloadOrParams_(e)));
    if (action === "testAIProviderConnection") return jsonResponse(testAIProviderConnection(payloadOrParams_(e)));
    if (action === "disconnectAIProvider") return jsonResponse(disconnectAIProvider(payloadOrParams_(e)));

    return jsonResponse(Object.assign(invalidImportActionResponse_(action), {
      source: "google_sheets",
      workspace_slug: context.workspace_slug || "",
      diagnostics: { receivedWorkspaceContext: context }
    }));
  } catch (err) {
    return jsonResponse(buildRouteErrorResponse_(err, action, context));
  }
}

function doPost(e) {
  var action = "";
  var context = {};
  try {
    const body = parseJsonSafe_((e && e.postData && e.postData.contents) || "{}") || {};
    context = getWorkspaceRequestContext_(e, body);
    setWorkspaceRequestContext_(context);
    action = getActionFromRequest_(e, body);
    var route = normalizeRouteName_(action);
    const payload = getPayloadFromRequest_(e, body);

    const deprecatedSocialActions = [
      "startLinkedInAuth",
      "startInstagramAuth",
      "startThreadsAuth",
      "startBlueskyAuth",
      "startTikTokAuth",
      "getSocialAuthUrl",
      "handleSocialOAuthCallback",
      "linkedinCallback",
      "instagramCallback",
      "threadsCallback",
      "metaCallback",
      "tiktokCallback",
      "refreshSocialToken",
      "disconnectSocialAccount",
      "disconnectPlatform",
      "disconnectBluesky",
      "testPlatformConnection",
      "testLinkedInHistoricalAccess",
      "getLinkedInHistoricalAccessDiagnostics",
      "testBlueskyConnection",
      "testTikTokConnection",
      "blueskyConnect",
      "blueskySyncRecentPosts",
      "prepareBlueskyPayload"
    ];
    if (deprecatedSocialActions.indexOf(action) !== -1 || deprecatedSocialActions.indexOf(route) !== -1) {
      return jsonResponse({
        ok: false,
        error: "Social OAuth now uses Supabase Edge Functions."
      });
    }

    if (route === "getWorkspaceConfig") {
      return jsonResponse({ ok: true, workspace: getWorkspaceServerConfig_(payload) });
    }

    if (route === "getPosts") {
      const result = getPosts();
      return jsonResponse(buildPostsResponse_(result, context, action));
    }
    if (route === "readTab" || action === "read_tab") {
      return jsonResponse(readTabRows_(payload, context));
    }
    if (route === "pullWorkspaceTabs" || action === "pull_workspace_tabs") {
      return jsonResponse(pullWorkspaceTabs_(payload, context));
    }

    if (route === "backfillPostIds") {
      return jsonResponse(backfillPostIds());
    }

    if (route === "savePost" || action === "savePost" || action === "updatePost") {
      const saveResult = savePost(payload);
      if (!saveResult || saveResult.ok !== true || saveResult.success !== true || !saveResult.post) {
        return jsonResponse({
          ok: false,
          success: false,
          error: saveResult && saveResult.error ? saveResult.error : "savePost did not confirm."
        });
      }
      const savedPost = saveResult.post;
      const confirmedPostId = String(savedPost.postId || savedPost.post_id || "").trim();
      return jsonResponse({
        ok: true,
        success: true,
        post: savedPost,
        savedPost: savedPost,
        postId: confirmedPostId,
        savedPostId: confirmedPostId,
        rowNumber: savedPost.rowNumber || savedPost.row_number || "",
        source: "google_sheets"
      });
    }

    if (action === "deletePost") {
      deletePost(payload.postId);
      return jsonResponse({ ok: true, deleted: true, postId: String(payload.postId || "").trim() });
    }

    if (action === "duplicatePost") {
      const duplicatedPost = duplicatePost(payload);
      return jsonResponse({ ok: true, post: duplicatedPost, postId: duplicatedPost.postId });
    }

    if (action === "uploadMedia") {
      return jsonResponse({ ok: true, asset: uploadMedia(payload) });
    }

    if (action === "saveMediaLink" || action === "saveMedia") {
      return jsonResponse({ ok: true, asset: saveMediaLink(payload) });
    }

    if (action === "saveInspo") {
      const savedInspo = saveInspo(payload);
      return jsonResponse({ ok: true, inspo: savedInspo, inspoId: savedInspo.inspoId });
    }

    if (action === "importExistingPostAsIdea") {
      return jsonResponse(importExistingPostAsIdea(payload));
    }

    if (action === "saveNote") {
      const savedNote = saveNote(payload);
      return jsonResponse({ ok: true, note: savedNote, noteId: savedNote.noteId });
    }

    if (action === "deleteNote") {
      deleteNote(payload.noteId);
      return jsonResponse({ ok: true, deleted: true, noteId: String(payload.noteId || "").trim() });
    }

    if (action === "deleteInspo") {
      deleteInspo(payload.inspoId);
      return jsonResponse({ ok: true, deleted: true, inspoId: String(payload.inspoId || "").trim() });
    }

    if (action === "createPostFromNote") {
      const createdPost = createPostFromNote(payload);
      return jsonResponse({ ok: true, post: createdPost, postId: createdPost.postId });
    }

    if (action === "archiveInspo") {
      const archivedInspo = archiveInspo(payload);
      return jsonResponse({ ok: true, inspo: archivedInspo, inspoId: archivedInspo.inspoId });
    }

    if (action === "saveCampaign") {
      return jsonResponse({ ok: true, campaign: saveCampaign(payload) });
    }

    if (action === "updateCampaignColor") {
      return jsonResponse({ ok: true, result: updateCampaignColor(payload) });
    }

    if (action === "mergeCampaignIntoCampaign") {
      return jsonResponse(mergeCampaignIntoCampaign(payload));
    }

    if (action === "deleteCampaignAndUnassignPosts") {
      return jsonResponse(deleteCampaignAndUnassignPosts(payload));
    }

    if (action === "reassignCampaignCleanupPosts") {
      return jsonResponse(reassignCampaignCleanupPosts(payload));
    }

    if (action === "repairCampaignKeyIssues") {
      return jsonResponse(repairCampaignKeyIssues(payload));
    }

    if (action === "saveBrandFramework") {
      return jsonResponse({ ok: true, items: saveBrandFramework(payload) });
    }

    if (action === "runStellarAssistant") {
      return jsonResponse(runStellarAssistant(payload));
    }

    if (action === "saveAIDraft" || action === "saveAiDraft") {
      return jsonResponse({ ok: true, draft: saveAIDraft(payload) });
    }

    if (action === "createPostFromAIDraft") {
      return jsonResponse({ ok: true, post: createPostFromAIDraft(payload) });
    }

    if (action === "promoteAiDraftToPost") {
      return jsonResponse(promoteAiDraftToPost(payload));
    }

    if (action === "approveAiDraft") {
      return jsonResponse(approveAiDraft(payload));
    }

    if (action === "sendAiDraftToLedger") {
      return jsonResponse(sendAiDraftToLedger(payload));
    }

    if (action === "getSocialImportCapabilities") {
      return jsonResponse({ ok: true, capabilities: getSocialImportCapabilities(payload) });
    }

    if (action === "fetchOpenGraphMetadata") {
      return jsonResponse({ ok: true, result: fetchOpenGraphMetadata(payload) });
    }

    if (action === "fetchInstagramOEmbed") {
      return jsonResponse({ ok: true, result: fetchInstagramOEmbed(payload) });
    }

    if (action === "getConnectedAccounts") {
      return jsonResponse({ ok: true, accounts: getConnectedAccounts() });
    }

    if (action === "getConnectedAccountsStatus") {
      return jsonResponse(getConnectedAccountsStatus());
    }

    if (action === "getDeploymentDiagnostics") {
      return jsonResponse(getDeploymentDiagnostics());
    }

    if (action === "getSocialAuthUrl") {
      return jsonResponse({ ok: true, auth: getSocialAuthUrl(payload) });
    }

    if (action === "startLinkedInAuth") {
      return jsonResponse(startLinkedInAuth());
    }

    if (action === "startInstagramAuth") {
      return jsonResponse(startInstagramAuth());
    }

    if (action === "startThreadsAuth") {
      return jsonResponse(startThreadsAuth());
    }

    if (action === "startBlueskyAuth") return jsonResponse(startBlueskyAuth());
    if (action === "startTikTokAuth") return jsonResponse(startTikTokAuth());
    if (action === "blueskyConnect") return jsonResponse(blueskyConnect(payload));
    if (action === "testBlueskyConnection") return jsonResponse(testBlueskyConnection());
    if (action === "disconnectBluesky") return jsonResponse(disconnectBluesky());
    if (action === "blueskySyncRecentPosts") return jsonResponse(blueskySyncRecentPosts());
    if (action === "prepareBlueskyPayload") return jsonResponse(prepareBlueskyPayload(payload));
    if (action === "testTikTokConnection") return jsonResponse(testTikTokConnection());

    if (action === "setInstagramAuthMode") {
      return jsonResponse(setInstagramAuthMode(payload));
    }

    if (action === "handleSocialOAuthCallback") {
      return jsonResponse({ ok: true, result: handleSocialOAuthCallback(payload) });
    }

    if (action === "testPlatformConnection") {
      return jsonResponse(testPlatformConnection(payload));
    }

    if (action === "testLinkedInHistoricalAccess") {
      return jsonResponse(testLinkedInHistoricalAccess(payload));
    }

    if (action === "getLinkedInHistoricalAccessDiagnostics") {
      return jsonResponse(testLinkedInHistoricalAccess(payload));
    }

    if (action === "refreshSocialToken") {
      return jsonResponse({ ok: true, account: refreshSocialToken(payload) });
    }

    if (action === "disconnectSocialAccount") {
      return jsonResponse({ ok: true, disconnected: disconnectSocialAccount(payload) });
    }

    if (action === "disconnectPlatform") {
      return jsonResponse(disconnectPlatform(payload));
    }

    if (action === "importSocialPostByUrl") {
      return jsonResponse({ ok: true, imported: importSocialPostByUrl(payload) });
    }

    if (action === "importSocialPostById") {
      return jsonResponse({ ok: true, imported: importSocialPostById(payload) });
    }

    if (action === "importRecentSocialPosts") {
      return jsonResponse({ ok: true, items: importRecentSocialPosts(payload) });
    }

    if (action === "importLinkedInPosts") {
      return jsonResponse(importLinkedInPosts(payload));
    }

    if (action === "importCapturedPosts" || action === "importLinkedInCapturedPosts") {
      return jsonResponse(importCapturedPosts(payload));
    }

    if (action === "importMediaManifest") {
      return jsonResponse(importMediaManifest(payload));
    }

    if (action === "createImportJob") {
      return jsonResponse(createImportJob(payload));
    }

    if (action === "runImportJobBatch") {
      return jsonResponse(runImportJobBatch(payload));
    }

    if (action === "cancelImportJob") {
      return jsonResponse(cancelImportJob(payload));
    }

    if (action === "retryImportJobFailures") {
      return jsonResponse(retryImportJobFailures(payload));
    }

    if (action === "saveImportedSocialPostCard") {
      return jsonResponse({ ok: true, card: saveImportedSocialPostCard(payload) });
    }

    if (action === "getMedia") {
      return jsonResponse({ ok: true, items: getMedia(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    }

    if (action === "getCampaigns") {
      return jsonResponse({ ok: true, items: getCampaigns(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    }

    if (action === "getNotes") {
      return jsonResponse({ ok: true, items: getNotes(), source: "google_sheets", workspace_slug: context.workspace_slug || "" });
    }

    if (route === "diagnostics") {
      return jsonResponse(buildDiagnosticsResponse_(getDiagnostics(payload), context, action));
    }

    if (action === "importPostFromUrl") {
      return jsonResponse({ ok: true, imported: importPostFromUrl(payload) });
    }

    if (action === "getPublishingReadiness") {
      return jsonResponse({ ok: true, readiness: getPublishingReadiness(payload) });
    }

    if (action === "validatePostForPublishing") {
      return jsonResponse({ ok: true, validation: validatePostForPublishing(payload) });
    }

    if (action === "preparePublishPayload") {
      return jsonResponse({ ok: true, payload: preparePublishPayload(payload) });
    }

    if (action === "repairDateFields") {
      return jsonResponse({ ok: true, results: repairDateFields(payload) });
    }

    if (action === "cleanupImportedLinkedInPosts") {
      return jsonResponse({ ok: true, results: cleanupImportedLinkedInPosts(payload) });
    }

    if (action === "repairFlowIntegrity") {
      return jsonResponse({ ok: true, results: repairFlowIntegrity(payload) });
    }

    if (action === "testRewriteImportedLinkedInRowsRoute") {
      return jsonResponse(testRewriteImportedLinkedInRowsRoute());
    }

    if (action === "rewriteImportedLinkedInRows") {
      return jsonResponse({ ok: true, results: rewriteImportedLinkedInRows(payload) });
    }

    if (action === "updateCampaignColor") {
      return jsonResponse({ ok: true, result: updateCampaignColor(payload) });
    }

    if (action === "getAICreationOptions") {
      return jsonResponse({ ok: true, options: getAICreationOptions(payload) });
    }

    if (action === "prepareAIGenerationContext") {
      return jsonResponse({ ok: true, context: prepareAIGenerationContext(payload) });
    }

    if (action === "generateAIDraft") {
      return jsonResponse({ ok: true, draft: generateAIDraft(payload) });
    }

    if (action === "saveIdeaPrompt") {
      return jsonResponse({ ok: true, idea: saveIdeaPrompt(payload) });
    }

    if (action === "prepareIdeaGenerationContext") {
      return jsonResponse({ ok: true, context: prepareIdeaGenerationContext(payload) });
    }

    if (action === "generateIdeaDraftScaffold") {
      return jsonResponse({ ok: true, scaffold: generateIdeaDraftScaffold(payload) });
    }

    if (action === "createPostFromIdea") {
      return jsonResponse({ ok: true, result: createPostFromIdea(payload) });
    }

    if (action === "createCampaignFromIdea") {
      return jsonResponse({ ok: true, result: createCampaignFromIdea(payload) });
    }

    if (action === "createCalendarPlanFromIdea") {
      return jsonResponse({ ok: true, result: createCalendarPlanFromIdea(payload) });
    }

    if (action === "createCarouselOutlineFromIdea") {
      return jsonResponse({ ok: true, result: createCarouselOutlineFromIdea(payload) });
    }

    if (action === "queuePublishPost") {
      return jsonResponse({ ok: true, queued: queuePublishPost(payload) });
    }

    if (action === "markPostPublished") {
      return jsonResponse({ ok: true, post: markPostPublished(payload) });
    }

    if (action === "markPostFailed") {
      return jsonResponse({ ok: true, post: markPostFailed(payload) });
    }

    if (action === "updateCampaignPosition") {
      return jsonResponse({ ok: true, updated: updateCampaignPosition(payload) });
    }

    if (action === "testMediaSync") {
      return jsonResponse({ ok: true, diagnostics: testMediaSync_() });
    }
    if (action === "cleanTaxonomyValues") {
      return jsonResponse({ ok: true, results: cleanTaxonomyValues() });
    }
    if (action === "validatePostSchema") {
      return jsonResponse(validatePostSchema());
    }
    if (action === "validateCoreSchema") {
      return jsonResponse(validateCoreSchema());
    }
    if (action === "migrateSheetOrderAndHeaders") {
      return jsonResponse(migrateSheetOrderAndHeaders());
    }
    if (action === "getPostMappingDiagnostics") {
      return jsonResponse(getPostMappingDiagnostics());
    }
    if (action === "rebuildPostFormulas") {
      return jsonResponse({ ok: true, results: rebuildPostFormulas() });
    }
    if (action === "rebuildAiDraftFormulas") {
      return jsonResponse({ ok: true, results: rebuildAiDraftFormulas() });
    }
    if (action === "rebuildNotesFormulas") {
      return jsonResponse({ ok: true, results: rebuildNotesFormulas() });
    }
    if (action === "rebuildMediaFormulas") {
      return jsonResponse({ ok: true, results: rebuildMediaFormulas() });
    }
    if (action === "rebuildInspoFormulas") {
      return jsonResponse({ ok: true, results: rebuildInspoFormulas() });
    }
    if (action === "rebuildAllSchemaFormulas") {
      return jsonResponse({ ok: true, results: rebuildAllSchemaFormulas() });
    }

    if (action === "getAIProviderConfig") return jsonResponse(getAIProviderConfig(payload));
    if (action === "saveAIProviderConfig") return jsonResponse(saveAIProviderConfig(payload));
    if (action === "testAIProviderConnection") return jsonResponse(testAIProviderConnection(payload));
    if (action === "disconnectAIProvider") return jsonResponse(disconnectAIProvider(payload));

    return jsonResponse(Object.assign(invalidImportActionResponse_(action), {
      source: "google_sheets",
      workspace_slug: context.workspace_slug || "",
      diagnostics: { receivedWorkspaceContext: context }
    }));
  } catch (err) {
    return jsonResponse({
      ok: false,
      success: false,
      error: err && err.message || String(err || "Unknown error")
    });
  }
}

function getSheet_(sheetKey) {
  const aliases = SHEET_NAMES[sheetKey] || [sheetKey];
  const ss = getSpreadsheet_();
  for (var i = 0; i < aliases.length; i += 1) {
    var sheet = ss.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }
  var newSheetName = aliases[0];
  return ss.insertSheet(newSheetName);
}

function ensureSheet_(sheetKey, headers, extraHeaders) {
  const sheet = getSheet_(sheetKey);
  ensureHeaders_(sheet, headers.concat(extraHeaders || []));
  return sheet;
}

function ensureHeaders_(sheet, expectedHeaders) {
  const current = getHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }

  const missing = expectedHeaders.filter(function(header) {
    return current.indexOf(header) === -1;
  });

  if (!missing.length) return;
  sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || "").trim();
  });
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getHeaderMap_(sheet) {
  const map = {};
  getHeaders_(sheet).forEach(function(header, index) {
    var rawKey = String(header || "").trim();
    var normalizedKey = normalizeHeader_(rawKey);
    if (rawKey) map[rawKey] = index + 1;
    if (normalizedKey) map[normalizedKey] = index + 1;
  });
  return map;
}

function requireHeaders_(sheet, requiredHeaders) {
  const map = getHeaderMap_(sheet);
  const missing = (requiredHeaders || []).filter(function(header) {
    return !map[normalizeHeader_(header)];
  });
  if (missing.length) {
    throw new Error("Missing required headers on " + sheet.getName() + ": " + missing.join(", "));
  }
  return map;
}

function ensureHeadersPresent_(sheet, headers) {
  var headerMap = getHeaderMap_(sheet);
  var missing = (headers || []).filter(function(header) {
    return header && !headerMap[normalizeHeader_(header)];
  });
  if (!missing.length) return headerMap;
  var startColumn = Math.max(sheet.getLastColumn() + 1, 1);
  sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
  return getHeaderMap_(sheet);
}

function getRequiredSheetByName_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet: " + name);
  return sheet;
}

function getPostsSheet_() {
  var context = getCurrentWorkspaceRequestContext_();
  var explicitPostsSheetName = String(context.postsSheetName || "").trim();
  return getRequiredSheetByName_(explicitPostsSheetName || SHEETS.POSTS);
}

function getCoreSheet_(sheetKey) {
  var aliases = SHEET_NAMES[sheetKey] || [sheetKey];
  var ss = getSpreadsheet_();
  for (var i = 0; i < aliases.length; i += 1) {
    var sheet = ss.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }
  throw new Error("Missing sheet: " + aliases[0]);
}

function getRowsByNormalizedHeaders_(sheet, requiredHeaders) {
  requireHeaders_(sheet, requiredHeaders || []);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastColumn = sheet.getLastColumn();
  const rawHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const headers = rawHeaders.map(normalizeHeader_);
  return sheet.getRange(2, 1, lastRow - 1, lastColumn)
    .getValues()
    .map(function(row, index) {
      const obj = { row_number: index + 2 };
      headers.forEach(function(header, colIndex) {
        if (header) obj[header] = row[colIndex];
      });
      return obj;
    })
    .filter(function(obj) {
      return Object.keys(obj).some(function(key) {
        return key !== "row_number" && String(obj[key] || "").trim() !== "";
      });
    });
}

function getSheetRowsByHeader_(sheetOrKey, requiredHeaders) {
  var sheet = typeof sheetOrKey === "string" ? getCoreSheet_(sheetOrKey) : sheetOrKey;
  return getRowsByNormalizedHeaders_(sheet, requiredHeaders || []);
}

function findObjectByNormalizedHeaderValue_(sheet, headerNames, value, requiredHeaders) {
  const target = String(value || "").trim();
  if (!target) return null;
  const rows = getRowsByNormalizedHeaders_(sheet, requiredHeaders || []);
  for (var i = 0; i < rows.length; i += 1) {
    for (var j = 0; j < (headerNames || []).length; j += 1) {
      var key = normalizeHeader_(headerNames[j]);
      if (String(rows[i][key] || "").trim() === target) return rows[i];
    }
  }
  return null;
}

function isFormulaHeader_(formulaHeaders, key) {
  return (formulaHeaders || []).map(normalizeHeader_).indexOf(normalizeHeader_(key)) !== -1;
}

function writeObjectToRowByHeaders_(sheet, rowNumber, rowObject, requiredHeaders, formulaHeaders) {
  const headerMap = requireHeaders_(sheet, requiredHeaders || []);
  Object.keys(rowObject || {}).forEach(function(rawKey) {
    const key = normalizeHeader_(rawKey);
    if (!key || key === "row_number") return;
    if (isFormulaHeader_(formulaHeaders, key)) return;
    const columnIndex = headerMap[key];
    if (!columnIndex) return;
    sheet.getRange(rowNumber, columnIndex).setValue(rowObject[rawKey]);
  });
  const updatedAtCol = headerMap.updated_at;
  if (updatedAtCol && !isFormulaHeader_(formulaHeaders, "updated_at")) {
    sheet.getRange(rowNumber, updatedAtCol).setValue(new Date());
  }
}

function writeObjectByHeader_(sheet, rowNumber, rowObject, requiredHeaders, formulaHeaders) {
  return writeObjectToRowByHeaders_(sheet, rowNumber, rowObject, requiredHeaders || [], formulaHeaders || []);
}

function upsertObjectByHeader_(sheet, idHeaders, rowObject, requiredHeaders, formulaHeaders) {
  const primaryKey = normalizeHeader_((idHeaders || [])[0]);
  const idValue = String(rowObject && rowObject[primaryKey] || "").trim();
  if (!idValue) throw new Error("Missing " + primaryKey);
  const rowNumber = findRowByNormalizedHeaderValue_(sheet, idHeaders, idValue);
  const targetRow = rowNumber > 0 ? rowNumber : Math.max(sheet.getLastRow() + 1, 2);
  writeObjectToRowByHeaders_(sheet, targetRow, rowObject, requiredHeaders, formulaHeaders);
  return targetRow;
}

function addCamelAliases_(obj, aliasMap) {
  obj = Object.assign({}, obj || {});
  Object.keys(aliasMap || {}).forEach(function(camelKey) {
    var snakeKey = normalizeHeader_(aliasMap[camelKey]);
    if (obj[camelKey] === undefined && obj[snakeKey] !== undefined) obj[camelKey] = obj[snakeKey];
  });
  return obj;
}

function getRowsAsObjects_(sheetKey, headers, extraHeaders) {
  const sheet = ensureSheet_(sheetKey, headers || [], extraHeaders || []);
  return getObjectsFromSheet_(sheet);
}

function getSettingsRegistry() {
  var settings = cloneSettingsDefaults_();
  var sheet = getSheet_("settings");
  var headers = getHeaders_(sheet);
  if (!headers.length) return settings;

  var rows = getObjectsFromSheet_(sheet);
  var headerKeyMap = {};
  headers.forEach(function(header) {
    headerKeyMap[header] = normalizeSettingKey_(header);
  });

  var arrayAssignments = {
    platforms: false,
    pillars: false,
    statuses: false,
    postTypes: false,
    campaigns: false,
    months: false
  };

  function categoryFromKey_(key) {
    if (key === "platform" || key === "platforms") return "platforms";
    if (key === "pillar" || key === "pillars") return "pillars";
    if (key === "status" || key === "statuses") return "statuses";
    if (key === "posttype" || key === "posttypes") return "postTypes";
    if (key === "campaign" || key === "campaigns") return "campaigns";
    if (key === "campaigncolor" || key === "campaigncolors") return "campaignColors";
    if (key === "month" || key === "months") return "months";
    if (key === "queuelimit") return "queueLimit";
    if (key === "currentmonth") return "currentMonth";
    if (key === "currentyear") return "currentYear";
    if (key === "mediafolderid") return "mediaFolderId";
    return "";
  }

  function normalizeSettingValue_(category, value) {
    if (category === "platforms") return normalizePlatform_(value);
    if (category === "pillars") return normalizePillar_(value, "");
    if (category === "statuses") return normalizeStatus_(value);
    if (category === "postTypes") return normalizePostType_(value);
    if (category === "campaigns") return normalizeCampaignName_(value);
    if (category === "months") return String(value || "").trim();
    if (category === "campaignColors") return String(value || "").trim();
    return String(value || "").trim();
  }

  Object.keys(headerKeyMap).forEach(function(header) {
    var category = categoryFromKey_(headerKeyMap[header]);
    if (!category) return;
    var values = rows
      .map(function(row) { return row[header]; })
      .map(function(value) { return normalizeSettingValue_(category, value); })
      .filter(Boolean);

    if (Array.isArray(settings[category]) && values.length) {
      settings[category] = values.filter(function(value, index, list) {
        return list.indexOf(value) === index;
      });
      arrayAssignments[category] = true;
    } else if (category !== "campaignColors" && !Array.isArray(settings[category]) && values.length) {
      settings[category] = values[0];
    }
  });

  var campaignHeader = headers.find(function(header) {
    return ["campaign", "campaigns"].indexOf(headerKeyMap[header]) !== -1;
  });
  var campaignColorHeader = headers.find(function(header) {
    return ["campaigncolor", "campaigncolors"].indexOf(headerKeyMap[header]) !== -1;
  });

  if (campaignHeader && campaignColorHeader) {
    rows.forEach(function(row) {
      var campaignName = normalizeCampaignName_(row[campaignHeader]);
      var colorValue = String(row[campaignColorHeader] || "").trim();
      if (!campaignName || !colorValue) return;
      settings.campaignColors[campaignName] = colorValue;
    });
  }

  var categoryHeader = headers.find(function(header) {
    return ["category", "setting", "registry", "group", "type", "key"].indexOf(headerKeyMap[header]) !== -1;
  });
  var valueHeader = headers.find(function(header) {
    return ["value", "item", "option", "name", "label"].indexOf(headerKeyMap[header]) !== -1;
  });

  if (categoryHeader && valueHeader) {
    var grouped = {
      platforms: [],
      pillars: [],
      statuses: [],
      postTypes: [],
      campaigns: [],
      months: []
    };

    rows.forEach(function(row) {
      var category = categoryFromKey_(normalizeSettingKey_(row[categoryHeader]));
      if (!category) return;
      var normalizedValue = normalizeSettingValue_(category, row[valueHeader]);
      if (!normalizedValue) return;
      if (Array.isArray(settings[category])) {
        grouped[category].push(normalizedValue);
      } else if (!settings[category]) {
        settings[category] = normalizedValue;
      }
    });

    Object.keys(grouped).forEach(function(category) {
      if (!grouped[category].length) return;
      settings[category] = grouped[category].filter(function(value, index, list) {
        return list.indexOf(value) === index;
      });
      arrayAssignments[category] = true;
    });
  }

  settings.campaigns = getAllowedCampaignNames_();
  arrayAssignments.campaigns = true;

  if (!arrayAssignments.platforms || !settings.platforms.length) settings.platforms = cloneSettingsDefaults_().platforms;
  if (!arrayAssignments.pillars || !settings.pillars.length) settings.pillars = cloneSettingsDefaults_().pillars;
  if (!arrayAssignments.statuses || !settings.statuses.length) settings.statuses = cloneSettingsDefaults_().statuses;
  if (!arrayAssignments.postTypes || !settings.postTypes.length) settings.postTypes = cloneSettingsDefaults_().postTypes;
  settings.campaignColors = buildCampaignColorMap_(settings.campaignColors);
  settings.default_pillars = settings.pillars.map(function(value) {
    return {
      name: pillarDisplayLabel_(value, value),
      slug: normalizePillar_(value, value),
      enabled: true
    };
  }).filter(function(value) {
    return value && value.slug;
  });

  return settings;
}

function getObjectsFromSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(value) {
    return String(value || "").trim();
  });

  return values
    .slice(1)
    .filter(function(row) {
      return row.some(function(cell) {
        return String(cell || "").trim() !== "";
      });
    })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(header, index) {
        obj[header] = row[index];
      });
      return obj;
    });
}

function appendObjectRowByHeaders_(sheet, obj) {
  const headers = getHeaders_(sheet);
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(obj, header) ? obj[header] : "";
  });
  var targetRow = Math.max(sheet.getLastRow() + 1, 2);
  var formulas = getFormulaRowSafe_(sheet, targetRow, headers.length);
  var values = preserveFormulaCells_(row, formulas);
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
}

function findRowByHeaderValue_(sheet, headerName, value) {
  if (value === undefined || value === null || String(value).trim() === "") return -1;

  const headerMap = getHeaderMap_(sheet);
  const columnIndex = headerMap[headerName];
  if (!columnIndex) return -1;

  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (rowCount === 0) return -1;

  const values = sheet.getRange(2, columnIndex, rowCount, 1).getValues().flat();
  const target = String(value).trim();
  const foundIndex = values.findIndex(function(item) {
    return String(item || "").trim() === target;
  });

  return foundIndex === -1 ? -1 : foundIndex + 2;
}

function findObjectByHeaders_(sheet, headerNames, value) {
  const target = String(value || "").trim();
  if (!target) return null;
  const rows = getObjectsFromSheet_(sheet);
  for (var i = 0; i < rows.length; i += 1) {
    for (var j = 0; j < headerNames.length; j += 1) {
      if (String(rows[i][headerNames[j]] || "").trim() === target) return rows[i];
    }
  }
  return null;
}

function upsertObjectRowByAliases_(sheet, headerNames, rowObject, extraAliases) {
  const headers = getHeaders_(sheet);
  const allAliases = headerNames.concat(extraAliases || []);
  let rowIndex = -1;

  for (var i = 0; i < allAliases.length; i += 1) {
    rowIndex = findRowByHeaderValue_(sheet, allAliases[i], rowObject[headerNames[0]]);
    if (rowIndex > 0) break;
  }

  const targetRow = rowIndex > 0 ? rowIndex : Math.max(sheet.getLastRow() + 1, 2);
  const rawValues = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : "";
  });
  const formulas = getFormulaRowSafe_(sheet, targetRow, headers.length);
  const values = preserveFormulaCells_(rawValues, formulas);
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
}

function getFormulaRowSafe_(sheet, rowIndex, width) {
  try {
    if (rowIndex > sheet.getMaxRows()) return [];
    return sheet.getRange(rowIndex, 1, 1, width).getFormulas()[0] || [];
  } catch (_) {
    return [];
  }
}

function preserveFormulaCells_(values, formulas) {
  return (values || []).map(function(value, index) {
    var formula = formulas && formulas[index];
    return formula ? formula : value;
  });
}

function isPostFormulaHeader_(key) {
  return POST_FORMULA_HEADERS.indexOf(normalizeHeader_(key)) !== -1;
}

function findRowByNormalizedHeaderValue_(sheet, headerNames, value) {
  if (value === undefined || value === null || String(value).trim() === "") return -1;
  const headerMap = getHeaderMap_(sheet);
  const target = String(value || "").trim();
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (!rowCount) return -1;

  for (var h = 0; h < (headerNames || []).length; h += 1) {
    var columnIndex = headerMap[normalizeHeader_(headerNames[h])] || headerMap[headerNames[h]];
    if (!columnIndex) continue;
    var values = sheet.getRange(2, columnIndex, rowCount, 1).getValues().flat();
    var foundIndex = values.findIndex(function(item) {
      return String(item || "").trim() === target;
    });
    if (foundIndex !== -1) return foundIndex + 2;
  }
  return -1;
}

function getPostsData_() {
  const sheet = getPostsSheet_();
  requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  console.log("[posts] sheet range", { lastRow: lastRow, lastColumn: lastColumn, dataRows: Math.max(0, lastRow - 1) });
  if (lastRow < 2) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeHeader_);
  console.log("[posts] headers", headers);
  const rawRows = sheet.getRange(2, 1, lastRow - 1, lastColumn)
    .getValues()
    .map(function(row, index) {
      const obj = { row_number: index + 2 };
      headers.forEach(function(header, colIndex) {
        if (header) obj[header] = row[colIndex];
      });
      return obj;
    })
    .filter(function(obj) {
      return Object.keys(obj).some(function(key) {
        return key !== "row_number" && String(obj[key] || "").trim() !== "";
      });
    });
  console.log("[posts] raw rows after empty filter", rawRows.length);
  return rawRows;
}

function postHasMeaningfulIdBackfillContent_(row) {
  row = normalizePostSchemaAliases_(Object.assign({}, row || {}));
  return !!String(pickFirstDefined_(
    row.title,
    row.post_title,
    row.postTitle,
    row.queue_title,
    row.queueTitle,
    row.headline,
    row.description,
    row.caption,
    row.body,
    row.content,
    row.copy,
    row.scheduled_at,
    row.scheduledAt,
    row.publish_date,
    row.publishDate,
    row.queue_date_label,
    row.queueDateLabel,
    ""
  )).trim();
}

function countPostsMissingPostIds_(posts) {
  return (Array.isArray(posts) ? posts : []).reduce(function(count, post) {
    var postId = String(pickFirstDefined_(post && post.post_id, post && post.postId, "")).trim();
    return !postId && postHasMeaningfulIdBackfillContent_(post) ? count + 1 : count;
  }, 0);
}

function backfillPostIds() {
  const sheet = getPostsSheet_();
  const headerMap = getHeaderMap_(sheet);
  const postIdColumn = headerMap.post_id;
  if (!postIdColumn) {
    return {
      ok: false,
      action: "backfillPostIds",
      error: "Missing required post_id column on " + sheet.getName() + ". Add a post_id header before running repair."
    };
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || !lastColumn) {
    return {
      ok: true,
      action: "backfillPostIds",
      updatedCount: 0,
      skippedCount: 0,
      sampleUpdated: []
    };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeHeader_);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var updatedCount = 0;
  var skippedCount = 0;
  var sampleUpdated = [];

  values.forEach(function(rowValues, index) {
    var rowNumber = index + 2;
    var existingPostId = String(rowValues[postIdColumn - 1] || "").trim();
    var row = { row_number: rowNumber };
    headers.forEach(function(header, colIndex) {
      if (header) row[header] = rowValues[colIndex];
    });

    if (existingPostId || !postHasMeaningfulIdBackfillContent_(row)) {
      skippedCount += 1;
      return;
    }

    var generatedPostId = createPostId_();
    sheet.getRange(rowNumber, postIdColumn).setValue(generatedPostId);
    updatedCount += 1;
    if (sampleUpdated.length < 10) {
      sampleUpdated.push({
        rowNumber: rowNumber,
        post_id: generatedPostId,
        title: derivePostTitle_(row),
        publish_date: String(pickFirstDefined_(row.publish_date, row.publishDate, row.queue_date_label, row.queueDateLabel, "")).trim(),
        scheduled_at: String(pickFirstDefined_(row.scheduled_at, row.scheduledAt, "")).trim()
      });
    }
  });

  return {
    ok: true,
    action: "backfillPostIds",
    updatedCount: updatedCount,
    skippedCount: skippedCount,
    sampleUpdated: sampleUpdated
  };
}

function findPostObjectById_(postId) {
  const target = String(postId || "").trim();
  if (!target) return null;
  return getPostsData_().find(function(row) {
    return String(pickFirstDefined_(row.post_id, row.postId, row.id)).trim() === target;
  }) || null;
}

function isBadPostIdentity_(value) {
  var id = String(value || "").trim();
  return !id || /^row_\d+$/i.test(id) || /^POST-NEW-/i.test(id) || /^draft[_-]/i.test(id);
}

function getCanonicalIncomingPostId_(payload) {
  var id = String(pickFirstDefined_(
    payload && payload.post_id,
    payload && payload.postId,
    payload && payload.stellarsync_post_id,
    ""
  )).trim();
  return isBadPostIdentity_(id) ? "" : id;
}

function ensureCanonicalPostId_(payload, existing) {
  return String(pickFirstDefined_(
    getCanonicalIncomingPostId_(payload),
    existing && existing.post_id,
    existing && existing.postId,
    createPostId_()
  )).trim();
}

function isTemporaryPostLookupId_(value) {
  return isBadPostIdentity_(value) || /^(index|slug|content_key)_/i.test(String(value || "").trim());
}

function canonicalIncomingPostId_(payload) {
  return getCanonicalIncomingPostId_(payload);
}

function findPostObjectForSave_(payload) {
  payload = payload || {};
  var byId = findPostObjectById_(canonicalIncomingPostId_(payload));
  if (byId) return byId;
  var rowNumber = Number(pickFirstDefined_(payload._rowNumber, payload.rowNumber, payload.row_number, payload.sheetRow, payload.sheet_row, ""));
  var rows = getPostsData_();
  if (rowNumber && rowNumber >= 2) {
    var byRow = rows.find(function(row) {
      return Number(row.row_number || row._rowNumber || row.sheetRow || 0) === rowNumber;
    });
    if (byRow) return byRow;
  }
  var slug = String(pickFirstDefined_(payload.slug, payload.content_slug, "")).trim();
  if (slug) {
    var bySlug = rows.find(function(row) {
      return String(pickFirstDefined_(row.slug, row.content_slug, "")).trim() === slug;
    });
    if (bySlug) return bySlug;
  }
  var contentKey = String(pickFirstDefined_(payload.content_key, payload.contentKey, "")).trim();
  if (contentKey) {
    var byContentKey = rows.find(function(row) {
      return String(pickFirstDefined_(row.content_key, row.contentKey, "")).trim() === contentKey;
    });
    if (byContentKey) return byContentKey;
  }
  var payloadTitle = String(derivePostTitle_(payload) || "").trim().toLowerCase();
  var payloadDateKey = getPostPlanningDateKey(payload);
  if (payloadTitle && payloadDateKey) {
    var byTitleAndDate = rows.find(function(row) {
      var rowTitle = String(derivePostTitle_(row) || "").trim().toLowerCase();
      var rowDateKey = getPostPlanningDateKey(row);
      return rowTitle === payloadTitle && rowDateKey === payloadDateKey;
    });
    if (byTitleAndDate) return byTitleAndDate;
  }
  return rows.find(function(row) {
    return Number(row.row_number || row._rowNumber || row.sheetRow || 0) === rowNumber;
  }) || null;
}

function firstNonEmptyLine_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(function(line) { return line.trim(); })
    .filter(Boolean)[0] || "";
}

function derivePostTitle_(row) {
  row = row || {};
  var directTitle = String(pickFirstDefined_(
    row.title,
    row.post_title,
    row.postTitle,
    row.queue_title,
    row.queueTitle,
    row.headline,
    row.captionTitle,
    row.caption_title,
    ""
  )).trim();
  if (directTitle) return directTitle;
  return firstNonEmptyLine_(pickFirstDefined_(
    row.caption,
    row.description,
    row.body,
    row.content,
    row.copy,
    ""
  ));
}

function deriveNoteTitle_(row) {
  row = row || {};
  var directTitle = String(pickFirstDefined_(row.title, row.note_title, row.noteTitle, row.headline, "")).trim();
  if (directTitle) return directTitle;
  var bodyTitle = firstNonEmptyLine_(pickFirstDefined_(row.body, row.note_body, row.noteBody, row.summary, row.description, ""));
  if (bodyTitle && bodyTitle.length > 80) bodyTitle = bodyTitle.slice(0, 80);
  return bodyTitle || "Untitled note";
}

function domainFromUrl_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  var match = text.match(/^(?:https?:\/\/)?(?:www\.)?([^\/?#]+)/i);
  return match && match[1] ? match[1] : "";
}

function deriveMediaTitle_(row) {
  row = row || {};
  var directTitle = String(pickFirstDefined_(
    row.title,
    row.media_title,
    row.mediaTitle,
    row.asset_title,
    row.assetTitle,
    row.asset_name,
    row.assetName,
    row.alt_text,
    row.altText,
    row.filename,
    row.original_filename,
    row.originalFilename,
    ""
  )).trim();
  if (directTitle) return directTitle;
  return domainFromUrl_(pickFirstDefined_(row.source_url, row.sourceUrl, row.url, row.file_url, row.fileUrl)) || "Untitled media";
}

function deriveDraftTitle_(row) {
  row = row || {};
  var directTitle = String(pickFirstDefined_(row.title, row.draft_title, row.draftTitle, row.headline, "")).trim();
  if (directTitle) return directTitle;
  var textTitle = firstNonEmptyLine_(pickFirstDefined_(row.draft_text, row.draftText, row.generated_output, row.generatedOutput, row.prompt, row.idea_prompt, row.ideaPrompt, ""));
  if (textTitle && textTitle.length > 80) textTitle = textTitle.slice(0, 80);
  return textTitle || "Untitled draft";
}

function getMetricAliasNumber_(row, aliases) {
  row = row || {};
  var raw = valueFrom_(row, aliases);
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    var rawNum = normalizeNumber_(raw);
    if (!isNaN(rawNum)) return rawNum;
  }
  return 0;
}

function valueFrom_(row, aliases) {
  row = row || {};
  for (var i = 0; i < (aliases || []).length; i += 1) {
    var key = aliases[i];
    var value = pickFirstDefined_(row[key], row[normalizeHeader_(key)]);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function normalizePostRow_(row) {
  row = normalizePostSchemaAliases_(Object.assign({}, row || {}));
  var postId = String(pickFirstDefined_(row.post_id, row.postId, row.id, "")).trim();
  var title = derivePostTitle_(row) || "Untitled post";
  var scheduledAt = String(pickFirstDefined_(row.scheduled_at, row.scheduledAt, "")).trim();
  var publishDate = String(pickFirstDefined_(row.publish_date, row.publishDate, row.queue_date_label, row.queueDateLabel, "")).trim();
  var publishTime = String(pickFirstDefined_(row.publish_time, row.publishTime, row.queue_time_label, row.queueTimeLabel, "")).trim();
  var postedAt = String(pickFirstDefined_(row.posted_at, row.postedAt, "")).trim();
  var impressions = getMetricAliasNumber_(row, ["impressions", "impression_count", "views", "view_count", "reach"]);
  var views = getMetricAliasNumber_(row, ["views", "view_count"]) || impressions;
  var reach = getMetricAliasNumber_(row, ["reach"]) || impressions;
  var likes = getMetricAliasNumber_(row, ["likes", "like_count", "reactions", "reaction_count"]);
  var reactions = getMetricAliasNumber_(row, ["reactions", "reaction_count"]) || likes;
  var comments = getMetricAliasNumber_(row, ["comments", "comment_count"]);
  var shares = getMetricAliasNumber_(row, ["shares", "share_count", "reposts", "repost_count"]);
  var reposts = getMetricAliasNumber_(row, ["reposts", "repost_count"]) || shares;
  var saves = getMetricAliasNumber_(row, ["saves", "save_count"]);
  var clicks = getMetricAliasNumber_(row, ["clicks", "click_count", "link_clicks"]);
  var engagementTotal = getMetricAliasNumber_(row, ["engagement_total", "total_engagement", "engagements"]);
  if (!engagementTotal) engagementTotal = likes + comments + shares + saves + clicks;
  var engagementRate = getMetricAliasNumber_(row, ["engagement_rate"]);
  if (!engagementRate && impressions > 0) engagementRate = engagementTotal / impressions;
  var saveRate = getMetricAliasNumber_(row, ["save_rate"]);
  var clickRate = getMetricAliasNumber_(row, ["click_rate"]);
  return Object.assign({}, row, {
    post_id: postId,
    postId: postId,
    id: row.id || postId,
    title: title,
    status: String(pickFirstDefined_(row.status, row.post_status, row.postStatus, "draft")).trim() || "draft",
    publish_date: publishDate,
    publishDate: publishDate,
    publish_time: publishTime,
    publishTime: publishTime,
    scheduled_at: scheduledAt,
    scheduledAt: scheduledAt,
    posted_at: postedAt,
    postedAt: postedAt,
    platform: (parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform))[0] || String(pickFirstDefined_(row.platform, "linkedin")).trim() || "linkedin"),
    campaign_name: String(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaign, "")).trim(),
    campaignName: String(pickFirstDefined_(row.campaignName, row.campaign_name, row.campaign, "")).trim(),
    campaign_id: String(pickFirstDefined_(row.campaign_id, row.campaignId, "")).trim(),
    campaignId: String(pickFirstDefined_(row.campaignId, row.campaign_id, "")).trim(),
    pillar: String(pickFirstDefined_(row.pillar, row.hub_pillar_label, row.hubPillarLabel, "")).trim(),
    format: String(pickFirstDefined_(row.format, row.post_type, row.postType, "text")).trim() || "text",
    description: String(pickFirstDefined_(row.description, row.caption, row.body, row.content, row.copy, "")).trim(),
    impressions: impressions,
    impression_count: impressions,
    views: views,
    view_count: views,
    reach: reach,
    likes: likes,
    like_count: likes,
    reactions: reactions,
    reaction_count: reactions,
    comments: comments,
    comment_count: getMetricAliasNumber_(row, ["comment_count"]) || comments,
    shares: shares,
    share_count: shares,
    reposts: reposts,
    repost_count: reposts,
    saves: saves,
    save_count: getMetricAliasNumber_(row, ["save_count"]) || saves,
    clicks: clicks,
    click_count: clicks,
    link_clicks: getMetricAliasNumber_(row, ["link_clicks"]) || clicks,
    engagement_total: engagementTotal,
    engagementTotal: engagementTotal,
    total_engagement: engagementTotal,
    engagements: engagementTotal,
    engagement_rate: engagementRate,
    engagementRate: engagementRate,
    save_rate: saveRate,
    saveRate: saveRate,
    click_rate: clickRate,
    clickRate: clickRate,
    workspace_id: String(pickFirstDefined_(row.workspace_id, row.workspaceId, "")).trim(),
    workspaceId: String(pickFirstDefined_(row.workspaceId, row.workspace_id, "")).trim(),
    media_id: String(pickFirstDefined_(row.media_id, row.mediaId, row.asset_id, row.assetId, "")).trim(),
    mediaId: String(pickFirstDefined_(row.mediaId, row.media_id, row.assetId, row.asset_id, "")).trim(),
    media_url: String(pickFirstDefined_(row.media_url, row.mediaUrl, row.asset_url, row.assetUrl, "")).trim(),
    mediaUrl: String(pickFirstDefined_(row.mediaUrl, row.media_url, row.assetUrl, row.asset_url, "")).trim(),
    media_type: String(pickFirstDefined_(row.media_type, row.mediaType, row.asset_type, row.assetType, "")).trim(),
    mediaType: String(pickFirstDefined_(row.mediaType, row.media_type, row.assetType, row.asset_type, "")).trim(),
    media_filename: String(pickFirstDefined_(row.media_filename, row.mediaFilename, row.asset_name, row.assetName, "")).trim(),
    mediaFilename: String(pickFirstDefined_(row.mediaFilename, row.media_filename, row.assetName, row.asset_name, "")).trim(),
    media_alt_text: String(pickFirstDefined_(row.media_alt_text, row.mediaAltText, row.alt_text, row.altText, "")).trim(),
    mediaAltText: String(pickFirstDefined_(row.mediaAltText, row.media_alt_text, row.altText, row.alt_text, "")).trim(),
    media_source: String(pickFirstDefined_(row.media_source, row.mediaSource, "")).trim(),
    mediaSource: String(pickFirstDefined_(row.mediaSource, row.media_source, "")).trim(),
    storage_path: String(pickFirstDefined_(row.storage_path, row.storagePath, "")).trim(),
    storagePath: String(pickFirstDefined_(row.storagePath, row.storage_path, "")).trim(),
    monday_item_id: String(pickFirstDefined_(row.monday_item_id, row.mondayItemId, "")).trim(),
    mondayItemId: String(pickFirstDefined_(row.mondayItemId, row.monday_item_id, "")).trim(),
    monday_group_id: String(pickFirstDefined_(row.monday_group_id, row.mondayGroupId, "")).trim(),
    mondayGroupId: String(pickFirstDefined_(row.mondayGroupId, row.monday_group_id, "")).trim(),
    monday_last_synced_at: String(pickFirstDefined_(row.monday_last_synced_at, row.mondayLastSyncedAt, "")).trim(),
    mondayLastSyncedAt: String(pickFirstDefined_(row.mondayLastSyncedAt, row.monday_last_synced_at, "")).trim(),
    monday_sync_status: String(pickFirstDefined_(row.monday_sync_status, row.mondaySyncStatus, "")).trim(),
    mondaySyncStatus: String(pickFirstDefined_(row.mondaySyncStatus, row.monday_sync_status, "")).trim()
  });
}

function normalizeNoteRow_(row) {
  row = Object.assign({}, row || {});
  var noteId = String(pickFirstDefined_(row.note_id, row.noteId, row.id, "")).trim();
  var body = String(pickFirstDefined_(row.body, row.note_body, row.noteBody, row.summary, row.description, "")).trim();
  var title = deriveNoteTitle_(Object.assign({}, row, { body: body }));
  return Object.assign({}, row, {
    note_id: noteId,
    noteId: noteId,
    id: row.id || noteId,
    title: title,
    note_title: String(pickFirstDefined_(row.note_title, row.noteTitle, title)).trim() || title,
    body: body,
    note_body: String(pickFirstDefined_(row.note_body, row.noteBody, body)).trim(),
    summary: String(pickFirstDefined_(row.summary, row.description, "")).trim(),
    campaign_name: String(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaign, "")).trim(),
    campaignName: String(pickFirstDefined_(row.campaignName, row.campaign_name, row.campaign, "")).trim(),
    pillar: String(pickFirstDefined_(row.pillar, row.suggested_pillar, row.suggestedPillar, "")).trim(),
    source_type: String(pickFirstDefined_(row.source_type, row.sourceType, "")).trim(),
    sourceType: String(pickFirstDefined_(row.sourceType, row.source_type, "")).trim(),
    created_at: String(pickFirstDefined_(row.created_at, row.createdAt, "")).trim(),
    createdAt: String(pickFirstDefined_(row.createdAt, row.created_at, "")).trim(),
    updated_at: String(pickFirstDefined_(row.updated_at, row.updatedAt, "")).trim(),
    updatedAt: String(pickFirstDefined_(row.updatedAt, row.updated_at, "")).trim(),
    linked_post_id: String(pickFirstDefined_(row.linked_post_id, row.linkedPostId, row.converted_post_id, row.convertedPostId, "")).trim(),
    linkedPostId: String(pickFirstDefined_(row.linkedPostId, row.linked_post_id, row.convertedPostId, row.converted_post_id, "")).trim(),
    linked_ai_draft_id: String(pickFirstDefined_(row.linked_ai_draft_id, row.linkedAiDraftId, row.source_ai_draft_id, row.sourceAiDraftId, "")).trim(),
    linkedAiDraftId: String(pickFirstDefined_(row.linkedAiDraftId, row.linked_ai_draft_id, row.sourceAiDraftId, row.source_ai_draft_id, "")).trim()
  });
}

function normalizeMediaRow_(row) {
  row = Object.assign({}, row || {});
  var assetId = String(pickFirstDefined_(row.asset_id, row.assetId, row.media_id, row.mediaId, row.id, "")).trim();
  var title = deriveMediaTitle_(row);
  var type = String(pickFirstDefined_(row.type, row.media_type, row.mediaType, row.asset_type, row.assetType, "image")).trim().toLowerCase() || "image";
  var url = String(pickFirstDefined_(row.url, row.media_url, row.mediaUrl, row.file_url, row.fileUrl, row.source_url, row.sourceUrl, "")).trim();
  return Object.assign({}, row, {
    asset_id: assetId,
    assetId: assetId,
    media_id: String(pickFirstDefined_(row.media_id, row.mediaId, assetId)).trim(),
    mediaId: String(pickFirstDefined_(row.mediaId, row.media_id, assetId)).trim(),
    id: row.id || assetId,
    title: title,
    media_title: String(pickFirstDefined_(row.media_title, row.mediaTitle, title)).trim() || title,
    asset_title: String(pickFirstDefined_(row.asset_title, row.assetTitle, row.asset_name, row.assetName, title)).trim() || title,
    asset_name: String(pickFirstDefined_(row.asset_name, row.assetName, title)).trim() || title,
    assetName: String(pickFirstDefined_(row.assetName, row.asset_name, title)).trim() || title,
    type: type,
    media_type: type,
    mediaType: type,
    asset_type: type,
    assetType: type,
    url: url,
    media_url: String(pickFirstDefined_(row.media_url, row.mediaUrl, row.file_url, row.fileUrl, url)).trim(),
    mediaUrl: String(pickFirstDefined_(row.mediaUrl, row.media_url, row.fileUrl, row.file_url, url)).trim(),
    media_filename: String(pickFirstDefined_(row.media_filename, row.mediaFilename, row.original_filename, row.originalFilename, title)).trim(),
    mediaFilename: String(pickFirstDefined_(row.mediaFilename, row.media_filename, row.originalFilename, row.original_filename, title)).trim(),
    media_alt_text: String(pickFirstDefined_(row.media_alt_text, row.mediaAltText, row.alt_text, row.altText, "")).trim(),
    mediaAltText: String(pickFirstDefined_(row.mediaAltText, row.media_alt_text, row.altText, row.alt_text, "")).trim(),
    media_source: String(pickFirstDefined_(row.media_source, row.mediaSource, row.source_type, row.sourceType, "")).trim(),
    mediaSource: String(pickFirstDefined_(row.mediaSource, row.media_source, row.sourceType, row.source_type, "")).trim(),
    storage_path: String(pickFirstDefined_(row.storage_path, row.storagePath, "")).trim(),
    storagePath: String(pickFirstDefined_(row.storagePath, row.storage_path, "")).trim(),
    source_url: String(pickFirstDefined_(row.source_url, row.sourceUrl, url)).trim(),
    sourceUrl: String(pickFirstDefined_(row.sourceUrl, row.source_url, url)).trim(),
    thumbnail_url: String(pickFirstDefined_(row.thumbnail_url, row.thumbnailUrl, row.file_url, row.fileUrl, url)).trim(),
    thumbnailUrl: String(pickFirstDefined_(row.thumbnailUrl, row.thumbnail_url, row.fileUrl, row.file_url, url)).trim(),
    campaign_name: String(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaign, "")).trim(),
    campaignName: String(pickFirstDefined_(row.campaignName, row.campaign_name, row.campaign, "")).trim(),
    linked_post_id: String(pickFirstDefined_(row.linked_post_id, row.linkedPostId, row.post_id, row.postId, "")).trim(),
    linkedPostId: String(pickFirstDefined_(row.linkedPostId, row.linked_post_id, row.postId, row.post_id, "")).trim(),
    linked_ai_draft_id: String(pickFirstDefined_(row.linked_ai_draft_id, row.linkedAiDraftId, row.ai_draft_id, row.aiDraftId, "")).trim(),
    linkedAiDraftId: String(pickFirstDefined_(row.linkedAiDraftId, row.linked_ai_draft_id, row.aiDraftId, row.ai_draft_id, "")).trim(),
    alt_text: String(pickFirstDefined_(row.alt_text, row.altText, "")).trim(),
    altText: String(pickFirstDefined_(row.altText, row.alt_text, "")).trim(),
    status: String(pickFirstDefined_(row.status, row.asset_status, row.assetStatus, "")).trim()
  });
}

function normalizeAiDraftRow_(row) {
  row = Object.assign({}, row || {});
  var aiDraftId = String(pickFirstDefined_(row.ai_draft_id, row.aiDraftId, row.id, "")).trim();
  var fullOutput = String(firstNonEmpty_(
    row.generated_output,
    row.generatedOutput,
    row.generated_outputs,
    row.generatedOutputs,
    row.output,
    row.response,
    row.message,
    row.content,
    row.full_text,
    row.fullText,
    row.fullOutput
  )).trim();
  var draftText = String(firstNonEmpty_(
    row.draft_text,
    row.draftText,
    row.final_text,
    row.finalText,
    row.finalPost,
    row.caption,
    fullOutput
  )).trim();
  var title = deriveDraftTitle_(row);
  return Object.assign({}, row, {
    ai_draft_id: aiDraftId,
    aiDraftId: aiDraftId,
    id: row.id || aiDraftId,
    title: title,
    draft_title: String(pickFirstDefined_(row.draft_title, row.draftTitle, title)).trim() || title,
    generated_output: fullOutput,
    generatedOutput: fullOutput,
    draft_text: draftText,
    draftText: draftText,
    campaign_name: String(pickFirstDefined_(row.campaign_name, row.campaignName, "")).trim(),
    campaignName: String(pickFirstDefined_(row.campaignName, row.campaign_name, "")).trim(),
    campaign_id: String(pickFirstDefined_(row.campaign_id, row.campaignId, "")).trim(),
    campaignId: String(pickFirstDefined_(row.campaignId, row.campaign_id, "")).trim(),
    source_id: String(pickFirstDefined_(row.source_id, row.sourceId, row.source_artifact_ids, row.sourceArtifactIds, "")).trim(),
    sourceId: String(pickFirstDefined_(row.sourceId, row.source_id, row.sourceArtifactIds, row.source_artifact_ids, "")).trim(),
    source_type: String(pickFirstDefined_(row.source_type, row.sourceType, "")).trim(),
    sourceType: String(pickFirstDefined_(row.sourceType, row.source_type, "")).trim(),
    parent_artifact_id: String(pickFirstDefined_(row.parent_artifact_id, row.parentArtifactId, "")).trim(),
    parentArtifactId: String(pickFirstDefined_(row.parentArtifactId, row.parent_artifact_id, "")).trim(),
    root_artifact_id: String(pickFirstDefined_(row.root_artifact_id, row.rootArtifactId, row.parent_artifact_id, row.parentArtifactId, "")).trim(),
    rootArtifactId: String(pickFirstDefined_(row.rootArtifactId, row.root_artifact_id, row.parentArtifactId, row.parent_artifact_id, "")).trim(),
    derived_from_ids: String(pickFirstDefined_(row.derived_from_ids, row.derivedFromIds, row.source_artifact_ids, row.sourceArtifactIds, "")).trim(),
    derivedFromIds: String(pickFirstDefined_(row.derivedFromIds, row.derived_from_ids, row.sourceArtifactIds, row.source_artifact_ids, "")).trim(),
    media_ids: String(pickFirstDefined_(row.media_ids, row.mediaIds, "")).trim(),
    mediaIds: String(pickFirstDefined_(row.mediaIds, row.media_ids, "")).trim(),
    performance_context: String(pickFirstDefined_(row.performance_context, row.performanceContext, "")).trim(),
    performanceContext: String(pickFirstDefined_(row.performanceContext, row.performance_context, "")).trim(),
    analysis_mode: String(pickFirstDefined_(row.analysis_mode, row.analysisMode, "")).trim(),
    analysisMode: String(pickFirstDefined_(row.analysisMode, row.analysis_mode, "")).trim(),
    created_post_id: String(pickFirstDefined_(row.created_post_id, row.createdPostId, "")).trim(),
    createdPostId: String(pickFirstDefined_(row.createdPostId, row.created_post_id, "")).trim(),
    status: String(pickFirstDefined_(row.status, row.draft_status, row.draftStatus, "needs_review")).trim() || "needs_review"
  });
}

function normalizeInspoRow_(row) {
  row = Object.assign({}, row || {});
  var inspoId = String(pickFirstDefined_(row.inspo_id, row.inspoId, row.id, "")).trim();
  var summary = String(pickFirstDefined_(row.summary, row.description, row.create_post_description, row.createPostDescription, "")).trim();

  var rawTitle = pickFirstDefined_(
    row.inspo_title,
    row.source_title,
    row.title,
    row.headline,
    row.link_title,
    row.page_title,
    row.imported_title,
    row.description,
    row.summary,
    row.notes,
    domainFromUrl_(row.source_url || row.url),
    ""
  );
  var title = String(rawTitle).trim();
  if (!title || /^untitled(\s+inspo)?$/i.test(title)) {
    title = "Untitled inspo";
  }

  var inspoTitle = title;
  var sourceTitle = String(pickFirstDefined_(row.source_title, row.link_title, row.page_title, row.imported_title, row.title, "")).trim();

  return Object.assign({}, row, {
    inspo_id: inspoId,
    inspoId: inspoId,
    id: row.id || inspoId,
    title: title,
    inspo_title: inspoTitle,
    source_title: sourceTitle,
    link_title: String(pickFirstDefined_(row.link_title, "")).trim(),
    page_title: String(pickFirstDefined_(row.page_title, "")).trim(),
    imported_title: String(pickFirstDefined_(row.imported_title, "")).trim(),
    headline: String(pickFirstDefined_(row.headline, "")).trim(),
    description: String(pickFirstDefined_(row.description, row.summary, "")).trim(),
    summary: summary,
    notes: String(pickFirstDefined_(row.notes, "")).trim(),
    url: String(pickFirstDefined_(row.url, row.source_url, "")).trim(),
    source_url: String(pickFirstDefined_(row.source_url, row.url, "")).trim(),
    campaign_name: String(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaign, "")).trim(),
    campaignName: String(pickFirstDefined_(row.campaignName, row.campaign_name, row.campaign, "")).trim(),
    pillar: String(pickFirstDefined_(row.pillar, row.suggested_pillar, "")).trim(),
    created_at: String(pickFirstDefined_(row.created_at, row.createdAt, "")).trim(),
    updated_at: String(pickFirstDefined_(row.updated_at, row.updatedAt, "")).trim(),
    linked_post_id: String(pickFirstDefined_(row.linked_post_id, row.linkedPostId, row.converted_post_id, row.convertedPostId, "")).trim(),
    linkedPostId: String(pickFirstDefined_(row.linkedPostId, row.linked_post_id, row.convertedPostId, row.converted_post_id, "")).trim(),
    linked_ai_draft_id: String(pickFirstDefined_(row.linked_ai_draft_id, row.linkedAiDraftId, row.source_ai_draft_id, row.sourceAiDraftId, "")).trim(),
    linkedAiDraftId: String(pickFirstDefined_(row.linkedAiDraftId, row.linked_ai_draft_id, row.sourceAiDraftId, row.source_ai_draft_id, "")).trim()
  });
}

function normalizePostSchemaAliases_(row) {
  row = Object.assign({}, row || {});
  if (!row.postId && row.post_id) row.postId = row.post_id;
  if (!row.post_type && row.format) row.post_type = row.format;
  if (!row.postType && row.post_type) row.postType = row.post_type;
  if (!row.queue_date_label && row.publish_date) row.queue_date_label = row.publish_date;
  if (!row.queueDateLabel && row.queue_date_label) row.queueDateLabel = row.queue_date_label;
  if (!row.queue_time_label && row.publish_time) row.queue_time_label = row.publish_time;
  if (!row.queueTimeLabel && row.queue_time_label) row.queueTimeLabel = row.queue_time_label;
  if (!row.requires_manual_review && row.needs_manual_review !== undefined) row.requires_manual_review = row.needs_manual_review;
  return row;
}

function writePostObjectToRow_(sheet, rowNumber, post) {
  const headers = getHeaders_(sheet).map(normalizeHeader_);
  const formulas = getFormulaRowSafe_(sheet, rowNumber, headers.length);
  const row = headers.map(function(header, index) {
    if (isPostFormulaHeader_(header) && formulas[index]) return formulas[index];
    if (Object.prototype.hasOwnProperty.call(post, header)) return post[header];
    return "";
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

function upsertPostObjectById_(sheet, post) {
  const postId = String(post && (post.post_id || post.postId || post.id) || "").trim();
  if (!postId) throw new Error("Missing post_id");
  const byIdRow = findRowByNormalizedHeaderValue_(sheet, ["post_id", "postId"], postId);
  const requestedRow = Number(post._rowNumber || post.rowNumber || post.row_number || post.sheetRow || post.sheet_row || 0);
  let targetRow = byIdRow > 0 ? byIdRow : -1;
  if (targetRow < 0 && requestedRow >= 2 && requestedRow <= sheet.getLastRow()) {
    const headers = getHeaders_(sheet).map(normalizeHeader_);
    const rowValues = sheet.getRange(requestedRow, 1, 1, headers.length).getValues()[0] || [];
    const rowObject = {};
    headers.forEach(function(header, index) {
      if (header) rowObject[header] = rowValues[index];
    });
    const rowPostId = String(rowObject.post_id || rowObject.postId || "").trim();
    if (!rowPostId || rowPostId === postId) {
      targetRow = requestedRow;
    } else {
      throw new Error("Row fallback refused: row " + requestedRow + " belongs to " + rowPostId + ", not " + postId + ".");
    }
  }
  if (targetRow < 0) targetRow = Math.max(sheet.getLastRow() + 1, 2);
  writePostObjectToRow_(sheet, targetRow, Object.assign({}, post, {
    post_id: postId,
    postId: postId
  }));
  SpreadsheetApp.flush();
  return targetRow;
}

function toColumnLetter_(columnIndex) {
  var letter = "";
  var col = Number(columnIndex || 0);
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - rem - 1) / 26);
  }
  return letter;
}

function postColumnRange_(headerMap, header) {
  var columnIndex = headerMap[normalizeHeader_(header)];
  if (!columnIndex) return "";
  var letter = toColumnLetter_(columnIndex);
  return letter + "2:" + letter;
}

function buildPostFormulaDefinitions_(headerMap) {
  var formulas = {};
  function add(target, requiredSources, builder) {
    if (!headerMap[normalizeHeader_(target)]) return;
    var refs = {};
    for (var i = 0; i < requiredSources.length; i += 1) {
      refs[requiredSources[i]] = postColumnRange_(headerMap, requiredSources[i]);
      if (!refs[requiredSources[i]]) return;
    }
    formulas[target] = builder(refs);
  }

  add("slug", ["title"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.title + '="",,LOWER(REGEXREPLACE(' + ref.title + ',"[^A-Za-z0-9]+","-"))))';
  });
  add("platform_key", ["platform"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.platform + '="",,LOWER(REGEXREPLACE(' + ref.platform + ',"[^A-Za-z0-9]+","_"))))';
  });
  add("campaign_key", ["campaign_name"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.campaign_name + '="",,LOWER(REGEXREPLACE(' + ref.campaign_name + ',"[^A-Za-z0-9]+","_"))))';
  });
  add("pillar_key", ["pillar"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.pillar + '="",,LOWER(REGEXREPLACE(' + ref.pillar + ',"[^A-Za-z0-9]+","_"))))';
  });
  add("content_key", ["description"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.description + '="",,LOWER(REGEXREPLACE(LEFT(' + ref.description + ',80),"[^A-Za-z0-9]+","_"))))';
  });
  add("scheduled_at", ["publish_date", "publish_time"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,' + ref.publish_date + '+IF(' + ref.publish_time + '="",0,' + ref.publish_time + ')))';
  });
  add("calendar_month", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,TEXT(' + ref.publish_date + ',"mmmm")))';
  });
  add("calendar_year", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,YEAR(' + ref.publish_date + ')))';
  });
  add("calendar_day", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,DAY(' + ref.publish_date + ')))';
  });
  add("week_start", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,' + ref.publish_date + '-WEEKDAY(' + ref.publish_date + ',2)+1))';
  });
  add("month_key", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,TEXT(' + ref.publish_date + ',"yyyy-mm")))';
  });
  add("day_of_week", ["publish_date"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.publish_date + '="",,TEXT(' + ref.publish_date + ',"dddd")))';
  });
  add("character_count", ["description"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.description + '="",,LEN(' + ref.description + ')))';
  });

  var metricRefs = ["likes", "comments", "shares", "saves", "clicks"].map(function(header) {
    return postColumnRange_(headerMap, header);
  }).filter(Boolean);
  if (headerMap.engagement_total && metricRefs.length) {
    var titleRef = postColumnRange_(headerMap, "title") || postColumnRange_(headerMap, "post_id");
    formulas.engagement_total = '=ARRAYFORMULA(IF(' + titleRef + '="",,' + metricRefs.map(function(ref) {
      return "N(" + ref + ")";
    }).join("+") + "))";
  }
  if (headerMap.engagement_rate && headerMap.engagement_total) {
    var impressionsRef = postColumnRange_(headerMap, "impressions") || postColumnRange_(headerMap, "reach");
    var engagementTotalRef = postColumnRange_(headerMap, "engagement_total");
    if (impressionsRef && engagementTotalRef) {
      formulas.engagement_rate = '=ARRAYFORMULA(IF(' + impressionsRef + '="",,IFERROR(' + engagementTotalRef + '/' + impressionsRef + ',0)))';
    }
  }
  if (headerMap.save_rate) {
    var savesRef = postColumnRange_(headerMap, "saves");
    var saveBaseRef = postColumnRange_(headerMap, "impressions") || postColumnRange_(headerMap, "reach");
    if (savesRef && saveBaseRef) {
      formulas.save_rate = '=ARRAYFORMULA(IF(' + saveBaseRef + '="",,IFERROR(' + savesRef + '/' + saveBaseRef + ',0)))';
    }
  }
  if (headerMap.click_rate) {
    var clicksRef = postColumnRange_(headerMap, "clicks");
    var clickBaseRef = postColumnRange_(headerMap, "impressions") || postColumnRange_(headerMap, "reach");
    if (clicksRef && clickBaseRef) {
      formulas.click_rate = '=ARRAYFORMULA(IF(' + clickBaseRef + '="",,IFERROR(' + clicksRef + '/' + clickBaseRef + ',0)))';
    }
  }
  add("needs_manual_review", ["publish_date", "platform", "campaign_name", "pillar", "description"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.description + '="",,IF((' + ref.publish_date + '="")+(' + ref.platform + '="")+(' + ref.campaign_name + '="")+(' + ref.pillar + '="")+(' + ref.description + '=""),TRUE,FALSE)))';
  });
  add("formula_status", ["title"], function(ref) {
    return '=ARRAYFORMULA(IF(' + ref.title + '="",,"OK"))';
  });
  return formulas;
}

function rebuildPostFormulas() {
  const sheet = getPostsSheet_();
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { updatedRows: 0, formulasApplied: [] };
  const formulas = buildPostFormulaDefinitions_(headerMap);
  Object.keys(formulas).forEach(function(header) {
    const columnIndex = headerMap[normalizeHeader_(header)];
    if (columnIndex) sheet.getRange(2, columnIndex).setFormula(formulas[header]);
  });
  return { updatedRows: lastRow - 1, formulasApplied: Object.keys(formulas) };
}

function validatePostSchema() {
  const sheet = getPostsSheet_();
  const headerMap = requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  const formulaHeadersPresent = POST_FORMULA_HEADERS.filter(function(header) {
    return !!headerMap[normalizeHeader_(header)];
  });
  return {
    ok: true,
    sheetName: sheet.getName(),
    requiredHeaders: REQUIRED_POST_HEADERS,
    formulaHeadersPresent: formulaHeadersPresent,
    rowCount: Math.max(sheet.getLastRow() - 1, 0)
  };
}

function getPostMappingDiagnostics() {
  const sheet = getPostsSheet_();
  const headerMap = requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  const rawRows = getPostsData_().slice(0, 5);
  const mappedPosts = getPosts().slice(0, 5).map(function(post) {
    return {
      postId: post.postId,
      title: post.title,
      description: post.description,
      campaignName: post.campaignName,
      pillar: post.pillar,
      platform: post.platform,
      publishDate: post.publishDate,
      status: post.status
    };
  });
  return {
    ok: true,
    sheetName: sheet.getName(),
    headerMapKeys: Object.keys(headerMap).filter(function(key, index, list) {
      return list.indexOf(key) === index;
    }).sort(),
    rawRows: rawRows,
    mappedPosts: mappedPosts
  };
}

function getCoreSchemaConfig_() {
  return {
    posts: { sheetKey: "posts", requiredHeaders: REQUIRED_POST_HEADERS, formulaHeaders: POST_FORMULA_HEADERS },
    notes: { sheetKey: "notes", requiredHeaders: REQUIRED_NOTE_HEADERS, formulaHeaders: NOTE_FORMULA_HEADERS },
    aiDrafts: { sheetKey: "aiDrafts", requiredHeaders: REQUIRED_AI_DRAFT_HEADERS, formulaHeaders: AI_DRAFT_FORMULA_HEADERS },
    media: { sheetKey: "media", requiredHeaders: REQUIRED_MEDIA_HEADERS, formulaHeaders: MEDIA_FORMULA_HEADERS },
    inspo: { sheetKey: "inspo", requiredHeaders: REQUIRED_INSPO_HEADERS, formulaHeaders: INSPO_FORMULA_HEADERS },
    campaign: { sheetKey: "campaign", requiredHeaders: REQUIRED_CAMPAIGN_HEADERS, formulaHeaders: CAMPAIGN_FORMULA_HEADERS }
  };
}

function validateCoreSchema() {
  var config = getCoreSchemaConfig_();
  var result = {
    ok: true,
    missingSheets: [],
    missingHeaders: {},
    formulaHeadersPresent: {},
    sheetOrder: []
  };
  var ss = getSpreadsheet_();
  result.sheetOrder = ss.getSheets().map(function(sheet) { return sheet.getName(); });
  Object.keys(config).forEach(function(key) {
    var check = config[key];
    var sheet = findExistingSheet_(check.sheetKey);
    if (!sheet) {
      result.ok = false;
      result.missingSheets.push(key);
      result.missingHeaders[key] = check.requiredHeaders.slice();
      result.formulaHeadersPresent[key] = [];
      return;
    }
    var map = getHeaderMap_(sheet);
    var missing = (check.requiredHeaders || []).filter(function(header) {
      return !map[normalizeHeader_(header)];
    });
    if (missing.length) result.ok = false;
    result.missingHeaders[key] = missing;
    result.formulaHeadersPresent[key] = (check.formulaHeaders || []).filter(function(header) {
      return !!map[normalizeHeader_(header)];
    });
  });
  return result;
}

function rebuildFormulaColumns_(sheetKey, formulaHeaders) {
  var sheet = getCoreSheet_(sheetKey);
  var headerMap = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { updatedRows: 0, formulasApplied: [], missingSourceFormulas: [] };
  var formulasApplied = [];
  var missingSourceFormulas = [];
  (formulaHeaders || []).forEach(function(header) {
    var columnIndex = headerMap[normalizeHeader_(header)];
    if (!columnIndex) return;
    var sourceFormula = String(sheet.getRange(2, columnIndex).getFormula() || "").trim();
    if (!sourceFormula) {
      missingSourceFormulas.push(header);
      return;
    }
    sheet.getRange(2, columnIndex).setFormula(sourceFormula);
    formulasApplied.push(header);
  });
  return {
    updatedRows: lastRow - 1,
    formulasApplied: formulasApplied,
    missingSourceFormulas: missingSourceFormulas,
    manualMigrationRequired: missingSourceFormulas.length > 0
  };
}

function rowCellRef_(headerMap, header, rowNumber) {
  var columnIndex = headerMap[normalizeHeader_(header)];
  if (!columnIndex) return "";
  return toColumnLetter_(columnIndex) + rowNumber;
}

function sheetColumnRangeByHeader_(sheetName, headerMap, header) {
  var columnIndex = headerMap[normalizeHeader_(header)];
  if (!columnIndex) return "";
  return "'" + sheetName.replace(/'/g, "''") + "'!$" + toColumnLetter_(columnIndex) + ":$" + toColumnLetter_(columnIndex);
}

function normalizeKeyFormula_(ref) {
  if (!ref) return '""';
  return 'LOWER(REGEXREPLACE(TRIM(' + ref + '),"[^A-Za-z0-9]+","_"))';
}

function buildAiDraftFormulaForRow_(header, headerMap, rowNumber) {
  var h = normalizeHeader_(header);
  var aiDraftId = rowCellRef_(headerMap, "ai_draft_id", rowNumber);
  var title = rowCellRef_(headerMap, "title", rowNumber);
  var draftText = rowCellRef_(headerMap, "draft_text", rowNumber);
  var prompt = rowCellRef_(headerMap, "prompt", rowNumber);
  var campaignName = rowCellRef_(headerMap, "campaign_name", rowNumber);
  var sourceArtifactIds = rowCellRef_(headerMap, "source_artifact_ids", rowNumber);
  var sourceIds = rowCellRef_(headerMap, "source_ids", rowNumber);
  var sourceId = rowCellRef_(headerMap, "source_id", rowNumber);
  var sourceType = rowCellRef_(headerMap, "source_type", rowNumber);
  var transformationType = rowCellRef_(headerMap, "transformation_type", rowNumber);
  var generationMode = rowCellRef_(headerMap, "generation_mode", rowNumber);
  var postType = rowCellRef_(headerMap, "post_type", rowNumber);
  var ideaId = rowCellRef_(headerMap, "idea_id", rowNumber);
  var artifactId = rowCellRef_(headerMap, "artifact_id", rowNumber);
  var createdPostId = rowCellRef_(headerMap, "created_post_id", rowNumber);
  var targetCampaignId = rowCellRef_(headerMap, "target_campaign_id", rowNumber);
  var campaignId = rowCellRef_(headerMap, "campaign_id", rowNumber);
  var parentArtifactId = rowCellRef_(headerMap, "parent_artifact_id", rowNumber);
  var postsSheet = getOptionalCoreSheet_("posts");
  var mediaSheet = getOptionalCoreSheet_("media");
  var postsMap = postsSheet ? getHeaderMap_(postsSheet) : {};
  var mediaMap = mediaSheet ? getHeaderMap_(mediaSheet) : {};
  var postsCampaign = sheetColumnRangeByHeader_(postsSheet ? postsSheet.getName() : "POSTS", postsMap, "campaign_name");
  var postsEngagement = sheetColumnRangeByHeader_(postsSheet ? postsSheet.getName() : "POSTS", postsMap, "engagement_total");
  var postsRate = sheetColumnRangeByHeader_(postsSheet ? postsSheet.getName() : "POSTS", postsMap, "engagement_rate");
  var postsTitle = sheetColumnRangeByHeader_(postsSheet ? postsSheet.getName() : "POSTS", postsMap, "title");
  var mediaAssetId = sheetColumnRangeByHeader_(mediaSheet ? mediaSheet.getName() : "MEDIA", mediaMap, "asset_id");
  var mediaLinkedPost = sheetColumnRangeByHeader_(mediaSheet ? mediaSheet.getName() : "MEDIA", mediaMap, "linked_post_id");
  var mediaCampaign = sheetColumnRangeByHeader_(mediaSheet ? mediaSheet.getName() : "MEDIA", mediaMap, "campaign");
  var mediaImportedSource = sheetColumnRangeByHeader_(mediaSheet ? mediaSheet.getName() : "MEDIA", mediaMap, "imported_media_source");
  var mediaSourceUrl = sheetColumnRangeByHeader_(mediaSheet ? mediaSheet.getName() : "MEDIA", mediaMap, "source_url");

  function blankGuard(expr) {
    var guard = aiDraftId || title || draftText || prompt;
    return guard ? '=IF(' + guard + '="","",' + expr + ')' : "=" + expr;
  }
  function firstNonBlank(refs) {
    refs = (refs || []).filter(Boolean);
    if (!refs.length) return '""';
    var expr = refs[refs.length - 1];
    for (var i = refs.length - 2; i >= 0; i -= 1) {
      expr = 'IF(' + refs[i] + '<>"",' + refs[i] + ',' + expr + ')';
    }
    return expr;
  }
  function textJoinRefs(refs, delimiter) {
    refs = (refs || []).filter(Boolean);
    return 'TEXTJOIN("' + (delimiter || ",") + '",TRUE,' + (refs.length ? refs.join(",") : '""') + ')';
  }

  if (h === "campaign_id") return blankGuard(campaignName ? 'IF(' + campaignName + '="","",' + normalizeKeyFormula_(campaignName) + ')' : '""');
  if (h === "target_campaign_id") return blankGuard(campaignName ? 'IF(' + campaignName + '="","",' + normalizeKeyFormula_(campaignName) + ')' : firstNonBlank([campaignId]));
  if (h === "generated_campaign_id") return blankGuard(firstNonBlank([targetCampaignId, campaignId]));
  if (h === "source_id") return blankGuard(firstNonBlank([sourceArtifactIds, sourceIds, ideaId, artifactId]));
  if (h === "parent_artifact_id") return blankGuard(firstNonBlank([sourceArtifactIds, artifactId, sourceIds, ideaId, aiDraftId]));
  if (h === "root_artifact_id") return blankGuard(firstNonBlank([parentArtifactId, sourceArtifactIds, artifactId, sourceIds, ideaId, aiDraftId]));
  if (h === "analysis_mode") {
    var modeText = textJoinRefs([generationMode, postType, transformationType, sourceType], " ");
    return blankGuard('IF(REGEXMATCH(LOWER(' + modeText + '),"rewrite|repurpose|transform|transformation"),"transformation",IF(REGEXMATCH(LOWER(' + modeText + '),"review|critique|audit"),"review",IF(REGEXMATCH(LOWER(' + modeText + '),"draft"),"draft_review",IF(REGEXMATCH(LOWER(' + modeText + '),"generate|new|create"),"generation","draft_review"))))');
  }
  if (h === "derived_from_ids") return blankGuard(textJoinRefs([sourceId, ideaId, sourceIds, sourceArtifactIds, parentArtifactId], ","));
  if (h === "media_ids" && mediaAssetId) {
    var mediaConditions = [];
    if (createdPostId && mediaLinkedPost) mediaConditions.push('(' + mediaLinkedPost + '=' + createdPostId + ')');
    if (campaignName && mediaCampaign) mediaConditions.push('(' + mediaCampaign + '=' + campaignName + ')');
    if (sourceArtifactIds && mediaImportedSource) mediaConditions.push('(' + mediaImportedSource + '=' + sourceArtifactIds + ')');
    if (sourceArtifactIds && mediaSourceUrl) mediaConditions.push('(' + mediaSourceUrl + '=' + sourceArtifactIds + ')');
    return blankGuard(mediaConditions.length ? 'IFERROR(TEXTJOIN(",",TRUE,FILTER(' + mediaAssetId + ',(' + mediaConditions.join("+") + ')>0)),"")' : '""');
  }
  if (h === "performance_context") {
    if (!campaignName || !postsCampaign) return blankGuard('""');
    var countExpr = 'COUNTIF(' + postsCampaign + ',' + campaignName + ')';
    var avgEngagement = postsEngagement ? 'IFERROR(ROUND(AVERAGEIF(' + postsCampaign + ',' + campaignName + ',' + postsEngagement + '),2),"")' : '""';
    var avgRate = postsRate ? 'IFERROR(ROUND(AVERAGEIF(' + postsCampaign + ',' + campaignName + ',' + postsRate + '),4),"")' : '""';
    var bestTitle = postsTitle && postsEngagement ? 'IFERROR(INDEX(SORT(FILTER({' + postsTitle + ',' + postsEngagement + '},' + postsCampaign + '=' + campaignName + '),2,FALSE),1,1),"")' : '""';
    return blankGuard('"posts:"&' + countExpr + '&" | avg engagement:"&' + avgEngagement + '&" | avg rate:"&' + avgRate + '&IF(' + bestTitle + '<>""," | best post:"&' + bestTitle + ',"")');
  }
  if (h === "semantic_summary") return blankGuard('LEFT(' + firstNonBlank([draftText, prompt, title]) + ',240)');
  if (h === "recurring_pattern_flags") return blankGuard('IF(REGEXMATCH(LOWER(' + firstNonBlank([draftText, prompt]) + '),"again|recurring|series|repeat"),"recurring_pattern","")');
  if (h === "anti_pattern_flags") return blankGuard('IF(REGEXMATCH(LOWER(' + firstNonBlank([draftText, prompt]) + '),"viral|hack|guaranteed|must-read"),"review_language","")');
  return "";
}

function rebuildAiDraftFormulas() {
  var sheet = getCoreSheet_("aiDrafts");
  var headerMap = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { updatedRows: 0, formulasApplied: [], missingSourceFormulas: [] };
  var formulasApplied = [];
  var skipped = [];
  AI_DRAFT_FORMULA_HEADERS.forEach(function(header) {
    var columnIndex = headerMap[normalizeHeader_(header)];
    if (!columnIndex) return;
    var formulas = [];
    for (var rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      formulas.push([buildAiDraftFormulaForRow_(header, headerMap, rowNumber)]);
    }
    var nonEmpty = formulas.some(function(row) { return String(row[0] || "").trim(); });
    if (!nonEmpty) {
      skipped.push(header);
      return;
    }
    sheet.getRange(2, columnIndex, lastRow - 1, 1).setFormulas(formulas);
    formulasApplied.push(header);
  });
  return {
    updatedRows: lastRow - 1,
    formulasApplied: formulasApplied,
    missingSourceFormulas: skipped,
    rowSafe: true
  };
}

function rebuildNotesFormulas() {
  return rebuildFormulaColumns_("notes", NOTE_FORMULA_HEADERS);
}

function rebuildMediaFormulas() {
  return rebuildFormulaColumns_("media", MEDIA_FORMULA_HEADERS);
}

function rebuildInspoFormulas() {
  return rebuildFormulaColumns_("inspo", INSPO_FORMULA_HEADERS);
}

function rebuildAllSchemaFormulas() {
  return {
    posts: rebuildPostFormulas(),
    aiDrafts: rebuildAiDraftFormulas(),
    notes: rebuildNotesFormulas(),
    media: rebuildMediaFormulas(),
    inspo: rebuildInspoFormulas(),
    validatedAt: new Date().toISOString()
  };
}

function migrateSheetOrderAndHeaders() {
  var desiredOrder = [SHEETS.POSTS, SHEETS.NOTES, SHEETS.AI_DRAFTS, SHEETS.MEDIA, SHEETS.INSPO];
  var schema = validateCoreSchema();
  var currentOrder = schema.sheetOrder || [];
  var desiredPresent = desiredOrder.every(function(name) {
    return currentOrder.indexOf(name) !== -1;
  });
  var alreadyOrdered = desiredPresent && desiredOrder.every(function(name, index) {
    return currentOrder[index] === name;
  });
  return {
    ok: alreadyOrdered && schema.ok,
    applied: false,
    manualMigrationRequired: !alreadyOrdered || !schema.ok,
    reason: "Safe automatic sheet reordering/header migration is not applied by gpe_code.gs. Reorder tabs manually and keep existing formulas intact.",
    desiredLeadingOrder: desiredOrder,
    currentOrder: currentOrder,
    schema: schema
  };
}

function deleteRowByAliases_(sheet, headerNames, keyValue) {
  for (var i = 0; i < headerNames.length; i += 1) {
    var rowIndex = findRowByHeaderValue_(sheet, headerNames[i], keyValue);
    if (rowIndex > 1) {
      sheet.deleteRow(rowIndex);
      return;
    }
  }
}

function createPostId_() {
  return "post_" + Utilities.getUuid();
}

function createAssetId_() {
  return "AST-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createInspoId_() {
  return "INSP-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createNoteId_() {
  return "NOTE-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createFlowEventId_() {
  return "FLOW-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function normalizeFlowState_(entityType, value, fallback) {
  var normalized = String(value || fallback || "").trim().toLowerCase();
  var allowed = {
    note: { active: true, converted_to_inspo: true, converted_to_post: true, archived: true },
    inspo: { active: true, drafted: true, converted_to_post: true, archived: true },
    post: { draft: true, scheduled: true, published: true, archived: true }
  }[String(entityType || "").trim().toLowerCase()] || {};
  if (allowed[normalized]) return normalized;
  if (entityType === "note") return "active";
  if (entityType === "inspo") return "active";
  if (entityType === "post") return String(fallback || "draft").trim().toLowerCase() || "draft";
  return normalized || String(fallback || "").trim().toLowerCase();
}

function derivePostFlowState_(status) {
  var normalized = String(status || "").trim().toLowerCase();
  if (normalized === "published") return "published";
  if (normalized === "scheduled") return "scheduled";
  if (normalized === "archived") return "archived";
  return "draft";
}

function buildFlowTrackingFields_(payload, existing, options) {
  options = options || {};
  var entityType = String(options.entityType || "post").trim().toLowerCase();
  var defaultFlow = entityType === "post" ? derivePostFlowState_(pickFirstDefined_(payload && payload.status, existing && existing.status, "draft")) : "active";
  return {
    sourceNoteId: String(pickFirstDefined_(payload && payload.sourceNoteId, payload && payload.source_note_id, payload && payload.createdFromNoteId, payload && payload.created_from_note_id, existing && existing.source_note_id, existing && existing.created_from_note_id, existing && existing.createdFromNoteId, "")).trim(),
    sourceInspoId: String(pickFirstDefined_(payload && payload.sourceInspoId, payload && payload.source_inspo_id, payload && payload.createdFromInspoId, payload && payload.created_from_inspo_id, existing && existing.source_inspo_id, existing && existing.created_from_inspo_id, existing && existing.createdFromInspoId, "")).trim(),
    sourceAiDraftId: String(pickFirstDefined_(payload && payload.sourceAiDraftId, payload && payload.source_ai_draft_id, payload && payload.aiSourceId, payload && payload.ai_source_id, existing && existing.source_ai_draft_id, "")).trim(),
    sourceImportJobId: String(pickFirstDefined_(payload && payload.sourceImportJobId, payload && payload.source_import_job_id, payload && payload.importJobId, payload && payload.import_job_id, existing && existing.source_import_job_id, existing && existing.import_job_id, "")).trim(),
    createdFromFlow: String(pickFirstDefined_(payload && payload.createdFromFlow, payload && payload.created_from_flow, existing && existing.created_from_flow, "")).trim(),
    movedToPostAt: String(pickFirstDefined_(payload && payload.movedToPostAt, payload && payload.moved_to_post_at, existing && existing.moved_to_post_at, "")).trim(),
    archivedAt: String(pickFirstDefined_(payload && payload.archivedAt, payload && payload.archived_at, existing && existing.archived_at, "")).trim(),
    flowState: normalizeFlowState_(entityType, pickFirstDefined_(payload && payload.flowState, payload && payload.flow_state, existing && existing.flow_state, existing && existing.status, defaultFlow), defaultFlow)
  };
}

function inferCreatedFromFlow_(tracking, payload, existing) {
  if (tracking.createdFromFlow) return tracking.createdFromFlow;
  if (tracking.sourceNoteId) return "note_to_post";
  if (tracking.sourceInspoId) return "inspo_to_post";
  if (tracking.sourceAiDraftId) return "ai_draft_to_post";
  if (tracking.sourceImportJobId) return "linkedin_import";
  var sourceType = String(pickFirstDefined_(payload && payload.sourceType, payload && payload.source_type, existing && existing.source_type, "")).trim().toLowerCase();
  if (sourceType === "calendar_plan") return "calendar_plan";
  if (sourceType) return sourceType;
  return "manual";
}

function logFlowEvent_(action, entityType, sourceId, targetId, result, errors, details) {
  try {
    var sheet = ensureSheet_("flowEventLog", FLOW_EVENT_HEADERS);
    appendObjectRowByHeaders_(sheet, {
      event_id: createFlowEventId_(),
      timestamp: new Date().toISOString(),
      action: String(action || "").trim(),
      entity_type: String(entityType || "").trim(),
      source_id: String(sourceId || "").trim(),
      target_id: String(targetId || "").trim(),
      result: String(result || "").trim(),
      errors: String(errors || "").trim(),
      details_json: details ? JSON.stringify(details) : ""
    });
  } catch (_) {}
}

function getFlowEventLog_(limit) {
  var rows = getObjectsFromSheet_(ensureSheet_("flowEventLog", FLOW_EVENT_HEADERS));
  return rows
    .map(function(row) {
      return {
        eventId: String(row.event_id || "").trim(),
        timestamp: String(row.timestamp || "").trim(),
        action: String(row.action || "").trim(),
        entityType: String(row.entity_type || "").trim(),
        sourceId: String(row.source_id || "").trim(),
        targetId: String(row.target_id || "").trim(),
        result: String(row.result || "").trim(),
        errors: String(row.errors || "").trim(),
        details: parseJsonSafe_(String(row.details_json || "").trim()) || {}
      };
    })
    .sort(function(a, b) {
      return parseSheetDate_(b.timestamp) - parseSheetDate_(a.timestamp);
    })
    .slice(0, Math.max(1, Number(limit || 50) || 50));
}

function setLastRebuildTimestamp_(key) {
  setScriptProp_("LAST_REBUILD_" + String(key || "").trim().toUpperCase(), new Date().toISOString());
}

function getLastRebuildTimestamps_() {
  return {
    ledger: getScriptProp_("LAST_REBUILD_LEDGER"),
    calendar: getScriptProp_("LAST_REBUILD_CALENDAR"),
    constellation: getScriptProp_("LAST_REBUILD_CONSTELLATION"),
    queue: getScriptProp_("LAST_REBUILD_QUEUE")
  };
}

function createCampaignId_() {
  return "CMP-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createImportJobId_() {
  return "JOB-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createImportJobItemId_() {
  return "JIT-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createDeterministicCampaignId_(campaignName) {
  var normalized = normalizeCampaignLookup_(campaignName).replace(/[^a-z0-9]+/g, "").toUpperCase();
  if (!normalized) return createCampaignId_();
  return "CMP-" + normalized.slice(0, 8);
}

function normalizeStatus_(value) {
  const v = String(value || "").toLowerCase();
  if (v.indexOf("publish") !== -1) return "published";
  if (v.indexOf("schedule") !== -1) return "scheduled";
  return "draft";
}

function cloneSettingsDefaults_() {
  return {
    platforms: SETTINGS_DEFAULTS.platforms.slice(),
    pillars: SETTINGS_DEFAULTS.pillars.slice(),
    statuses: SETTINGS_DEFAULTS.statuses.slice(),
    postTypes: SETTINGS_DEFAULTS.postTypes.slice(),
    campaigns: SETTINGS_DEFAULTS.campaigns.slice(),
    campaignColors: Object.assign({}, SETTINGS_DEFAULTS.campaignColors),
    months: SETTINGS_DEFAULTS.months.slice(),
    queueLimit: SETTINGS_DEFAULTS.queueLimit,
    currentMonth: SETTINGS_DEFAULTS.currentMonth,
    currentYear: SETTINGS_DEFAULTS.currentYear,
    mediaFolderId: SETTINGS_DEFAULTS.mediaFolderId
  };
}

function normalizeSettingKey_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

function normalizeKey_(value) {
  return normalizeHeader_(value);
}

function logCampaignFinalSource_(detail) {
  detail = detail || {};
  console.log("[campaign-final-source]", {
    finalCampaignName: detail.finalCampaignName || detail.finalName || "",
    sourceFunction: detail.sourceFunction || "",
    sourceSheet: detail.sourceSheet || "",
    sourceRow: detail.sourceRow || "",
    sourcePostId: detail.sourcePostId || "",
    rawValue: detail.rawValue || "",
    parsedParts: Array.isArray(detail.parsedParts) ? detail.parsedParts : [],
    retainedReason: detail.retainedReason || ""
  });
}

function discardCampaignNameFragments_(names, sourceFunction, sourceSheet) {
  names = Array.isArray(names) ? names : [];
  return names.filter(function(name) {
    var raw = normalizeCampaignDisplayName_(name);
    var key = normalizeKey_(raw);
    if (!key) return false;
    var parentNames = names.filter(function(other) {
      var parent = normalizeCampaignDisplayName_(other);
      if (parent === raw || parent.indexOf(",") === -1) return false;
      return normalizeKey_(parent).indexOf(key) !== -1;
    });
    if (!parentNames.length) {
      logCampaignFinalSource_({
        finalCampaignName: raw,
        sourceFunction: sourceFunction || "discardCampaignNameFragments_",
        sourceSheet: sourceSheet || "",
        rawValue: raw,
        parsedParts: splitExplicitCampaignValues_(raw),
        retainedReason: "retained"
      });
      return true;
    }
    logCampaignFinalSource_({
      finalCampaignName: raw,
      sourceFunction: sourceFunction || "discardCampaignNameFragments_",
      sourceSheet: sourceSheet || "",
      rawValue: raw,
      parsedParts: splitExplicitCampaignValues_(raw),
      retainedReason: "discarded fragment of " + parentNames.join(", ")
    });
    return false;
  });
}

function getAllowedCampaignNames_() {
  if (getAllowedCampaignNames_._cache) return getAllowedCampaignNames_._cache.slice();
  var sheet = getSheet_("SETTINGS");
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var values = sheet.getRange(1, 12, lastRow, 1).getValues().flat();
  var allowed = values
    .map(function(value) { return String(value || "").trim(); })
    .filter(function(value) { return value && !/^campaigns?$/i.test(value); })
    .filter(function(value, index, list) {
      var key = normalizeKey_(value);
      return key && list.findIndex(function(item) { return normalizeKey_(item) === key; }) === index;
    });
  allowed = discardCampaignNameFragments_(allowed, "getAllowedCampaignNames_", "SETTINGS!L:L");
  getAllowedCampaignNames_._cache = allowed.slice();
  return allowed;
}

function normalizePlatform_(value) {
  var normalized = normalizeSettingKey_(value);
  if (normalized === "linkedin") return "linkedin";
  if (normalized === "instagram") return "instagram";
  if (normalized === "both") return "both";
  return "";
}

function normalizePostType_(value) {
  var normalized = normalizeSettingKey_(value);
  var allowed = {
    image: "image",
    carousel: "carousel",
    video: "video",
    article: "article",
    text: "text",
    poll: "poll"
  };
  return allowed[normalized] || "";
}

function normalizeCampaignDisplayName_(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitExplicitCampaignValues_(value) {
  return String(value || "")
    .split(/[|\n]/)
    .map(function(item) {
      return normalizeCampaignDisplayName_(item);
    })
    .filter(Boolean);
}

function normalizeCampaignName_(value) {
  var raw = normalizeCampaignDisplayName_(value);
  if (!raw) return "";
  return resolveCampaignName_(raw, getAllowedCampaignNames_());
}

function resolveCampaignName_(rawCampaignName, campaignRecords, options) {
  var raw = normalizeCampaignDisplayName_(rawCampaignName);
  console.log("[campaign-parse] raw", raw);
  if (!raw) return "";
  var records = Array.isArray(campaignRecords) ? campaignRecords : [];
  var names = records.map(function(campaign) {
    return typeof campaign === "string"
      ? String(campaign || "").trim()
      : String(campaign && (campaign.campaignName || campaign.campaign_name || campaign.name) || "").trim();
  }).filter(Boolean);
  console.log("[campaign-parse] canonical campaigns", names);
  var girlTakeActionKey = normalizeKey_("Girl, Take Action");
  var rawKey = normalizeKey_(raw);
  if (raw === "Girl, Take Action") {
    console.log("[campaign-parse] exact Girl, Take Action preserved", "Girl, Take Action");
    return "Girl, Take Action";
  }
  var exactMatch = names.find(function(name) { return name === raw; });
  if (exactMatch) {
    console.log("[campaign-parse] exact match", exactMatch);
    if (normalizeKey_(exactMatch) === girlTakeActionKey) {
      console.log("[campaign-parse] exact Girl, Take Action preserved", exactMatch);
    }
    return exactMatch;
  }
  var normalizedMatch = names.find(function(name) { return normalizeKey_(name) === rawKey; });
  if (normalizedMatch) {
    console.log("[campaign-parse] normalized match", normalizedMatch);
    if (normalizeKey_(normalizedMatch) === girlTakeActionKey) {
      console.log("[campaign-parse] exact Girl, Take Action preserved", normalizedMatch);
    }
    return normalizedMatch;
  }
  if (rawKey === girlTakeActionKey) {
    console.log("[campaign-parse] removed overbroad girl take action fallback", raw);
    return raw;
  }
  var explicitMulti = Boolean(options && options.allowMulti) && (Array.isArray(rawCampaignName) || /[|\n]/.test(String(rawCampaignName || "")));
  if (raw.indexOf(",") !== -1 && !explicitMulti) {
    console.log("[campaign-parse] comma preserved", raw);
    return raw;
  }
  if (explicitMulti) {
    var parts = splitExplicitCampaignValues_(rawCampaignName);
    console.log("[campaign-parse] split explicit delimiter only", parts);
    return parts[0] || raw;
  }
  console.log("[campaign-parse] unknown preserved", raw);
  return raw;
}

function normalizeCampaignLookup_(value) {
  return normalizeSettingKey_(resolveCampaignName_(value, getAllowedCampaignNames_()));
}

function buildCampaignColorMap_(source) {
  var map = Object.assign({}, SETTINGS_DEFAULTS.campaignColors);
  Object.keys(source || {}).forEach(function(key) {
    var campaignName = normalizeCampaignName_(key);
    var colorValue = String(source[key] || "").trim();
    if (!campaignName || !colorValue) return;
    map[campaignName] = colorValue;
  });
  return map;
}

function getCampaignColorFromSettings_(campaignName, settings) {
  var normalizedName = normalizeCampaignName_(campaignName);
  if (!normalizedName) return "";
  var colorMap = buildCampaignColorMap_((settings || getSettingsRegistry()).campaignColors || {});
  return String(colorMap[normalizedName] || "").trim();
}

function normalizePillar_(value, fallback, pillarList) {
  var normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return fallback === undefined ? "" : normalizePillar_(fallback);
  }

  var list = pillarList || null;
  if (!list || !list.length) {
    try { var s = getSettingsRegistry(); list = s && s.pillars; } catch (e) { list = null; }
  }
  if (Array.isArray(list) && list.length) {
    for (var i = 0; i < list.length; i++) {
      var p = typeof list[i] === "object" ? String(list[i].slug || list[i].name || "").trim().toLowerCase() : String(list[i] || "").trim().toLowerCase();
      if (p === normalized || normalized.indexOf(p) !== -1 || p.indexOf(normalized) !== -1) return typeof list[i] === "object" ? String(list[i].slug || list[i].name || "").trim().toLowerCase() : p;
    }
  }

  var canonicalMap = {
    iden: "identity",
    ident: "identity",
    identity: "identity",
    advocacy: "advocacy",
    wellness: "wellness",
    community: "community",
    leadership: "leadership",
    authority: "authority",
    distribution: "distribution",
    application: "application",
    education: "education",
    promotion: "promotion"
  };

  if (canonicalMap[normalized]) return canonicalMap[normalized];
  if (normalized.indexOf("advocacy") !== -1) return "advocacy";
  if (normalized.indexOf("wellness") !== -1) return "wellness";
  if (normalized.indexOf("community") !== -1) return "community";
  if (normalized.indexOf("leadership") !== -1) return "leadership";
  if (normalized.indexOf("identity") !== -1 || normalized === "iden" || normalized === "ident") return "identity";
  if (normalized.indexOf("author") !== -1) return "authority";
  if (normalized.indexOf("distribut") !== -1) return "distribution";
  if (normalized.indexOf("applic") !== -1) return "application";
  return fallback === undefined ? "" : normalizePillar_(fallback);
}

function pillarDisplayLabel_(value, fallback) {
  var canonical = normalizePillar_(value, fallback);
  if (!canonical) return "";
  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
}

function normalizeDateTime_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      getPlanningTimeZone_(),
      "yyyy-MM-dd'T'HH:mm"
    );
  }

  var parsedPlanning = parsePlanningDateForRepair_(value);
  if (parsedPlanning && !isNaN(parsedPlanning)) {
    return Utilities.formatDate(
      parsedPlanning,
      getPlanningTimeZone_(),
      "yyyy-MM-dd'T'HH:mm"
    );
  }

  const text = String(value).trim().replace(" ", "T");
  if (!text) return "";

  const localMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (localMatch) {
    return [
      localMatch[1],
      "-",
      localMatch[2],
      "-",
      localMatch[3],
      "T",
      localMatch[4] || "00",
      ":",
      localMatch[5] || "00"
    ].join("");
  }

  const parsed = new Date(text);
  if (!isNaN(parsed)) {
    return Utilities.formatDate(
      parsed,
      getPlanningTimeZone_(),
      "yyyy-MM-dd'T'HH:mm"
    );
  }

  return text;
}

function normalizeQueueDateLabel(value) {
  var dateKey = getPlanningDateKeyFromValue_(value) || parseDisplayDateKey_(value);
  if (!dateKey) {
    var parsed = parseSheetDate_(value);
    if (parsed && !isNaN(parsed)) dateKey = getLocalDateKey_(parsed);
  }
  if (!dateKey) return "";
  var parts = dateKey.split("-");
  return String(Number(parts[1])) + "/" + String(Number(parts[2])) + "/" + parts[0];
}

function formatQueueDateLabel(value) {
  return normalizeQueueDateLabel(value);
}

function normalizeQueueTimeLabel(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  var match = text.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (match) {
    var hours = Number(match[1]);
    var minutes = String(match[2]).padStart(2, "0");
    var meridiem = String(match[3] || "").toUpperCase();
    if (!meridiem) {
      meridiem = hours >= 12 ? "PM" : "AM";
      hours = hours % 24;
      hours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    }
    return String(hours) + ":" + minutes + " " + meridiem;
  }
  var parsed = parseSheetDate_(value);
  if (parsed && !isNaN(parsed)) return Utilities.formatDate(parsed, getPlanningTimeZone_(), "h:mm a");
  return "";
}

function hasUserSelectedTime(post) {
  var value = pickFirstDefined_(
    post && post.hasUserSelectedTime,
    post && post.has_user_selected_time,
    post && post.queue_time_label,
    post && post.queueTimeLabel
  );
  if (value === true || value === false) return value;
  return !!String(value || "").trim();
}

function buildScheduledAtFromPlanningFields(queueDateLabel, queueTimeLabel) {
  var normalizedDate = normalizeQueueDateLabel(queueDateLabel);
  if (!normalizedDate) return "";
  var dateKey = parseDisplayDateKey_(normalizedDate);
  if (!dateKey) return "";
  var timeLabel = normalizeQueueTimeLabel(queueTimeLabel) || "9:15 AM";
  var match = timeLabel.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return dateKey + "T09:15";
  var hour = Number(match[1]) % 12;
  if (String(match[3]).toUpperCase() === "PM") hour += 12;
  var minute = Number(match[2]);
  return dateKey + "T" + ("0" + hour).slice(-2) + ":" + ("0" + minute).slice(-2);
}

function normalizeScheduledAt(value, queueDateLabel, queueTimeLabel) {
  var fromPlanning = buildScheduledAtFromPlanningFields(queueDateLabel, queueTimeLabel);
  var normalized = normalizeDateTime_(value);
  if (!normalized) return fromPlanning;

  var dateKey = parseDisplayDateKey_(normalizeQueueDateLabel(queueDateLabel));
  var timeLabel = normalizeQueueTimeLabel(queueTimeLabel);
  if (!dateKey && !timeLabel) return normalized;

  var selectedTime = timeLabel || normalizeQueueTimeLabel(normalized);
  return buildScheduledAtFromPlanningFields(dateKey || normalized.slice(0, 10), selectedTime);
}

function normalizePostScheduleForWorkflow_(row) {
  row = row || {};
  row = normalizePostSchemaAliases_(row);
  var rawScheduledAt = String(pickFirstDefined_(row.scheduled_at, row.scheduledAt, row.publish_date, row.publishDate, row.date, "")).trim();
  var requestedStatus = normalizeStatus_(pickFirstDefined_(row.status, row.postStatus, "draft"));
  var publishedAt = String(pickFirstDefined_(row.published_at, row.publishedAt, "")).trim();
  var publishedUrl = String(pickFirstDefined_(row.published_url, row.publishedUrl, "")).trim();
  var queueDateLabelInput = String(pickFirstDefined_(row.queue_date_label, row.queueDateLabel, row.publish_date, row.publishDate, "")).trim();
  var queueTimeLabelInput = String(pickFirstDefined_(row.queue_time_label, row.queueTimeLabel, row.publish_time, row.publishTime, "")).trim();
  var hasSelectedTime = hasUserSelectedTime(row);
  var normalizedScheduledAt = rawScheduledAt ? normalizeScheduledAt(rawScheduledAt, queueDateLabelInput, queueTimeLabelInput) : "";
  var isScheduledValid = !!(normalizedScheduledAt && getPlanningDateKeyFromValue_(normalizedScheduledAt));
  var queueDateLabel = isScheduledValid ? normalizeQueueDateLabel(queueDateLabelInput || normalizedScheduledAt) : "";
  var queueTimeLabel = isScheduledValid && hasSelectedTime ? normalizeQueueTimeLabel(queueTimeLabelInput || normalizedScheduledAt) : "";
  var dateKey = isScheduledValid ? getPlanningDateKeyFromValue_(normalizedScheduledAt) : "";
  var workflowBucket = "draft";
  if (publishedAt || publishedUrl || requestedStatus === "published") {
    workflowBucket = "published";
  } else if (rawScheduledAt && !isScheduledValid) {
    workflowBucket = "invalid_schedule";
  } else if (normalizeBoolean_(pickFirstDefined_(row.requires_manual_review, row.requiresManualReview, false)) || String(pickFirstDefined_(row.ai_draft_status, row.aiDraftStatus, "")).trim().toLowerCase() === "needs_review") {
    workflowBucket = "needs_review";
  } else if (isScheduledValid) {
    workflowBucket = "scheduled";
  }
  var status = workflowBucket === "published"
    ? "published"
    : workflowBucket === "scheduled"
    ? "scheduled"
    : "draft";
  return {
    scheduledAt: isScheduledValid ? normalizedScheduledAt : "",
    status: status,
    queueDateLabel: queueDateLabel,
    queueTimeLabel: queueTimeLabel,
    dateKey: dateKey,
    isScheduledValid: isScheduledValid,
    workflowBucket: workflowBucket
  };
}

function getPostPlanningDateKey(post) {
  post = normalizePostSchemaAliases_(post);
  return getPlanningDateKeyFromValue_(pickFirstDefined_(post && post.scheduled_at, post && post.scheduledAt, post && post.publish_date, post && post.publishDate, post && post.date)) || parseDisplayDateKey_(pickFirstDefined_(
    post && post.queue_date_label,
    post && post.queueDateLabel,
    post && post.publish_date,
    post && post.publishDate,
    post && post.scheduledDateKey
  ));
}

function getPlanningCalendarParts_(queueDateLabel, scheduledAt) {
  var dateKey = parseDisplayDateKey_(normalizeQueueDateLabel(queueDateLabel)) || getPlanningDateKeyFromValue_(scheduledAt);
  if (!dateKey) return { calendarMonth: "", calendarYear: "", calendarDay: "" };
  var parts = dateKey.split("-");
  return {
    calendarMonth: String(Number(parts[1])),
    calendarYear: parts[0],
    calendarDay: String(Number(parts[2]))
  };
}

function normalizePlanningFields_(source, existing) {
  source = normalizePostSchemaAliases_(source);
  existing = normalizePostSchemaAliases_(existing);
  var sourceHasExplicitTimeSelection =
    !!(source && (
      Object.prototype.hasOwnProperty.call(source, "hasUserSelectedTime") ||
      Object.prototype.hasOwnProperty.call(source, "has_user_selected_time") ||
      Object.prototype.hasOwnProperty.call(source, "queueTimeLabel") ||
      Object.prototype.hasOwnProperty.call(source, "queue_time_label") ||
      Object.prototype.hasOwnProperty.call(source, "publishTime") ||
      Object.prototype.hasOwnProperty.call(source, "publish_time")
    ));
  var queueDateLabel = normalizeQueueDateLabel(pickFirstDefined_(
    source && source.scheduledAt,
    source && source.scheduled_at,
    source && source.publishDate,
    source && source.publish_date,
    source && source.date,
    existing && existing.scheduled_at,
    existing && existing.scheduledAt,
    existing && existing.publish_date,
    existing && existing.publishDate,
    source && source.queueDateLabel,
    source && source.queue_date_label,
    existing && existing.queue_date_label,
    existing && existing.queueDateLabel
  ));
  var queueTimeLabel = normalizeQueueTimeLabel(pickFirstDefined_(
    source && source.queueTimeLabel,
    source && source.queue_time_label,
    source && source.publishTime,
    source && source.publish_time,
    existing && existing.queue_time_label,
    existing && existing.queueTimeLabel,
    existing && existing.publish_time,
    existing && existing.publishTime
  ));
  var selectedTime = sourceHasExplicitTimeSelection ? hasUserSelectedTime(source) : (hasUserSelectedTime(source) || hasUserSelectedTime(existing));
  var scheduledAt = normalizeScheduledAt(
    pickFirstDefined_(
      source && source.scheduledAt,
      source && source.scheduled_at,
      source && source.publishDate,
      source && source.publish_date,
      source && source.date,
      existing && existing.scheduled_at,
      existing && existing.scheduledAt,
      existing && existing.publish_date,
      existing && existing.publishDate
    ),
    queueDateLabel,
    queueTimeLabel
  );
  if (!queueDateLabel && scheduledAt) queueDateLabel = normalizeQueueDateLabel(scheduledAt);
  if (!selectedTime) queueTimeLabel = "";
  var parts = getPlanningCalendarParts_(queueDateLabel, scheduledAt);
  return {
    queueDateLabel: queueDateLabel,
    queueTimeLabel: queueTimeLabel,
    scheduledAt: scheduledAt,
    calendarMonth: String(pickFirstDefined_(source && source.calendarMonth, source && source.calendar_month, existing && existing.calendar_month, parts.calendarMonth)).trim(),
    calendarYear: String(pickFirstDefined_(source && source.calendarYear, source && source.calendar_year, existing && existing.calendar_year, parts.calendarYear)).trim(),
    calendarDay: String(pickFirstDefined_(source && source.calendarDay, source && source.calendar_day, existing && existing.calendar_day, parts.calendarDay)).trim(),
    hasUserSelectedTime: !!selectedTime
  };
}

function getPlanningTimeZone_() {
  var tz = String(Session.getScriptTimeZone() || "").trim();
  return tz === "America/Chicago" ? tz : "America/Chicago";
}

function parseGoogleSheetsSerialDate_(value) {
  var serial = Number(value);
  if (!isFinite(serial) || serial < 25000) return null;
  var millis = Math.round((serial - 25569) * 86400 * 1000);
  var parsed = new Date(millis);
  return isNaN(parsed) ? null : parsed;
}

function parsePlanningDateForRepair_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) return value;

  var serialParsed = parseGoogleSheetsSerialDate_(value);
  if (serialParsed) return serialParsed;

  var parsedLocal = parseLocalDateTime_(value);
  if (parsedLocal) return parsedLocal;

  var text = String(value || "").trim();
  if (!text) return null;

  var isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 0, 0, 0, 0);
  }

  var slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    return new Date(Number(slashDate[3]), Number(slashDate[1]) - 1, Number(slashDate[2]), 0, 0, 0, 0);
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) return null;

  var parsed = new Date(text.replace(" ", "T"));
  return isNaN(parsed) ? null : parsed;
}

function parseSheetDate_(value) {
  if (!value) return null;
  return parsePlanningDateForRepair_(value);
}

function parseLocalDateTime_(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0),
    0
  );
}

function getLocalDateKey_(value) {
  const date = parseSheetDate_(value);
  if (!date || isNaN(date)) return "";
  return Utilities.formatDate(date, getPlanningTimeZone_(), "yyyy-MM-dd");
}

function getPlanningDateKeyFromValue_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, getPlanningTimeZone_(), "yyyy-MM-dd");
  }
  var text = String(value || "").trim();
  if (!text) return "";
  var datePart = text.indexOf("T") !== -1 ? text.split("T")[0] : text.split(" ")[0];
  var direct = parseDisplayDateKey_(datePart) || parseDisplayDateKey_(text);
  if (direct) return direct;
  var parsed = parsePlanningDateForRepair_(value);
  if (parsed && !isNaN(parsed)) {
    return Utilities.formatDate(parsed, getPlanningTimeZone_(), "yyyy-MM-dd");
  }
  return "";
}

function getStoredCalendarDateKey_(post) {
  var year = String(pickFirstDefined_(post && post.calendar_year, post && post.calendarYear, "")).trim();
  var month = String(pickFirstDefined_(post && post.calendar_month, post && post.calendarMonth, "")).trim();
  var day = String(pickFirstDefined_(post && post.calendar_day, post && post.calendarDay, "")).trim();
  if (!year || !month || !day) return "";
  return year + "-" + ("0" + Number(month)).slice(-2) + "-" + ("0" + Number(day)).slice(-2);
}

function parseDisplayDateKey_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
  var mdyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return mdyMatch[3] + "-" + ("0" + Number(mdyMatch[1])).slice(-2) + "-" + ("0" + Number(mdyMatch[2])).slice(-2);
  }
  return "";
}

function formatQueueDate_(value) {
  return formatQueueDateLabel(value);
}

function formatQueueTime_(value) {
  return normalizeQueueTimeLabel(value);
}

function detectAssetType_(mimeType, fileName) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();

  if (mime.indexOf("video") !== -1) return "video";
  if (mime === "application/pdf" || /officedocument|msword|presentation|spreadsheet|text\//.test(mime) || /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(name)) return "document";
  if (name.indexOf("carousel") !== -1) return "carousel";
  return "image";
}

function normalizeNumber_(value) {
  var text = String(value == null ? "" : value).trim().toLowerCase().replace(/,/g, "");
  var isPercent = text.slice(-1) === "%";
  if (isPercent) text = text.slice(0, -1);
  var multiplier = text.slice(-1) === "k" ? 1000 : text.slice(-1) === "m" ? 1000000 : 1;
  if (multiplier !== 1) text = text.slice(0, -1);
  const num = Number(text || 0);
  if (isPercent && isFinite(num)) return num / 100;
  if (multiplier !== 1 && isFinite(num)) return num * multiplier;
  return isFinite(num) ? num : 0;
}

function normalizeBoolean_(value) {
  if (value === true || value === false) return value;
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

function normalizeScalar_(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const num = Number(text);
    return String(num) === text || String(parseInt(text, 10)) === text ? num : text;
  }
  return text;
}

function pickFirstDefined_() {
  for (var i = 0; i < arguments.length; i += 1) {
    if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") return arguments[i];
  }
  return "";
}

function firstNonEmpty_() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length) return value;
      continue;
    }
    if (String(value).trim() !== "") return value;
  }
  return "";
}

function getSpreadsheet_() {
  var context = getCurrentWorkspaceRequestContext_();
  var requestSpreadsheetId = String(context.spreadsheetId || "").trim();
  if (requestSpreadsheetId && isGoogleSpreadsheetId_(requestSpreadsheetId)) {
    var requestSpreadsheet = SpreadsheetApp.openById(requestSpreadsheetId);
    LAST_SPREADSHEET_RESOLUTION_ = {
      source: "request_context",
      spreadsheetId: requestSpreadsheet.getId(),
      spreadsheetName: requestSpreadsheet.getName(),
      legacyScriptPropertiesUsed: false
    };
    return requestSpreadsheet;
  }

  try {
    var activeSpreadsheet = SpreadsheetApp.getActive();
    if (activeSpreadsheet) {
      LAST_SPREADSHEET_RESOLUTION_ = {
        source: "active_spreadsheet",
        spreadsheetId: activeSpreadsheet.getId(),
        spreadsheetName: activeSpreadsheet.getName(),
        legacyScriptPropertiesUsed: false
      };
      return activeSpreadsheet;
    }
  } catch (_) {}

  // legacy fallback: retained for older bound/script-property deployments only.
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID") || props.getProperty("SPREADSHEET_ID");
  if (id) {
    var legacySpreadsheet = SpreadsheetApp.openById(id);
    LAST_SPREADSHEET_RESOLUTION_ = {
      source: "legacy_script_properties",
      spreadsheetId: legacySpreadsheet.getId(),
      spreadsheetName: legacySpreadsheet.getName(),
      legacyScriptPropertiesUsed: true
    };
    return legacySpreadsheet;
  }
  throw new Error("No spreadsheet resolved. Pass spreadsheet_id from Supabase workspace_connections, bind the script to a Sheet, or configure legacy SHEET_ID/SPREADSHEET_ID.");
}

function getWorkspaceServerConfig_(payload) {
  payload = payload || {};
  var context = getWorkspaceRequestContext_(null, { payload: payload });
  var props = PropertiesService.getScriptProperties();
  var enabled = String(pickFirstDefined_(
    payload.supabase_media_enabled,
    payload.supabaseMediaEnabled,
    // legacy fallback: Supabase now owns workspace/client config.
    props.getProperty("SUPABASE_MEDIA_ENABLED"),
    WORKSPACE_SERVER_DEFAULTS.SUPABASE_MEDIA_ENABLED
  )).toLowerCase() === "true";
  return {
    WORKSPACE_ID: String(pickFirstDefined_(context.workspace_id, payload.workspace_id, payload.workspaceId, props.getProperty("WORKSPACE_ID"), WORKSPACE_SERVER_DEFAULTS.WORKSPACE_ID)).trim() || WORKSPACE_SERVER_DEFAULTS.WORKSPACE_ID,
    WORKSPACE_SLUG: String(pickFirstDefined_(context.workspace_slug, payload.workspace_slug, payload.workspaceSlug, props.getProperty("WORKSPACE_SLUG"), WORKSPACE_SERVER_DEFAULTS.WORKSPACE_SLUG)).trim() || WORKSPACE_SERVER_DEFAULTS.WORKSPACE_SLUG,
    SHEET_ID: String(pickFirstDefined_(context.spreadsheetId, payload.spreadsheet_id, payload.spreadsheetId, payload.sheet_id, payload.sheetId, props.getProperty("SHEET_ID"), props.getProperty("SPREADSHEET_ID"), WORKSPACE_SERVER_DEFAULTS.SHEET_ID)).trim(),
    // legacy fallback: Monday board id remains server-only/internal until Supabase owns it.
    MONDAY_BOARD_ID: String(pickFirstDefined_(payload.monday_board_id, payload.mondayBoardId, props.getProperty("MONDAY_BOARD_ID"), WORKSPACE_SERVER_DEFAULTS.MONDAY_BOARD_ID)).trim(),
    SUPABASE_MEDIA_ENABLED: enabled
  };
}

function normalizeWorkspacePostFields_(payload, existing) {
  payload = payload || {};
  existing = existing || {};
  var workspaceConfig = getWorkspaceServerConfig_(payload);
  return {
    workspace_id: String(pickFirstDefined_(payload.workspace_id, payload.workspaceId, existing.workspace_id, existing.workspaceId, workspaceConfig.WORKSPACE_ID)).trim(),
    media_id: String(pickFirstDefined_(payload.media_id, payload.mediaId, existing.media_id, existing.mediaId, "")).trim(),
    media_url: String(pickFirstDefined_(payload.media_url, payload.mediaUrl, existing.media_url, existing.mediaUrl, "")).trim(),
    media_type: String(pickFirstDefined_(payload.media_type, payload.mediaType, existing.media_type, existing.mediaType, "")).trim(),
    media_filename: String(pickFirstDefined_(payload.media_filename, payload.mediaFilename, existing.media_filename, existing.mediaFilename, "")).trim(),
    media_alt_text: String(pickFirstDefined_(payload.media_alt_text, payload.mediaAltText, existing.media_alt_text, existing.mediaAltText, "")).trim(),
    media_source: String(pickFirstDefined_(payload.media_source, payload.mediaSource, existing.media_source, existing.mediaSource, "")).trim(),
    storage_path: String(pickFirstDefined_(payload.storage_path, payload.storagePath, existing.storage_path, existing.storagePath, "")).trim(),
    monday_item_id: String(pickFirstDefined_(payload.monday_item_id, payload.mondayItemId, existing.monday_item_id, existing.mondayItemId, "")).trim(),
    monday_group_id: String(pickFirstDefined_(payload.monday_group_id, payload.mondayGroupId, existing.monday_group_id, existing.mondayGroupId, "")).trim(),
    monday_last_synced_at: String(pickFirstDefined_(payload.monday_last_synced_at, payload.mondayLastSyncedAt, existing.monday_last_synced_at, existing.mondayLastSyncedAt, "")).trim(),
    monday_sync_status: String(pickFirstDefined_(payload.monday_sync_status, payload.mondaySyncStatus, existing.monday_sync_status, existing.mondaySyncStatus, "")).trim()
  };
}

function getSetting_(key) {
  const sheet = getSheet_( "settings");
  if (!sheet) return "";

  const values = sheet.getDataRange().getValues();
  const target = String(key || "").trim();

  for (var r = 0; r < values.length; r += 1) {
    if (String(values[r][9] || "").trim() === target) {
      return String(values[r][10] || "").trim();
    }
  }

  for (var row = 0; row < values.length; row += 1) {
    for (var col = 0; col < values[row].length - 1; col += 1) {
      if (String(values[row][col] || "").trim() === target) {
        return String(values[row][col + 1] || "").trim();
      }
    }
  }

  return "";
}

function getPosts() {
  const settings = getSettingsRegistry();
  const defaultPillar = settings.pillars[0] || "advocacy";
  const campaignMap = buildCampaignMap_();
  const campaignNameMap = buildCampaignNameMap_();
  const campaignRecordsForResolver = Object.values(campaignMap).concat(Object.values(campaignNameMap));
  const mediaItems = getMedia();
  const rawRows = getPostsData_();
  console.log("[posts] sheet raw row count", rawRows.length);
  console.log("[campaign-audit] raw", rawRows.slice(0, 10).map(function(rawRow) {
    const row = normalizePostSchemaAliases_(rawRow);
    return {
      sourceRowId: String(row.row_number || "").trim(),
      sourcePostId: String(pickFirstDefined_(row.post_id, row.postId, row.id, "")).trim(),
      rawCampaignValue: normalizeCampaignDisplayName_(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaign, "")),
      sourceCampaignId: String(pickFirstDefined_(row.campaign_id, row.campaignID, "")).trim()
    };
  }));
  var droppedRows = [];
  const normalizedPosts = rawRows.map(function(rawRow) {
    const row = normalizePostSchemaAliases_(rawRow);
    const title = derivePostTitle_(row);
    const rawCampaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID));
    const rawCampaignName = String(pickFirstDefined_(row.campaign_name, row.campaignName)).trim();
    const resolvedCampaignName = resolveCampaignName_(rawCampaignName, campaignRecordsForResolver, { allowMulti: /[|\n]/.test(String(rawCampaignName || "")) });
    const matchedCampaign = campaignMap[String(rawCampaignId || "")] || campaignNameMap[normalizeCampaignLookup_(rawCampaignName)] || null;
    const campaignId = rawCampaignId || (matchedCampaign && matchedCampaign.campaignId) || "";
    console.log("[campaign-parse] resolved", {
      raw: rawCampaignName,
      resolved: resolvedCampaignName || rawCampaignName || "",
      campaignId: campaignId || "",
      postId: String(pickFirstDefined_(row.post_id, row.postId, row.id, row.row_number || "")).trim()
    });
    const planning = normalizePlanningFields_(row, row);
    const scheduledAt = planning.scheduledAt;
    const hubPillarLabel = pillarDisplayLabel_(
      pickFirstDefined_(row.hub_pillar_label, row.hubPillarLabel, row.pillar, matchedCampaign && matchedCampaign.pillar),
      matchedCampaign && matchedCampaign.pillar
    );
    const fallbackPostId = row.row_number ? "row_" + String(row.row_number).trim() : "";
    const postId = String(pickFirstDefined_(row.post_id, row.postId, row.id, fallbackPostId)).trim();
    const canonicalPillar = normalizePillar_(
      pickFirstDefined_(row.pillar, row.hub_pillar_label, row.hubPillarLabel, matchedCampaign && matchedCampaign.pillar),
      matchedCampaign && matchedCampaign.pillar || defaultPillar
    ) || defaultPillar;
    const carouselAssetIds = parseAssetIdList_(pickFirstDefined_(row.carousel_asset_ids, row.carouselAssetIds));
    const linkedAssets = getAssetsForPost_({
      postId: postId,
      assetId: String(pickFirstDefined_(row.asset_id, row.assetId)).trim(),
      carouselAssetIds: carouselAssetIds
    }, mediaItems);
    const queueDateLabel = planning.queueDateLabel;
    const scheduledDateKey = getPostPlanningDateKey({
      queue_date_label: queueDateLabel,
      scheduled_at: scheduledAt
    });

    return normalizePostRow_(Object.assign({}, row, {
      postId: postId,
      platforms: parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform)),
      platform: String(pickFirstDefined_(row.platform, "")).trim() || (parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform))[0] || "linkedin"),
      postType: String(pickFirstDefined_(row.post_type, row.postType, row.format, "text")).trim() || "text",
      pillar: canonicalPillar,
      scheduledAt: scheduledAt,
      status: normalizeStatus_(pickFirstDefined_(row.status, row.post_status, row.postStatus, "draft")),
      description: String(pickFirstDefined_(row.description, row.caption, row.body)).trim(),
      assetId: String(pickFirstDefined_(row.asset_id, row.assetId)).trim(),
      hubTitle: String(pickFirstDefined_(row.hub_title, row.hubTitle, row.title)).trim(),
      hubPillarLabel: hubPillarLabel,
      queueDateLabel: queueDateLabel,
      queueTimeLabel: planning.queueTimeLabel,
      publishDate: String(pickFirstDefined_(row.publish_date, row.publishDate, queueDateLabel)).trim(),
      publishTime: String(pickFirstDefined_(row.publish_time, row.publishTime, planning.queueTimeLabel)).trim(),
      format: String(pickFirstDefined_(row.format, row.post_type, row.postType, "text")).trim() || "text",
      calendarMonth: planning.calendarMonth,
      calendarYear: planning.calendarYear,
      calendarDay: planning.calendarDay,
      ledgerExcerpt: String(pickFirstDefined_(row.ledger_excerpt, row.ledgerExcerpt)).trim(),
      constellationMeta: String(pickFirstDefined_(row.constellation_meta, row.constellationMeta)).trim(),
      mediaLabel: String(pickFirstDefined_(row.media_label, row.mediaLabel)).trim(),
      createdFromInspoId: String(pickFirstDefined_(row.created_from_inspo_id, row.createdFromInspoId)).trim(),
      createdFromNoteId: String(pickFirstDefined_(row.created_from_note_id, row.createdFromNoteId)).trim(),
      sourceNoteId: String(pickFirstDefined_(row.source_note_id, row.created_from_note_id, row.createdFromNoteId)).trim(),
      sourceInspoId: String(pickFirstDefined_(row.source_inspo_id, row.created_from_inspo_id, row.createdFromInspoId)).trim(),
      sourceAiDraftId: String(pickFirstDefined_(row.source_ai_draft_id, row.ai_source_id, row.aiSourceId)).trim(),
      sourceImportJobId: String(pickFirstDefined_(row.source_import_job_id, row.import_job_id, row.importJobId)).trim(),
      createdFromFlow: String(pickFirstDefined_(row.created_from_flow)).trim(),
      movedToPostAt: String(pickFirstDefined_(row.moved_to_post_at)).trim(),
      archivedAt: String(pickFirstDefined_(row.archived_at)).trim(),
      flowState: normalizeFlowState_("post", pickFirstDefined_(row.flow_state, row.status, "draft"), "draft"),
      campaignId: campaignId,
      campaign_name: rawCampaignName,
      campaignName: resolvedCampaignName || rawCampaignName || "",
      notes: String(row.notes || "").trim(),
      impressions: normalizeNumber_(row.impressions),
      reach: normalizeNumber_(row.reach),
      likes: normalizeNumber_(row.likes),
      comments: normalizeNumber_(row.comments),
      shares: normalizeNumber_(row.shares),
      saves: normalizeNumber_(row.saves),
      clicks: normalizeNumber_(row.clicks),
      engagementRate: normalizeNumber_(pickFirstDefined_(row.engagement_rate, row.engagementRate)),
      sourceUrl: String(pickFirstDefined_(row.source_url, row.sourceUrl)).trim(),
      sourceType: String(pickFirstDefined_(row.source_type, row.sourceType)).trim(),
      sourcePlatform: String(pickFirstDefined_(row.source_platform, row.sourcePlatform)).trim(),
      sourceTitle: String(pickFirstDefined_(row.source_title, row.sourceTitle)).trim(),
      sourceMetadata: String(pickFirstDefined_(row.source_metadata, row.sourceMetadata)).trim(),
      sourceImportStatus: String(pickFirstDefined_(row.source_import_status, row.sourceImportStatus)).trim(),
      importedAt: String(pickFirstDefined_(row.imported_at, row.importedAt)).trim(),
      importJobId: String(pickFirstDefined_(row.import_job_id, row.importJobId)).trim(),
      originalPostDate: String(pickFirstDefined_(row.original_post_date, row.originalPostDate)).trim(),
      originalPostDateLabel: String(pickFirstDefined_(row.original_post_date_label, row.originalPostDateLabel)).trim(),
      dateConfidence: String(pickFirstDefined_(row.date_confidence, row.dateConfidence)).trim(),
      linkedinPostId: String(pickFirstDefined_(row.linkedin_post_id, row.linkedinPostId)).trim(),
      normalizedTextHash: String(pickFirstDefined_(row.normalized_text_hash, row.normalizedTextHash)).trim(),
      isRepost: normalizeBoolean_(pickFirstDefined_(row.is_repost, row.isRepost)),
      repostAuthor: String(pickFirstDefined_(row.repost_author, row.repostAuthor)).trim(),
      repostCommentary: String(pickFirstDefined_(row.repost_commentary, row.repostCommentary)).trim(),
      originalAuthor: String(pickFirstDefined_(row.original_author, row.originalAuthor)).trim(),
      originalPostExcerpt: String(pickFirstDefined_(row.original_post_excerpt, row.originalPostExcerpt)).trim(),
      platform_targets: parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform)),
      platforms: parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform)),
      platformTargets: parsePlatformTargets_(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform)),
      publishStatus: String(pickFirstDefined_(row.publish_status, row.publishStatus)).trim() || "draft",
      publishedUrl: String(pickFirstDefined_(row.published_url, row.publishedUrl)).trim(),
      publishedAt: String(pickFirstDefined_(row.published_at, row.publishedAt)).trim(),
      apiPostId: String(pickFirstDefined_(row.api_post_id, row.apiPostId)).trim(),
      apiError: String(pickFirstDefined_(row.api_error, row.apiError)).trim(),
      platformCaptionOverride: String(pickFirstDefined_(row.platform_caption_override, row.platformCaptionOverride)).trim(),
      platformCharacterCount: normalizeNumber_(pickFirstDefined_(row.platform_character_count, row.platformCharacterCount)),
      requiresManualReview: normalizeBoolean_(pickFirstDefined_(row.requires_manual_review, row.requiresManualReview)),
      carouselAssetIds: carouselAssetIds,
      aiSourceType: String(pickFirstDefined_(row.ai_source_type, row.aiSourceType)).trim(),
      aiSourceId: String(pickFirstDefined_(row.ai_source_id, row.aiSourceId)).trim(),
      aiPrompt: String(pickFirstDefined_(row.ai_prompt, row.aiPrompt)).trim(),
      aiGenerationMode: String(pickFirstDefined_(row.ai_generation_mode, row.aiGenerationMode)).trim(),
      aiBrandFrameworkVersion: String(pickFirstDefined_(row.ai_brand_framework_version, row.aiBrandFrameworkVersion)).trim(),
      aiDraftStatus: String(pickFirstDefined_(row.ai_draft_status, row.aiDraftStatus)).trim(),
      aiReviewNotes: String(pickFirstDefined_(row.ai_review_notes, row.aiReviewNotes)).trim(),
      hasUserSelectedTime: planning.hasUserSelectedTime,
      carouselAssets: linkedAssets.map(function(asset) {
        return {
          assetId: asset.assetId,
          assetName: asset.assetName,
          fileUrl: asset.fileUrl,
          sourceUrl: asset.sourceUrl,
          assetType: asset.assetType
        };
      }),
      scheduledDateKey: scheduledDateKey,
      dateDiagnostics: buildDateDiagnostics_(scheduledAt, scheduledDateKey, queueDateLabel, planning.queueTimeLabel, planning.hasUserSelectedTime)
    }, semanticFieldsFromRow_(row)));
  });
  var filteredPosts = normalizedPosts.filter(function(post) {
    var hasVisibleContent = !!String(pickFirstDefined_(
      post && post.title,
      post && post.description,
      post && post.caption,
      post && post.body,
      post && post.content,
      post && post.publishDate,
      post && post.publishTime,
      post && post.queueDateLabel,
      post && post.queueTimeLabel,
      post && post.scheduledAt,
      post && post.campaignName,
      post && post.platform,
      ""
    )).trim();
    if (!hasVisibleContent) {
      droppedRows.push({
        row_number: post && post.row_number || post && post.rowNumber || "",
        reason: "blank_after_normalize",
        title: post && post.title || "",
        description: post && post.description || "",
        campaignName: post && post.campaignName || "",
        status: post && post.status || "",
        platform: post && post.platform || "",
        scheduledAt: post && post.scheduledAt || "",
        publishDate: post && post.publishDate || "",
        queueDateLabel: post && post.queueDateLabel || ""
      });
    }
    return true;
  });
  filteredPosts.sort(function(a, b) {
    var bDate = parseSheetDate_(pickFirstDefined_(b && b.scheduledAt, b && b.publishDate, b && b.date, "")) || new Date(0);
    var aDate = parseSheetDate_(pickFirstDefined_(a && a.scheduledAt, a && a.publishDate, a && a.date, "")) || new Date(0);
    var delta = bDate.getTime() - aDate.getTime();
    if (delta !== 0) return delta;
    return Number(pickFirstDefined_(b && b.row_number, b && b.rowNumber, 0)) - Number(pickFirstDefined_(a && a.row_number, a && a.rowNumber, 0));
  });
  console.log("[posts] normalized row count", filteredPosts.length);
  console.log("[posts] dropped blank-normalize rows count", droppedRows.length);
  console.log("[posts] last 10 posts", filteredPosts.slice(0, 10).map(function(post) {
    return {
      row_number: pickFirstDefined_(post && post.row_number, post && post.rowNumber, ""),
      post_id: pickFirstDefined_(post && post.postId, post && post.post_id, ""),
      title: pickFirstDefined_(post && post.title, post && post.description, ""),
      publish_date: pickFirstDefined_(post && post.publishDate, post && post.publish_date, ""),
      publish_time: pickFirstDefined_(post && post.publishTime, post && post.publish_time, ""),
      scheduled_at: pickFirstDefined_(post && post.scheduledAt, post && post.scheduled_at, ""),
      campaign_name: pickFirstDefined_(post && post.campaignName, ""),
      status: pickFirstDefined_(post && post.status, ""),
      platform: pickFirstDefined_(post && post.platform, "")
    };
  }));
  console.log("[posts] dropped rows with reason", droppedRows.map(function(d) {
    return {
      row_number: d.row_number,
      reason: d.reason,
      title: d.title || "",
      campaign_name: d.campaignName || "",
      status: d.status || "",
      platform: d.platform || ""
    };
  }));
  console.log("[campaign-audit] normalized", filteredPosts.slice(0, 10).map(function(post) {
    return {
      sourceRowId: String(post.row_number || "").trim(),
      sourcePostId: String(post.postId || "").trim(),
      rawCampaignValue: normalizeCampaignDisplayName_(post.campaign_name || post.campaignName || ""),
      normalizedCampaignValue: normalizeCampaignDisplayName_(post.campaignName || ""),
      campaignValuesAfterParsing: splitExplicitCampaignValues_(post.campaignName || post.campaign_name || "")
    };
  }));
  console.log("[campaign-audit] fragments", filteredPosts.filter(function(post) {
    return splitExplicitCampaignValues_(post.campaignName || post.campaign_name || "").length > 1;
  }).map(function(post) {
    return {
      sourceRowId: String(post.row_number || "").trim(),
      sourcePostId: String(post.postId || "").trim(),
      campaignValuesAfterParsing: splitExplicitCampaignValues_(post.campaignName || post.campaign_name || "")
    };
  }));
  return filteredPosts;
}

function getMedia() {
  const sheet = getCoreSheet_("media");
  return getRowsByNormalizedHeaders_(sheet, REQUIRED_MEDIA_HEADERS).map(function(row) {
    return normalizeMediaRow_(Object.assign({}, row, {
      assetId: String(row.asset_id || "").trim(),
      assetName: String(row.asset_name || "").trim(),
      assetType: String(row.asset_type || "").trim(),
      assetBadge: String(row.asset_badge || "").trim(),
      assetMeta: String(row.asset_meta || "").trim(),
      linkedPostId: String(row.linked_post_id || "").trim(),
      assetStatus: String(row.asset_status || "").trim(),
      placeholderIcon: String(row.placeholder_icon || "").trim(),
      fileUrl: String(row.file_url || "").trim(),
      campaign: String(row.campaign || "").trim(),
      notes: String(row.notes || "").trim(),
      driveFileId: String(row.drive_file_id || "").trim(),
      sourceUrl: String(row.source_url || "").trim(),
      sourceType: String(row.source_type || "").trim(),
      mimeType: String(row.mime_type || "").trim(),
      fileSizeBytes: normalizeNumber_(row.file_size_bytes),
      originalFilename: String(row.original_filename || "").trim(),
      importedMediaSource: String(row.imported_media_source || "").trim(),
      createdAt: String(row.created_at || "").trim(),
      updatedAt: String(row.updated_at || "").trim()
    }, semanticFieldsFromRow_(row)));
  }).filter(function(asset) {
    return asset.assetId || asset.assetName || asset.title;
  });
}

function getInspo(includeInactive) {
  const sheet = getCoreSheet_("inspo");
  return getRowsByNormalizedHeaders_(sheet, REQUIRED_INSPO_HEADERS).map(function(row) {
    return normalizeInspoRow_(Object.assign({}, row, {
      inspoId: String(row.inspo_id || "").trim(),
      inspoType: String(row.inspo_type || "").trim(),
      title: String(row.title || "").trim(),
      inspoTitle: String(row.inspo_title || row.inspoTItle || "").trim(),
      sourceTitle: String(row.source_title || row.sourceTitle || "").trim(),
      linkTitle: String(row.link_title || row.linkTitle || "").trim(),
      pageTitle: String(row.page_title || row.pageTitle || "").trim(),
      importedTitle: String(row.imported_title || row.importedTitle || "").trim(),
      headline: String(row.headline || "").trim(),
      description: String(row.description || "").trim(),
      url: String(row.url || "").trim(),
      sourceUrl: String(row.source_url || row.sourceUrl || "").trim(),
      sourceLabel: String(row.source_label || "").trim(),
      summary: String(row.summary || "").trim(),
      domainOrMeta: String(row.domain_or_meta || "").trim(),
      suggestedPlatform: String(row.suggested_platform || "").trim(),
      suggestedPillar: normalizePillar_(row.suggested_pillar, SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
      createPostTitle: String(row.create_post_title || "").trim(),
      createPostDescription: String(row.create_post_description || "").trim(),
      createPostType: String(row.create_post_type || "").trim(),
      notes: String(row.notes || "").trim(),
      status: String(row.status || "active").trim() || "active",
      campaignName: String(row.campaign_name || row.campaignName || row.campaign || "").trim(),
      pillar: String(row.pillar || row.suggested_pillar || "").trim(),
      createdAt: String(row.created_at || row.createdAt || "").trim(),
      updatedAt: String(row.updated_at || row.updatedAt || "").trim(),
      convertedPostId: String(row.converted_post_id || "").trim(),
      sourceNoteId: String(row.source_note_id || "").trim(),
      sourceInspoId: String(row.source_inspo_id || "").trim(),
      sourceAiDraftId: String(row.source_ai_draft_id || "").trim(),
      sourceImportJobId: String(row.source_import_job_id || "").trim(),
      createdFromFlow: String(row.created_from_flow || "").trim(),
      movedToPostAt: String(row.moved_to_post_at || "").trim(),
      archivedAt: String(row.archived_at || "").trim(),
      flowState: normalizeFlowState_("inspo", pickFirstDefined_(row.flow_state, row.status, "active"), "active")
    }, semanticFieldsFromRow_(row)));
  }).filter(function(item) {
    if (!(item.inspoId || item.title)) return false;
    if (includeInactive) return true;
    return item.status !== "converted" && item.status !== "archived" && item.flowState !== "converted_to_post" && item.flowState !== "archived";
  });
}

function getNotes() {
  const sheet = getCoreSheet_("notes");
  return getRowsByNormalizedHeaders_(sheet, REQUIRED_NOTE_HEADERS).map(function(row) {
    return normalizeNoteRow_(Object.assign({}, row, {
      noteId: String(pickFirstDefined_(row.note_id, row.noteId)).trim(),
      title: String(pickFirstDefined_(row.title)).trim(),
      body: String(pickFirstDefined_(row.body, row.summary, row.description)).trim(),
      bullets: parseBulletLines_(pickFirstDefined_(row.bullets)),
      suggestedPlatform: String(pickFirstDefined_(row.suggested_platform, row.suggestedPlatform)).trim() || "linkedin",
      suggestedPillar: normalizePillar_(pickFirstDefined_(row.suggested_pillar, row.suggestedPillar), SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
      status: String(pickFirstDefined_(row.status, "active")).trim() || "active",
      convertedPostId: String(pickFirstDefined_(row.converted_post_id, row.convertedPostId)).trim(),
      sourceNoteId: String(pickFirstDefined_(row.source_note_id, row.note_id, row.noteId)).trim(),
      sourceInspoId: String(pickFirstDefined_(row.source_inspo_id)).trim(),
      sourceAiDraftId: String(pickFirstDefined_(row.source_ai_draft_id)).trim(),
      sourceImportJobId: String(pickFirstDefined_(row.source_import_job_id)).trim(),
      createdFromFlow: String(pickFirstDefined_(row.created_from_flow)).trim(),
      movedToPostAt: String(pickFirstDefined_(row.moved_to_post_at)).trim(),
      archivedAt: String(pickFirstDefined_(row.archived_at)).trim(),
      flowState: normalizeFlowState_("note", pickFirstDefined_(row.flow_state, row.status, "active"), "active"),
      sourceUrl: String(pickFirstDefined_(row.source_url, row.sourceUrl)).trim(),
      sourcePlatform: String(pickFirstDefined_(row.source_platform, row.sourcePlatform)).trim(),
      sourceLabel: String(pickFirstDefined_(row.source_label, row.sourceLabel)).trim(),
      createdAt: String(pickFirstDefined_(row.created_at, row.createdAt)).trim(),
      updatedAt: String(pickFirstDefined_(row.updated_at, row.updatedAt)).trim()
    }, semanticFieldsFromRow_(row)));
  }).filter(function(note) {
    return (note.noteId || note.title) && note.status !== "deleted";
  }).sort(function(a, b) {
    return parseSheetDate_(b.updatedAt || b.createdAt) - parseSheetDate_(a.updatedAt || a.createdAt);
  });
}

function getDashboardSummary() {
  const posts = getPosts();
  const scheduledCount = posts.filter(function(post) { return post.status === "scheduled"; }).length;
  const publishedCount = posts.filter(function(post) { return post.status === "published"; }).length;
  const draftCount = posts.filter(function(post) { return post.status === "draft"; }).length;
  const insightPostCount = posts.filter(function(post) {
    return INSIGHT_METRIC_KEYS.some(function(key) {
      const value = key === "engagement_rate" ? post.engagementRate : post[key];
      return normalizeNumber_(value) > 0;
    });
  }).length;

  return {
    scheduledCount: scheduledCount,
    publishedCount: publishedCount,
    draftCount: draftCount,
    totalPosts: posts.length,
    insightPostCount: insightPostCount
  };
}

function getQueue() {
  return getPosts()
    .filter(function(post) {
      return post.status === "scheduled" && post.scheduledAt;
    })
    .sort(function(a, b) {
      return parseSheetDate_(a.scheduledAt) - parseSheetDate_(b.scheduledAt);
    })
    .map(function(post) {
      return {
        postId: post.postId,
        title: post.title,
        displayTitle: post.title,
        platform: post.platform,
        pillar: post.hubPillarLabel || post.pillar,
        scheduledAt: post.scheduledAt,
        status: post.status,
        queueDateLabel: post.queueDateLabel || formatQueueDate_(post.scheduledAt),
        queueTimeLabel: post.queueTimeLabel || formatQueueTime_(post.scheduledAt)
      };
    });
}

function getCampaigns() {
  const settings = getSettingsRegistry();
  const sheet = getCoreSheet_("campaign");
  const allRows = getRowsByNormalizedHeaders_(sheet, REQUIRED_CAMPAIGN_HEADERS)
    .map(function(row) {
      const campaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID, row.campaignid));
      return Object.assign({
        campaignId: campaignId,
        campaignName: normalizeCampaignName_(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaignname)),
        pillar: normalizePillar_(row.pillar, ""),
        color: String(row.color || getCampaignColorFromSettings_(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaignname), settings) || "").trim(),
        x: normalizeNumber_(row.x),
        y: normalizeNumber_(row.y),
        iconShape: normalizeIconShape_(row.icon_shape),
        pathStyle: normalizePathStyle_(row.path_style),
        sortOrder: normalizeNumber_(pickFirstDefined_(row.sort_order, row.y)),
        isArchived: normalizeBoolean_(pickFirstDefined_(row.is_archived, row.isArchived)),
        createdAt: String(pickFirstDefined_(row.created_at, row.createdat)).trim()
      }, semanticFieldsFromRow_(row));
    })
    .sort(function(a, b) {
      return normalizeNumber_(a.sortOrder) - normalizeNumber_(b.sortOrder);
    });
  const archivedLookup = {};
  allRows.filter(function(campaign) { return campaign.isArchived; }).forEach(function(campaign) {
    archivedLookup[normalizeCampaignLookup_(campaign.campaignName)] = true;
  });
  const rows = allRows.filter(function(campaign) {
    return !campaign.isArchived && (campaign.campaignId || campaign.campaignName);
  });

  console.log("[campaign-audit] constellation campaigns", rows.map(function(campaign) {
    return {
      campaignId: String(campaign.campaignId || "").trim(),
      campaignName: normalizeCampaignDisplayName_(campaign.campaignName || ""),
      sourceRowId: String(campaign.row_number || "").trim()
    };
  }));

  const byName = {};
  rows.forEach(function(campaign) {
    byName[normalizeCampaignLookup_(campaign.campaignName)] = campaign;
  });

  const merged = (settings.campaigns || []).map(function(campaignName, index) {
    if (archivedLookup[normalizeCampaignLookup_(campaignName)]) return null;
    const matched = byName[normalizeCampaignLookup_(campaignName)];
    return matched || {
      campaignId: createDeterministicCampaignId_(campaignName),
      campaignName: normalizeCampaignDisplayName_(campaignName),
      pillar: "",
      color: getCampaignColorFromSettings_(campaignName, settings),
      x: 0,
      y: 0,
      iconShape: "",
      pathStyle: "",
      sortOrder: index,
      isArchived: false,
      createdAt: ""
    };
  }).filter(Boolean);

  rows.forEach(function(campaign) {
    if (!byName[normalizeCampaignLookup_(campaign.campaignName)]) return;
  });

  rows.forEach(function(campaign) {
    const exists = merged.some(function(item) {
      return normalizeCampaignLookup_(item.campaignName) === normalizeCampaignLookup_(campaign.campaignName);
    });
    if (!exists) merged.push(campaign);
  });

  return merged;
}

function saveCampaign(payload) {
  const sheet = getCoreSheet_("campaign");
  const settings = getSettingsRegistry();
  const existing = findObjectByNormalizedHeaderValue_(sheet, ["campaign_id", "campaignID", "campaignid"], payload.campaignId, REQUIRED_CAMPAIGN_HEADERS);
  const createdAt = pickFirstDefined_(payload.createdAt, existing && existing.created_at, existing && existing.createdat, new Date().toISOString());
  const sortOrder = normalizeNumber_(pickFirstDefined_(payload.sortOrder, existing && existing.sort_order, payload.y, existing && existing.y));
  const campaignId = normalizeScalar_(pickFirstDefined_(payload.campaignId, existing && (existing.campaign_id || existing.campaignID || existing.campaignid), createCampaignId_()));
  const isArchived = payload.isArchived === undefined
    ? normalizeBoolean_(pickFirstDefined_(existing && existing.is_archived, existing && existing.isArchived))
    : normalizeBoolean_(payload.isArchived);

  const normalized = {
    campaign_id: campaignId,
    campaignID: campaignId,
    campaign_name: normalizeCampaignName_(payload.campaignName || existing && (existing.campaign_name || existing.campaignName || existing.campaignname) || "Untitled Campaign"),
    campaignName: normalizeCampaignName_(payload.campaignName || existing && (existing.campaignName || existing.campaign_name || existing.campaignname) || "Untitled Campaign"),
    pillar: normalizePillar_(pickFirstDefined_(payload.pillar, existing && existing.pillar), ""),
    color: String(payload.color || existing && existing.color || getCampaignColorFromSettings_(payload.campaignName || existing && (existing.campaign_name || existing.campaignName || existing.campaignname), settings) || "#c77dff").trim(),
    x: normalizeNumber_(pickFirstDefined_(payload.x, existing && existing.x, 240)),
    y: normalizeNumber_(pickFirstDefined_(payload.y, existing && existing.y, 240)),
    icon_shape: normalizeIconShape_(pickFirstDefined_(payload.iconShape, payload.icon_shape, existing && existing.icon_shape)),
    path_style: normalizePathStyle_(pickFirstDefined_(payload.pathStyle, payload.path_style, existing && existing.path_style)),
    sort_order: sortOrder,
    is_archived: isArchived,
    isArchived: isArchived,
    created_at: String(createdAt).trim(),
    createdat: String(createdAt).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectByHeader_(sheet, ["campaign_id", "campaignID", "campaignid"], normalized, REQUIRED_CAMPAIGN_HEADERS, CAMPAIGN_FORMULA_HEADERS);

  return Object.assign({
    campaignId: normalized.campaign_id,
    campaignName: normalized.campaign_name,
    pillar: normalized.pillar,
    color: normalized.color,
    x: normalized.x,
    y: normalized.y,
    iconShape: normalized.icon_shape,
    pathStyle: normalized.path_style,
    sortOrder: normalized.sort_order,
    isArchived: normalized.is_archived,
    createdAt: normalized.created_at
  }, semanticFieldsFromRow_(normalized));
}

function updateCampaignColor(payload) {
  payload = payload || {};
  var sourceCampaign = findCampaignByPayload_(payload);
  if (!sourceCampaign) throw new Error("Campaign not found.");
  var nextColor = String(payload.color || "").trim();
  if (!nextColor) throw new Error("Missing campaign color.");
  var savedCampaign = saveCampaign(Object.assign({}, sourceCampaign, {
    campaignId: sourceCampaign.campaignId,
    campaignName: sourceCampaign.campaignName,
    pillar: sourceCampaign.pillar,
    color: nextColor,
    x: sourceCampaign.x,
    y: sourceCampaign.y,
    sortOrder: sourceCampaign.sortOrder,
    iconShape: sourceCampaign.iconShape,
    pathStyle: sourceCampaign.pathStyle,
    isArchived: sourceCampaign.isArchived
  }));
  var sourceLookup = normalizeCampaignLookup_(sourceCampaign.campaignName);
  var updatedPostCount = 0;
  getPosts().forEach(function(post) {
    var matchesCampaign = String(post.campaignId || "").trim() === String(sourceCampaign.campaignId || "").trim()
      || normalizeCampaignLookup_(post.campaignName) === sourceLookup;
    if (!matchesCampaign) return;
    savePost(Object.assign({}, post, {
      postId: post.postId,
      campaignId: savedCampaign.campaignId,
      campaignName: savedCampaign.campaignName,
      hubTitle: !String(post.hubTitle || post.hub_title || "").trim() || String(post.hubTitle || post.hub_title || "").trim() === String(sourceCampaign.campaignName || "").trim()
        ? savedCampaign.campaignName
        : String(post.hubTitle || post.hub_title || "").trim(),
      hubPillarLabel: !String(post.hubPillarLabel || post.hub_pillar_label || "").trim()
        ? pillarDisplayLabel_(savedCampaign.pillar, savedCampaign.pillar)
        : String(post.hubPillarLabel || post.hub_pillar_label || "").trim(),
      constellationMeta: updateCampaignColorInConstellationMeta_(post.constellationMeta || post.constellation_meta || "", sourceCampaign, nextColor)
    }));
    updatedPostCount += 1;
  });
  return {
    ok: true,
    action: "updateCampaignColor",
    backendVersion: APP_BACKEND_VERSION,
    campaign: savedCampaign,
    updatedPostCount: updatedPostCount
  };
}

function updateCampaignColorInConstellationMeta_(value, campaign, nextColor) {
  var raw = String(value || "").trim();
  if (!raw) {
    return JSON.stringify({
      campaignId: String(campaign && campaign.campaignId || "").trim(),
      campaignName: String(campaign && campaign.campaignName || "").trim(),
      campaignColor: String(nextColor || "").trim()
    });
  }
  if (raw === String(campaign && campaign.campaignId || "").trim() || raw === String(campaign && campaign.campaignName || "").trim()) {
    return raw;
  }
  var parsed = parseJsonSafe_(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
  parsed.campaignColor = String(nextColor || "").trim();
  if (!parsed.color) parsed.color = String(nextColor || "").trim();
  if (!parsed.campaignId) parsed.campaignId = String(campaign && campaign.campaignId || "").trim();
  if (!parsed.campaignName) parsed.campaignName = String(campaign && campaign.campaignName || "").trim();
  return JSON.stringify(parsed);
}

function repairCampaignKeyIssues(payload) {
  payload = payload || {};
  var action = String(payload.repairAction || "reassign").trim();
  var targetCampaignId = String(payload.targetCampaignId || "").trim();
  var targetCampaignName = String(payload.targetCampaignName || "").trim();
  var sourceCampaignName = String(payload.sourceCampaignName || "").trim();
  var campaign = findCampaignByPayload_({ campaignId: targetCampaignId, campaignName: targetCampaignName });
  var result = { ok: true, action: action, repaired: 0, posts: [] };

  if (action === "reassign" && targetCampaignName) {
    var posts = getPosts();
    posts.forEach(function(post) {
      var postCampaignName = String(post.campaignName || "").trim().toLowerCase();
      if (postCampaignName === sourceCampaignName.toLowerCase() || postCampaignName.indexOf(sourceCampaignName.toLowerCase()) !== -1) {
        var target = campaign || findCampaignByPayload_({ campaignName: targetCampaignName });
        if (target) {
          savePost(Object.assign({}, post, {
            campaignId: target.campaignId,
            campaignName: target.campaignName
          }));
          result.posts.push(post.postId);
          result.repaired += 1;
        }
      }
    });
  }

  if (action === "merge_duplicate" && targetCampaignName) {
    var allCampaigns = getCampaigns();
    var target = campaign;
    var normalizedTarget = normalizeCampaignLookup_(targetCampaignName);
    var duplicates = allCampaigns.filter(function(c) {
      return normalizeCampaignLookup_(c.campaignName || "") === normalizedTarget && c.campaignId !== (target && target.campaignId);
    });
    duplicates.forEach(function(dup) {
      dup.targetCampaignId = target ? target.campaignId : "";
      var mergedResult = mergeCampaignIntoCampaign({ sourceCampaignName: dup.campaignName, targetCampaignName: targetCampaignName });
      result.repaired += mergedResult.changedPostCount || 0;
    });
  }

  if (action === "clear_campaign") {
    var posts = getPosts();
    posts.forEach(function(post) {
      var postCampaignName = String(post.campaignName || "").trim().toLowerCase();
      if (sourceCampaignName && postCampaignName.indexOf(sourceCampaignName.toLowerCase()) !== -1) {
        savePost(Object.assign({}, post, {
          campaignId: "",
          campaignName: ""
        }));
        result.posts.push(post.postId);
        result.repaired += 1;
      }
    });
  }

  return result;
}

function findCampaignByPayload_(payload) {
  payload = payload || {};
  var sourceCampaignId = String(pickFirstDefined_(payload.campaignId, payload.sourceCampaignId, payload.targetCampaignId, "")).trim();
  var sourceCampaignName = normalizeCampaignName_(pickFirstDefined_(payload.campaignName, payload.sourceCampaignName, payload.targetCampaignName, ""));
  var campaigns = getCampaigns();
  if (sourceCampaignId) {
    var byId = campaigns.find(function(item) { return String(item.campaignId || "").trim() === sourceCampaignId; });
    if (byId) return byId;
  }
  if (sourceCampaignName) {
    var lookup = normalizeCampaignLookup_(sourceCampaignName);
    return campaigns.find(function(item) { return normalizeCampaignLookup_(item.campaignName) === lookup; }) || null;
  }
  return null;
}

function getCampaignCleanupDiagnostics_(posts, campaigns) {
  posts = Array.isArray(posts) ? posts : [];
  campaigns = Array.isArray(campaigns) ? campaigns : [];
  var normalizedCampaignGroups = {};
  campaigns.forEach(function(campaign) {
    var lookup = normalizeCampaignLookup_(campaign.campaignName);
    if (!lookup) return;
    if (!normalizedCampaignGroups[lookup]) normalizedCampaignGroups[lookup] = [];
    normalizedCampaignGroups[lookup].push({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName
    });
  });
  var sameNormalizedNameDifferentIds = Object.keys(normalizedCampaignGroups).filter(function(key) {
    var uniqueIds = normalizedCampaignGroups[key].map(function(item) { return String(item.campaignId || "").trim(); }).filter(Boolean);
    return normalizedCampaignGroups[key].length > 1 && new Set(uniqueIds).size > 1;
  }).map(function(key) {
    return {
      normalizedName: key,
      campaigns: normalizedCampaignGroups[key]
    };
  });
  var nearDuplicateCampaigns = [];
  var communitySingular = campaigns.find(function(campaign) { return normalizeCampaignLookup_(campaign.campaignName) === "community shoutout"; }) || null;
  var communityPlural = campaigns.find(function(campaign) { return normalizeCampaignLookup_(campaign.campaignName) === "community shout outs"; }) || null;
  if (communitySingular || communityPlural) {
    nearDuplicateCampaigns.push({
      type: "near_duplicate_campaign",
      sourceCampaignName: communitySingular && communitySingular.campaignName || "Community Shoutout",
      sourceCampaignId: communitySingular && communitySingular.campaignId || "",
      targetCampaignName: communityPlural && communityPlural.campaignName || "Community Shout Outs",
      targetCampaignId: communityPlural && communityPlural.campaignId || "",
      suggestedAction: "Merge Community Shoutout into Community Shout Outs."
    });
  }
  var duplicateNameSuggestions = sameNormalizedNameDifferentIds.map(function(group) {
    return {
      type: "same_normalized_name",
      normalizedName: group.normalizedName,
      suggestedAction: "Merge campaigns that normalize to " + group.normalizedName + " so Constellation keeps one clean lane.",
      campaigns: group.campaigns
    };
  });
  var invalidComboCampaigns = [];
  posts.forEach(function(post) {
    var name = normalizeCampaignDisplayName_(post.campaignName || "");
    if (!name) return;
    var explicitMulti = /[|\n]/.test(name);
    if (!explicitMulti) return;
    var labels = splitExplicitCampaignValues_(name);
    if (!labels.length) return;
    var normalizedLabels = labels.map(function(label) { return normalizeCampaignLookup_(label); });
    var hasMessaging = normalizedLabels.indexOf("messaging") !== -1;
    var hasJobPosts = normalizedLabels.indexOf("jobposts") !== -1;
    var allowedTargets = hasMessaging && hasJobPosts
      ? ["Messaging", "Job Posts"]
      : labels;
    invalidComboCampaigns.push({
      type: "invalid_combo_campaign",
      postId: post.postId,
      title: post.title,
      campaignId: post.campaignId,
      campaignName: name,
      allowedTargets: allowedTargets,
      reviewSuggestion: hasMessaging && hasJobPosts
        ? "Review affected posts and reassign to Messaging or Job Posts."
        : "Review affected posts and reassign to one clean campaign label."
    });
  });
  console.log("[campaign-audit] duplicate candidates", sameNormalizedNameDifferentIds);
  return {
    nearDuplicateCampaigns: nearDuplicateCampaigns,
    invalidComboCampaigns: invalidComboCampaigns,
    sameNormalizedNameDifferentIds: sameNormalizedNameDifferentIds,
    cleanupSuggestions: nearDuplicateCampaigns.concat(duplicateNameSuggestions).concat(invalidComboCampaigns.map(function(item) {
      return {
        type: "invalid_combo_campaign",
        suggestedAction: item.reviewSuggestion || ("Reassign this post to one clean campaign: " + (item.allowedTargets || []).join(", ")),
        postId: item.postId,
        campaignName: item.campaignName
      };
    }))
  };
}

function getCampaignDerivedFieldPatch_(post, sourceCampaign, targetCampaign) {
  var sourceName = String(sourceCampaign && sourceCampaign.campaignName || "").trim();
  var targetName = String(targetCampaign && targetCampaign.campaignName || "").trim();
  var sourcePillarLabel = sourceCampaign ? pillarDisplayLabel_(sourceCampaign.pillar, sourceCampaign.pillar) : "";
  var targetPillarLabel = targetCampaign ? pillarDisplayLabel_(targetCampaign.pillar, targetCampaign.pillar) : "";
  var hubTitle = String(post.hubTitle || post.hub_title || "").trim();
  var hubPillarLabel = String(post.hubPillarLabel || post.hub_pillar_label || "").trim();
  var constellationMeta = String(post.constellationMeta || post.constellation_meta || "").trim();
  return {
    hubTitle: !hubTitle || hubTitle === sourceName ? targetName : hubTitle,
    hubPillarLabel: !hubPillarLabel || hubPillarLabel === sourcePillarLabel ? targetPillarLabel : hubPillarLabel,
    constellationMeta: !constellationMeta || constellationMeta === sourceName || constellationMeta === String(sourceCampaign && sourceCampaign.campaignId || "").trim()
      ? (targetName || String(targetCampaign && targetCampaign.campaignId || "").trim())
      : constellationMeta
  };
}

function mergeCampaignIntoCampaign(payload) {
  payload = payload || {};
  var sourceCampaign = findCampaignByPayload_({ campaignId: payload.sourceCampaignId, campaignName: payload.sourceCampaignName });
  var targetCampaign = findCampaignByPayload_({ campaignId: payload.targetCampaignId, campaignName: payload.targetCampaignName });
  if (!sourceCampaign) throw new Error("Source campaign not found.");
  if (!targetCampaign) throw new Error("Target campaign not found.");
  if (String(sourceCampaign.campaignId || "").trim() === String(targetCampaign.campaignId || "").trim()) {
    throw new Error("Cannot merge a campaign into itself.");
  }
  var sourceLookup = normalizeCampaignLookup_(sourceCampaign.campaignName);
  var changedPostCount = 0;
  getPosts().forEach(function(post) {
    var matchesSource = String(post.campaignId || "").trim() === String(sourceCampaign.campaignId || "").trim()
      || normalizeCampaignLookup_(post.campaignName) === sourceLookup;
    if (!matchesSource) return;
    var derivedPatch = getCampaignDerivedFieldPatch_(post, sourceCampaign, targetCampaign);
    savePost(Object.assign({}, post, {
      postId: post.postId,
      campaignId: targetCampaign.campaignId,
      campaignName: targetCampaign.campaignName,
      hubTitle: derivedPatch.hubTitle,
      hubPillarLabel: derivedPatch.hubPillarLabel,
      pillar: post.pillar || targetCampaign.pillar || "",
      constellationMeta: derivedPatch.constellationMeta
    }));
    changedPostCount += 1;
  });
  var archivedSource = changedPostCount > 0;
  if (archivedSource) {
    saveCampaign(Object.assign({}, sourceCampaign, {
      campaignId: sourceCampaign.campaignId,
      campaignName: sourceCampaign.campaignName,
      pillar: sourceCampaign.pillar,
      color: sourceCampaign.color,
      sortOrder: sourceCampaign.sortOrder,
      iconShape: sourceCampaign.iconShape,
      pathStyle: sourceCampaign.pathStyle,
      isArchived: true
    }));
  }
  return {
    ok: true,
    action: "mergeCampaignIntoCampaign",
    backendVersion: APP_BACKEND_VERSION,
    changedPostCount: changedPostCount,
    sourceCampaign: sourceCampaign,
    targetCampaign: targetCampaign,
    archivedSource: archivedSource
  };
}

function deleteCampaignAndUnassignPosts(payload) {
  payload = payload || {};
  var sourceCampaign = findCampaignByPayload_({ campaignId: payload.sourceCampaignId, campaignName: payload.sourceCampaignName });
  if (!sourceCampaign) throw new Error("Source campaign not found.");
  var sourceLookup = normalizeCampaignLookup_(sourceCampaign.campaignName);
  var changedPostCount = 0;
  getPosts().forEach(function(post) {
    var matchesSource = String(post.campaignId || "").trim() === String(sourceCampaign.campaignId || "").trim()
      || normalizeCampaignLookup_(post.campaignName) === sourceLookup;
    if (!matchesSource) return;
    var derivedPatch = getCampaignDerivedFieldPatch_(post, sourceCampaign, null);
    savePost(Object.assign({}, post, {
      postId: post.postId,
      campaignId: "",
      campaignName: "",
      hubTitle: !String(post.hubTitle || post.hub_title || "").trim() || String(post.hubTitle || post.hub_title || "").trim() === String(sourceCampaign.campaignName || "").trim() ? "" : String(post.hubTitle || post.hub_title || "").trim(),
      hubPillarLabel: !String(post.hubPillarLabel || post.hub_pillar_label || "").trim() || String(post.hubPillarLabel || post.hub_pillar_label || "").trim() === pillarDisplayLabel_(sourceCampaign.pillar, sourceCampaign.pillar) ? "" : String(post.hubPillarLabel || post.hub_pillar_label || "").trim(),
      constellationMeta: !String(post.constellationMeta || post.constellation_meta || "").trim() || String(post.constellationMeta || post.constellation_meta || "").trim() === String(sourceCampaign.campaignName || "").trim() ? "" : String(post.constellationMeta || post.constellation_meta || "").trim()
    }));
    changedPostCount += 1;
  });
  saveCampaign(Object.assign({}, sourceCampaign, {
    campaignId: sourceCampaign.campaignId,
    campaignName: sourceCampaign.campaignName,
    pillar: sourceCampaign.pillar,
    color: sourceCampaign.color,
    sortOrder: sourceCampaign.sortOrder,
    iconShape: sourceCampaign.iconShape,
    pathStyle: sourceCampaign.pathStyle,
    isArchived: true
  }));
  return {
    ok: true,
    action: "deleteCampaignAndUnassignPosts",
    backendVersion: APP_BACKEND_VERSION,
    changedPostCount: changedPostCount,
    campaign: sourceCampaign
  };
}

function reassignCampaignCleanupPosts(payload) {
  payload = payload || {};
  var postIds = Array.isArray(payload.postIds) ? payload.postIds.map(function(item) { return String(item || "").trim(); }).filter(Boolean) : [];
  if (!postIds.length) throw new Error("No posts selected for reassignment.");
  var targetCampaign = findCampaignByPayload_({ campaignId: payload.targetCampaignId, campaignName: payload.targetCampaignName });
  if (!targetCampaign) throw new Error("Target campaign not found.");
  var changedPostCount = 0;
  getPosts().forEach(function(post) {
    if (postIds.indexOf(String(post.postId || "").trim()) === -1) return;
    var currentCampaign = findCampaignByPayload_({ campaignId: post.campaignId, campaignName: post.campaignName });
    var derivedPatch = getCampaignDerivedFieldPatch_(post, currentCampaign, targetCampaign);
    savePost(Object.assign({}, post, {
      postId: post.postId,
      campaignId: targetCampaign.campaignId,
      campaignName: targetCampaign.campaignName,
      hubTitle: derivedPatch.hubTitle,
      hubPillarLabel: derivedPatch.hubPillarLabel,
      constellationMeta: derivedPatch.constellationMeta
    }));
    changedPostCount += 1;
  });
  return {
    ok: true,
    action: "reassignCampaignCleanupPosts",
    backendVersion: APP_BACKEND_VERSION,
    changedPostCount: changedPostCount,
    targetCampaign: targetCampaign
  };
}

function updateCampaignPosition(payload) {
  if (!payload.campaignId) throw new Error("Missing campaignId");

  const sheet = getCoreSheet_("campaign");
  const existing = findObjectByNormalizedHeaderValue_(sheet, ["campaign_id", "campaignID", "campaignid"], payload.campaignId, REQUIRED_CAMPAIGN_HEADERS);
  if (!existing) throw new Error("Campaign not found");

  existing.campaign_id = normalizeScalar_(pickFirstDefined_(existing.campaign_id, existing.campaignID, existing.campaignid, payload.campaignId));
  existing.campaignID = existing.campaign_id;
  existing.x = normalizeNumber_(payload.x);
  existing.y = normalizeNumber_(payload.y);
  existing.sort_order = normalizeNumber_(pickFirstDefined_(existing.sort_order, payload.y));
  existing.updated_at = new Date().toISOString();

  upsertObjectByHeader_(sheet, ["campaign_id", "campaignID", "campaignid"], existing, REQUIRED_CAMPAIGN_HEADERS, CAMPAIGN_FORMULA_HEADERS);
  return true;
}

function syncSourceFlowStateForPost_(postRow) {
  var postId = String(postRow && postRow.post_id || "").trim();
  if (!postId) return;
  var timestamp = String(postRow && postRow.moved_to_post_at || new Date().toISOString()).trim();

  var noteId = String(postRow && postRow.source_note_id || postRow && postRow.created_from_note_id || "").trim();
  if (noteId) {
    var noteSheet = getCoreSheet_("notes");
    var noteRow = findObjectByNormalizedHeaderValue_(noteSheet, ["note_id", "noteId"], noteId, REQUIRED_NOTE_HEADERS);
    if (noteRow) {
      noteRow.converted_post_id = postId;
      noteRow.status = "converted_to_post";
      noteRow.flow_state = "converted_to_post";
      noteRow.moved_to_post_at = timestamp;
      noteRow.updated_at = new Date().toISOString();
      upsertObjectByHeader_(noteSheet, ["note_id", "noteId"], noteRow, REQUIRED_NOTE_HEADERS, NOTE_FORMULA_HEADERS);
      logFlowEvent_("note_to_post", "note", noteId, postId, "ok", "", { flowState: "converted_to_post" });
    }
  }

  var inspoId = String(postRow && postRow.source_inspo_id || postRow && postRow.created_from_inspo_id || "").trim();
  if (inspoId) {
    var inspoSheet = getCoreSheet_("inspo");
    var inspoRow = findObjectByNormalizedHeaderValue_(inspoSheet, ["inspo_id"], inspoId, REQUIRED_INSPO_HEADERS);
    if (inspoRow) {
      inspoRow.converted_post_id = postId;
      inspoRow.status = "converted_to_post";
      inspoRow.flow_state = "converted_to_post";
      inspoRow.moved_to_post_at = timestamp;
      inspoRow.updated_at = new Date().toISOString();
      upsertObjectByHeader_(inspoSheet, ["inspo_id"], inspoRow, REQUIRED_INSPO_HEADERS, INSPO_FORMULA_HEADERS);
      logFlowEvent_("inspo_to_post", "inspo", inspoId, postId, "ok", "", { flowState: "converted_to_post" });
    }
  }

  var aiDraftId = String(postRow && postRow.source_ai_draft_id || "").trim();
  if (aiDraftId) {
    try {
      saveAIDraft({
        aiDraftId: aiDraftId,
        createdPostId: postId,
        generatedPostIds: [postId],
        draftStatus: "converted",
        reviewNotes: "Converted into POSTS."
      });
      logFlowEvent_("ai_draft_to_post", "ai_draft", aiDraftId, postId, "ok", "", { flowState: "converted" });
    } catch (_) {}
  }
}

function savePost(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return {
      ok: false,
      success: false,
      retryable: true,
      error: "Another save is already running. Try again in a moment."
    };
  }
  try {
    return savePostCore_(payload || {});
  } catch (err) {
    return {
      ok: false,
      success: false,
      error: String(err && err.message || err)
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

function savePostCore_(payload) {
  const start = Date.now();
  payload = payload || {};
  console.log("[savePost] payload", JSON.stringify(payload));
  console.log("[savePost] backend", "google_sheets");
  const sheet = getPostsSheet_();
  ensureHeadersPresent_(sheet, PHASE1_WORKSPACE_POST_HEADERS);
  requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  const settings = getSettingsRegistry();
  const defaultPillar = settings.pillars[0] || "authority";
  const incomingPostId = getCanonicalIncomingPostId_(payload);
  const existingRow = incomingPostId
    ? findObjectByHeaders_(sheet, ["post_id", "postId"], incomingPostId)
    : null;
  const existing = existingRow ? normalizePostSchemaAliases_(existingRow) : null;
  const tracking = buildFlowTrackingFields_(payload, existing, { entityType: "post" });
  const finalIncomingPostId = getCanonicalIncomingPostId_(payload);
  const finalExistingRow = finalIncomingPostId
    ? findObjectByHeaders_(sheet, ["post_id", "postId"], finalIncomingPostId)
    : null;
  const finalExisting = finalExistingRow ? normalizePostSchemaAliases_(finalExistingRow) : null;
  const campaignMap = buildCampaignMap_();
  const campaignNameMap = buildCampaignNameMap_();
  let campaignId = normalizeScalar_(pickFirstDefined_(payload.campaignId, payload.campaign_id, finalExisting && finalExisting.campaign_id));
  let inputCampaignName = normalizeCampaignName_(pickFirstDefined_(payload.campaignName, payload.campaign_name, finalExisting && finalExisting.campaign_name, finalExisting && finalExisting.campaignName));
  let matchedCampaign = campaignMap[String(campaignId || "")] || campaignNameMap[normalizeCampaignLookup_(inputCampaignName)] || null;
  if (!campaignId && matchedCampaign && matchedCampaign.campaignId) {
    campaignId = matchedCampaign.campaignId;
  }
  if (!matchedCampaign && inputCampaignName) {
    matchedCampaign = saveCampaign({
      campaignId: String(campaignId || "").indexOf("CMP-") === 0 ? campaignId : createDeterministicCampaignId_(inputCampaignName),
      campaignName: inputCampaignName,
      pillar: "",
      color: "",
      sortOrder: getCampaigns().reduce(function(max, campaign) {
        return Math.max(max, Number(campaign.sortOrder || 0));
      }, 0) + 1,
      isArchived: false
    });
    campaignId = matchedCampaign.campaignId;
    inputCampaignName = matchedCampaign.campaignName;
  }
  const planning = normalizePlanningFields_(payload, finalExisting);
  const workflow = normalizePostScheduleForWorkflow_(Object.assign({}, finalExisting || {}, payload || {}, {
    scheduled_at: planning.scheduledAt,
    queue_date_label: planning.queueDateLabel,
    queue_time_label: planning.queueTimeLabel
  }));
  const scheduledAt = workflow.scheduledAt;
  const canonicalPillar = normalizePillar_(
    pickFirstDefined_(payload.pillar, payload.hubPillarLabel, payload.hub_pillar_label, finalExisting && finalExisting.pillar, finalExisting && finalExisting.hub_pillar_label, matchedCampaign && matchedCampaign.pillar),
    defaultPillar
  ) || defaultPillar;
  const hubPillarLabel = pillarDisplayLabel_(
    pickFirstDefined_(payload.hubPillarLabel, payload.hub_pillar_label, finalExisting && finalExisting.hub_pillar_label, canonicalPillar, matchedCampaign && matchedCampaign.pillar),
    canonicalPillar
  );
  const campaignName = normalizeCampaignName_(
    pickFirstDefined_(matchedCampaign && matchedCampaign.campaignName, inputCampaignName, finalExisting && finalExisting.campaign_name, finalExisting && finalExisting.campaignName, "")
  );
  const carouselAssetIds = parseAssetIdList_(pickFirstDefined_(payload.carouselAssetIds, payload.carousel_asset_ids, finalExisting && finalExisting.carousel_asset_ids));
  const platformTargets = parsePlatformTargets_(pickFirstDefined_(payload.platformTargets, payload.platform_targets, finalExisting && finalExisting.platform_targets, payload.platform));
  const primaryPlatform = platformTargets[0] || String(pickFirstDefined_(payload.platform, payload.channel, existing && existing.platform, "linkedin")).trim() || "linkedin";
  const sourceMetadataValue = normalizeMetadataString_(pickFirstDefined_(payload.sourceMetadata, payload.source_metadata, finalExisting && finalExisting.source_metadata));
  const aiPrompt = String(pickFirstDefined_(payload.aiPrompt, payload.ai_prompt, finalExisting && finalExisting.ai_prompt, "")).trim();
  const aiGenerationMode = String(pickFirstDefined_(payload.aiGenerationMode, payload.ai_generation_mode, finalExisting && finalExisting.ai_generation_mode, "")).trim();
  const aiDraftStatus = String(pickFirstDefined_(payload.aiDraftStatus, payload.ai_draft_status, finalExisting && finalExisting.ai_draft_status, "")).trim();
  const postType = String(pickFirstDefined_(payload.postType, payload.post_type, payload.format, existing && existing.post_type, existing && existing.format, existing && existing.postType, "text")).trim() || "text";
  const workspaceFields = normalizeWorkspacePostFields_(payload, finalExisting || existing || {});
  const normalized = {
    post_id: ensureCanonicalPostId_(payload, finalExisting || existing),
    _rowNumber: payload._rowNumber || payload.rowNumber || payload.row_number || payload.sheetRow || payload.sheet_row || "",
    title: String(pickFirstDefined_(payload.title, payload.postTitle, existing && existing.title, "")).trim(),
    platform: primaryPlatform,
    post_type: postType,
    format: postType,
    pillar: canonicalPillar,
    scheduled_at: scheduledAt,
    status: workflow.status,
    description: String(pickFirstDefined_(payload.description, payload.caption, existing && existing.description, "")).trim(),
    asset_id: String(pickFirstDefined_(payload.assetId, payload.asset_id, existing && existing.asset_id, existing && existing.assetId, "")).trim(),
    hub_title: String(pickFirstDefined_(payload.hubTitle, payload.hub_title, existing && existing.hub_title, payload.title, "")).trim(),
    hub_pillar_label: hubPillarLabel,
    queue_date_label: workflow.queueDateLabel,
    queue_time_label: workflow.queueTimeLabel,
    publish_date: workflow.queueDateLabel,
    publish_time: workflow.queueTimeLabel,
    calendar_month: workflow.dateKey ? planning.calendarMonth : "",
    calendar_year: workflow.dateKey ? planning.calendarYear : "",
    calendar_day: workflow.dateKey ? planning.calendarDay : "",
    ledger_excerpt: String(pickFirstDefined_(payload.ledgerExcerpt, payload.ledger_excerpt, existing && existing.ledger_excerpt, existing && existing.ledgerExcerpt, "")).trim(),
    constellation_meta: String(pickFirstDefined_(payload.constellationMeta, payload.constellation_meta, existing && existing.constellation_meta, existing && existing.constellationMeta, "")).trim(),
    media_label: String(pickFirstDefined_(payload.mediaLabel, payload.media_label, existing && existing.media_label, existing && existing.mediaLabel, "")).trim(),
    created_from_inspo_id: String(pickFirstDefined_(payload.createdFromInspoId, payload.created_from_inspo_id, existing && existing.created_from_inspo_id, existing && existing.createdFromInspoId, "")).trim(),
    created_from_note_id: String(pickFirstDefined_(payload.createdFromNoteId, payload.created_from_note_id, existing && existing.created_from_note_id, existing && existing.createdFromNoteId, "")).trim(),
    campaign_id: campaignId,
    campaign_name: campaignName,
    notes: String(payload.notes || existing && existing.notes || "").trim(),
    impressions: normalizeNumber_(pickFirstDefined_(payload.impressions, existing && existing.impressions)),
    reach: normalizeNumber_(pickFirstDefined_(payload.reach, existing && existing.reach)),
    likes: normalizeNumber_(pickFirstDefined_(payload.likes, existing && existing.likes)),
    comments: normalizeNumber_(pickFirstDefined_(payload.comments, existing && existing.comments)),
    shares: normalizeNumber_(pickFirstDefined_(payload.shares, existing && existing.shares)),
    saves: normalizeNumber_(pickFirstDefined_(payload.saves, existing && existing.saves)),
    clicks: normalizeNumber_(pickFirstDefined_(payload.clicks, existing && existing.clicks)),
    engagement_rate: normalizeNumber_(pickFirstDefined_(payload.engagementRate, existing && existing.engagement_rate)),
    source_url: String(pickFirstDefined_(payload.sourceUrl, payload.source_url, existing && existing.source_url, "")).trim(),
    source_type: String(pickFirstDefined_(payload.sourceType, payload.source_type, existing && existing.source_type, "")).trim(),
    source_platform: String(pickFirstDefined_(payload.sourcePlatform, payload.source_platform, existing && existing.source_platform, "")).trim(),
    source_title: String(pickFirstDefined_(payload.sourceTitle, payload.source_title, existing && existing.source_title, "")).trim(),
    source_metadata: sourceMetadataValue,
    source_import_status: String(pickFirstDefined_(payload.sourceImportStatus, payload.source_import_status, existing && existing.source_import_status, "")).trim(),
    imported_at: String(pickFirstDefined_(payload.importedAt, payload.imported_at, existing && existing.imported_at, "")).trim(),
    import_job_id: String(pickFirstDefined_(payload.importJobId, payload.import_job_id, existing && existing.import_job_id, "")).trim(),
    source_note_id: tracking.sourceNoteId,
    source_inspo_id: tracking.sourceInspoId,
    source_ai_draft_id: tracking.sourceAiDraftId,
    source_import_job_id: tracking.sourceImportJobId,
    created_from_flow: inferCreatedFromFlow_(tracking, payload, finalExisting),
    moved_to_post_at: tracking.movedToPostAt || (tracking.sourceNoteId || tracking.sourceInspoId || tracking.sourceAiDraftId ? new Date().toISOString() : ""),
    archived_at: tracking.archivedAt,
    flow_state: derivePostFlowState_(workflow.status),
    original_post_date: String(pickFirstDefined_(payload.originalPostDate, payload.original_post_date, existing && existing.original_post_date, "")).trim(),
    original_post_date_label: String(pickFirstDefined_(payload.originalPostDateLabel, payload.original_post_date_label, existing && existing.original_post_date_label, "")).trim(),
    date_confidence: String(pickFirstDefined_(payload.dateConfidence, payload.date_confidence, existing && existing.date_confidence, "")).trim(),
    linkedin_post_id: String(pickFirstDefined_(payload.linkedinPostId, payload.linkedin_post_id, existing && existing.linkedin_post_id, "")).trim(),
    normalized_text_hash: String(pickFirstDefined_(payload.normalizedTextHash, payload.normalized_text_hash, existing && existing.normalized_text_hash, "")).trim(),
    is_repost: normalizeBoolean_(pickFirstDefined_(payload.isRepost, payload.is_repost, existing && existing.is_repost)),
    repost_author: String(pickFirstDefined_(payload.repostAuthor, payload.repost_author, existing && existing.repost_author, "")).trim(),
    repost_commentary: String(pickFirstDefined_(payload.repostCommentary, payload.repost_commentary, existing && existing.repost_commentary, "")).trim(),
    original_author: String(pickFirstDefined_(payload.originalAuthor, payload.original_author, existing && existing.original_author, "")).trim(),
    original_post_excerpt: String(pickFirstDefined_(payload.originalPostExcerpt, payload.original_post_excerpt, existing && existing.original_post_excerpt, "")).trim(),
    platform_targets: platformTargets.join(","),
    publish_status: String(pickFirstDefined_(payload.publishStatus, payload.publish_status, existing && existing.publish_status, "draft")).trim() || "draft",
    published_url: String(pickFirstDefined_(payload.publishedUrl, payload.published_url, existing && existing.published_url, "")).trim(),
    published_at: String(pickFirstDefined_(payload.publishedAt, payload.published_at, existing && existing.published_at, "")).trim(),
    api_post_id: String(pickFirstDefined_(payload.apiPostId, payload.api_post_id, existing && existing.api_post_id, "")).trim(),
    api_error: String(pickFirstDefined_(payload.apiError, payload.api_error, existing && existing.api_error, "")).trim(),
    platform_caption_override: String(pickFirstDefined_(payload.platformCaptionOverride, payload.platform_caption_override, existing && existing.platform_caption_override, "")).trim(),
    platform_character_count: normalizeNumber_(pickFirstDefined_(payload.platformCharacterCount, payload.platform_character_count, existing && existing.platform_character_count)),
    requires_manual_review: normalizeBoolean_(pickFirstDefined_(payload.requiresManualReview, payload.requires_manual_review, existing && existing.requires_manual_review)),
    carousel_asset_ids: carouselAssetIds.join("|"),
    ai_source_type: String(pickFirstDefined_(payload.aiSourceType, payload.ai_source_type, existing && existing.ai_source_type, "")).trim(),
    ai_source_id: String(pickFirstDefined_(payload.aiSourceId, payload.ai_source_id, existing && existing.ai_source_id, "")).trim(),
    ai_prompt: aiPrompt,
    ai_generation_mode: aiGenerationMode,
    ai_brand_framework_version: String(pickFirstDefined_(payload.aiBrandFrameworkVersion, payload.ai_brand_framework_version, existing && existing.ai_brand_framework_version, getBrandFrameworkVersion_())).trim(),
    ai_draft_status: aiDraftStatus,
    ai_review_notes: String(pickFirstDefined_(payload.aiReviewNotes, payload.ai_review_notes, existing && existing.ai_review_notes, "")).trim(),
    workspace_id: workspaceFields.workspace_id,
    media_id: workspaceFields.media_id,
    media_url: workspaceFields.media_url,
    media_type: workspaceFields.media_type,
    media_filename: workspaceFields.media_filename,
    media_alt_text: workspaceFields.media_alt_text,
    media_source: workspaceFields.media_source,
    storage_path: workspaceFields.storage_path,
    monday_item_id: workspaceFields.monday_item_id,
    monday_group_id: workspaceFields.monday_group_id,
    monday_last_synced_at: workspaceFields.monday_last_synced_at,
    monday_sync_status: workspaceFields.monday_sync_status,
    created_at: String(finalExisting && finalExisting.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, finalExisting);
  maybeAutoGenerateKeywords_(normalized, payload, finalExisting);

  var savedRowNumber = upsertPostObjectById_(sheet, normalized);
  SpreadsheetApp.flush();
  const confirmed = findObjectByHeaders_(sheet, ["post_id", "postId"], normalized.post_id);
  if (!confirmed) {
    throw new Error("Save failed: row was not confirmed in POSTS after write.");
  }
  // TEMP DISABLED: post-save side effects were causing savePost to hang.
  // Save should only write POSTS, confirm the row, and return.
  // Isolate order: syncSourceFlowStateForPost_ (worst — cascades into saveAIDraft, notes, inspo, logFlowEvent_) > syncMediaLinkForPost_ > logFlowEvent_
  // syncMediaLinkForPost_(normalized.post_id, normalized.asset_id, normalized.campaign_name, normalized.media_label);
  // syncSourceFlowStateForPost_(normalized);
  // if (normalized.flow_state === "scheduled") setLastRebuildTimestamp_("calendar");
  // if (normalized.flow_state === "scheduled" || normalized.flow_state === "draft") setLastRebuildTimestamp_("queue");
  // setLastRebuildTimestamp_("ledger");
  // setLastRebuildTimestamp_("constellation");
  // logFlowEvent_(...)

  var confirmedNormalized = normalizePostSchemaAliases_(confirmed);
  var response = Object.assign({
    postId: confirmedNormalized.post_id || normalized.post_id,
    post_id: confirmedNormalized.post_id || normalized.post_id,
    savedPostId: confirmedNormalized.post_id || normalized.post_id,
    rowNumber: savedRowNumber,
    row_number: savedRowNumber,
    source: "google_sheets",
    title: confirmedNormalized.title || normalized.title,
    platform: confirmedNormalized.platform || normalized.platform,
    platform_targets: platformTargets,
    platforms: platformTargets,
    postType: confirmedNormalized.post_type || normalized.post_type,
    format: confirmedNormalized.format || normalized.format,
    pillar: confirmedNormalized.pillar || normalized.pillar,
    scheduledAt: confirmedNormalized.scheduled_at || normalized.scheduled_at,
    status: confirmedNormalized.status || normalized.status,
    description: confirmedNormalized.description || normalized.description,
    assetId: confirmedNormalized.asset_id || normalized.asset_id,
    hubTitle: confirmedNormalized.hub_title || normalized.hub_title,
    hubPillarLabel: confirmedNormalized.hub_pillar_label || normalized.hub_pillar_label,
    queueDateLabel: confirmedNormalized.queue_date_label || normalized.queue_date_label,
    queueTimeLabel: confirmedNormalized.queue_time_label || normalized.queue_time_label,
    publishDate: confirmedNormalized.publish_date || normalized.publish_date,
    publishTime: confirmedNormalized.publish_time || normalized.publish_time,
    calendarMonth: confirmedNormalized.calendar_month || normalized.calendar_month,
    calendarYear: confirmedNormalized.calendar_year || normalized.calendar_year,
    calendarDay: confirmedNormalized.calendar_day || normalized.calendar_day,
    ledgerExcerpt: confirmedNormalized.ledger_excerpt || normalized.ledger_excerpt,
    constellationMeta: confirmedNormalized.constellation_meta || normalized.constellation_meta,
    mediaLabel: confirmedNormalized.media_label || normalized.media_label,
    createdFromInspoId: confirmedNormalized.created_from_inspo_id || normalized.created_from_inspo_id,
    createdFromNoteId: confirmedNormalized.created_from_note_id || normalized.created_from_note_id,
    sourceNoteId: confirmedNormalized.source_note_id || normalized.source_note_id,
    sourceInspoId: confirmedNormalized.source_inspo_id || normalized.source_inspo_id,
    sourceAiDraftId: confirmedNormalized.source_ai_draft_id || normalized.source_ai_draft_id,
    sourceImportJobId: confirmedNormalized.source_import_job_id || normalized.source_import_job_id,
    createdFromFlow: confirmedNormalized.created_from_flow || normalized.created_from_flow,
    movedToPostAt: confirmedNormalized.moved_to_post_at || normalized.moved_to_post_at,
    archivedAt: confirmedNormalized.archived_at || normalized.archived_at,
    flowState: confirmedNormalized.flow_state || normalized.flow_state,
    campaignId: confirmedNormalized.campaign_id || normalized.campaign_id,
    campaignName: confirmedNormalized.campaign_name || normalized.campaign_name,
    notes: confirmedNormalized.notes || normalized.notes,
    impressions: confirmedNormalized.impressions || normalized.impressions,
    reach: confirmedNormalized.reach || normalized.reach,
    likes: confirmedNormalized.likes || normalized.likes,
    comments: confirmedNormalized.comments || normalized.comments,
    shares: confirmedNormalized.shares || normalized.shares,
    saves: confirmedNormalized.saves || normalized.saves,
    clicks: confirmedNormalized.clicks || normalized.clicks,
    engagementRate: confirmedNormalized.engagement_rate || normalized.engagement_rate,
    sourceUrl: confirmedNormalized.source_url || normalized.source_url,
    sourceType: confirmedNormalized.source_type || normalized.source_type,
    sourcePlatform: confirmedNormalized.source_platform || normalized.source_platform,
    sourceTitle: confirmedNormalized.source_title || normalized.source_title,
    sourceMetadata: confirmedNormalized.source_metadata || normalized.source_metadata,
    sourceImportStatus: confirmedNormalized.source_import_status || normalized.source_import_status,
    importedAt: confirmedNormalized.imported_at || normalized.imported_at,
    importJobId: confirmedNormalized.import_job_id || normalized.import_job_id,
    originalPostDate: confirmedNormalized.original_post_date || normalized.original_post_date,
    originalPostDateLabel: confirmedNormalized.original_post_date_label || normalized.original_post_date_label,
    dateConfidence: confirmedNormalized.date_confidence || normalized.date_confidence,
    linkedinPostId: confirmedNormalized.linkedin_post_id || normalized.linkedin_post_id,
    normalizedTextHash: confirmedNormalized.normalized_text_hash || normalized.normalized_text_hash,
    isRepost: confirmedNormalized.is_repost || normalized.is_repost,
    repostAuthor: confirmedNormalized.repost_author || normalized.repost_author,
    repostCommentary: confirmedNormalized.repost_commentary || normalized.repost_commentary,
    originalAuthor: confirmedNormalized.original_author || normalized.original_author,
    originalPostExcerpt: confirmedNormalized.original_post_excerpt || normalized.original_post_excerpt,
    platformTargets: platformTargets,
    publishStatus: confirmedNormalized.publish_status || normalized.publish_status,
    publishedUrl: confirmedNormalized.published_url || normalized.published_url,
    publishedAt: confirmedNormalized.published_at || normalized.published_at,
    apiPostId: confirmedNormalized.api_post_id || normalized.api_post_id,
    apiError: confirmedNormalized.api_error || normalized.api_error,
    platformCaptionOverride: confirmedNormalized.platform_caption_override || normalized.platform_caption_override,
    platformCharacterCount: confirmedNormalized.platform_character_count || normalized.platform_character_count,
    requiresManualReview: confirmedNormalized.requires_manual_review || normalized.requires_manual_review,
    carouselAssetIds: carouselAssetIds,
    aiSourceType: confirmedNormalized.ai_source_type || normalized.ai_source_type,
    aiSourceId: confirmedNormalized.ai_source_id || normalized.ai_source_id,
    aiPrompt: confirmedNormalized.ai_prompt || normalized.ai_prompt,
    aiGenerationMode: confirmedNormalized.ai_generation_mode || normalized.ai_generation_mode,
    aiBrandFrameworkVersion: confirmedNormalized.ai_brand_framework_version || normalized.ai_brand_framework_version,
    aiDraftStatus: confirmedNormalized.ai_draft_status || normalized.ai_draft_status,
    aiReviewNotes: confirmedNormalized.ai_review_notes || normalized.ai_review_notes,
    workspaceId: confirmedNormalized.workspace_id || normalized.workspace_id,
    workspace_id: confirmedNormalized.workspace_id || normalized.workspace_id,
    mediaId: confirmedNormalized.media_id || normalized.media_id,
    media_id: confirmedNormalized.media_id || normalized.media_id,
    mediaUrl: confirmedNormalized.media_url || normalized.media_url,
    media_url: confirmedNormalized.media_url || normalized.media_url,
    mediaType: confirmedNormalized.media_type || normalized.media_type,
    media_type: confirmedNormalized.media_type || normalized.media_type,
    mediaFilename: confirmedNormalized.media_filename || normalized.media_filename,
    media_filename: confirmedNormalized.media_filename || normalized.media_filename,
    mediaAltText: confirmedNormalized.media_alt_text || normalized.media_alt_text,
    media_alt_text: confirmedNormalized.media_alt_text || normalized.media_alt_text,
    mediaSource: confirmedNormalized.media_source || normalized.media_source,
    media_source: confirmedNormalized.media_source || normalized.media_source,
    storagePath: confirmedNormalized.storage_path || normalized.storage_path,
    storage_path: confirmedNormalized.storage_path || normalized.storage_path,
    mondayItemId: confirmedNormalized.monday_item_id || normalized.monday_item_id,
    monday_item_id: confirmedNormalized.monday_item_id || normalized.monday_item_id,
    mondayGroupId: confirmedNormalized.monday_group_id || normalized.monday_group_id,
    monday_group_id: confirmedNormalized.monday_group_id || normalized.monday_group_id,
    mondayLastSyncedAt: confirmedNormalized.monday_last_synced_at || normalized.monday_last_synced_at,
    monday_last_synced_at: confirmedNormalized.monday_last_synced_at || normalized.monday_last_synced_at,
    mondaySyncStatus: confirmedNormalized.monday_sync_status || normalized.monday_sync_status,
    monday_sync_status: confirmedNormalized.monday_sync_status || normalized.monday_sync_status,
    hasUserSelectedTime: planning.hasUserSelectedTime && workflow.isScheduledValid,
    carouselAssets: [],
    scheduledDateKey: workflow.dateKey,
    workflowBucket: workflow.workflowBucket,
    dateDiagnostics: buildDateDiagnostics_(normalized.scheduled_at, workflow.dateKey, normalized.queue_date_label, normalized.queue_time_label, planning.hasUserSelectedTime && workflow.isScheduledValid)
  }, semanticFieldsFromRow_(confirmedNormalized));
  console.log("[savePost] response", JSON.stringify({ postId: response.postId, rowNumber: response.rowNumber, source: response.source }));
    if (Date.now() - start > 25000) {
      return { ok: false, success: false, error: "Save exceeded backend time budget." };
    }
    return { ok: true, success: true, post: response };
}

function deletePost(postId) {
  if (!postId) throw new Error("Missing postId");

  const sheet = getPostsSheet_();
  deleteRowByAliases_(sheet, ["post_id"], postId);
  unlinkMediaForPost_(postId);
}

function duplicatePost(payload) {
  if (!payload || !payload.duplicate) throw new Error("Missing duplicate payload");
  const duplicate = {};
  Object.keys(payload.duplicate).forEach(function(key) {
    duplicate[key] = payload.duplicate[key];
  });
  duplicate.postId = createPostId_();
  duplicate.status = "draft";
  duplicate.scheduled_at = "";
  duplicate.queue_date_label = "";
  duplicate.queue_time_label = "";
  return savePost(duplicate);
}

function uploadMedia(payload) {
  if (!payload || !payload.fileName || !payload.mimeType || !payload.base64Data) {
    throw new Error("Missing upload payload");
  }

  const folder = getMediaFolder_();
  const bytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(bytes, payload.mimeType, payload.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);

  const assetId = createAssetId_();
  const sheet = getCoreSheet_("media");
  ensureHeadersPresent_(sheet, PHASE1_MEDIA_REFERENCE_HEADERS);
  const normalized = {
    asset_id: assetId,
    asset_name: String(payload.fileName || "").trim(),
    asset_type: detectAssetType_(payload.mimeType, payload.fileName),
    asset_badge: String(payload.assetBadge || "").trim(),
    asset_meta: String(payload.assetMeta || "").trim(),
    linked_post_id: String(payload.linkedPostId || "").trim(),
    asset_status: "ready",
    placeholder_icon: String(payload.placeholderIcon || "").trim() || derivePlaceholderIcon_(detectAssetType_(payload.mimeType, payload.fileName)),
    file_url: file.getUrl(),
    campaign: String(payload.campaign || "").trim(),
    notes: String(payload.notes || "").trim(),
    drive_file_id: file.getId(),
    source_url: "",
    source_type: "upload",
    mime_type: String(payload.mimeType || "").trim(),
    file_size_bytes: normalizeNumber_(pickFirstDefined_(payload.fileSizeBytes, payload.file_size_bytes, bytes.length)),
    original_filename: String(pickFirstDefined_(payload.originalFilename, payload.original_filename, payload.fileName, "")).trim(),
    imported_media_source: String(pickFirstDefined_(payload.importedMediaSource, payload.imported_media_source, "drive_upload")).trim(),
    media_id: String(pickFirstDefined_(payload.media_id, payload.mediaId, assetId)).trim(),
    media_url: file.getUrl(),
    media_type: String(pickFirstDefined_(payload.media_type, payload.mediaType, detectAssetType_(payload.mimeType, payload.fileName))).trim(),
    media_filename: String(pickFirstDefined_(payload.media_filename, payload.mediaFilename, payload.originalFilename, payload.original_filename, payload.fileName, "")).trim(),
    media_alt_text: String(pickFirstDefined_(payload.media_alt_text, payload.mediaAltText, payload.altText, payload.alt_text, "")).trim(),
    media_source: String(pickFirstDefined_(payload.media_source, payload.mediaSource, "google_drive")).trim(),
    storage_path: String(pickFirstDefined_(payload.storage_path, payload.storagePath, "")).trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, null);

  upsertObjectByHeader_(sheet, ["asset_id"], normalized, REQUIRED_MEDIA_HEADERS, MEDIA_FORMULA_HEADERS);

  if (normalized.linked_post_id) {
    syncMediaLinkForPost_(normalized.linked_post_id, normalized.asset_id, normalized.campaign, normalized.asset_name);
  }

  return Object.assign({
    assetId: normalized.asset_id,
    assetName: normalized.asset_name,
    assetType: normalized.asset_type,
    assetBadge: normalized.asset_badge,
    assetMeta: normalized.asset_meta,
    linkedPostId: normalized.linked_post_id,
    assetStatus: normalized.asset_status,
    placeholderIcon: normalized.placeholder_icon,
    fileUrl: normalized.file_url,
    campaign: normalized.campaign,
    notes: normalized.notes,
    driveFileId: normalized.drive_file_id,
    sourceUrl: normalized.source_url,
    sourceType: normalized.source_type,
    mimeType: normalized.mime_type,
    fileSizeBytes: normalized.file_size_bytes,
    originalFilename: normalized.original_filename,
    importedMediaSource: normalized.imported_media_source,
    mediaId: normalized.media_id,
    media_id: normalized.media_id,
    mediaUrl: normalized.media_url,
    media_url: normalized.media_url,
    mediaType: normalized.media_type,
    media_type: normalized.media_type,
    mediaFilename: normalized.media_filename,
    media_filename: normalized.media_filename,
    mediaAltText: normalized.media_alt_text,
    media_alt_text: normalized.media_alt_text,
    mediaSource: normalized.media_source,
    media_source: normalized.media_source,
    storagePath: normalized.storage_path,
    storage_path: normalized.storage_path
  }, semanticFieldsFromRow_(normalized));
}

function importMediaManifest(payload) {
  if (!payload || !payload.items || !Array.isArray(payload.items)) {
    return { ok: false, error: "No media manifest items provided." };
  }

  var results = [];
  var folder = getMediaFolder_();
  var sheet = getCoreSheet_("media");
  var importedCount = 0;
  var failedCount = 0;
  var skippedCount = 0;

  payload.items.forEach(function(entry) {
    var postUrl = String(entry.linkedin_url || entry.url || "").trim();
    var linkedinPostId = parseLinkedInPostIdFromUrl_(postUrl);
    var captureIndex = entry.capture_index;
    var entryMedia = Array.isArray(entry.media) ? entry.media : [];

    entryMedia.forEach(function(m) {
      var url = String(m.url || "").trim();
      if (!url) {
        skippedCount++;
        return;
      }
      var mediaType = String(m.type || "unknown").trim();
      var alt = String(m.alt || "").trim();
      var assetName = inferAssetNameFromUrl_(url) || "linkedin-media-" + entry.capture_index + "-" + results.length;

      var driveFileId = "";
      var driveFileUrl = "";
      var needsManualDownload = false;
      var uploadError = "";
      var mimeType = mediaType === "video" ? "video/mp4" : mediaType === "document_thumbnail" ? "image/png" : "image/jpeg";

      try {
        var response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          timeout: 30000
        });
        var responseCode = response.getResponseCode();
        if (responseCode >= 200 && responseCode < 400) {
          var blob = response.getBlob();
          blob.setName(assetName);
          if (!blob.getContentType() || blob.getContentType() === "application/octet-stream") {
            blob.setContentType(mimeType);
          }
          var file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
          driveFileId = file.getId();
          driveFileUrl = file.getUrl();
          importedCount++;
        } else {
          needsManualDownload = true;
          failedCount++;
          uploadError = "HTTP " + responseCode;
        }
      } catch (e) {
        needsManualDownload = true;
        failedCount++;
        uploadError = e.message || "Fetch failed";
      }

      var assetId = createAssetId_();
      var assetType = mediaType === "video" ? "video" : mediaType === "document_thumbnail" ? "document_thumbnail" : "image";
      var normalized = {
        asset_id: assetId,
        asset_name: assetName,
        asset_type: assetType,
        asset_badge: needsManualDownload ? "needs_manual_download" : "ready",
        asset_meta: "" + (alt ? "Alt: " + alt : "") + (uploadError ? " | Error: " + uploadError : ""),
        linked_post_id: linkedinPostId,
        asset_status: needsManualDownload ? "needs_manual_download" : "ready",
        placeholder_icon: derivePlaceholderIcon_(assetType),
        file_url: driveFileUrl,
        campaign: "",
        notes: "Imported from LinkedIn Export Helper. " + (needsManualDownload ? "Media URL blocked or expired. Manual download required." : "Uploaded to Drive."),
        drive_file_id: driveFileId,
        source_url: url,
        source_type: "linkedin_export_helper",
        mime_type: mimeType,
        file_size_bytes: 0,
        original_filename: assetName,
        imported_media_source: needsManualDownload ? "reference_url" : "drive_upload",
        reference_url: needsManualDownload ? url : "",
        needs_manual_download: needsManualDownload,
        linkedin_post_id: linkedinPostId,
        capture_index: captureIndex,
        width: m.width || 0,
        height: m.height || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      applySemanticFieldsToRow_(normalized, payload, null);
      upsertObjectByHeader_(sheet, ["asset_id"], normalized, REQUIRED_MEDIA_HEADERS, MEDIA_FORMULA_HEADERS);

      if (linkedinPostId) {
        syncMediaLinkForPost_(linkedinPostId, assetId, "", assetName);
      }

      results.push(normalized);
    });
  });

  var needsManualDownload = results.filter(function(r) { return r.needs_manual_download; }).length;
  var withPostLink = results.filter(function(r) { return r.linked_post_id; }).length;
  return {
    ok: true,
    total: results.length,
    mediaDetected: payload.items.reduce(function(sum, entry) { return sum + (Array.isArray(entry.media) ? entry.media.length : 0); }, 0),
    mediaLinked: withPostLink,
    uploadedToDrive: importedCount,
    referenceOnly: needsManualDownload,
    failed: failedCount,
    skipped: skippedCount,
    needsManualDownload: needsManualDownload,
    assets: results.map(function(r) {
      return {
        assetId: r.asset_id,
        assetName: r.asset_name,
        assetType: r.asset_type,
        assetStatus: r.asset_status,
        driveFileUrl: r.file_url,
        sourceUrl: r.source_url,
        needsManualDownload: r.needs_manual_download,
        linkedPostId: r.linked_post_id
      };
    })
  };
}

function saveMediaLink(payload) {
  if (!payload) throw new Error("Missing media link payload");

  const sheet = getCoreSheet_("media");
  const resolved = resolveMediaSource_(payload);
  const assetType = normalizeLinkedAssetType_(payload.assetType || resolved.assetType || "image");
  const assetName = String(payload.assetName || resolved.assetName || "").trim()
    || inferAssetNameFromUrl_(resolved.fileUrl || resolved.sourceUrl || "")
    || "Linked Asset";
  const linkedPostId = String(payload.linkedPostId || "").trim();
  const assetId = createAssetId_();

  ensureHeadersPresent_(sheet, PHASE1_MEDIA_REFERENCE_HEADERS);
  const normalized = {
    asset_id: assetId,
    asset_name: assetName,
    asset_type: assetType,
    asset_badge: String(payload.assetBadge || resolved.assetBadge || "").trim(),
    asset_meta: String(payload.assetMeta || resolved.assetMeta || "").trim(),
    linked_post_id: linkedPostId,
    asset_status: "linked",
    placeholder_icon: String(payload.placeholderIcon || "").trim() || derivePlaceholderIcon_(assetType),
    file_url: String(payload.fileUrl || resolved.fileUrl || resolved.sourceUrl || "").trim(),
    campaign: String(payload.campaign || "").trim(),
    notes: String(payload.notes || "").trim(),
    drive_file_id: String(payload.driveFileId || resolved.driveFileId || "").trim(),
    source_url: String(payload.sourceUrl || resolved.sourceUrl || "").trim(),
    source_type: String(payload.sourceType || resolved.sourceType || "").trim() || "external",
    mime_type: String(payload.mimeType || resolved.mimeType || "").trim(),
    file_size_bytes: normalizeNumber_(pickFirstDefined_(payload.fileSizeBytes, payload.file_size_bytes, resolved.fileSizeBytes)),
    original_filename: String(pickFirstDefined_(payload.originalFilename, payload.original_filename, assetName, "")).trim(),
    imported_media_source: String(pickFirstDefined_(payload.importedMediaSource, payload.imported_media_source, resolved.importedMediaSource, "linked_external")).trim(),
    media_id: String(pickFirstDefined_(payload.media_id, payload.mediaId, assetId)).trim(),
    media_url: String(pickFirstDefined_(payload.media_url, payload.mediaUrl, payload.fileUrl, resolved.fileUrl, resolved.sourceUrl, "")).trim(),
    media_type: String(pickFirstDefined_(payload.media_type, payload.mediaType, assetType, "")).trim(),
    media_filename: String(pickFirstDefined_(payload.media_filename, payload.mediaFilename, payload.originalFilename, payload.original_filename, assetName, "")).trim(),
    media_alt_text: String(pickFirstDefined_(payload.media_alt_text, payload.mediaAltText, payload.altText, payload.alt_text, "")).trim(),
    media_source: String(pickFirstDefined_(payload.media_source, payload.mediaSource, payload.sourceType, resolved.sourceType, "external")).trim(),
    storage_path: String(pickFirstDefined_(payload.storage_path, payload.storagePath, "")).trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, null);

  upsertObjectByHeader_(sheet, ["asset_id"], normalized, REQUIRED_MEDIA_HEADERS, MEDIA_FORMULA_HEADERS);

  if (linkedPostId) {
    syncMediaLinkForPost_(linkedPostId, normalized.asset_id, normalized.campaign, normalized.asset_name);
  }

  return Object.assign({
    assetId: normalized.asset_id,
    assetName: normalized.asset_name,
    assetType: normalized.asset_type,
    assetBadge: normalized.asset_badge,
    assetMeta: normalized.asset_meta,
    linkedPostId: normalized.linked_post_id,
    assetStatus: normalized.asset_status,
    placeholderIcon: normalized.placeholder_icon,
    fileUrl: normalized.file_url,
    campaign: normalized.campaign,
    notes: normalized.notes,
    driveFileId: normalized.drive_file_id,
    sourceUrl: normalized.source_url,
    sourceType: normalized.source_type,
    mimeType: normalized.mime_type,
    fileSizeBytes: normalized.file_size_bytes,
    originalFilename: normalized.original_filename,
    importedMediaSource: normalized.imported_media_source,
    mediaId: normalized.media_id,
    media_id: normalized.media_id,
    mediaUrl: normalized.media_url,
    media_url: normalized.media_url,
    mediaType: normalized.media_type,
    media_type: normalized.media_type,
    mediaFilename: normalized.media_filename,
    media_filename: normalized.media_filename,
    mediaAltText: normalized.media_alt_text,
    media_alt_text: normalized.media_alt_text,
    mediaSource: normalized.media_source,
    media_source: normalized.media_source,
    storagePath: normalized.storage_path,
    storage_path: normalized.storage_path
  }, semanticFieldsFromRow_(normalized));
}

function saveInspo(payload) {
  const sheet = getCoreSheet_("inspo");
  const existing = findObjectByNormalizedHeaderValue_(sheet, ["inspo_id"], payload.inspoId, REQUIRED_INSPO_HEADERS);
  const tracking = buildFlowTrackingFields_(payload, existing, { entityType: "inspo" });
  const normalized = {
    inspo_id: String(payload.inspoId || existing && existing.inspo_id || createInspoId_()).trim(),
    inspo_type: String(payload.inspoType || existing && existing.inspo_type || "article").trim(),
    title: String(payload.title || existing && existing.title || "").trim(),
    inspo_title: String(payload.inspoTitle || existing && existing.inspo_title || "").trim(),
    source_title: String(payload.sourceTitle || existing && existing.source_title || "").trim(),
    link_title: String(payload.linkTitle || existing && existing.link_title || "").trim(),
    page_title: String(payload.pageTitle || existing && existing.page_title || "").trim(),
    imported_title: String(payload.importedTitle || existing && existing.imported_title || "").trim(),
    headline: String(payload.headline || existing && existing.headline || "").trim(),
    description: String(payload.description || existing && existing.description || "").trim(),
    url: String(payload.url || existing && existing.url || "").trim(),
    source_label: String(payload.sourceLabel || existing && existing.source_label || "Added manually").trim(),
    source_type: String(payload.sourceType || existing && existing.source_type || "").trim(),
    source_url: String(payload.sourceUrl || existing && existing.source_url || "").trim(),
    summary: String(payload.summary || existing && existing.summary || "").trim(),
    domain_or_meta: String(payload.domainOrMeta || existing && existing.domain_or_meta || "").trim(),
    suggested_platform: String(payload.suggestedPlatform || existing && existing.suggested_platform || "linkedin").trim(),
    suggested_pillar: normalizePillar_(pickFirstDefined_(payload.suggestedPillar, existing && existing.suggested_pillar), SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
    campaign_name: String(payload.campaignName || payload.campaign_name || existing && existing.campaign_name || "").trim(),
    pillar: String(payload.pillar || existing && existing.pillar || "").trim(),
    create_post_title: String(payload.createPostTitle || existing && existing.create_post_title || payload.title || "").trim(),
    create_post_description: String(payload.createPostDescription || existing && existing.create_post_description || payload.summary || "").trim(),
    create_post_type: String(payload.createPostType || existing && existing.create_post_type || "article").trim(),
    notes: String(payload.notes || existing && existing.notes || "").trim(),
    imported_at: String(payload.importedAt || existing && existing.imported_at || "").trim(),
    original_post_date: String(payload.originalPostDate || existing && existing.original_post_date || "").trim(),
    metrics_json: String(payload.metricsJson || existing && existing.metrics_json || "").trim(),
    status: String(payload.status || existing && existing.status || "active").trim() || "active",
    converted_post_id: String(payload.convertedPostId || existing && existing.converted_post_id || "").trim(),
    source_note_id: tracking.sourceNoteId,
    source_inspo_id: tracking.sourceInspoId,
    source_ai_draft_id: tracking.sourceAiDraftId,
    source_import_job_id: tracking.sourceImportJobId,
    created_from_flow: String(pickFirstDefined_(payload.createdFromFlow, payload.created_from_flow, existing && existing.created_from_flow, "manual")).trim() || "manual",
    moved_to_post_at: tracking.movedToPostAt,
    archived_at: tracking.archivedAt,
    flow_state: normalizeFlowState_("inspo", pickFirstDefined_(payload.flowState, payload.flow_state, existing && existing.flow_state, existing && existing.status, "active"), "active"),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);
  maybeAutoGenerateKeywords_(normalized, payload, existing);

  upsertObjectByHeader_(sheet, ["inspo_id"], normalized, REQUIRED_INSPO_HEADERS, INSPO_FORMULA_HEADERS);

  return normalizeInspoRow_(Object.assign({}, normalized, {
    inspoId: normalized.inspo_id,
    inspoType: normalized.inspo_type,
    sourceLabel: normalized.source_label,
    sourceUrl: normalized.source_url,
    campaignName: normalized.campaign_name,
    createdAt: normalized.created_at,
    updatedAt: normalized.updated_at,
    suggestedPlatform: normalized.suggested_platform,
    suggestedPillar: normalized.suggested_pillar,
    createPostTitle: normalized.create_post_title,
    createPostDescription: normalized.create_post_description,
    createPostType: normalized.create_post_type,
    importedAt: normalized.imported_at,
    originalPostDate: normalized.original_post_date,
    metricsJson: normalized.metrics_json,
    convertedPostId: normalized.converted_post_id,
    sourceNoteId: normalized.source_note_id,
    sourceInspoId: normalized.source_inspo_id,
    sourceAiDraftId: normalized.source_ai_draft_id,
    sourceImportJobId: normalized.source_import_job_id,
    createdFromFlow: normalized.created_from_flow,
    movedToPostAt: normalized.moved_to_post_at,
    archivedAt: normalized.archived_at,
    flowState: normalized.flow_state,
    row_number: (existing && existing.row_number) || undefined
  }));
}

function saveNote(payload) {
  const sheet = getCoreSheet_("notes");
  const existing = findObjectByNormalizedHeaderValue_(sheet, ["note_id", "noteId"], pickFirstDefined_(payload.noteId, payload.id), REQUIRED_NOTE_HEADERS);
  const tracking = buildFlowTrackingFields_(payload, existing, { entityType: "note" });
  const sourceUrl = String(pickFirstDefined_(payload.sourceUrl, payload.source_url, existing && existing.source_url, "")).trim();
  const sourcePlatform = detectSourcePlatform_(pickFirstDefined_(payload.sourcePlatform, payload.source_platform, sourceUrl));
  const normalized = {
    note_id: String(pickFirstDefined_(payload.noteId, payload.id, existing && existing.note_id, createNoteId_())).trim(),
    title: String(pickFirstDefined_(payload.title, existing && existing.title, "")).trim(),
    body: String(pickFirstDefined_(payload.body, payload.description, existing && existing.body, "")).trim(),
    bullets: stringifyBulletLines_(pickFirstDefined_(payload.bullets, existing && existing.bullets)),
    suggested_platform: String(pickFirstDefined_(payload.suggestedPlatform, payload.suggested_platform, existing && existing.suggested_platform, sourcePlatform || "linkedin")).trim() || "linkedin",
    suggested_pillar: normalizePillar_(pickFirstDefined_(payload.suggestedPillar, payload.suggested_pillar, existing && existing.suggested_pillar), SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
    status: String(pickFirstDefined_(payload.status, existing && existing.status, "active")).trim() || "active",
    converted_post_id: String(pickFirstDefined_(payload.convertedPostId, payload.converted_post_id, existing && existing.converted_post_id, "")).trim(),
    source_note_id: tracking.sourceNoteId || String(pickFirstDefined_(payload.noteId, payload.id, existing && existing.note_id, "")).trim(),
    source_inspo_id: tracking.sourceInspoId,
    source_ai_draft_id: tracking.sourceAiDraftId,
    source_import_job_id: tracking.sourceImportJobId,
    created_from_flow: String(pickFirstDefined_(payload.createdFromFlow, payload.created_from_flow, existing && existing.created_from_flow, "manual")).trim() || "manual",
    moved_to_post_at: tracking.movedToPostAt,
    archived_at: tracking.archivedAt,
    flow_state: normalizeFlowState_("note", pickFirstDefined_(payload.flowState, payload.flow_state, existing && existing.flow_state, existing && existing.status, "active"), "active"),
    source_url: sourceUrl,
    source_platform: sourcePlatform,
    source_label: String(pickFirstDefined_(payload.sourceLabel, payload.source_label, existing && existing.source_label, deriveSourceLabelFromPlatform_(sourcePlatform))).trim(),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);
  maybeAutoGenerateKeywords_(normalized, payload, existing);

  upsertObjectByHeader_(sheet, ["note_id", "noteId"], normalized, REQUIRED_NOTE_HEADERS, NOTE_FORMULA_HEADERS);

  return Object.assign({
    noteId: normalized.note_id,
    title: normalized.title,
    body: normalized.body,
    bullets: parseBulletLines_(normalized.bullets),
    suggestedPlatform: normalized.suggested_platform,
    suggestedPillar: normalized.suggested_pillar,
    status: normalized.status,
    convertedPostId: normalized.converted_post_id,
    sourceNoteId: normalized.source_note_id,
    sourceInspoId: normalized.source_inspo_id,
    sourceAiDraftId: normalized.source_ai_draft_id,
    sourceImportJobId: normalized.source_import_job_id,
    createdFromFlow: normalized.created_from_flow,
    movedToPostAt: normalized.moved_to_post_at,
    archivedAt: normalized.archived_at,
    flowState: normalized.flow_state,
    sourceUrl: normalized.source_url,
    sourcePlatform: normalized.source_platform,
    sourceLabel: normalized.source_label,
    createdAt: normalized.created_at,
    updatedAt: normalized.updated_at
  }, semanticFieldsFromRow_(normalized));
}

function deleteNote(noteId) {
  if (!noteId) throw new Error("Missing noteId");
  const sheet = getCoreSheet_("notes");
  deleteRowByAliases_(sheet, ["note_id", "noteId"], noteId);
}

function deleteInspo(inspoId) {
  if (!inspoId) throw new Error("Missing inspoId");
  const sheet = getCoreSheet_("inspo");
  deleteRowByAliases_(sheet, ["inspo_id"], inspoId);
}

function createPostFromNote(payload) {
  const noteId = String(payload && (payload.noteId || payload.note_id) || "").trim();
  if (!noteId) throw new Error("Missing noteId");

  const note = getNotes().find(function(item) {
    return item.noteId === noteId;
  });
  if (!note) throw new Error("Note not found");

  const bulletsText = (note.bullets || []).length ? "\n\n- " + note.bullets.join("\n- ") : "";
  const savePayload = Object.assign({}, payload.post || payload, {
    title: pickFirstDefined_(payload.title, payload.post && payload.post.title, note.title),
    description: pickFirstDefined_(payload.description, payload.post && payload.post.description, note.body + bulletsText),
    platform: pickFirstDefined_(payload.platform, payload.post && payload.post.platform, note.suggestedPlatform, "linkedin"),
    pillar: pickFirstDefined_(payload.pillar, payload.post && payload.post.pillar, note.suggestedPillar, SETTINGS_DEFAULTS.pillars[0]),
    postType: pickFirstDefined_(payload.postType, payload.post && payload.post.postType, "text"),
    createdFromNoteId: note.noteId,
    sourceNoteId: note.noteId,
    createdFromFlow: "note_to_post",
    sourceUrl: pickFirstDefined_(payload.sourceUrl, payload.post && payload.post.sourceUrl, note.sourceUrl),
    sourcePlatform: pickFirstDefined_(payload.sourcePlatform, payload.post && payload.post.sourcePlatform, note.sourcePlatform),
    sourceTitle: pickFirstDefined_(payload.sourceTitle, payload.post && payload.post.sourceTitle, note.title),
    sourceImportStatus: pickFirstDefined_(payload.sourceImportStatus, payload.post && payload.post.sourceImportStatus, note.sourceUrl ? "note_source" : "")
  });
  savePayload.semanticTags = pickFirstDefined_(payload.semanticTags, payload.post && payload.post.semanticTags, note.semanticTags);
  savePayload.semanticClusters = pickFirstDefined_(payload.semanticClusters, payload.post && payload.post.semanticClusters, note.semanticClusters);
  savePayload.semanticOrigin = pickFirstDefined_(payload.semanticOrigin, payload.post && payload.post.semanticOrigin, "note");
  savePayload.semanticSummary = pickFirstDefined_(payload.semanticSummary, payload.post && payload.post.semanticSummary, note.semanticSummary || note.body);
  const savedPost = savePost(savePayload);
  saveNote({
    noteId: note.noteId,
    title: note.title,
    body: note.body,
    bullets: note.bullets,
    suggestedPlatform: note.suggestedPlatform,
    suggestedPillar: note.suggestedPillar,
    sourceUrl: note.sourceUrl,
    sourcePlatform: note.sourcePlatform,
    sourceLabel: note.sourceLabel,
    status: "converted_to_post",
    flowState: "converted_to_post",
    movedToPostAt: new Date().toISOString(),
    convertedPostId: savedPost.postId
  });
  return savedPost;
}

function getBrandFrameworkDefaults_() {
  return [
    { framework_key: "core_identity", section: "Core Identity", rule_type: "principle", title: "Core Identity", content: "Digital communications as public infrastructure.", importance: 10, strictness: "high", semantic_category: "identity", enabled: true, sort_order: 1 },
    { framework_key: "system_philosophy", section: "System Philosophy", rule_type: "principle", title: "System Philosophy", content: "Interpret systems, map relations, and make structures legible.", importance: 10, strictness: "high", semantic_category: "systems", enabled: true, sort_order: 2 },
    { framework_key: "participation_architecture", section: "Participation Architecture", rule_type: "principle", title: "Participation Architecture", content: "Design for participation and community-led systems rather than broadcast-first messaging.", importance: 9, strictness: "high", semantic_category: "participation", enabled: true, sort_order: 3 },
    { framework_key: "orientation", section: "Orientation", rule_type: "principle", title: "Orientation", content: "Prefer orientation over motivation and recognition before explanation.", importance: 9, strictness: "high", semantic_category: "orientation", enabled: true, sort_order: 4 },
    { framework_key: "spatial_systems", section: "Spatial / Geographic Systems", rule_type: "principle", title: "Spatial / Geographic Systems", content: "Ground ideas in place, proximity, local infrastructure, and spatial systems.", importance: 8, strictness: "medium", semantic_category: "spatial", enabled: true, sort_order: 5 },
    { framework_key: "interpreter_of_systems", section: "Interpreter of Systems", rule_type: "principle", title: "Interpreter of Systems", content: "Translate systems, explain hidden structures, and connect moving parts without flattening nuance.", importance: 9, strictness: "high", semantic_category: "translation", enabled: true, sort_order: 6 },
    { framework_key: "classification_before_distribution", section: "Classification Before Distribution", rule_type: "rule", title: "Classification Before Distribution", content: "Clarify classification and semantic structure before optimizing distribution.", importance: 10, strictness: "high", semantic_category: "classification", enabled: true, sort_order: 7 },
    { framework_key: "community_led_systems", section: "Community-Led Systems", rule_type: "principle", title: "Community-Led Systems", content: "Center community-led systems, local participation, and reciprocal infrastructure.", importance: 9, strictness: "high", semantic_category: "community", enabled: true, sort_order: 8 },
    { framework_key: "language_carries_structure", section: "Language Carries Structure", rule_type: "rule", title: "Language Carries Structure", content: "Treat wording as structural design. Language should carry orientation, classification, and legibility.", importance: 8, strictness: "high", semantic_category: "language", enabled: true, sort_order: 9 },
    { framework_key: "embedded_builder_perspective", section: "Embedded Builder Perspective", rule_type: "principle", title: "Embedded Builder Perspective", content: "Write from inside the work as an embedded builder and analyzer, not a detached commentator.", importance: 8, strictness: "high", semantic_category: "perspective", enabled: true, sort_order: 10 },
    { framework_key: "legibility", section: "Legibility", rule_type: "rule", title: "Legibility", content: "Prefer semantic clarity, recognition, and public-interface legibility over vague abstraction.", importance: 8, strictness: "high", semantic_category: "legibility", enabled: true, sort_order: 11 },
    { framework_key: "platform_specific_strategy", section: "Platform-Specific Strategy", rule_type: "pattern", title: "Platform-Specific Strategy", content: "Adapt structure and formatting to each platform without losing the underlying system logic.", importance: 7, strictness: "medium", semantic_category: "platform", enabled: true, sort_order: 12 },
    { framework_key: "cta_philosophy", section: "CTA Philosophy", rule_type: "pattern", title: "CTA Philosophy", content: "CTA should invite participation, recognition, or practical next steps rather than hype.", importance: 7, strictness: "medium", semantic_category: "cta", enabled: true, sort_order: 13 },
    { framework_key: "hook_patterns", section: "Hook Patterns", rule_type: "pattern", title: "Hook Patterns", content: "Hooks should start from tension, classification, or an orienting observation.", importance: 8, strictness: "medium", semantic_category: "hook", enabled: true, sort_order: 14 },
    { framework_key: "emotional_entry_points", section: "Emotional Entry Points", rule_type: "pattern", title: "Emotional Entry Points", content: "Vary entry points across recognition, friction, proximity, surprise, and practical clarity.", importance: 7, strictness: "medium", semantic_category: "emotion", enabled: true, sort_order: 15 },
    { framework_key: "carousel_philosophy", section: "Carousel Philosophy", rule_type: "pattern", title: "Carousel Philosophy", content: "Treat carousels as structured sequences. Do not flatten the whole sequence into the caption.", importance: 9, strictness: "high", applies_to_post_type: "carousel", semantic_category: "carousel", enabled: true, sort_order: 16 },
    { framework_key: "anti_generic_marketer", section: "AI Anti-Patterns", rule_type: "anti_pattern", title: "Avoid Generic Marketer Tone", content: "Do not sound like a generic marketer or guru.", importance: 10, strictness: "high", anti_pattern: true, semantic_category: "tone", enabled: true, sort_order: 17 },
    { framework_key: "anti_quietly_doing", section: "Grammar Rules", rule_type: "anti_pattern", title: "Avoid Quietly Doing", content: "Avoid 'quietly doing'.", importance: 8, strictness: "high", anti_pattern: true, semantic_category: "grammar", enabled: true, sort_order: 18 },
    { framework_key: "anti_still_feeling", section: "Grammar Rules", rule_type: "anti_pattern", title: "Avoid Still Feeling", content: "Avoid 'still feeling'.", importance: 8, strictness: "high", anti_pattern: true, semantic_category: "grammar", enabled: true, sort_order: 19 },
    { framework_key: "preferred_vocab", section: "Preferred Vocabulary", rule_type: "vocabulary", title: "Preferred Vocabulary", content: "orientation, participation, legibility, infrastructure, recognition, proximity, systems, translation, classification, public interfaces, participation architecture, civic systems, semantic clarity, community-led, local systems, embedded analysis", importance: 7, strictness: "medium", preferred_pattern: true, semantic_category: "vocabulary", enabled: true, sort_order: 20 },
    { framework_key: "avoid_vocab", section: "Avoid Vocabulary", rule_type: "vocabulary", title: "Avoid Vocabulary", content: "generic inspiration, guru framing, detached institutional phrasing", importance: 7, strictness: "medium", anti_pattern: true, semantic_category: "vocabulary", enabled: true, sort_order: 21 }
  ];
}

function getBrandFramework() {
  var sheet = ensureSheet_("brandFramework", BRAND_FRAMEWORK_HEADERS);
  var rows = getObjectsFromSheet_(sheet);
  if (!rows.length) {
    var defaults = getBrandFrameworkDefaults_();
    defaults.forEach(function(item) {
      appendObjectRowByHeaders_(sheet, normalizeBrandFrameworkRow_(item));
    });
    rows = getObjectsFromSheet_(sheet);
  }
  return rows.map(function(row) {
    return brandFrameworkRowToObject_(row);
  }).filter(function(item) {
    return item.frameworkKey || item.section || item.title;
  }).sort(function(a, b) {
    return normalizeNumber_(a.sortOrder) - normalizeNumber_(b.sortOrder);
  });
}

function saveBrandFramework(payload) {
  var sheet = ensureSheet_("brandFramework", BRAND_FRAMEWORK_HEADERS);
  var items = Array.isArray(payload && payload.items) ? payload.items : [];
  if (!items.length) throw new Error("Missing brand framework items");

  items.forEach(function(item) {
    var existing = findObjectByHeaders_(sheet, ["framework_key"], item.frameworkKey || item.framework_key);
    var normalized = normalizeBrandFrameworkRow_(Object.assign({}, existing || {}, item));
    upsertObjectRowByAliases_(sheet, ["framework_key"], normalized);
  });

  return getBrandFramework();
}

function getBrandFrameworkVersion_() {
  return "brand-os-2026.05.09";
}

function getAIProviderName_() {
  var provider = String(getScriptProp_("AI_PROVIDER") || "local").trim().toLowerCase() || "local";
  return ["local", "openai", "gemini", "disabled"].indexOf(provider) >= 0 ? provider : "local";
}

function getAIProviderRuntimeConfig_() {
  var provider = getAIProviderName_();
  var config = AI_PROVIDER_CONFIG[provider];
  if (!config) {
    return {
      provider: provider,
      label: provider,
      supported: false,
      missingKeys: ["AI_PROVIDER"],
      configured: false,
      model: "",
      baseUrl: ""
    };
  }
  var apiKey = config.apiKeyKey ? getScriptProp_(config.apiKeyKey) : "";
  var model = config.modelKey ? getScriptProp_(config.modelKey) || config.defaultModel : config.defaultModel;
  var baseUrl = config.baseUrlKey ? getScriptProp_(config.baseUrlKey) || config.defaultBaseUrl : config.defaultBaseUrl;
  var missingKeys = [];
  if (!apiKey) missingKeys.push(config.apiKeyKey);
  if (provider === "local") missingKeys = [];
  if (provider === "disabled") missingKeys = [];
  return {
    provider: provider,
    label: config.label,
    supported: true,
    configured: provider === "disabled" ? false : !missingKeys.length,
    missingKeys: missingKeys,
    model: model,
    baseUrl: baseUrl,
    localFallbackAvailable: true,
    notice: provider === "local" || missingKeys.length
      ? "Using Local Creator Engine. Add an AI provider key for more advanced generation."
      : ""
  };
}

function isAIDraftingConfigured_() {
  return getAIProviderRuntimeConfig_().configured;
}

function assertAIDraftingConfigured_() {
  var runtime = getAIProviderRuntimeConfig_();
  if (!runtime.supported) throw new Error("Unsupported AI provider: " + runtime.provider);
  if (runtime.provider !== "local" && !runtime.configured) {
    throw new Error("Provider AI is not configured. Using Local Creator Engine does not require provider keys.");
  }
  return runtime;
}

function resolveAISourceRecord_(sourceType, sourceId) {
  var normalizedType = String(sourceType || "manual").trim();
  var normalizedId = String(sourceId || "").trim();
  if (!normalizedId) return {};
  if (normalizedType === "note") return getNotes().find(function(item) { return item.noteId === normalizedId; }) || {};
  if (normalizedType === "inspo") return getInspo().find(function(item) { return item.inspoId === normalizedId; }) || {};
  if (normalizedType === "post") return getPosts().find(function(item) { return item.postId === normalizedId; }) || {};
  if (normalizedType === "campaign") return getCampaigns().find(function(item) { return item.campaignId === normalizedId; }) || {};
  if (normalizedType === "media") return getMedia().find(function(item) { return item.assetId === normalizedId; }) || {};
  return {};
}

function getBrandVoiceRules_(platform, postType) {
  return getBrandFramework()
    .filter(function(item) {
      if (item.enabled === false) return false;
      if (item.appliesToPlatform && item.appliesToPlatform !== platform) return false;
      if (item.appliesToPostType && item.appliesToPostType !== postType) return false;
      return true;
    })
    .sort(function(a, b) {
      return Number(b.importance || 0) - Number(a.importance || 0);
    })
    .slice(0, 18)
    .map(function(item) {
      return [
        item.title || item.frameworkKey || "Guidance",
        item.content || "",
        item.antiPattern ? "Avoid this." : "",
        item.preferredPattern ? "Prefer this." : ""
      ].filter(Boolean).join(": ");
    });
}

function getAICreationOptions() {
  var runtime = getAIProviderRuntimeConfig_();
  return {
    backendConnected: runtime.configured || runtime.provider === "local",
    activeProvider: runtime.label,
    activeModel: runtime.model,
    missingSetupKeys: runtime.missingKeys,
    aiProvider: runtime.provider,
    localCreatorEngineAvailable: true,
    generationEngineOptions: ["auto", "local", "provider"],
    providerNotice: runtime.notice || "",
    frameworkVersion: getBrandFrameworkVersion_(),
    generationModes: [
      "LinkedIn draft",
      "Instagram caption",
      "Carousel draft",
      "Short video script",
      "Job board promo",
      "Campaign recap",
      "Platform analysis",
      "Local infrastructure post",
      "Alternate realities / solarpunk history"
    ],
    brandAlignmentChecklist: [
      "digital communications as public infrastructure",
      "participation architecture",
      "orientation",
      "spatial/geographic systems",
      "interpreter of systems",
      "classification before distribution",
      "community-led systems",
      "language carries structure",
      "embedded builder/analyzer perspective",
      "legibility"
    ],
    antiPatterns: [
      "do not sound like a generic marketer",
      "do not over-repeat source material",
      "do not flatten carousel into caption",
      "avoid guru language",
      "avoid generic inspiration",
      "avoid quietly doing",
      "avoid still feeling",
      "avoid repetitive antithesis framing",
      "avoid captions that are too long for carousels",
      "do not emit outline placeholders unless outline mode is requested"
    ],
    diversityControls: [
      "vary hook style",
      "vary structure",
      "vary CTA",
      "vary post length",
      "vary emotional entry point",
      "vary platform-specific formatting"
    ],
    guidance: runtime.configured
      ? "Live AI drafting is configured. Generate full drafts by default and use outline mode only when you explicitly want structure without finished prose."
      : "Using Local Creator Engine. Add an AI provider key for more advanced generation."
  };
}

function prepareAIGenerationContext(payload) {
  var request = normalizeAIDraftGenerationRequest_(payload || {});
  var runtime = getAIProviderRuntimeConfig_();
  var historicalContext = buildHistoricalAIPostContext_(request);
  return {
    sourceType: request.sourceType,
    sourceId: request.sourceId,
    sourceRecord: request.sourceRecord,
    frameworkVersion: getBrandFrameworkVersion_(),
    brandFramework: getBrandFramework(),
    options: getAICreationOptions(),
    providerStatus: {
      configured: runtime.configured || runtime.provider === "local",
      provider: runtime.label,
      model: runtime.model,
      missingSetupKeys: runtime.missingKeys,
      aiProvider: runtime.provider,
      localCreatorEngineAvailable: true,
      notice: runtime.notice || ""
    },
    historicalPosts: historicalContext.posts,
    historicalSummary: historicalContext.summary,
    guidance: runtime.configured
      ? "Live AI drafting is available. This context will be used to generate a finished draft unless outline mode is selected."
      : "Using Local Creator Engine. Add an AI provider key for more advanced generation."
  };
}

function normalizeAIDraftGenerationRequest_(payload) {
  var sourceType = String(payload && payload.sourceType || payload && payload.aiSourceType || "manual").trim() || "manual";
  var sourceId = String(payload && payload.sourceId || payload && payload.aiSourceId || "").trim();
  var platform = String(payload && payload.platform || "linkedin").trim().toLowerCase() || "linkedin";
  if (platform === "both") platform = "linkedin";
  var postType = String(payload && payload.postType || payload && payload.post_type || "text").trim().toLowerCase() || "text";
  var prompt = String(payload && payload.prompt || payload && payload.ideaPrompt || payload && payload.idea_prompt || "").trim();
  var existingText = String(payload && payload.existingText || payload && payload.description || payload && payload.draftText || payload && payload.draft_text || "").trim();
  var existingTitle = String(payload && payload.existingTitle || payload && payload.title || "").trim();
  var historyStartDate = normalizeAIDateFilterKey_(pickFirstDefined_(payload && payload.historyStartDate, payload && payload.history_start_date, payload && payload.startDate, payload && payload.start_date));
  var historyEndDate = normalizeAIDateFilterKey_(pickFirstDefined_(payload && payload.historyEndDate, payload && payload.history_end_date, payload && payload.endDate, payload && payload.end_date));
  if (historyStartDate && historyEndDate && historyStartDate > historyEndDate) {
    throw new Error("Historical post date filters are invalid. Start date must be on or before end date.");
  }
  return {
    aiDraftId: String(payload && payload.aiDraftId || payload && payload.ai_draft_id || "").trim(),
    sourceType: sourceType,
    sourceId: sourceId,
    sourceRecord: resolveAISourceRecord_(sourceType, sourceId),
    platform: platform,
    pillar: normalizePillar_(payload && payload.pillar || payload && payload.hubPillarLabel || "authority", "authority") || "authority",
    postType: postType,
    generationMode: String(payload && payload.generationMode || payload && payload.generation_mode || (postType === "carousel" ? "Carousel draft" : "LinkedIn draft")).trim(),
    generationStyle: String(payload && payload.generationStyle || payload && payload.generation_style || "match_my_style").trim(),
    targetField: String(payload && payload.targetField || payload && payload.target || "draft").trim(),
    prompt: prompt,
    existingText: existingText,
    existingTitle: existingTitle,
    campaignName: String(payload && payload.campaignName || payload && payload.campaign_name || "").trim(),
    outlineMode: normalizeBoolean_(payload && payload.outlineMode),
    desiredLength: String(payload && payload.desiredLength || "").trim(),
    title: existingTitle || deriveIdeaTitle_(prompt || existingText),
    historyPlatform: normalizeAIHistoryFilterValue_(pickFirstDefined_(payload && payload.historyPlatform, payload && payload.history_platform, payload && payload.platformFilter, payload && payload.platform_filter, platform)),
    historyCampaign: String(pickFirstDefined_(payload && payload.historyCampaign, payload && payload.history_campaign, payload && payload.campaignName, payload && payload.campaign_name, "")).trim(),
    historyPostType: normalizeAIHistoryFilterValue_(pickFirstDefined_(payload && payload.historyPostType, payload && payload.history_post_type, payload && payload.postTypeFilter, payload && payload.post_type_filter, "")),
    historyPostKind: normalizeAIHistoryPostKind_(pickFirstDefined_(payload && payload.historyPostKind, payload && payload.history_post_kind, payload && payload.repostFilter, payload && payload.repost_filter, "")),
    historySourceType: normalizeAIHistoryFilterValue_(pickFirstDefined_(payload && payload.historySourceType, payload && payload.history_source_type, payload && payload.sourceTypeFilter, payload && payload.source_type_filter, "")),
    historyStartDate: historyStartDate,
    historyEndDate: historyEndDate,
    allowStylizedUnicode: normalizeBoolean_(pickFirstDefined_(payload && payload.allowStylizedUnicode, payload && payload.allow_stylized_unicode, false))
  };
}

function normalizeAIHistoryFilterValue_(value) {
  var normalized = String(value || "").trim().toLowerCase();
  return normalized === "all" ? "" : normalized;
}

function normalizeAIHistoryPostKind_(value) {
  var normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "originals" || normalized === "original") return "original_only";
  if (normalized === "include_reposts" || normalized === "include-reposts" || normalized === "all") return "include_reposts";
  if (normalized === "repost_analysis" || normalized === "repost-analysis") return "repost_analysis";
  if (normalized === "reposts") return "reposts_only";
  if (normalized === "reshares") return "reshares_only";
  return "original_only";
}

function normalizeAIDateFilterKey_(value) {
  if (!value) return "";
  return getPlanningDateKeyFromValue_(value) || parseDisplayDateKey_(value);
}

function getHistoricalAIPostDateValue_(post) {
  return String(pickFirstDefined_(
    post && post.originalPostDate,
    post && post.original_post_date,
    post && post.scheduledAt,
    post && post.scheduled_at,
    post && post.createdAt,
    post && post.created_at,
    post && post.importedAt,
    post && post.imported_at
  )).trim();
}

function getHistoricalAIPostDateKey_(post) {
  return getPlanningDateKeyFromValue_(getHistoricalAIPostDateValue_(post)) || parseDisplayDateKey_(pickFirstDefined_(
    post && post.originalPostDateLabel,
    post && post.original_post_date_label,
    post && post.queueDateLabel,
    post && post.queue_date_label
  ));
}

function normalizeHistoricalAIPostKind_(post) {
  var postType = String(pickFirstDefined_(post && post.postType, post && post.post_type, "")).trim().toLowerCase();
  var isRepost = normalizeBoolean_(pickFirstDefined_(post && post.isRepost, post && post.is_repost, false));
  if (postType === "reshare") return "reshare";
  if (postType === "repost") return "repost";
  return isRepost ? "repost" : "original";
}

function buildHistoricalAIPostContext_(request) {
  var allPosts = getPosts().map(function(post, index) {
    var body = String(pickFirstDefined_(post.description, post.body, "")).trim();
    var kind = normalizeHistoricalAIPostKind_(post);
    var dateKey = getHistoricalAIPostDateKey_(post);
    return {
      index: index,
      postId: String(post.postId || post.post_id || "").trim(),
      title: String(post.title || "").trim(),
      platform: String(post.platform || "").trim().toLowerCase(),
      postType: String(post.postType || post.post_type || "text").trim().toLowerCase(),
      kind: kind,
      isRepost: kind !== "original",
      sourceType: String(post.sourceType || post.source_type || "").trim().toLowerCase(),
      campaignId: String(post.campaignId || post.campaign_id || "").trim(),
      campaignName: String(post.campaignName || post.campaign_name || "").trim(),
      body: body,
      originalPostDate: String(post.originalPostDate || post.original_post_date || "").trim(),
      originalPostDateLabel: String(post.originalPostDateLabel || post.original_post_date_label || "").trim(),
      dateConfidence: String(post.dateConfidence || post.date_confidence || "").trim() || "missing",
      normalizedTextHash: String(post.normalizedTextHash || post.normalized_text_hash || "").trim(),
      scheduledAt: String(post.scheduledAt || post.scheduled_at || "").trim(),
      createdAt: String(post.createdAt || post.created_at || post.importedAt || post.imported_at || "").trim(),
      dateKey: dateKey,
      metrics: {
        impressions: normalizeNumber_(post.impressions),
        reach: normalizeNumber_(post.reach),
        likes: normalizeNumber_(post.likes),
        comments: normalizeNumber_(post.comments),
        shares: normalizeNumber_(post.shares),
        saves: normalizeNumber_(post.saves),
        clicks: normalizeNumber_(post.clicks),
        engagementRate: normalizeNumber_(post.engagementRate || post.engagement_rate)
      }
    };
  }).filter(function(post) {
    return post.body || post.title;
  });
  var filtered = allPosts.filter(function(post) {
    if (request.historyPlatform && request.historyPlatform !== "both" && post.platform && post.platform !== request.historyPlatform) return false;
    if (request.historyCampaign) {
      var requestedCampaign = normalizeCampaignLookup_(request.historyCampaign);
      var postCampaignKey = normalizeCampaignLookup_(post.campaignName);
      if (requestedCampaign && requestedCampaign !== postCampaignKey && request.historyCampaign !== post.campaignId) return false;
    }
    if (request.historyPostType && post.postType !== request.historyPostType) return false;
    if (request.historySourceType && post.sourceType !== request.historySourceType) return false;
    if (request.historyStartDate && (!post.dateKey || post.dateKey < request.historyStartDate)) return false;
    if (request.historyEndDate && (!post.dateKey || post.dateKey > request.historyEndDate)) return false;
    if (request.historyPostKind === "original_only" && post.kind !== "original") return false;
    if (request.historyPostKind === "reposts_only" && post.kind !== "repost") return false;
    if (request.historyPostKind === "reshares_only" && post.kind !== "reshare") return false;
    if (request.historyPostKind === "repost_analysis" && post.kind === "original") return false;
    return true;
  }).sort(function(a, b) {
    if (request.historyPostKind !== "repost_analysis" && request.historyPostKind !== "reposts_only" && request.historyPostKind !== "reshares_only") {
      if (a.kind === "original" && b.kind !== "original") return -1;
      if (a.kind !== "original" && b.kind === "original") return 1;
    }
    var aDate = parseSheetDate_(a.originalPostDate || a.scheduledAt || a.createdAt);
    var bDate = parseSheetDate_(b.originalPostDate || b.scheduledAt || b.createdAt);
    return (bDate && !isNaN(bDate) ? bDate.getTime() : 0) - (aDate && !isNaN(aDate) ? aDate.getTime() : 0);
  });
  var summary = summarizeHistoricalAIPosts_(allPosts, filtered, request);
  var maxPosts = 18;
  var maxChars = 18000;
  var trimmed = [];
  var totalChars = 0;
  for (var index = 0; index < filtered.length; index += 1) {
    var entry = buildHistoricalAIPostContextEntry_(filtered[index]);
    var entrySize = JSON.stringify(entry).length;
    if (trimmed.length >= maxPosts || (trimmed.length && totalChars + entrySize > maxChars)) {
      summary.trimmed = true;
      summary.trimmingNote = "Historical post context trimmed to " + trimmed.length + " posts for model context size.";
      break;
    }
    trimmed.push(entry);
    totalChars += entrySize;
  }
  summary.postsUsed = trimmed.length;
  return {
    posts: trimmed,
    summary: summary
  };
}

function buildHistoricalAIPostContextEntry_(post) {
  return {
    postId: post.postId,
    title: post.title,
    platform: post.platform,
    postType: post.postType,
    kind: post.kind,
    sourceType: post.sourceType,
    campaignName: post.campaignName,
    body: post.body,
    originalPostDate: post.originalPostDate,
    originalPostDateLabel: post.originalPostDateLabel,
    dateConfidence: post.dateConfidence,
    normalizedTextHash: post.normalizedTextHash,
    metrics: post.metrics
  };
}

function summarizeHistoricalAIPosts_(allPosts, filteredPosts, request) {
  var counts = { original: 0, repost: 0, reshare: 0 };
  var platforms = {};
  var sourceTypes = {};
  var postTypes = {};
  var startKey = "";
  var endKey = "";
  filteredPosts.forEach(function(post) {
    counts[post.kind] = (counts[post.kind] || 0) + 1;
    if (post.platform) platforms[post.platform] = true;
    if (post.sourceType) sourceTypes[post.sourceType] = true;
    if (post.postType) postTypes[post.postType] = (postTypes[post.postType] || 0) + 1;
    if (post.dateKey && (!startKey || post.dateKey < startKey)) startKey = post.dateKey;
    if (post.dateKey && (!endKey || post.dateKey > endKey)) endKey = post.dateKey;
  });
  return {
    totalHistoricalPostsAvailable: allPosts.length,
    postsIncluded: filteredPosts.length,
    postsUsed: filteredPosts.length,
    dateRangeUsed: {
      start: request.historyStartDate || "",
      end: request.historyEndDate || ""
    },
    dateSpan: {
      start: startKey || "",
      end: endKey || ""
    },
    platformsIncluded: Object.keys(platforms),
    sourceTypesIncluded: Object.keys(sourceTypes),
    postTypesIncluded: Object.keys(postTypes).sort(function(a, b) { return postTypes[b] - postTypes[a]; }),
    originalsCount: counts.original || 0,
    repostsCount: counts.repost || 0,
    resharesCount: counts.reshare || 0,
    repostsIncluded: request.historyPostKind !== "original_only",
    filters: {
      platform: request.historyPlatform || "all",
      campaign: request.historyCampaign || "",
      postType: request.historyPostType || "all",
      postKind: request.historyPostKind || "original_only",
      sourceType: request.historySourceType || "all"
    },
    inferredPatterns: inferHistoricalPostPatterns_(filteredPosts),
    trimmed: false,
    trimmingNote: ""
  };
}

function inferHistoricalPostPatterns_(posts) {
  var stopWords = {
    the: true, and: true, that: true, this: true, with: true, from: true, have: true, about: true, into: true,
    your: true, their: true, they: true, them: true, then: true, when: true, what: true, where: true, which: true,
    while: true, been: true, were: true, will: true, would: true, there: true, here: true, just: true, like: true,
    into: true, over: true, because: true, through: true, after: true, before: true, more: true, than: true,
    also: true, only: true, much: true, each: true, make: true, made: true, make: true, does: true, dont: true,
    youre: true, its: true, our: true, for: true, are: true, was: true, but: true, not: true, can: true, how: true
  };
  var topicCounts = {};
  var hookCounts = {};
  var structureCounts = { questionHook: 0, numbered: 0, bulletLike: 0, shortParagraphs: 0 };
  var voiceCounts = { firstPerson: 0, directAddress: 0, observational: 0 };
  var postTypeCounts = {};
  posts.slice(0, 24).forEach(function(post) {
    var body = String(post.body || "").trim();
    if (!body) return;
    var hook = body.split(/\n+/)[0].trim().slice(0, 120);
    if (hook) hookCounts[hook] = (hookCounts[hook] || 0) + 1;
    if (/\?$/.test(hook)) structureCounts.questionHook += 1;
    if (/^\d+[.)\s]/.test(body)) structureCounts.numbered += 1;
    if (/^[\-\u2022*]/m.test(body)) structureCounts.bulletLike += 1;
    if ((body.match(/\n/g) || []).length >= 2) structureCounts.shortParagraphs += 1;
    if (/\b(i|we|my|our)\b/i.test(body)) voiceCounts.firstPerson += 1;
    if (/\byou\b/i.test(body)) voiceCounts.directAddress += 1;
    if (/\b(noticed|seeing|watching|mapping|tracking|learning|building)\b/i.test(body)) voiceCounts.observational += 1;
    postTypeCounts[post.postType] = (postTypeCounts[post.postType] || 0) + 1;
    body.toLowerCase().split(/[^a-z0-9]+/).forEach(function(word) {
      if (!word || word.length < 4 || stopWords[word]) return;
      topicCounts[word] = (topicCounts[word] || 0) + 1;
    });
  });
  var topTopics = Object.keys(topicCounts).sort(function(a, b) { return topicCounts[b] - topicCounts[a]; }).slice(0, 8);
  var topHooks = Object.keys(hookCounts).sort(function(a, b) { return hookCounts[b] - hookCounts[a]; }).slice(0, 4);
  var frequentPostTypes = Object.keys(postTypeCounts).sort(function(a, b) { return postTypeCounts[b] - postTypeCounts[a]; }).slice(0, 4);
  var voice = [];
  if (voiceCounts.firstPerson) voice.push("first-person reflection");
  if (voiceCounts.directAddress) voice.push("direct address");
  if (voiceCounts.observational) voice.push("observational systems voice");
  return {
    topHooks: topHooks,
    recurringTopics: topTopics,
    voiceSignals: voice,
    commonStructures: Object.keys(structureCounts).filter(function(key) { return structureCounts[key] > 0; }),
    frequentPostTypes: frequentPostTypes
  };
}

function buildAIDraftingPromptBundle_(request, context) {
  var sourceRecord = context && context.sourceRecord || request.sourceRecord || {};
  var sourceSummary = normalizeMetadataString_(sourceRecord);
  var brandRules = getBrandVoiceRules_(request.platform, request.postType);
  var modeLabel = request.outlineMode ? "outline mode" : "full draft mode";
  var styleLabel = request.generationStyle || "match_my_style";
  var historicalSummary = context && context.historicalSummary || {};
  var historicalPosts = Array.isArray(context && context.historicalPosts) ? context.historicalPosts : [];
  var historicalSummaryLines = [];
  if (historicalSummary.postsIncluded != null) historicalSummaryLines.push("Posts included after filters: " + historicalSummary.postsIncluded);
  if (historicalSummary.postsUsed != null) historicalSummaryLines.push("Posts used in prompt context: " + historicalSummary.postsUsed);
  if (historicalSummary.dateSpan && (historicalSummary.dateSpan.start || historicalSummary.dateSpan.end)) {
    historicalSummaryLines.push("Historical date span: " + [historicalSummary.dateSpan.start || "unknown", historicalSummary.dateSpan.end || "unknown"].join(" to "));
  }
  if (historicalSummary.platformsIncluded && historicalSummary.platformsIncluded.length) historicalSummaryLines.push("Platforms included: " + historicalSummary.platformsIncluded.join(", "));
  historicalSummaryLines.push("Original / repost / reshare counts: " + [historicalSummary.originalsCount || 0, historicalSummary.repostsCount || 0, historicalSummary.resharesCount || 0].join(" / "));
  if (historicalSummary.sourceTypesIncluded && historicalSummary.sourceTypesIncluded.length) historicalSummaryLines.push("Source types included: " + historicalSummary.sourceTypesIncluded.join(", "));
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.recurringTopics && historicalSummary.inferredPatterns.recurringTopics.length) {
    historicalSummaryLines.push("Recurring topics: " + historicalSummary.inferredPatterns.recurringTopics.join(", "));
  }
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.voiceSignals && historicalSummary.inferredPatterns.voiceSignals.length) {
    historicalSummaryLines.push("Voice signals: " + historicalSummary.inferredPatterns.voiceSignals.join(", "));
  }
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.commonStructures && historicalSummary.inferredPatterns.commonStructures.length) {
    historicalSummaryLines.push("Common structures: " + historicalSummary.inferredPatterns.commonStructures.join(", "));
  }
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.frequentPostTypes && historicalSummary.inferredPatterns.frequentPostTypes.length) {
    historicalSummaryLines.push("Frequent post types: " + historicalSummary.inferredPatterns.frequentPostTypes.join(", "));
  }
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.frequentFrameworks && historicalSummary.inferredPatterns.frequentFrameworks.length) {
    historicalSummaryLines.push("Creator frameworks: " + historicalSummary.inferredPatterns.frequentFrameworks.join(", "));
  }
  if (historicalSummary.inferredPatterns && historicalSummary.inferredPatterns.frequentMetaphors && historicalSummary.inferredPatterns.frequentMetaphors.length) {
    historicalSummaryLines.push("Recurring metaphors: " + historicalSummary.inferredPatterns.frequentMetaphors.join(", "));
  }
  if (historicalSummary.trimmed && historicalSummary.trimmingNote) historicalSummaryLines.push("Context trimming note: " + historicalSummary.trimmingNote);
  var styleInstructions = "";
  if (styleLabel === "match_my_style") {
    styleInstructions = [
      "Style mode: Match the creator's historical writing style. This is the default.",
      "Analyze the historical posts below for recurring patterns in: sentence rhythm, paragraph length, hook style, transition structure, CTA phrasing, metaphor use, analytical depth.",
      "Mirror those patterns in your output. The post should feel like it was written by the same person who wrote the historical examples.",
      "Prefer the creator's common structures, hooks, and cadence over generic AI writing conventions."
    ].join("\n");
  } else if (styleLabel === "match_framework") {
    styleInstructions = [
      "Style mode: Match a specific framework from the creator's library.",
      "If a framework is identified in the historical posts, structure the draft around it (Watershed Communication, Participation Pathways, Attention Systems, etc.).",
      "Use the framework's recurring phrasing and structural logic to shape the output."
    ].join("\n");
  } else if (styleLabel === "experimental") {
    styleInstructions = [
      "Style mode: Experimental. The creator wants to try something outside their usual patterns.",
      "Maintain voice authenticity but push structural, metaphorical, or topical boundaries.",
      "Use historical posts as contrast, not template. Write something that surprises while staying true to the creator's core perspective."
    ].join("\n");
  } else if (styleLabel === "newsletter") {
    styleInstructions = [
      "Style mode: Newsletter. Write in long-form essay style.",
      "Use a personal opening, framework breakdown, examples, and reflective closing.",
      "Include a subject line and formatted sections. Draw on the creator's analytical and systems-oriented voice."
    ].join("\n");
  } else if (styleLabel === "carousel") {
    styleInstructions = [
      "Style mode: Carousel. Optimize for slide-by-slide narrative.",
      "Each slide must advance a clear idea. Hook slide, body slides with frameworks or examples, closing with CTA.",
      "Use visual language that works with slide design: short titles, scannable copy, strong openings per slide."
    ].join("\n");
  } else if (styleLabel === "linkedin_reflection") {
    styleInstructions = [
      "Style mode: LinkedIn Reflection. Write a personal, reflective LinkedIn post.",
      "Start with an observation or personal experience. Connect it to a broader system or framework insight.",
      "Keep the tone conversational, vulnerable where appropriate, and end with an invitation for discussion.",
      "Avoid formulaic LinkedIn structures and guru language."
    ].join("\n");
  }
  var instructions = [
    "You write polished social drafts for StellarSync.",
    "Default to emotionally coherent, finished writing. Do not output placeholders, scaffolds, TODO notes, or advice to expand manually.",
    "Voice: conversational, emotionally grounded, observant, specific, and human.",
    "Avoid corporate tone, guru language, fake polish, generic inspiration, and repetitive AI phrasing.",
    "Do not give an overlong recap of imported historical posts. Infer patterns from them and use those patterns to write something usable now.",
    "Preserve vulnerability when the prompt is vulnerable. Do not sand off the emotional truth.",
    "Use context-aware formatting for the platform and post type.",
    "Infer useful patterns from prior posts when they are provided: hooks, themes, voice, common structures, recurring topics, and post types that appear often.",
    styleInstructions,
    request.outlineMode
      ? "Outline mode is explicitly enabled. You may return structured slide or section outlines, but they should still be useful and specific."
      : "Full draft mode is required. Return complete prose and complete slide copy, not outlines.",
    request.allowStylizedUnicode
      ? "Preserve meaningful Unicode characters from historical posts. Stylized Unicode is allowed sparingly for the opening hook only. Never stylize long paragraphs. Allowed styles include italic serif, bold serif, script, small caps, and circled numbers."
      : "Do not add stylized Unicode characters unless the prompt explicitly requires them.",
    "Return valid JSON only. No markdown fences."
  ].join("\n");
  var userPrompt = [
    "Requested mode: " + modeLabel,
    "Platform: " + request.platform,
    "Post type: " + request.postType,
    "Pillar: " + request.pillar,
    "Generation mode: " + request.generationMode,
    request.campaignName ? "Campaign: " + request.campaignName : "",
    request.title ? "Working title: " + request.title : "",
    request.prompt ? "Prompt: " + request.prompt : "",
    request.existingTitle ? "Existing title: " + request.existingTitle : "",
    request.existingText ? "Existing text: " + request.existingText : "",
    request.sourceType !== "manual" ? "Source type: " + request.sourceType : "",
    sourceSummary && sourceSummary !== "{}" ? "Source record: " + sourceSummary : "",
    brandRules.length ? "Brand voice rules:\n- " + brandRules.join("\n- ") : "",
    historicalSummaryLines.length ? "Historical post context summary:\n- " + historicalSummaryLines.join("\n- ") : "",
    historicalPosts.length ? "Historical post examples:\n" + historicalPosts.map(function(post, index) {
      return [
        "Example " + (index + 1),
        "platform=" + post.platform,
        "postType=" + post.postType,
        "kind=" + post.kind,
        "sourceType=" + post.sourceType,
        "date=" + (post.originalPostDateLabel || post.originalPostDate || "unknown"),
        "dateConfidence=" + (post.dateConfidence || "missing"),
        "metrics=" + JSON.stringify(post.metrics || {}),
        "body=" + String(post.body || "").trim().slice(0, 900)
      ].join(" | ");
    }).join("\n") : "",
    [
      "Return a JSON object with these keys:",
      "title: string",
      "draftText: string",
      "hookText: string",
      "ctaText: string",
      "captionVariant: string",
      "carouselSlides: array of objects with title and copy",
      "reviewNotes: string",
      "semanticTags: array of strings"
    ].join("\n"),
    request.postType === "carousel"
      ? "For carousels, create a hook slide, several body slides, and a closing slide. Each slide needs real copy, not placeholders."
      : "For non-carousel drafts, write the complete post body in draftText.",
    request.targetField && request.targetField !== "draft"
      ? "The user is currently editing this target field: " + request.targetField + ". Make sure the relevant field is strong."
      : ""
  ].filter(Boolean).join("\n\n");
  return {
    instructions: instructions,
    input: userPrompt
  };
}

function getLocalCreatorPromptText_(request) {
  return String(pickFirstDefined_(
    request && request.prompt,
    request && request.existingText,
    request && request.existingTitle,
    request && request.title,
    ""
  )).trim().replace(/\s+/g, " ");
}

function getLocalCreatorTokens_(text) {
  var stopWords = {
    about: true, after: true, again: true, also: true, because: true, being: true, could: true,
    from: true, have: true, into: true, just: true, like: true, more: true, that: true,
    their: true, there: true, this: true, with: true, would: true, your: true
  };
  var seen = {};
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(function(token) {
    if (token.length < 4 || stopWords[token] || seen[token]) return false;
    seen[token] = true;
    return true;
  }).slice(0, 24);
}

function scoreLocalCreatorPost_(post, tokens) {
  var haystack = [
    post && post.title,
    post && post.body,
    post && post.campaignName,
    post && post.platform,
    post && post.postType
  ].join(" ").toLowerCase();
  var score = 0;
  tokens.forEach(function(token) {
    if (haystack.indexOf(token) !== -1) score += 3;
  });
  if (post && post.kind === "original") score += 2;
  score += Math.min(4, String(post && post.body || "").length / 600);
  return score;
}

function getNearestLocalCreatorPosts_(request, context) {
  var promptText = getLocalCreatorPromptText_(request);
  var tokens = getLocalCreatorTokens_(promptText);
  var posts = Array.isArray(context && context.historicalPosts) ? context.historicalPosts : [];
  return posts.map(function(post) {
    return Object.assign({}, post, { localCreatorScore: scoreLocalCreatorPost_(post, tokens) });
  }).sort(function(a, b) {
    return b.localCreatorScore - a.localCreatorScore;
  }).slice(0, 3);
}

function buildLocalCreatorStyleProfile_(context) {
  var inferred = context && context.historicalSummary && context.historicalSummary.inferredPatterns || {};
  return {
    voiceTraits: normalizeListField_(inferred.voiceSignals).concat(["systems language", "concrete examples", "community infrastructure framing"]).filter(function(item, index, list) {
      return item && list.indexOf(item) === index;
    }).slice(0, 8),
    recurringThemes: normalizeListField_(inferred.recurringTopics).slice(0, 8),
    preferredStructures: normalizeListField_(inferred.commonStructures).slice(0, 6),
    recurringMetaphors: normalizeListField_(inferred.frequentMetaphors).slice(0, 5),
    frameworks: normalizeListField_(inferred.frequentFrameworks).slice(0, 5)
  };
}

function getLocalCreatorFrameworkMatches_(request, context) {
  var text = getLocalCreatorPromptText_(request).toLowerCase();
  var brandFramework = Array.isArray(context && context.brandFramework) ? context.brandFramework : getBrandFramework();
  return brandFramework.filter(function(item) {
    if (item && item.enabled === false) return false;
    var haystack = [item && item.frameworkKey, item && item.title, item && item.content, item && item.semanticCategory].join(" ").toLowerCase();
    return /community|climate|energy|distribution|infrastructure|systems|participation|communication|attention|framework/.test(text + " " + haystack)
      || getLocalCreatorTokens_(text).some(function(token) { return haystack.indexOf(token) !== -1; });
  }).sort(function(a, b) {
    return normalizeNumber_(b.importance) - normalizeNumber_(a.importance);
  }).slice(0, 5).map(function(item) {
    return String(item.title || item.frameworkKey || item.section || "").trim();
  }).filter(Boolean);
}

function chooseLocalCreatorFormula_(request, promptText) {
  var style = String(request && request.generationStyle || "").toLowerCase();
  var mode = String(request && request.generationMode || "").toLowerCase();
  var postType = String(request && request.postType || "").toLowerCase();
  var lower = String(promptText || "").toLowerCase();
  if (postType === "carousel" || mode.indexOf("carousel") !== -1 || style === "carousel") return "carousel_copy";
  if (style === "linkedin_reflection" || mode.indexOf("linkedin") !== -1) return "linkedin_reflection";
  if (style === "newsletter" || lower.indexOf("framework") !== -1 || mode.indexOf("framework") !== -1) return "framework_breakdown";
  if (/feel|felt|mind|support|personal|lesson|learned/.test(lower)) return "personal_reflection";
  return "systems_take";
}

function buildLocalCreatorCarouselSlides_(promptText, frame, examples) {
  return [
    { title: promptText || "The big claim", copy: frame.sharpClaim },
    { title: "What gets attention", copy: frame.usualFocus },
    { title: "What gets missed", copy: frame.systemIssue },
    { title: "What it looks like", copy: examples[0] || "The gap shows up in access, channels, trust, timing, and maintenance." },
    { title: "What changes", copy: examples[1] || "The work shifts from making the message louder to making the system more participatory." },
    { title: "Takeaway", copy: frame.implication }
  ];
}

function buildLocalCreatorFrame_(request, context, nearestPosts, styleProfile, frameworkMatches) {
  var promptText = getLocalCreatorPromptText_(request);
  var lower = promptText.toLowerCase();
  var themes = styleProfile.recurringThemes.length ? styleProfile.recurringThemes.slice(0, 4).join(", ") : "systems, participation, infrastructure, distribution";
  var campaign = request.campaignName || (nearestPosts[0] && nearestPosts[0].campaignName) || "";
  var framework = frameworkMatches[0] || styleProfile.frameworks[0] || "participation infrastructure";
  if (lower.indexOf("anything you set your mind to") !== -1) {
    return {
      sharpClaim: "“You can do anything you set your mind to” sounds empowering until you notice what it leaves out.",
      usualFocus: "People usually focus on effort, discipline, confidence, and desire.",
      systemIssue: "What gets missed is the distribution of time, access, recovery, mentorship, money, safety, and support.",
      examples: ["A person can be deeply committed and still be navigating unstable childcare, inaccessible networks, or systems that were not built for their participation.", "Mindset can help someone move, but conditions determine whether movement can become sustainable."],
      implication: "Better encouragement does not erase barriers. It names the conditions people need and helps build the support that makes effort possible.",
      framework: framework,
      campaign: campaign,
      themes: themes
    };
  }
  if (lower.indexOf("clean energy without distribution") !== -1 || lower.indexOf("new segregation") !== -1) {
    return {
      sharpClaim: "Clean energy without distribution is just the new segregation.",
      usualFocus: "People usually focus on generation, technology, adoption curves, and innovation.",
      systemIssue: "The overlooked question is who receives the benefits, who owns the infrastructure, and who gets to shape the transition.",
      examples: ["If cleaner power only reaches people who can already afford upgrades, the system has changed its branding more than its structure.", "Distribution means siting, financing, maintenance, local ownership, public interfaces, and community control."],
      implication: "A transition should be judged by where the power goes, who participates, and whether communities carrying the old burden get authority in the new system.",
      framework: framework,
      campaign: campaign,
      themes: themes
    };
  }
  if (lower.indexOf("community-led climate communication") !== -1) {
    return {
      sharpClaim: "Community-led climate communication is not a messaging tactic. It is an infrastructure question.",
      usualFocus: "A lot of climate communication focuses on better language, stronger campaigns, and clearer facts.",
      systemIssue: "The deeper issue is whether communities have channels, trust, participation paths, and attention systems that let information move both ways.",
      examples: ["A flyer, post, or town hall can inform people, but durable communication needs local messengers, feedback loops, translation, maintenance, and places where decisions are actually legible.", "Participation changes the work from broadcasting to building the channels people can use before, during, and after a crisis."],
      implication: "The goal is not simply to make climate messages more persuasive. It is to build communication systems communities can recognize, use, question, and shape.",
      framework: framework,
      campaign: campaign,
      themes: themes
    };
  }
  return {
    sharpClaim: promptText || "The strongest ideas are rarely just content ideas. They are systems trying to become visible.",
    usualFocus: "People usually focus on the message, the platform, the aesthetic, or the individual action.",
    systemIssue: "What matters underneath is distribution: who can access the thing, who can participate, what gets maintained, and what the interface makes legible.",
    examples: ["You can see it in communication channels, local infrastructure, public services, climate work, hiring systems, and creator platforms.", "The pattern is often the same: a promising idea fails when the conditions around it are treated as background."],
    implication: "When the system becomes visible, the next move gets more honest: change the conditions, not only the wording.",
    framework: framework,
    campaign: campaign,
    themes: themes
  };
}

function renderLocalCreatorFormula_(formula, frame, request) {
  if (formula === "personal_reflection") {
    return [
      frame.sharpClaim,
      "I keep coming back to this because the emotional truth is more complicated than the slogan.",
      frame.systemIssue,
      frame.examples[0],
      "The broader lesson: people do not only need more belief. They need conditions that make participation possible.",
      frame.implication
    ].join("\n\n");
  }
  if (formula === "framework_breakdown") {
    return [
      "A useful framework here: " + frame.framework + ".",
      "The point is simple: an idea does not become real just because it is well stated. It becomes real when the surrounding system can carry it.",
      "The components I would look for:",
      "1. Access - who can actually use or benefit from it.",
      "2. Distribution - where value flows and where it stops.",
      "3. Participation - who gets to shape the process.",
      "4. Maintenance - what keeps it working after launch.",
      "5. Legibility - whether people can understand the path and act on it.",
      frame.implication
    ].join("\n\n");
  }
  if (formula === "linkedin_reflection") {
    return [
      frame.sharpClaim,
      frame.usualFocus,
      frame.systemIssue,
      frame.examples[0],
      frame.examples[1],
      frame.implication
    ].join("\n\n");
  }
  return [
    frame.sharpClaim,
    frame.usualFocus,
    frame.systemIssue,
    frame.examples[0],
    frame.examples[1],
    frame.implication
  ].join("\n\n");
}

function renderLocalCreatorStructure_(formula, frame) {
  if (formula === "carousel_copy") {
    return buildLocalCreatorCarouselSlides_(frame.sharpClaim, frame, frame.examples).map(function(slide, index) {
      return "Slide " + (index + 1) + ": " + slide.title + "\n" + slide.copy;
    }).join("\n\n");
  }
  return [
    "Structure: " + formula.replace(/_/g, " "),
    "1. Sharp claim: " + frame.sharpClaim,
    "2. Common focus: " + frame.usualFocus,
    "3. Overlooked system issue: " + frame.systemIssue,
    "4. Examples: " + frame.examples.join(" / "),
    "5. Implication: " + frame.implication
  ].join("\n");
}

function generateLocalCreatorDraft_(request, context) {
  context = context || prepareAIGenerationContext(request);
  var promptText = getLocalCreatorPromptText_(request);
  var nearestPosts = getNearestLocalCreatorPosts_(request, context);
  var styleProfile = buildLocalCreatorStyleProfile_(context);
  var frameworkMatches = getLocalCreatorFrameworkMatches_(request, context);
  var formula = chooseLocalCreatorFormula_(request, promptText);
  var frame = buildLocalCreatorFrame_(request, context, nearestPosts, styleProfile, frameworkMatches);
  var carouselSlides = formula === "carousel_copy" || request.postType === "carousel"
    ? buildLocalCreatorCarouselSlides_(promptText, frame, frame.examples)
    : [];
  var draftText = request.outlineMode
    ? renderLocalCreatorStructure_(formula, frame)
    : carouselSlides.length
    ? frame.sharpClaim + "\n\n" + frame.implication
    : renderLocalCreatorFormula_(formula, frame, request);
  var title = request.title || deriveIdeaTitle_(promptText || frame.sharpClaim);
  var creatorMemoryUsed = {
    memoryGraphSummary: context.historicalSummary || {},
    creatorStyleProfile: styleProfile,
    recurringThemes: styleProfile.recurringThemes,
    matchingFrameworks: frameworkMatches,
    campaignContext: frame.campaign || request.campaignName || ""
  };
  return {
    aiDraftId: String(request.aiDraftId || "").trim(),
    title: title,
    platform: request.platform,
    postType: request.postType,
    generationMode: "local_creator_engine",
    requestedGenerationMode: request.generationMode,
    sourceType: request.sourceType,
    sourceId: request.sourceId,
    prompt: request.prompt,
    draftText: draftText,
    hookText: draftText.split(/\n+/)[0] || "",
    ctaText: "What would change if we designed for the conditions, not just the message?",
    captionVariant: draftText,
    carouselOutline: carouselSlides.length ? formatCarouselSlides_(carouselSlides) : "",
    carouselSlides: carouselSlides,
    draftStatus: request.outlineMode ? "outline_ready" : "needs_review",
    reviewNotes: "Generated with Local Creator Engine using " + formula.replace(/_/g, " ") + ".",
    semanticTags: getLocalCreatorTokens_(promptText).slice(0, 8),
    provider: "Local Creator Engine",
    model: "LOCAL_CREATOR_ENGINE",
    outlineMode: !!request.outlineMode,
    allowStylizedUnicode: !!request.allowStylizedUnicode,
    historicalSummary: context.historicalSummary || {},
    creatorMemoryUsed: creatorMemoryUsed,
    historicalReferences: nearestPosts.map(function(post) {
      return {
        postId: post.postId || "",
        title: post.title || "",
        campaignName: post.campaignName || "",
        platform: post.platform || "",
        excerpt: String(post.body || "").slice(0, 220)
      };
    }),
    summary: "Local draft shaped by creator memory, historical posts, frameworks, and campaign context.",
    localFallback: true,
    notice: "Using Local Creator Engine. Add an AI provider key for more advanced generation.",
    generatedAt: new Date().toISOString()
  };
}

function callOpenAIResponses_(request, runtime) {
  var bundle = buildAIDraftingPromptBundle_(request, prepareAIGenerationContext(request));
  var response = fetchJson_(runtime.baseUrl.replace(/\/+$/, "") + "/responses", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + getScriptProp_(AI_PROVIDER_CONFIG.openai.apiKeyKey)
    },
    payload: JSON.stringify({
      model: runtime.model,
      instructions: bundle.instructions,
      input: bundle.input,
      max_output_tokens: request.postType === "carousel" ? 2200 : 1600,
      text: { format: { type: "text" } }
    }),
    metaLabel: runtime.label + " drafting"
  });
  var text = extractOpenAIOutputText_(response);
  if (!text) throw new Error(runtime.label + " returned an empty drafting response.");
  return text;
}

function extractOpenAIOutputText_(response) {
  if (response && response.output_text) return String(response.output_text).trim();
  var output = response && response.output || [];
  for (var i = 0; i < output.length; i += 1) {
    var item = output[i];
    var content = item && item.content || [];
    for (var j = 0; j < content.length; j += 1) {
      if (content[j] && content[j].type === "output_text" && content[j].text) {
        return String(content[j].text).trim();
      }
    }
  }
  return "";
}

function extractJsonObjectText_(text) {
  var raw = String(text || "").trim();
  if (!raw) return "";
  var fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) raw = fenceMatch[1].trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
}

function formatCarouselSlides_(slides) {
  return (Array.isArray(slides) ? slides : []).map(function(slide, index) {
    var title = String(slide && slide.title || "Slide " + (index + 1)).trim();
    var copy = String(slide && slide.copy || "").trim();
    return "Slide " + (index + 1) + " - " + title + "\n" + copy;
  }).join("\n\n");
}

function containsAIDraftPlaceholder_(text) {
  var value = String(text || "").trim();
  return AI_PLACEHOLDER_PATTERNS.some(function(pattern) {
    return pattern.test(value);
  });
}

function normalizeAIDraftResult_(parsed, request, runtime) {
  parsed = parsed || {};
  var slides = Array.isArray(parsed.carouselSlides) ? parsed.carouselSlides.map(function(slide) {
    return {
      title: String(slide && slide.title || "").trim(),
      copy: String(slide && slide.copy || "").trim()
    };
  }).filter(function(slide) {
    return slide.title || slide.copy;
  }) : [];
  var draftText = String(parsed.draftText || "").trim();
  var carouselOutline = slides.length ? formatCarouselSlides_(slides) : "";
  if (!draftText && request.postType === "carousel") {
    draftText = String(parsed.captionVariant || parsed.hookText || "").trim();
  }
  var result = {
    aiDraftId: String(request.aiDraftId || "").trim(),
    title: String(parsed.title || request.title || deriveIdeaTitle_(request.prompt || draftText)).trim(),
    platform: request.platform,
    postType: request.postType,
    generationMode: request.generationMode,
    sourceType: request.sourceType,
    sourceId: request.sourceId,
    prompt: request.prompt,
    draftText: draftText,
    hookText: String(parsed.hookText || "").trim(),
    ctaText: String(parsed.ctaText || "").trim(),
    captionVariant: String(parsed.captionVariant || "").trim(),
    carouselOutline: carouselOutline,
    carouselSlides: slides,
    draftStatus: request.outlineMode ? "outline_ready" : "needs_review",
    reviewNotes: String(parsed.reviewNotes || "").trim(),
    semanticTags: Array.isArray(parsed.semanticTags) ? parsed.semanticTags.map(function(item) { return String(item || "").trim(); }).filter(Boolean) : [],
    provider: runtime.label,
    model: runtime.model,
    outlineMode: !!request.outlineMode,
    allowStylizedUnicode: !!request.allowStylizedUnicode,
    historicalSummary: request.historicalSummary || {},
    generatedAt: new Date().toISOString()
  };
  if (!result.title) throw new Error("AI drafting returned no title.");
  if (!request.outlineMode && !result.draftText) throw new Error("AI drafting returned no draft text.");
  if (!request.outlineMode && containsAIDraftPlaceholder_(result.draftText + "\n" + result.carouselOutline + "\n" + result.reviewNotes)) {
    throw new Error("AI drafting returned scaffold-like placeholder output instead of a finished draft.");
  }
  if (request.postType === "carousel" && !request.outlineMode && result.carouselSlides.length < 3) {
    throw new Error("AI drafting returned an incomplete carousel. Expected hook, body, and closing slides.");
  }
  return result;
}

function regenerateKeywords(payload) {
  var itemType = String(payload && (payload.itemType || payload.type) || "").trim();
  var itemId = String(payload && (payload.itemId || payload.id) || "").trim();
  if (!itemType || !itemId) throw new Error("Missing itemType or itemId");

  var item = null;
  if (itemType === "post") {
    var posts = getPosts(true);
    for (var pi = 0; pi < posts.length; pi += 1) {
      if (String(posts[pi].postId || posts[pi].id || "") === itemId) { item = posts[pi]; break; }
    }
  } else if (itemType === "inspo") {
    var inspoItems = getInspo(true);
    for (var ii = 0; ii < inspoItems.length; ii += 1) {
      if (String(inspoItems[ii].inspoId || inspoItems[ii].id || "") === itemId) { item = inspoItems[ii]; break; }
    }
  } else if (itemType === "note") {
    var notes = getNotes();
    for (var ni = 0; ni < notes.length; ni += 1) {
      if (String(notes[ni].noteId || notes[ni].id || "") === itemId) { item = notes[ni]; break; }
    }
  } else if (itemType === "ai_draft") {
    var drafts = getAIDrafts();
    for (var di = 0; di < drafts.length; di += 1) {
      if (String(drafts[di].aiDraftId || drafts[di].id || "") === itemId) { item = drafts[di]; break; }
    }
  }

  if (!item) throw new Error("Item not found: " + itemType + " " + itemId);

  var context = buildKeywordGenerationContext_();
  var keywords = buildSemanticKeywordsForItem_(item, context);
  return { keywords: keywords, semanticTags: keywords };
}

function generateAIDraft(payload) {
  var request = normalizeAIDraftGenerationRequest_(payload || {});
  if (!request.prompt && !request.existingText && !request.existingTitle) {
    throw new Error("Add a prompt or source text before generating an AI draft.");
  }
  var runtime = getAIProviderRuntimeConfig_();
  var context = prepareAIGenerationContext(request);
  request.historicalSummary = context && context.historicalSummary || {};
  var requestedEngine = String(pickFirstDefined_(
    payload && payload.generationEngine,
    payload && payload.generation_engine,
    payload && payload.aiProviderMode,
    payload && payload.ai_provider_mode,
    "auto"
  )).trim().toLowerCase() || "auto";
  if (requestedEngine === "local_creator_engine") requestedEngine = "local";
  if (requestedEngine !== "auto" && requestedEngine !== "local" && requestedEngine !== "provider") requestedEngine = "auto";
  if (runtime.provider === "disabled") {
    throw new Error("AI drafting is disabled. Set AI_PROVIDER to local, openai, or gemini to generate drafts.");
  }
  if (requestedEngine === "local" || !runtime.configured) {
    return generateLocalCreatorDraft_(request, context);
  }
  var rawText = "";
  if (runtime.provider === "openai") {
    rawText = callOpenAIResponses_(request, runtime);
  } else if (runtime.provider === "gemini") {
    return generateLocalCreatorDraft_(request, context);
  } else {
    return generateLocalCreatorDraft_(request, context);
  }
  var parsed = parseJsonSafe_(extractJsonObjectText_(rawText));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI drafting returned an unreadable response. Try regenerating with a slightly more specific prompt.");
  }
  try {
    return normalizeAIDraftResult_(parsed, request, runtime);
  } catch (err) {
    if (requestedEngine === "provider") {
      throw err;
    }
    return generateLocalCreatorDraft_(request, context);
  }
}

function prepareIdeaGenerationContext(payload) {
  var sourceTypes = normalizeListField_(pickFirstDefined_(
    payload && payload.sourceTypes,
    payload && payload.source_types,
    payload && payload.sourceType,
    payload && payload.source_type
  ));
  var sourceIds = normalizeListField_(pickFirstDefined_(payload && payload.sourceIds, payload && payload.source_ids));
  var targetCampaignId = String(pickFirstDefined_(payload && payload.targetCampaignId, payload && payload.target_campaign_id, "")).trim();
  var campaign = targetCampaignId ? getCampaigns().find(function(item) { return item.campaignId === targetCampaignId; }) : null;
  var semantic = getSemanticMemory({});
  return {
    sourceTypes: sourceTypes,
    sourceIds: sourceIds,
    targetCampaign: campaign || {},
    frameworkVersion: getBrandFrameworkVersion_(),
    brandFramework: getBrandFramework(),
    semanticSignals: {
      recurringPatterns: semantic.recurringPatterns || [],
      overusedPatterns: semantic.overusedPatterns || [],
      campaignClusters: semantic.campaignClusters || [],
      platformSignals: semantic.platformSignals || []
    },
    guidance: "Generate a structure to review proposed posts and dates, or generate a finished post for direct review."
  };
}

function saveIdeaPrompt(payload) {
  var normalized = buildIdeaDraftPayload_(payload, null);
  normalized.draftText = normalized.draftText || "Idea captured. Generate a post using the Write an Idea workspace to turn this into finished prose.";
  normalized.reviewNotes = normalized.reviewNotes || "Review before saving.";
  normalized.draftStatus = normalized.draftStatus || "idea_captured";
  return saveAIDraft(normalized);
}

function generateIdeaDraftScaffold(payload) {
  var normalized = buildIdeaDraftPayload_(payload, null);
  var context = prepareIdeaGenerationContext(payload);
  var scaffold = buildIdeaScaffold_(normalized, context);
  var saved = saveAIDraft({
    aiDraftId: normalized.aiDraftId,
    ideaId: normalized.ideaId,
    artifactId: normalized.artifactId || normalized.aiDraftId,
    artifactType: normalized.artifactType || "ai_draft",
    title: normalized.title || scaffold.title,
    prompt: normalized.prompt || normalized.ideaPrompt,
    ideaPrompt: normalized.ideaPrompt || normalized.prompt,
    transformationType: normalized.transformationType,
    analysisMode: normalized.analysisMode,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    sourceIds: normalized.sourceIds,
    sourceArtifactIds: normalized.sourceArtifactIds,
    derivedFromIds: normalized.derivedFromIds,
    outputType: normalized.outputType,
    outputArtifacts: scaffold.generatedOutputs.map(function(item) { return item.title; }),
    targetPlatforms: normalized.targetPlatforms,
    targetCampaignId: normalized.targetCampaignId,
    targetDate: normalized.targetDate,
    targetDateRange: normalized.targetDateRange,
    generationStage: "scaffold_only",
    platform: normalized.platform,
    postType: normalized.postType,
    generationMode: normalized.generationMode,
    campaignId: normalized.campaignId,
    campaignName: normalized.campaignName,
    draftText: scaffold.summaryText,
    carouselOutline: scaffold.carouselOutline,
    brandFrameworkVersion: normalized.brandFrameworkVersion,
    draftStatus: "scaffold_only",
    reviewNotes: scaffold.warnings.join(" | "),
    semanticTags: scaffold.semanticTags,
    generatedOutputs: scaffold.generatedOutputs.map(function(item) { return item.title; }),
    mediaIds: normalized.mediaIds,
    performanceContext: normalized.performanceContext
  });
  return {
    idea: saved,
    context: context,
    scaffold: scaffold
  };
}

function createPostFromIdea(payload) {
  var result = generateIdeaDraftScaffold(payload || {});
  var scaffold = normalizeIdeaScaffoldPayload_(payload && (payload.scaffold || result.scaffold));
  var selected = scaffold.proposedPosts[0] || buildIdeaPostScaffold_(buildIdeaDraftPayload_(payload, result.idea), 0, scaffold.targetDate || result.idea.targetDate || normalizeQueueDateLabel(new Date()), result.idea.title);
  var post = savePost(Object.assign({}, payload && payload.post || {}, {
    title: pickFirstDefined_(payload && payload.title, selected.title, result.idea.title, "Idea Draft"),
    description: pickFirstDefined_(payload && payload.description, selected.description, result.idea.draftText),
    platform: pickFirstDefined_(payload && payload.platform, selected.platform, "linkedin"),
    postType: pickFirstDefined_(payload && payload.postType, selected.postType, "text"),
    campaignId: pickFirstDefined_(payload && payload.campaignId, scaffold.targetCampaignId, result.idea.targetCampaignId, ""),
    queueDateLabel: pickFirstDefined_(payload && payload.queueDateLabel, selected.queueDateLabel, result.idea.targetDate, normalizeQueueDateLabel(new Date())),
    queueTimeLabel: pickFirstDefined_(payload && payload.queueTimeLabel, ""),
    status: "draft",
    sourceAiDraftId: result.idea.ideaId || result.idea.aiDraftId,
    createdFromFlow: "idea_to_post",
    aiSourceType: "idea",
    aiSourceId: result.idea.ideaId || result.idea.aiDraftId,
    aiPrompt: result.idea.ideaPrompt || result.idea.prompt,
    aiGenerationMode: result.idea.outputType || "create_one_post",
    aiBrandFrameworkVersion: result.idea.brandFrameworkVersion || getBrandFrameworkVersion_(),
    aiDraftStatus: "approved",
    aiReviewNotes: "Created from approved Write an Idea scaffold.",
    semanticTags: result.idea.semanticTags
  }));
  saveAIDraft({
    aiDraftId: result.idea.aiDraftId,
    ideaId: result.idea.ideaId,
    generatedPostIds: [post.postId],
    draftStatus: "approved",
    reviewNotes: "One post created from approved idea scaffold."
  });
  return {
    idea: getAIDrafts().find(function(item) { return item.aiDraftId === result.idea.aiDraftId; }) || result.idea,
    createdPosts: [post]
  };
}

function createCampaignFromIdea(payload) {
  var result = generateIdeaDraftScaffold(payload || {});
  var scaffold = normalizeIdeaScaffoldPayload_(payload && (payload.scaffold || result.scaffold));
  var campaignName = pickFirstDefined_(payload && payload.campaignName, scaffold.proposedCampaign && scaffold.proposedCampaign.campaignName, result.scaffold.proposedCampaign && result.scaffold.proposedCampaign.campaignName, result.idea.title, "Idea Campaign");
  var campaign = saveCampaign({
    campaignId: pickFirstDefined_(payload && payload.campaignId, scaffold.targetCampaignId, result.idea.targetCampaignId, ""),
    campaignName: campaignName,
    pillar: pickFirstDefined_(payload && payload.pillar, scaffold.proposedCampaign && scaffold.proposedCampaign.pillar, "authority"),
    iconShape: pickFirstDefined_(payload && payload.iconShape, scaffold.proposedCampaign && scaffold.proposedCampaign.iconShape, "star"),
    pathStyle: pickFirstDefined_(payload && payload.pathStyle, scaffold.proposedCampaign && scaffold.proposedCampaign.pathStyle, ""),
  });
  var createdPosts = scaffold.proposedPosts.map(function(item) {
    return savePost({
      title: item.title,
      description: item.description,
      platform: item.platform,
      postType: item.postType,
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      queueDateLabel: item.queueDateLabel,
      queueTimeLabel: "",
      status: "draft",
      sourceAiDraftId: result.idea.ideaId || result.idea.aiDraftId,
      createdFromFlow: "idea_to_post",
      aiSourceType: "idea",
      aiSourceId: result.idea.ideaId || result.idea.aiDraftId,
      aiPrompt: result.idea.ideaPrompt || result.idea.prompt,
      aiGenerationMode: result.idea.outputType || "create_campaign",
      aiBrandFrameworkVersion: result.idea.brandFrameworkVersion || getBrandFrameworkVersion_(),
      aiDraftStatus: "approved",
      aiReviewNotes: "Created from approved Write an Idea campaign scaffold.",
      semanticTags: result.idea.semanticTags
    });
  });
  saveAIDraft({
    aiDraftId: result.idea.aiDraftId,
    ideaId: result.idea.ideaId,
    generatedPostIds: createdPosts.map(function(item) { return item.postId; }),
    generatedCampaignId: campaign.campaignId,
    draftStatus: "approved",
    reviewNotes: "Campaign and draft posts created from approved idea scaffold."
  });
  return {
    idea: getAIDrafts().find(function(item) { return item.aiDraftId === result.idea.aiDraftId; }) || result.idea,
    campaign: campaign,
    createdPosts: createdPosts
  };
}

function createCalendarPlanFromIdea(payload) {
  return createCampaignFromIdea(payload);
}

function createCarouselOutlineFromIdea(payload) {
  var result = generateIdeaDraftScaffold(payload || {});
  saveAIDraft({
    aiDraftId: result.idea.aiDraftId,
    ideaId: result.idea.ideaId,
    carouselOutline: result.scaffold.carouselOutline,
    draftStatus: "reviewed",
    reviewNotes: "Carousel outline scaffold saved for manual editing."
  });
  return {
    idea: getAIDrafts().find(function(item) { return item.aiDraftId === result.idea.aiDraftId; }) || result.idea,
    carouselOutline: result.scaffold.carouselOutline,
    warnings: result.scaffold.warnings
  };
}

function saveAIDraft(payload) {
  payload = payload || {};
  var sheet = getCoreSheet_("aiDrafts");
  ensureHeadersPresent_(sheet, ["generated_output", "draft_title"]);
  var existing = findObjectByNormalizedHeaderValue_(sheet, ["ai_draft_id"], pickFirstDefined_(payload.aiDraftId, payload.ai_draft_id), REQUIRED_AI_DRAFT_HEADERS);
  var fullOutput = String(firstNonEmpty_(
    payload.generated_output,
    payload.generatedOutput,
    payload.generated_outputs,
    payload.generatedOutputs,
    payload.output,
    payload.response,
    payload.message,
    payload.content,
    payload.full_text,
    payload.fullText,
    payload.fullOutput,
    existing && existing.generated_output
  )).trim();
  var finalText = String(firstNonEmpty_(
    payload.draft_text,
    payload.draftText,
    payload.final_text,
    payload.finalText,
    payload.finalPost,
    payload.caption,
    fullOutput,
    existing && existing.draft_text
  )).trim();
  var derivedTitle = String(firstNonEmpty_(
    payload.title,
    payload.draft_title,
    payload.draftTitle,
    existing && existing.title,
    firstNonEmptyLine_(finalText || fullOutput)
  )).trim();
  if (derivedTitle.length > 80) derivedTitle = derivedTitle.slice(0, 80);
  var normalized = {
    ai_draft_id: String(pickFirstDefined_(payload.aiDraftId, payload.ai_draft_id, existing && existing.ai_draft_id, createAIDraftId_())).trim(),
    idea_id: String(pickFirstDefined_(payload.ideaId, payload.idea_id, existing && existing.idea_id, createIdeaId_())).trim(),
    artifact_id: String(pickFirstDefined_(payload.artifactId, payload.artifact_id, existing && existing.artifact_id, pickFirstDefined_(payload.aiDraftId, payload.ai_draft_id, existing && existing.ai_draft_id, ""))).trim(),
    artifact_type: String(pickFirstDefined_(payload.artifactType, payload.artifact_type, existing && existing.artifact_type, "ai_draft")).trim() || "ai_draft",
    parent_artifact_id: String(pickFirstDefined_(payload.parentArtifactId, payload.parent_artifact_id, existing && existing.parent_artifact_id, "")).trim(),
    root_artifact_id: String(pickFirstDefined_(payload.rootArtifactId, payload.root_artifact_id, existing && existing.root_artifact_id, "")).trim(),
    idea_prompt: String(pickFirstDefined_(payload.ideaPrompt, payload.idea_prompt, payload.prompt, existing && existing.idea_prompt, "")).trim(),
    title: derivedTitle || "AI Draft",
    platform: String(pickFirstDefined_(payload.platform, existing && existing.platform, "linkedin")).trim() || "linkedin",
    post_type: String(pickFirstDefined_(payload.postType, payload.post_type, existing && existing.post_type, "text")).trim() || "text",
    generation_mode: String(pickFirstDefined_(payload.generationMode, payload.generation_mode, existing && existing.generation_mode, "")).trim(),
    transformation_type: String(pickFirstDefined_(payload.transformationType, payload.transformation_type, existing && existing.transformation_type, "expand")).trim() || "expand",
    analysis_mode: String(pickFirstDefined_(payload.analysisMode, payload.analysis_mode, existing && existing.analysis_mode, "")).trim(),
    source_type: String(pickFirstDefined_(payload.sourceType, payload.source_type, existing && existing.source_type, "")).trim(),
    source_id: String(pickFirstDefined_(payload.sourceId, payload.source_id, existing && existing.source_id, "")).trim(),
    source_ids: normalizeMetadataString_(pickFirstDefined_(payload.sourceIds, payload.source_ids, existing && existing.source_ids, "")),
    source_artifact_ids: normalizeMetadataString_(pickFirstDefined_(payload.sourceArtifactIds, payload.source_artifact_ids, existing && existing.source_artifact_ids, "")),
    derived_from_ids: normalizeMetadataString_(pickFirstDefined_(payload.derivedFromIds, payload.derived_from_ids, existing && existing.derived_from_ids, "")),
    output_type: String(pickFirstDefined_(payload.outputType, payload.output_type, existing && existing.output_type, "")).trim(),
    output_artifacts: normalizeMetadataString_(pickFirstDefined_(payload.outputArtifacts, payload.output_artifacts, existing && existing.output_artifacts, "")),
    target_platforms: normalizeMetadataString_(pickFirstDefined_(payload.targetPlatforms, payload.target_platforms, existing && existing.target_platforms, "")),
    target_campaign_id: String(pickFirstDefined_(payload.targetCampaignId, payload.target_campaign_id, existing && existing.target_campaign_id, "")).trim(),
    target_date: normalizeQueueDateLabel(pickFirstDefined_(payload.targetDate, payload.target_date, existing && existing.target_date, "")),
    target_date_range: normalizeMetadataString_(pickFirstDefined_(payload.targetDateRange, payload.target_date_range, existing && existing.target_date_range, "")),
    generation_stage: String(pickFirstDefined_(payload.generationStage, payload.generation_stage, existing && existing.generation_stage, "captured")).trim() || "captured",
    generated_post_ids: normalizeMetadataString_(pickFirstDefined_(payload.generatedPostIds, payload.generated_post_ids, existing && existing.generated_post_ids, "")),
    generated_campaign_id: String(pickFirstDefined_(payload.generatedCampaignId, payload.generated_campaign_id, existing && existing.generated_campaign_id, "")).trim(),
    generated_outputs: normalizeMetadataString_(pickFirstDefined_(payload.generatedOutputs, payload.generated_outputs, existing && existing.generated_outputs, "")),
    campaign_id: String(pickFirstDefined_(payload.campaignId, payload.campaign_id, existing && existing.campaign_id, "")).trim(),
    campaign_name: String(pickFirstDefined_(payload.campaignName, payload.campaign_name, existing && existing.campaign_name, "")).trim(),
    prompt: String(pickFirstDefined_(payload.prompt, existing && existing.prompt, "")).trim(),
    draft_title: derivedTitle || "AI Draft",
    generated_output: fullOutput,
    draft_text: finalText,
    hook_text: String(pickFirstDefined_(payload.hookText, payload.hook_text, existing && existing.hook_text, "")).trim(),
    cta_text: String(pickFirstDefined_(payload.ctaText, payload.cta_text, existing && existing.cta_text, "")).trim(),
    carousel_outline: normalizeMetadataString_(pickFirstDefined_(payload.carouselOutline, payload.carousel_outline, existing && existing.carousel_outline, "")),
    brand_framework_version: String(pickFirstDefined_(payload.brandFrameworkVersion, payload.brand_framework_version, existing && existing.brand_framework_version, getBrandFrameworkVersion_())).trim(),
    draft_status: String(pickFirstDefined_(payload.draftStatus, payload.draft_status, payload.status, existing && existing.draft_status, "needs_review")).trim() || "needs_review",
    review_notes: String(pickFirstDefined_(payload.reviewNotes, payload.review_notes, existing && existing.review_notes, "")).trim(),
    alignment_score: normalizeNumber_(pickFirstDefined_(payload.alignmentScore, payload.alignment_score, existing && existing.alignment_score)),
    diversity_controls: normalizeMetadataString_(pickFirstDefined_(payload.diversityControls, payload.diversity_controls, existing && existing.diversity_controls, "")),
    anti_pattern_flags: normalizeMetadataString_(pickFirstDefined_(payload.antiPatternFlags, payload.anti_pattern_flags, existing && existing.anti_pattern_flags, "")),
    media_ids: normalizeMetadataString_(pickFirstDefined_(payload.mediaIds, payload.media_ids, existing && existing.media_ids, "")),
    performance_context: normalizeMetadataString_(pickFirstDefined_(payload.performanceContext, payload.performance_context, existing && existing.performance_context, "")),
    created_post_id: String(pickFirstDefined_(payload.createdPostId, payload.created_post_id, existing && existing.created_post_id, "")).trim(),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);
  maybeAutoGenerateKeywords_(normalized, payload, existing);

  upsertObjectByHeader_(sheet, ["ai_draft_id"], normalized, REQUIRED_AI_DRAFT_HEADERS, AI_DRAFT_FORMULA_HEADERS);
  return aiDraftRowToObject_(normalized);
}

function createPostFromAIDraft(payload) {
  var aiDraftId = String(payload && (payload.aiDraftId || payload.ai_draft_id) || "").trim();
  if (!aiDraftId) throw new Error("Missing aiDraftId");
  return promoteAiDraftToPost_(Object.assign({}, payload || {}, {
    aiDraftId: aiDraftId,
    targetStatus: pickFirstDefined_(payload && payload.targetStatus, payload && payload.status, "Draft"),
    post: payload && payload.post || {}
  })).post;
}

function updateOptionalHeadersById_(sheet, idHeaders, idValue, values, formulaHeaders) {
  var rowNumber = findRowByNormalizedHeaderValue_(sheet, idHeaders, idValue);
  if (rowNumber < 2) return;
  writeObjectToRowByHeaders_(sheet, rowNumber, values || {}, [], formulaHeaders || []);
}

function promoteAiDraftToPost_(payload) {
  payload = payload || {};
  ensureHeadersPresent_(getCoreSheet_("aiDrafts"), ["generated_output", "draft_title", "promoted_at", "sent_to_posts_at"]);
  var aiDraftId = String(firstNonEmpty_(payload.aiDraftId, payload.ai_draft_id, payload.id, payload.ai_draft_id)).trim();
  if (!aiDraftId) throw new Error("Missing aiDraftId");
  var targetStatusRaw = String(firstNonEmpty_(payload.targetStatus, payload.target_status, payload.status, "Draft")).trim();
  var targetStatus = targetStatusRaw.toLowerCase() === "scheduled" || targetStatusRaw.toLowerCase() === "approve" || targetStatusRaw.toLowerCase() === "approved"
    ? "Scheduled"
    : "Draft";
  var draft = getAIDrafts().find(function(item) { return String(item.aiDraftId || item.ai_draft_id || item.id || "").trim() === aiDraftId; });
  if (!draft) throw new Error("AI draft not found");

  var postInput = payload.post || {};
  var postText = String(firstNonEmpty_(
    postInput.description,
    postInput.caption,
    payload.description,
    payload.caption,
    payload.draftText,
    payload.draft_text,
    payload.generatedOutput,
    payload.generated_output,
    payload.output,
    payload.response,
    payload.message,
    payload.content,
    draft.draftText,
    draft.draft_text,
    draft.generatedOutput,
    draft.generated_output
  )).trim();
  var postTitle = String(firstNonEmpty_(
    payload.title,
    postInput.title,
    draft.title,
    draft.draftTitle,
    draft.draft_title,
    firstNonEmptyLine_(postText)
  )).trim();
  if (postTitle.length > 80) postTitle = postTitle.slice(0, 80);
  var publishDate = firstNonEmpty_(
    payload.publish_date,
    payload.publishDate,
    postInput.publish_date,
    postInput.publishDate,
    draft.targetDate,
    draft.target_date
  );
  var publishTime = firstNonEmpty_(
    payload.publish_time,
    payload.publishTime,
    postInput.publish_time,
    postInput.publishTime,
    draft.targetTime,
    draft.target_time
  );
  var createdPostId = String(firstNonEmpty_(draft.createdPostId, draft.created_post_id, payload.postId, payload.post_id, postInput.postId, postInput.post_id, "")).trim();
  var post = savePost(Object.assign({}, postInput, {
    postId: createdPostId,
    title: postTitle || "AI Draft",
    platform: pickFirstDefined_(payload.platform, postInput.platform, draft.platform),
    postType: pickFirstDefined_(payload.postType, payload.post_type, payload.format, postInput.postType, postInput.post_type, postInput.format, draft.postType, draft.post_type, draft.format),
    format: pickFirstDefined_(payload.format, payload.postType, payload.post_type, postInput.format, postInput.postType, draft.format, draft.postType),
    description: postText,
    caption: postText,
    status: targetStatus,
    publishDate: publishDate,
    publishTime: publishTime,
    queueDateLabel: publishDate,
    queueTimeLabel: publishTime,
    hasUserSelectedTime: !!String(publishTime || "").trim(),
    campaignId: pickFirstDefined_(payload.campaignId, payload.campaign_id, postInput.campaignId, postInput.campaign_id, draft.campaignId, draft.campaign_id),
    campaignName: pickFirstDefined_(payload.campaignName, payload.campaign_name, postInput.campaignName, postInput.campaign_name, draft.campaignName, draft.campaign_name),
    pillar: pickFirstDefined_(payload.pillar, postInput.pillar, draft.pillar),
    mediaIds: pickFirstDefined_(payload.mediaIds, payload.media_ids, postInput.mediaIds, postInput.media_ids, draft.mediaIds, draft.media_ids),
    carouselAssetIds: pickFirstDefined_(payload.mediaIds, payload.media_ids, postInput.mediaIds, postInput.media_ids, draft.mediaIds, draft.media_ids),
    sourceAiDraftId: draft.aiDraftId,
    createdFromFlow: "ai_draft_to_post",
    aiSourceType: pickFirstDefined_(payload.aiSourceType, postInput.aiSourceType, draft.sourceType || "ai_draft"),
    aiSourceId: pickFirstDefined_(payload.aiSourceId, postInput.aiSourceId, draft.sourceId || draft.aiDraftId),
    aiPrompt: pickFirstDefined_(payload.aiPrompt, postInput.aiPrompt, draft.prompt),
    aiGenerationMode: pickFirstDefined_(payload.aiGenerationMode, postInput.aiGenerationMode, draft.generationMode),
    aiBrandFrameworkVersion: pickFirstDefined_(payload.aiBrandFrameworkVersion, postInput.aiBrandFrameworkVersion, draft.brandFrameworkVersion),
    aiDraftStatus: targetStatus === "Scheduled" ? "approved" : "sent_to_draft",
    aiReviewNotes: pickFirstDefined_(payload.aiReviewNotes, postInput.aiReviewNotes, draft.reviewNotes),
    semanticTags: pickFirstDefined_(payload.semanticTags, postInput.semanticTags, draft.semanticTags),
    semanticClusters: pickFirstDefined_(payload.semanticClusters, postInput.semanticClusters, draft.semanticClusters),
    semanticOrigin: pickFirstDefined_(payload.semanticOrigin, postInput.semanticOrigin, draft.semanticOrigin || "ai_draft"),
    semanticSummary: pickFirstDefined_(payload.semanticSummary, postInput.semanticSummary, draft.semanticSummary || postText),
    recurringPatternFlags: pickFirstDefined_(payload.recurringPatternFlags, postInput.recurringPatternFlags, draft.recurringPatternFlags)
  }));

  var nextDraftStatus = targetStatus === "Scheduled" ? "approved" : "sent_to_draft";
  var savedDraft = saveAIDraft({
    aiDraftId: draft.aiDraftId,
    ideaId: draft.ideaId,
    ideaPrompt: draft.ideaPrompt,
    title: draft.title,
    platform: draft.platform,
    postType: draft.postType,
    generationMode: draft.generationMode,
    sourceType: draft.sourceType,
    sourceId: draft.sourceId,
    sourceIds: draft.sourceIds,
    outputType: draft.outputType,
    targetPlatforms: draft.targetPlatforms,
    targetCampaignId: draft.targetCampaignId,
    targetDate: draft.targetDate,
    targetDateRange: draft.targetDateRange,
    generatedCampaignId: draft.generatedCampaignId,
    campaignId: draft.campaignId,
    campaignName: draft.campaignName,
    prompt: draft.prompt,
    generatedOutput: firstNonEmpty_(payload.generatedOutput, payload.generated_output, payload.output, payload.response, payload.message, payload.content, draft.generatedOutput, draft.generated_output, postText),
    draftText: firstNonEmpty_(payload.draftText, payload.draft_text, payload.finalText, payload.final_text, payload.caption, draft.draftText, postText),
    hookText: draft.hookText,
    ctaText: draft.ctaText,
    carouselOutline: draft.carouselOutline,
    brandFrameworkVersion: draft.brandFrameworkVersion,
    draftStatus: nextDraftStatus,
    alignmentScore: draft.alignmentScore,
    diversityControls: draft.diversityControls,
    antiPatternFlags: draft.antiPatternFlags,
    createdPostId: post.postId,
    reviewNotes: (targetStatus === "Scheduled" ? "Approved and promoted to scheduled post " : "Sent to POSTS draft ") + post.postId + "."
  });

  var now = new Date().toISOString();
  updateOptionalHeadersById_(getCoreSheet_("aiDrafts"), ["ai_draft_id"], draft.aiDraftId, {
    ai_draft_id: draft.aiDraftId,
    created_post_id: post.postId,
    status: nextDraftStatus,
    draft_status: nextDraftStatus,
    promoted_at: now,
    sent_to_posts_at: now
  }, AI_DRAFT_FORMULA_HEADERS);
  updateOptionalHeadersById_(getPostsSheet_(), ["post_id"], post.postId, {
    post_id: post.postId,
    status: targetStatus === "Scheduled" ? "scheduled" : "draft",
    caption: postText,
    source_id: draft.aiDraftId,
    media_ids: pickFirstDefined_(payload.mediaIds, payload.media_ids, postInput.mediaIds, postInput.media_ids, draft.mediaIds, draft.media_ids),
    publish_date: publishDate,
    publish_time: publishTime
  }, POST_FORMULA_HEADERS);

  logFlowEvent_(
    targetStatus === "Scheduled" ? "approve_ai_draft" : "send_ai_draft_to_posts",
    "ai_draft",
    draft.aiDraftId,
    post.postId,
    "ok",
    "",
    {
      targetStatus: targetStatus,
      postStatus: targetStatus === "Scheduled" ? "scheduled" : "draft"
    }
  );

  return {
    ok: true,
    aiDraftId: draft.aiDraftId,
    postId: post.postId,
    targetStatus: targetStatus,
    draft: savedDraft,
    post: post
  };
}

function promoteAiDraftToPost(payload) {
  return promoteAiDraftToPost_(payload || {});
}

function approveAiDraft(payload) {
  return promoteAiDraftToPost_(Object.assign({}, payload || {}, { targetStatus: "Scheduled" }));
}

function sendAiDraftToLedger(payload) {
  return promoteAiDraftToPost_(Object.assign({}, payload || {}, { targetStatus: "Draft" }));
}

function topItemsByCount_(items, limit) {
  return Object.keys(items || {}).map(function(key) {
    return { key: key, count: items[key] };
  }).sort(function(a, b) {
    return b.count - a.count || a.key.localeCompare(b.key);
  }).slice(0, limit || 5);
}

function countAssistantRows_(rows, getter) {
  var counts = {};
  (rows || []).forEach(function(row) {
    var key = String(getter(row) || "Uncategorized").trim() || "Uncategorized";
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function assistantPostTitle_(post) {
  return String(pickFirstDefined_(post && post.title, post && post.description, post && post.caption, "Untitled post")).trim().slice(0, 90);
}

function buildAssistantContext_() {
  var posts = getPosts();
  var rawPostRows = [];
  try {
    rawPostRows = getPostsData_().map(normalizePostSchemaAliases_);
  } catch (_) {
    rawPostRows = [];
  }
  var notes = getNotes();
  var inspo = getInspo();
  var drafts = getAIDrafts();
  var media = getMedia();
  var settings = getSettingsRegistry();
  var diagnostics = {};
  try {
    diagnostics = getDiagnostics({});
  } catch (err) {
    diagnostics = { error: err && err.message ? err.message : String(err) };
  }
  var campaignCounts = countAssistantRows_(posts, function(post) { return post.campaignName || post.campaign_name || "Uncategorized"; });
  var pillarCounts = countAssistantRows_(posts, function(post) { return post.pillar || post.hubPillarLabel || "Uncategorized"; });
  var platformCounts = countAssistantRows_(posts, function(post) { return post.platform || "linkedin"; });
  var scheduled = posts.filter(function(post) { return String(post.status || "").toLowerCase() === "scheduled"; });
  var topPosts = posts.slice().sort(function(a, b) {
    var bScore = Number(b.impressions || 0) + Number(b.engagementTotal || b.engagement_total || 0) * 10;
    var aScore = Number(a.impressions || 0) + Number(a.engagementTotal || a.engagement_total || 0) * 10;
    return bScore - aScore;
  }).slice(0, 5);
  return {
    posts: posts,
    notes: notes,
    inspo: inspo,
    drafts: drafts,
    media: media,
    settings: settings,
    diagnostics: diagnostics,
    campaignCounts: campaignCounts,
    pillarCounts: pillarCounts,
    platformCounts: platformCounts,
    scheduled: scheduled,
    topPosts: topPosts
  };
}

function formatAssistantBullets_(items) {
  return (items || []).filter(Boolean).map(function(item) { return "- " + item; }).join("\n");
}

function buildCampaignConcepts_(ctx) {
  var campaigns = (ctx.settings.campaigns || []).map(function(campaign) {
    return String(campaign && (campaign.campaignName || campaign.name || campaign.title) || campaign || "").trim();
  }).filter(Boolean).slice(0, 3);
  if (!campaigns.length) campaigns = topItemsByCount_(ctx.campaignCounts, 3).map(function(item) { return item.key; });
  if (!campaigns.length) campaigns = ["Signal Systems", "Community Proof", "Field Notes"];
  while (campaigns.length < 3) campaigns.push(["Signal Systems", "Community Proof", "Field Notes"][campaigns.length]);
  var concepts = campaigns.slice(0, 3).map(function(name, index) {
    var pillar = topItemsByCount_(ctx.pillarCounts, 3)[index] && topItemsByCount_(ctx.pillarCounts, 3)[index].key || "authority";
    return [
      "Campaign " + (index + 1) + ": " + name,
      "Audience: people already close to this topic who need a clearer next step.",
      "Core message: make the " + pillar + " angle concrete, useful, and repeatable.",
      "Post ideas:",
      "1. Name the tension your audience keeps working around.",
      "2. Show one concrete example from your work or saved notes.",
      "3. Close with a decision, question, or checklist.",
      "Newsletter angle: a longer field note on what this campaign helps people notice.",
      "Carousel idea: 5 slides moving from problem, pattern, example, shift, CTA.",
      "Suggested platforms: LinkedIn, Instagram carousel, newsletter"
    ].join("\n");
  });
  return concepts.join("\n\n");
}

function buildNewsletterIdea_(ctx) {
  var top = ctx.topPosts[0];
  var subjectBase = top ? assistantPostTitle_(top) : "What your content calendar is trying to tell you";
  return [
    "Subject line options:",
    "- " + subjectBase,
    "- The pattern under this week's strongest idea",
    "- A practical note on what to build next",
    "",
    "Intro:",
    "Start with the strongest current signal, then explain why it matters now.",
    "",
    "Sections:",
    "1. The pattern: what your recent posts, notes, or inspo are circling.",
    "2. The example: one concrete story, saved inspo item, or campaign detail.",
    "3. The application: what the reader can do with the idea this week.",
    "",
    "CTA:",
    "Invite readers to reply with the version of this pattern they are seeing in their own work.",
    "",
    "Related posts/carousels to create:",
    formatAssistantBullets_([
      "A short LinkedIn post naming the core pattern.",
      "A carousel that breaks the idea into 5 practical steps.",
      "A follow-up post using one note or inspo item as proof."
    ])
  ].join("\n");
}

function buildCarouselIdea_(ctx) {
  var media = (ctx.media || [])[0];
  return [
    "Carousel title: The pattern your audience needs to see clearly",
    "",
    "Slide-by-slide outline:",
    "1. Hook: name the tension in one sentence.",
    "2. Context: show why the old framing is not enough.",
    "3. Pattern: identify what keeps repeating.",
    "4. Example: connect to a note, inspo item, or campaign proof point.",
    "5. Shift: offer the better question or decision.",
    "6. CTA: ask the audience what they are noticing.",
    "",
    "Caption:",
    "The useful part is not just the insight. It is what the insight makes easier to decide, build, or explain.",
    "",
    "CTA:",
    "Save this if you are mapping a campaign or turning scattered ideas into a clearer sequence.",
    "",
    "Suggested media/assets: " + (media ? String(media.title || media.assetName || media.asset_id || "Use the latest media asset.") : "Use a simple text-led carousel or add one supporting visual.")
  ].join("\n");
}

function buildContentGaps_(ctx) {
  var campaigns = topItemsByCount_(ctx.campaignCounts, 10);
  var pillars = topItemsByCount_(ctx.pillarCounts, 10);
  var platforms = topItemsByCount_(ctx.platformCounts, 10);
  var leastPillar = pillars.length ? pillars[pillars.length - 1].key : "authority";
  var nextPost = ctx.topPosts[0] ? "Repurpose \"" + assistantPostTitle_(ctx.topPosts[0]) + "\" into a carousel or newsletter." : "Create one post for the least-used pillar.";
  return [
    "Missing campaign coverage:",
    campaigns.length ? formatAssistantBullets_(campaigns.slice(-3).map(function(item) { return item.key + " has lighter coverage than other active campaigns."; })) : "- No campaign coverage is available yet.",
    "",
    "Missing platform coverage:",
    platforms.length ? formatAssistantBullets_(platforms.slice(-2).map(function(item) { return item.key + " has fewer posts than the dominant platform."; })) : "- Platform history is not available yet.",
    "",
    "Repeated pillar imbalance:",
    "- Least-used pillar to reinforce next: " + leastPillar,
    "",
    "Next recommended post:",
    "- " + nextPost
  ].join("\n");
}

function buildInspoToPosts_(ctx) {
  var source = (ctx.inspo || [])[0];
  var title = source ? String(source.title || source.summary || "latest inspo").trim() : "latest inspo";
  return [
    "Using: " + title,
    "",
    "3 post angles:",
    "1. The observation: what this inspo makes visible.",
    "2. The tension: what people usually misunderstand about it.",
    "3. The application: how your audience can use it this week.",
    "",
    "Carousel outline:",
    "1. Hook from the inspo",
    "2. Why it matters",
    "3. What usually gets missed",
    "4. A concrete reframing",
    "5. CTA",
    "",
    "Newsletter angle:",
    "Use the inspo as the opening example, then expand into a field note on the broader pattern."
  ].join("\n");
}

function buildAssistantResponse_(payload, ctx) {
  var action = String(payload && payload.action || "").trim();
  var message = String(payload && payload.message || "").trim();
  var lower = (action + " " + message).toLowerCase();
  if (lower.indexOf("newsletter") !== -1) return buildNewsletterIdea_(ctx);
  if (lower.indexOf("carousel") !== -1) return buildCarouselIdea_(ctx);
  if (lower.indexOf("gap") !== -1 || lower.indexOf("calendar") !== -1) return buildContentGaps_(ctx);
  if (lower.indexOf("inspo") !== -1 || lower.indexOf("notes") !== -1 || lower.indexOf("repurpose") !== -1) return buildInspoToPosts_(ctx);
  if (lower.indexOf("walkthrough") !== -1 || lower.indexOf("explain") !== -1) {
    return "Walkthrough mode:\n" + formatAssistantBullets_([
      "Calendar: plan scheduled posts and spot date gaps.",
      "Constellation: see campaign relationships and semantic clusters.",
      "Ledger: review every post row and workflow status.",
      "Media Vault: manage reusable assets and linked post media.",
      "Inspo Vault: capture source material for future drafts.",
      "Notes: store raw ideas before turning them into posts.",
      "AI Drafts: generate, review, approve, and send drafts to POSTS.",
      "Performance: identify top posts and weak spots.",
      "Audit: review schema, publishing, and content health."
    ]);
  }
  return buildCampaignConcepts_(ctx);
}

function runStellarAssistant(payload) {
  payload = payload || {};
  var ctx = buildAssistantContext_();
  var action = String(payload.action || "suggest_campaigns").trim() || "suggest_campaigns";
  var response = buildAssistantResponse_(payload, ctx);
  var suggestions = [
    "Save this to AI Drafts for later editing.",
    "Turn the strongest idea into a draft post.",
    "Use the content gaps to schedule the next post."
  ];
  return {
    ok: true,
    action: action,
    response: response,
    suggestions: suggestions,
    recommendedActions: [
      "Save to AI Drafts",
      "Create Post Draft",
      "Create Campaign Plan",
      "Open AI Drafts"
    ],
    contextSummary: {
      posts: ctx.posts.length,
      notes: ctx.notes.length,
      inspo: ctx.inspo.length,
      aiDrafts: ctx.drafts.length,
      media: ctx.media.length,
      scheduled: ctx.scheduled.length
    }
  };
}

function getAIDrafts() {
  var sheet = getCoreSheet_("aiDrafts");
  return getRowsByNormalizedHeaders_(sheet, REQUIRED_AI_DRAFT_HEADERS).map(function(row) {
    return aiDraftRowToObject_(row);
  }).filter(function(item) {
    return item.aiDraftId || item.title;
  }).sort(function(a, b) {
    return parseSheetDate_(b.updatedAt || b.createdAt) - parseSheetDate_(a.updatedAt || a.createdAt);
  });
}

function archiveInspo(payload) {
  var sheet = getCoreSheet_("inspo");
  var inspoId = String(payload && payload.inspoId || "").trim();
  if (!inspoId) throw new Error("Missing inspoId");

  var existing = findObjectByNormalizedHeaderValue_(sheet, ["inspo_id"], inspoId, REQUIRED_INSPO_HEADERS);
  if (!existing) throw new Error("Inspo item not found");

  existing.inspo_id = inspoId;
  existing.status = String(payload && payload.status || "archived").trim() || "archived";
  existing.flow_state = existing.converted_post_id ? "converted_to_post" : "archived";
  existing.converted_post_id = String(payload && payload.convertedPostId || "").trim();
  existing.moved_to_post_at = existing.converted_post_id ? new Date().toISOString() : String(existing.moved_to_post_at || "").trim();
  existing.archived_at = new Date().toISOString();
  existing.updated_at = new Date().toISOString();
  upsertObjectByHeader_(sheet, ["inspo_id"], existing, REQUIRED_INSPO_HEADERS, INSPO_FORMULA_HEADERS);
  logFlowEvent_("archive_inspo", "inspo", inspoId, existing.converted_post_id, "ok", "", {
    flowState: existing.flow_state,
    status: existing.status
  });

  return {
    inspoId: String(existing.inspo_id || "").trim(),
    status: String(existing.status || "").trim(),
    convertedPostId: String(existing.converted_post_id || "").trim(),
    flowState: String(existing.flow_state || "").trim(),
    archivedAt: String(existing.archived_at || "").trim()
  };
}

function payloadOrParams_(e) {
  var body = parseJsonSafe_((e && e.postData && e.postData.contents) || "") || {};
  return getPayloadFromRequest_(e, body);
}

function findExistingSheet_(sheetKey) {
  var aliases = SHEET_NAMES[sheetKey] || [sheetKey];
  var ss = getSpreadsheet_();
  for (var i = 0; i < aliases.length; i += 1) {
    var sheet = ss.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }
  return null;
}

function getMediaFolder_() {
  // legacy fallback: media folder config is server-side/internal for older Apps Script deployments.
  const propertyFolderId = PropertiesService.getScriptProperties().getProperty("MEDIA_FOLDER_ID");
  const settingFolderId = getSetting_("media_folder_id");
  const folderId = String(propertyFolderId || settingFolderId || "").trim();
  if (folderId) return DriveApp.getFolderById(folderId);
  return DriveApp.getRootFolder();
}

function syncMediaLinkForPost_(postId, assetId, campaignName, mediaLabel) {
  const assetKey = String(assetId || "").trim();
  const postKey = String(postId || "").trim();
  if (!postKey) return;

  const sheet = getCoreSheet_("media");
  const mediaRows = getRowsByNormalizedHeaders_(sheet, REQUIRED_MEDIA_HEADERS);
  let matched = null;

  if (assetKey) {
    matched = mediaRows.find(function(row) {
      return String(row.asset_id || "").trim() === assetKey;
    }) || null;
  }

  if (!matched && mediaLabel) {
    const normalizedLabel = String(mediaLabel || "").trim().toLowerCase();
    matched = mediaRows.find(function(row) {
      return String(row.asset_name || "").trim().toLowerCase() === normalizedLabel;
    }) || null;
  }

  if (!matched) return;

  matched.linked_post_id = postKey;
  matched.campaign = String(campaignName || matched.campaign || "").trim();
  matched.updated_at = new Date().toISOString();
  upsertObjectByHeader_(sheet, ["asset_id"], matched, REQUIRED_MEDIA_HEADERS, MEDIA_FORMULA_HEADERS);
}

function unlinkMediaForPost_(postId) {
  const sheet = getCoreSheet_("media");
  const rows = getRowsByNormalizedHeaders_(sheet, REQUIRED_MEDIA_HEADERS);
  rows.forEach(function(row) {
    if (String(row.linked_post_id || "").trim() !== String(postId || "").trim()) return;
    row.linked_post_id = "";
    row.updated_at = new Date().toISOString();
    upsertObjectByHeader_(sheet, ["asset_id"], row, REQUIRED_MEDIA_HEADERS, MEDIA_FORMULA_HEADERS);
  });
}

function buildCampaignMap_() {
  const map = {};
  getCampaigns().forEach(function(campaign) {
    map[String(campaign.campaignId || "")] = campaign;
  });
  return map;
}

function buildCampaignNameMap_() {
  const map = {};
  getCampaigns().forEach(function(campaign) {
    const key = normalizeCampaignLookup_(campaign.campaignName);
    if (key) map[key] = campaign;
  });
  return map;
}

function derivePlaceholderIcon_(assetType) {
  if (assetType === "article") return "article";
  if (assetType === "video") return "video";
  if (assetType === "carousel") return "images";
  if (assetType === "document") return "file-text";
  return "image";
}

function resolveMediaSource_(payload) {
  const fileUrlInput = String(payload.fileUrl || "").trim();
  const sourceUrlInput = String(payload.sourceUrl || "").trim();
  const driveFileIdInput = String(payload.driveFileId || "").trim();
  const sourceCandidate = fileUrlInput || sourceUrlInput || driveFileIdInput;
  if (!sourceCandidate) throw new Error("A Drive link, Drive file ID, or external URL is required");

  const parsedDriveFileId = driveFileIdInput || extractDriveFileId_(sourceCandidate);
  if (parsedDriveFileId) {
    try {
      const file = DriveApp.getFileById(parsedDriveFileId);
      return {
        driveFileId: file.getId(),
        fileUrl: file.getUrl(),
        sourceUrl: sourceUrlInput || fileUrlInput || file.getUrl(),
        sourceType: "drive",
        assetName: payload.assetName || file.getName(),
        mimeType: file.getMimeType(),
        assetType: detectAssetType_(file.getMimeType(), file.getName())
      };
    } catch (err) {
      throw new Error("Could not resolve Drive file ID");
    }
  }

  if (!/^https?:\/\//i.test(sourceCandidate)) {
    throw new Error("Provide a valid URL or Drive file ID");
  }

  const lowerUrl = sourceCandidate.toLowerCase();
  return {
    driveFileId: "",
    fileUrl: fileUrlInput || sourceUrlInput || "",
    sourceUrl: sourceUrlInput || fileUrlInput || sourceCandidate,
    sourceType: lowerUrl.indexOf("linkedin.com") !== -1 ? "linkedin" : "external",
    assetName: payload.assetName || "",
    mimeType: "",
    assetType: payload.assetType || inferAssetTypeFromUrl_(sourceCandidate)
  };
}

function extractDriveFileId_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;

  var match = text.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) return match[1];

  match = text.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) return match[1];

  match = text.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) return match[1];

  return "";
}

function inferAssetTypeFromUrl_(url) {
  const lower = String(url || "").toLowerCase();
  if (/\.(mp4|mov|m4v|avi|webm)(\?|$)/i.test(lower)) return "video";
  if (/\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i.test(lower)) return "image";
  if (/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)(\?|$)/i.test(lower)) return "document";
  if (lower.indexOf("linkedin.com") !== -1) return "article";
  return "image";
}

function inferAssetNameFromUrl_(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const cleaned = value.split("?")[0].split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);
  const candidate = parts[parts.length - 1] || "";
  return candidate ? decodeURIComponent(candidate) : "";
}

function normalizeLinkedAssetType_(value) {
  const lower = String(value || "").trim().toLowerCase();
  if (lower === "video") return "video";
  if (lower === "carousel") return "carousel";
  if (lower === "document" || lower === "pdf" || lower === "doc") return "document";
  if (lower === "article" || lower === "link" || lower === "linkedin") return "article";
  return "image";
}

function parseAssetIdList_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || "").trim(); }).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  try {
    if (text.charAt(0) === "[") {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(function(item) { return String(item || "").trim(); }).filter(Boolean);
      }
    }
  } catch (_) {}

  return text
    .split(/[|,\n]/)
    .map(function(item) { return String(item || "").trim(); })
    .filter(Boolean)
    .filter(function(item, index, list) {
      return list.indexOf(item) === index;
    });
}

function parseSemanticList_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || "").trim(); }).filter(Boolean).filter(function(item, index, list) {
      return list.indexOf(item) === index;
    });
  }

  var text = String(value || "").trim();
  if (!text) return [];

  try {
    if (text.charAt(0) === "[") {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parseSemanticList_(parsed);
    }
  } catch (_) {}

  return text
    .split(/[|,\n]/)
    .map(function(item) { return String(item || "").trim(); })
    .filter(Boolean)
    .filter(function(item, index, list) {
      return list.indexOf(item) === index;
    });
}

function stringifySemanticList_(value) {
  return parseSemanticList_(value).join("|");
}

function semanticFieldsFromRow_(row) {
  return {
    semanticTags: parseSemanticList_(pickFirstDefined_(row.semantic_tags, row.semanticTags)),
    semanticClusters: parseSemanticList_(pickFirstDefined_(row.semantic_clusters, row.semanticClusters)),
    semanticNeighbors: parseSemanticList_(pickFirstDefined_(row.semantic_neighbors, row.semanticNeighbors)),
    semanticStrength: normalizeNumber_(pickFirstDefined_(row.semantic_strength, row.semanticStrength)),
    semanticOrigin: String(pickFirstDefined_(row.semantic_origin, row.semanticOrigin, "")).trim(),
    semanticRelationshipType: String(pickFirstDefined_(row.semantic_relationship_type, row.semanticRelationshipType, "")).trim(),
    semanticConfidence: normalizeNumber_(pickFirstDefined_(row.semantic_confidence, row.semanticConfidence)),
    semanticEmbeddingVersion: String(pickFirstDefined_(row.semantic_embedding_version, row.semanticEmbeddingVersion, "heuristic-overlap-v1")).trim(),
    semanticSummary: String(pickFirstDefined_(row.semantic_summary, row.semanticSummary, "")).trim(),
    recurringPatternFlags: parseSemanticList_(pickFirstDefined_(row.recurring_pattern_flags, row.recurringPatternFlags)),
    semanticDecayScore: normalizeNumber_(pickFirstDefined_(row.semantic_decay_score, row.semanticDecayScore)),
    semanticNoveltyScore: normalizeNumber_(pickFirstDefined_(row.semantic_novelty_score, row.semanticNoveltyScore)),
    semanticDensityScore: normalizeNumber_(pickFirstDefined_(row.semantic_density_score, row.semanticDensityScore))
  };
}

function applySemanticFieldsToRow_(target, payload, existing) {
  var source = Object.assign({}, existing || {}, payload || {});
  target.semantic_tags = stringifySemanticList_(pickFirstDefined_(payload.semanticTags, payload.semantic_tags, existing && existing.semantic_tags, existing && existing.semanticTags, []));
  target.semantic_clusters = stringifySemanticList_(pickFirstDefined_(payload.semanticClusters, payload.semantic_clusters, existing && existing.semantic_clusters, existing && existing.semanticClusters, []));
  target.semantic_neighbors = stringifySemanticList_(pickFirstDefined_(payload.semanticNeighbors, payload.semantic_neighbors, existing && existing.semantic_neighbors, existing && existing.semanticNeighbors, []));
  target.semantic_strength = normalizeNumber_(pickFirstDefined_(source.semanticStrength, source.semantic_strength));
  target.semantic_origin = String(pickFirstDefined_(source.semanticOrigin, source.semantic_origin, "")).trim();
  target.semantic_relationship_type = String(pickFirstDefined_(source.semanticRelationshipType, source.semantic_relationship_type, "")).trim();
  target.semantic_confidence = normalizeNumber_(pickFirstDefined_(source.semanticConfidence, source.semantic_confidence));
  target.semantic_embedding_version = String(pickFirstDefined_(source.semanticEmbeddingVersion, source.semantic_embedding_version, "heuristic-overlap-v1")).trim();
  target.semantic_summary = String(pickFirstDefined_(source.semanticSummary, source.semantic_summary, "")).trim();
  target.recurring_pattern_flags = stringifySemanticList_(pickFirstDefined_(source.recurringPatternFlags, source.recurring_pattern_flags, []));
  target.semantic_decay_score = normalizeNumber_(pickFirstDefined_(source.semanticDecayScore, source.semantic_decay_score));
  target.semantic_novelty_score = normalizeNumber_(pickFirstDefined_(source.semanticNoveltyScore, source.semantic_novelty_score));
  target.semantic_density_score = normalizeNumber_(pickFirstDefined_(source.semanticDensityScore, source.semantic_density_score));
  return target;
}

function normalizeIconShape_(value) {
  var shape = String(value || "").trim().toLowerCase();
  if (!shape) return "";
  return ALLOWED_ICON_SHAPES.indexOf(shape) === -1 ? "" : shape;
}

function normalizePathStyle_(value) {
  var style = String(value || "").trim().toLowerCase();
  if (!style) return "";
  return ALLOWED_PATH_STYLES.indexOf(style) === -1 ? "" : style;
}

function parsePlatformTargets_(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[|,\n]/);
  const allowed = ["instagram", "linkedin", "threads", "bluesky", "tiktok"];
  return list
    .map(function(item) { return detectSourcePlatform_(item); })
    .filter(function(item) { return allowed.indexOf(item) !== -1; })
    .filter(function(item, index, arr) { return arr.indexOf(item) === index; });
}

function getAssetsForPost_(post, mediaItems) {
  const items = Array.isArray(mediaItems) ? mediaItems : getMedia();
  const assetIds = parseAssetIdList_(post.carouselAssetIds || post.carousel_asset_ids || []).slice();
  const primaryAssetId = String(post.assetId || post.asset_id || "").trim();
  if (primaryAssetId && assetIds.indexOf(primaryAssetId) === -1) assetIds.unshift(primaryAssetId);

  const byId = assetIds.map(function(assetId) {
    return items.find(function(asset) {
      return String(asset.assetId || "").trim() === assetId;
    }) || null;
  }).filter(Boolean);

  if (byId.length) return byId;

  const postId = String(post.postId || post.post_id || "").trim();
  if (!postId) return [];

  return items.filter(function(asset) {
    return String(asset.linkedPostId || "").trim() === postId;
  });
}

function normalizeMetadataString_(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value).trim();
  }
}

function normalizeBrandFrameworkRow_(item) {
  return {
    framework_key: String(item.frameworkKey || item.framework_key || createBrandFrameworkKey_(item.section || item.title || "framework")).trim(),
    section: String(item.section || "").trim(),
    rule_type: String(item.ruleType || item.rule_type || "principle").trim(),
    title: String(item.title || "").trim(),
    content: String(item.content || "").trim(),
    importance: normalizeNumber_(pickFirstDefined_(item.importance, 0)),
    strictness: String(item.strictness || "medium").trim() || "medium",
    applies_to_platform: String(item.appliesToPlatform || item.applies_to_platform || "").trim(),
    applies_to_post_type: String(item.appliesToPostType || item.applies_to_post_type || "").trim(),
    anti_pattern: normalizeBoolean_(pickFirstDefined_(item.antiPattern, item.anti_pattern, false)),
    preferred_pattern: normalizeBoolean_(pickFirstDefined_(item.preferredPattern, item.preferred_pattern, false)),
    semantic_category: String(item.semanticCategory || item.semantic_category || "").trim(),
    enabled: normalizeBoolean_(pickFirstDefined_(item.enabled, true)),
    examples: normalizeMetadataString_(pickFirstDefined_(item.examples, "")),
    sort_order: normalizeNumber_(pickFirstDefined_(item.sortOrder, item.sort_order, 0)),
    created_at: String(item.created_at || item.createdAt || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
}

function brandFrameworkRowToObject_(row) {
  return {
    frameworkKey: String(row.framework_key || "").trim(),
    section: String(row.section || "").trim(),
    ruleType: String(row.rule_type || "").trim(),
    title: String(row.title || "").trim(),
    content: String(row.content || "").trim(),
    importance: normalizeNumber_(row.importance),
    strictness: String(row.strictness || "medium").trim() || "medium",
    appliesToPlatform: String(row.applies_to_platform || "").trim(),
    appliesToPostType: String(row.applies_to_post_type || "").trim(),
    antiPattern: normalizeBoolean_(row.anti_pattern),
    preferredPattern: normalizeBoolean_(row.preferred_pattern),
    semanticCategory: String(row.semantic_category || "").trim(),
    enabled: row.enabled === "" ? true : normalizeBoolean_(row.enabled),
    examples: String(row.examples || "").trim(),
    sortOrder: normalizeNumber_(row.sort_order),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim()
  };
}

function aiDraftRowToObject_(row) {
  return normalizeAiDraftRow_(Object.assign({}, row, {
    aiDraftId: String(row.ai_draft_id || "").trim(),
    ideaId: String(row.idea_id || row.ai_draft_id || "").trim(),
    artifactId: String(row.artifact_id || row.ai_draft_id || "").trim(),
    artifactType: String(row.artifact_type || "ai_draft").trim() || "ai_draft",
    parentArtifactId: String(row.parent_artifact_id || "").trim(),
    rootArtifactId: String(row.root_artifact_id || "").trim(),
    ideaPrompt: String(row.idea_prompt || row.prompt || "").trim(),
    title: String(row.title || "").trim(),
    platform: String(row.platform || "linkedin").trim() || "linkedin",
    postType: String(row.post_type || "text").trim() || "text",
    generationMode: String(row.generation_mode || "").trim(),
    transformationType: String(row.transformation_type || "").trim(),
    analysisMode: String(row.analysis_mode || "").trim(),
    sourceType: String(row.source_type || "").trim(),
    sourceId: String(row.source_id || "").trim(),
    sourceIds: String(row.source_ids || "").trim(),
    sourceArtifactIds: String(row.source_artifact_ids || "").trim(),
    derivedFromIds: String(row.derived_from_ids || "").trim(),
    outputType: String(row.output_type || "").trim(),
    outputArtifacts: String(row.output_artifacts || "").trim(),
    targetPlatforms: String(row.target_platforms || "").trim(),
    targetCampaignId: String(row.target_campaign_id || "").trim(),
    targetDate: String(row.target_date || "").trim(),
    targetDateRange: String(row.target_date_range || "").trim(),
    generationStage: String(row.generation_stage || "").trim(),
    generatedPostIds: String(row.generated_post_ids || "").trim(),
    generatedCampaignId: String(row.generated_campaign_id || "").trim(),
    generatedOutputs: String(row.generated_outputs || "").trim(),
    campaignId: String(row.campaign_id || "").trim(),
    campaignName: String(row.campaign_name || "").trim(),
    prompt: String(row.prompt || "").trim(),
    draftText: String(row.draft_text || "").trim(),
    hookText: String(row.hook_text || "").trim(),
    ctaText: String(row.cta_text || "").trim(),
    carouselOutline: String(row.carousel_outline || "").trim(),
    brandFrameworkVersion: String(row.brand_framework_version || "").trim(),
    draftStatus: String(row.draft_status || "needs_review").trim() || "needs_review",
    reviewNotes: String(row.review_notes || "").trim(),
    alignmentScore: normalizeNumber_(row.alignment_score),
    diversityControls: String(row.diversity_controls || "").trim(),
    antiPatternFlags: String(row.anti_pattern_flags || "").trim(),
    mediaIds: String(row.media_ids || "").trim(),
    performanceContext: String(row.performance_context || "").trim(),
    createdPostId: String(row.created_post_id || "").trim(),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim()
  }, semanticFieldsFromRow_(row)));
}

function createAIDraftId_() {
  return "AID-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function createIdeaId_() {
  return "IDEA-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function normalizeListField_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || "").trim(); }).filter(Boolean);
  }
  return String(value || "")
    .split(/[|,\n]/)
    .map(function(item) { return String(item || "").trim(); })
    .filter(Boolean);
}

function buildIdeaDraftPayload_(payload, existing) {
  return {
    aiDraftId: String(pickFirstDefined_(payload && payload.aiDraftId, payload && payload.ai_draft_id, existing && existing.aiDraftId, "")).trim(),
    ideaId: String(pickFirstDefined_(payload && payload.ideaId, payload && payload.idea_id, existing && existing.ideaId, "")).trim(),
    artifactId: String(pickFirstDefined_(payload && payload.artifactId, payload && payload.artifact_id, existing && existing.artifactId, "")).trim(),
    artifactType: String(pickFirstDefined_(payload && payload.artifactType, payload && payload.artifact_type, existing && existing.artifactType, "ai_draft")).trim() || "ai_draft",
    parentArtifactId: String(pickFirstDefined_(payload && payload.parentArtifactId, payload && payload.parent_artifact_id, existing && existing.parentArtifactId, "")).trim(),
    rootArtifactId: String(pickFirstDefined_(payload && payload.rootArtifactId, payload && payload.root_artifact_id, existing && existing.rootArtifactId, "")).trim(),
    title: String(pickFirstDefined_(payload && payload.title, existing && existing.title, "")).trim(),
    ideaPrompt: String(pickFirstDefined_(payload && payload.ideaPrompt, payload && payload.idea_prompt, payload && payload.prompt, existing && existing.ideaPrompt, "")).trim(),
    prompt: String(pickFirstDefined_(payload && payload.prompt, payload && payload.ideaPrompt, payload && payload.idea_prompt, existing && existing.prompt, "")).trim(),
    transformationType: String(pickFirstDefined_(payload && payload.transformationType, payload && payload.transformation_type, existing && existing.transformationType, "expand")).trim() || "expand",
    analysisMode: String(pickFirstDefined_(payload && payload.analysisMode, payload && payload.analysis_mode, existing && existing.analysisMode, "")).trim(),
    sourceType: String(pickFirstDefined_(payload && payload.sourceType, payload && payload.source_type, existing && existing.sourceType, "manual")).trim() || "manual",
    sourceId: String(pickFirstDefined_(payload && payload.sourceId, payload && payload.source_id, existing && existing.sourceId, "")).trim(),
    sourceIds: normalizeListField_(pickFirstDefined_(payload && payload.sourceIds, payload && payload.source_ids, existing && existing.sourceIds)).join("|"),
    sourceArtifactIds: normalizeListField_(pickFirstDefined_(payload && payload.sourceArtifactIds, payload && payload.source_artifact_ids, existing && existing.sourceArtifactIds)).join("|"),
    derivedFromIds: normalizeListField_(pickFirstDefined_(payload && payload.derivedFromIds, payload && payload.derived_from_ids, existing && existing.derivedFromIds)).join("|"),
    outputType: String(pickFirstDefined_(payload && payload.outputType, payload && payload.output_type, existing && existing.outputType, "create_one_post")).trim() || "create_one_post",
    outputArtifacts: normalizeListField_(pickFirstDefined_(payload && payload.outputArtifacts, payload && payload.output_artifacts, existing && existing.outputArtifacts)).join("|"),
    targetPlatforms: normalizeListField_(pickFirstDefined_(payload && payload.targetPlatforms, payload && payload.target_platforms, existing && existing.targetPlatforms, "linkedin")).join("|"),
    targetCampaignId: String(pickFirstDefined_(payload && payload.targetCampaignId, payload && payload.target_campaign_id, existing && existing.targetCampaignId, "")).trim(),
    targetDate: normalizeQueueDateLabel(pickFirstDefined_(payload && payload.targetDate, payload && payload.target_date, existing && existing.targetDate, "")),
    targetDateRange: normalizeListField_(pickFirstDefined_(payload && payload.targetDateRange, payload && payload.target_date_range, existing && existing.targetDateRange)).join("|"),
    generationStage: String(pickFirstDefined_(payload && payload.generationStage, payload && payload.generation_stage, existing && existing.generationStage, "captured")).trim() || "captured",
    campaignId: String(pickFirstDefined_(payload && payload.campaignId, payload && payload.campaign_id, existing && existing.campaignId, "")).trim(),
    campaignName: String(pickFirstDefined_(payload && payload.campaignName, payload && payload.campaign_name, existing && existing.campaignName, "")).trim(),
    platform: String(pickFirstDefined_(payload && payload.platform, existing && existing.platform, "linkedin")).trim() || "linkedin",
    postType: String(pickFirstDefined_(payload && payload.postType, payload && payload.post_type, existing && existing.postType, "text")).trim() || "text",
    generationMode: String(pickFirstDefined_(payload && payload.generationMode, payload && payload.generation_mode, existing && existing.generationMode, "write_an_idea")).trim() || "write_an_idea",
    draftStatus: String(pickFirstDefined_(payload && payload.draftStatus, payload && payload.draft_status, existing && existing.draftStatus, "idea_captured")).trim() || "idea_captured",
    reviewNotes: String(pickFirstDefined_(payload && payload.reviewNotes, payload && payload.review_notes, existing && existing.reviewNotes, "")).trim(),
    brandFrameworkVersion: String(pickFirstDefined_(payload && payload.brandFrameworkVersion, payload && payload.brand_framework_version, existing && existing.brandFrameworkVersion, getBrandFrameworkVersion_())).trim(),
    semanticTags: normalizeListField_(pickFirstDefined_(payload && payload.semanticTags, payload && payload.semantic_tags, existing && existing.semanticTags)).join("|"),
    draftText: String(pickFirstDefined_(payload && payload.draftText, payload && payload.draft_text, existing && existing.draftText, "")).trim(),
    carouselOutline: String(pickFirstDefined_(payload && payload.carouselOutline, payload && payload.carousel_outline, existing && existing.carouselOutline, "")).trim(),
    generatedOutputs: normalizeListField_(pickFirstDefined_(payload && payload.generatedOutputs, payload && payload.generated_outputs, existing && existing.generatedOutputs)).join("|"),
    mediaIds: normalizeListField_(pickFirstDefined_(payload && payload.mediaIds, payload && payload.media_ids, existing && existing.mediaIds)).join("|"),
    performanceContext: normalizeListField_(pickFirstDefined_(payload && payload.performanceContext, payload && payload.performance_context, existing && existing.performanceContext)).join("|")
  };
}

function normalizeIdeaScaffoldPayload_(payload) {
  return {
    title: String(payload && payload.title || "").trim(),
    targetDate: normalizeQueueDateLabel(payload && payload.targetDate || payload && payload.target_date || ""),
    targetCampaignId: String(payload && payload.targetCampaignId || payload && payload.target_campaign_id || "").trim(),
    proposedCampaign: payload && (payload.proposedCampaign || payload.proposed_campaign) || {},
    proposedPosts: Array.isArray(payload && payload.proposedPosts) ? payload.proposedPosts.map(function(item) {
      return {
        title: String(item && item.title || "").trim(),
        description: String(item && item.description || "").trim(),
        platform: String(item && item.platform || "linkedin").trim() || "linkedin",
        postType: String(item && (item.postType || item.post_type) || "text").trim() || "text",
        queueDateLabel: normalizeQueueDateLabel(item && (item.queueDateLabel || item.queue_date_label || item.date) || "")
      };
    }) : []
  };
}

function buildIdeaScaffold_(normalized, context) {
  var prompt = normalized.ideaPrompt || normalized.prompt || "";
  var title = normalized.title || deriveIdeaTitle_(prompt);
  var semanticTags = deriveIdeaSemanticTags_(prompt, normalized, context);
  var warnings = deriveIdeaWarnings_(prompt, normalized, context, semanticTags);
  var generatedOutputs = [{
    artifactId: normalized.artifactId || normalized.aiDraftId || createAIDraftId_(),
    artifactType: normalized.transformationType === "turn_into_carousel" || normalized.outputType === "draft_carousel_outline"
      ? "carousel_outline"
      : normalized.transformationType === "turn_into_caption"
      ? "caption"
      : normalized.transformationType === "turn_into_video_script" || normalized.outputType === "draft_short_video_script"
      ? "video_script"
      : normalized.transformationType === "generate_campaign"
      ? "campaign"
      : normalized.transformationType === "analyze_performance"
      ? "analysis"
      : "draft",
    title: title + " Output",
    summary: normalized.mediaIds ? "Output scaffold includes source media context." : "Output scaffold derived from the current artifact chain."
  }];
  return {
    title: title,
    outputType: normalized.outputType,
    transformationType: normalized.transformationType,
    sourceContext: {
      sourceType: normalized.sourceType,
      sourceIds: normalizeListField_(normalized.sourceIds)
    },
    brandChecks: [
      "Brand Voice context included when Brand OS rules exist.",
      "Grammar and anti-pattern checks remain manual until live AI is connected.",
      "Scheduling stays internal to StellarSync only."
    ],
    semanticTags: semanticTags,
    warnings: warnings,
    draftStatus: "scaffold_only",
    generatedOutputs: generatedOutputs,
    proposedCampaign: {
      campaignName: normalized.campaignName || title,
      campaignId: normalized.targetCampaignId || createDeterministicCampaignId_(title),
      pillar: "authority",
      iconShape: normalized.outputType === "populate_campaign_queue" ? "spiral" : "star",
      pathStyle: normalized.outputType === "populate_campaign_queue" ? "zigzag" : "squiggle"
    },
    proposedPosts: buildIdeaProposedPosts_(normalized, title),
    carouselOutline: buildIdeaCarouselOutline_(title, prompt),
    summaryText: [
      "Structure generated.",
      "Output: " + normalized.outputType.replace(/_/g, " "),
      "Source: " + (normalized.sourceType || "manual"),
      "Transformation: " + (normalized.transformationType || "expand").replace(/_/g, " "),
      "Semantic tags: " + (semanticTags.join(", ") || "pending"),
      "Draft status: structured plan",
      "Review proposed posts below."
    ].join("\n")
  };
}

function deriveIdeaTitle_(prompt) {
  var text = String(prompt || "").trim();
  if (!text) return "Untitled Idea";
  return text.split(/[.!?\n]/)[0].trim().slice(0, 72) || "Untitled Idea";
}

function deriveIdeaSemanticTags_(prompt, normalized, context) {
  var tags = normalizeListField_(normalized.semanticTags);
  String(prompt || "").toLowerCase().split(/[^a-z0-9]+/).forEach(function(token) {
    if (token.length >= 5 && tags.length < 8 && tags.indexOf(token) === -1) tags.push(token);
  });
  (context.semanticSignals && context.semanticSignals.platformSignals || []).slice(0, 2).forEach(function(signal) {
    var label = String(signal && (signal.platform || signal.label) || "").trim();
    if (label && tags.indexOf(label) === -1) tags.push(label);
  });
  return tags.slice(0, 8);
}

function deriveIdeaWarnings_(prompt, normalized, context, semanticTags) {
  var warnings = [];
  var text = String(prompt || "").trim();
  if (!text || text.length < 18) warnings.push("too generic");
  if (text.length > 220 && normalized.outputType === "draft_carousel_outline") warnings.push("too long for carousel caption");
  if (/(.)\1\1/i.test(text) || /(very|really|just)\s+\1/i.test(text.toLowerCase())) warnings.push("repeated structure");
  if ((context.semanticSignals && context.semanticSignals.overusedPatterns || []).length) warnings.push("repeated hook");
  if (!semanticTags.length || semanticTags.length < 2) warnings.push("weak classification");
  if ((context.semanticSignals && context.semanticSignals.campaignClusters || []).some(function(cluster) {
    return String(cluster && cluster.campaignKey || "").trim() && String(normalized.campaignName || "").trim() && String(cluster.campaignKey || "").toLowerCase().indexOf(String(normalized.campaignName || "").toLowerCase()) !== -1;
  })) warnings.push("campaign overlap");
  return warnings.filter(function(item, index, list) { return list.indexOf(item) === index; });
}

function buildIdeaProposedPosts_(normalized, title) {
  var outputType = normalized.outputType || "create_one_post";
  var dateRange = normalizeListField_(normalized.targetDateRange);
  var targetDate = normalized.targetDate || normalizeQueueDateLabel(new Date());
  var count = outputType === "create_campaign" || outputType === "populate_campaign_queue" ? 4 : outputType === "populate_calendar_week" ? 5 : 1;
  var posts = [];
  for (var i = 0; i < count; i += 1) {
    var dateLabel = dateRange[i] || offsetQueueDateLabel_(targetDate, i);
    posts.push(buildIdeaPostScaffold_(normalized, i, dateLabel, title));
  }
  return posts;
}

function buildIdeaPostScaffold_(normalized, index, dateLabel, title) {
  var platform = normalizeListField_(normalized.targetPlatforms)[0] || normalized.platform || "linkedin";
  var outputType = normalized.outputType || "create_one_post";
  var prompt = normalized.ideaPrompt || normalized.prompt || "";
  var description = outputType === "create_one_post"
    ? buildIdeaProseFallback_(prompt)
    : [
      "Structure draft direction.",
      "Prompt: " + (prompt || "No prompt captured."),
      "Output: " + outputType.replace(/_/g, " ")
    ].join("\n");
  return {
    title: (title || "Idea Draft") + (index > 0 ? " Part " + (index + 1) : ""),
    description: description,
    platform: platform,
    postType: outputType === "draft_carousel_outline" ? "carousel" : normalized.postType || "text",
    queueDateLabel: dateLabel
  };
}

function buildIdeaProseFallback_(prompt) {
  var text = String(prompt || "").trim().replace(/\s+/g, " ");
  var lower = text.toLowerCase();
  if (lower.indexOf("anything you set your mind to") !== -1) {
    return [
      "“You can do anything you set your mind to” sounds empowering until you notice what it leaves out.",
      "People do not move through neutral systems with equal time, access, support, or room to recover. Mindset matters, but it cannot substitute for infrastructure.",
      "The better question is not whether someone wants it badly enough. It is what conditions make follow-through possible, repeatable, and supported."
    ].join("\n\n");
  }
  if (lower.indexOf("clean energy without distribution") !== -1 || lower.indexOf("new segregation") !== -1) {
    return [
      "Clean energy without distribution is just the new segregation.",
      "If the benefits stop at the people who can already afford the upgrade, the system has not transformed. It has rebranded exclusion with better technology.",
      "A clean-energy transition has to be judged by where the power goes, who controls it, and whether communities that carried the burden of the old system get to shape the next one."
    ].join("\n\n");
  }
  return [
    text,
    "The useful part of this idea is the structure underneath it: who gets access, what conditions shape the outcome, and what changes when the system is made visible.",
    "When the framing gets more precise, the next step gets easier to act on."
  ].filter(Boolean).join("\n\n");
}

function buildIdeaCarouselOutline_(title, prompt) {
  return [
    "Slide 1: " + (title || "Idea"),
    "Slide 2: Core observation from the prompt",
    "Slide 3: Why it matters",
    "Slide 4: Practical application",
    "Slide 5: CTA"
  ].join("\n");
}

function offsetQueueDateLabel_(queueDateLabel, offset) {
  var baseKey = parseDisplayDateKey_(normalizeQueueDateLabel(queueDateLabel));
  if (!baseKey) return normalizeQueueDateLabel(queueDateLabel);
  var parts = baseKey.split("-");
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + Number(offset || 0), 9, 15, 0, 0);
  return formatQueueDateLabel(date);
}

function createBrandFrameworkKey_(label) {
  var cleaned = String(label || "framework").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "framework_rule";
}

function parseBulletLines_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(function(line) {
      return String(line || "").replace(/^\s*[-*•]\s*/, "").trim();
    })
    .filter(Boolean);
}

function stringifyBulletLines_(value) {
  const items = Array.isArray(value) ? value : parseBulletLines_(value);
  return items.join("\n");
}

function detectSourcePlatform_(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.indexOf("instagram") !== -1) return "instagram";
  if (text.indexOf("linkedin") !== -1 || text.indexOf("lnkd.in") !== -1) return "linkedin";
  if (text.indexOf("threads") !== -1) return "threads";
  if (text.indexOf("bsky") !== -1 || text.indexOf("bluesky") !== -1) return "bluesky";
  if (text.indexOf("tiktok") !== -1) return "tiktok";
  return "";
}

function deriveSourceLabelFromPlatform_(platform) {
  const detected = detectSourcePlatform_(platform);
  if (!detected) return "Added manually";
  return detected.charAt(0).toUpperCase() + detected.slice(1);
}

function getSocialAccountPropertyKey_(platform) {
  return "SOCIAL_ACCOUNT_" + String(platform || "").trim().toUpperCase();
}

function getSocialAccountConfig_(platform) {
  // legacy fallback: stored social metadata is retained for older server-side OAuth flows only.
  var raw = PropertiesService.getScriptProperties().getProperty(getSocialAccountPropertyKey_(platform));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function getInstagramOEmbedToken_() {
  // legacy fallback: server-only Meta tokens may exist in Script Properties; diagnostics never expose them.
  return String(
    PropertiesService.getScriptProperties().getProperty("INSTAGRAM_OEMBED_ACCESS_TOKEN") ||
    PropertiesService.getScriptProperties().getProperty("META_APP_ACCESS_TOKEN") ||
    ""
  ).trim();
}

function buildDefaultConnectedAccount_(platform) {
  var normalized = detectSourcePlatform_(platform);
  var status = getPlatformStatus_(normalized);
  return {
    platform: normalized,
    accountId: "",
    accountLabel: status.displayName || status.username || "",
    accessStatus: status.accessStatus,
    scopesGranted: (status.requiredScopes || []).slice(),
    tokenExpiresAt: status.tokenExpiresAt || "",
    lastSyncAt: "",
    lastError: status.lastError || "",
    importSupported: status.importSupported,
    publishSupported: status.publishSupported,
    tokenStatus: status.tokenStatus,
    oauthConfigured: status.hasClientId && status.hasClientSecret && status.hasRedirectUri,
    requiredScopes: (status.requiredScopes || []).slice(),
    appReviewNotes: status.appReviewNotes || "",
    setupChecklist: (status.setupChecklist || []).slice(),
    connectionStatusLabel: status.connectionStatusLabel,
    requiredSetupKeys: (status.requiredSetupKeys || []).slice(),
    missingSetupKeys: (status.missingSetupKeys || []).slice(),
    hasClientId: !!status.hasClientId,
    hasClientSecret: !!status.hasClientSecret,
    hasRedirectUri: !!status.hasRedirectUri,
    hasAccessToken: !!status.hasAccessToken,
    connected: !!status.connected,
    username: status.username || "",
    displayName: status.displayName || "",
    capabilities: {
      captions: status.importSupported,
      images: status.importSupported || normalized === "instagram"
    }
  };
}

function getConnectedAccounts() {
  return ["linkedin", "instagram", "threads", "bluesky", "tiktok"].map(function(platform) {
    return buildDefaultConnectedAccount_(platform);
  });
}

function getConnectedAccountsStatus() {
  return {
    ok: true,
    backendVersion: APP_BACKEND_VERSION,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    accounts: {
      linkedin: getPlatformStatus_("linkedin"),
      instagram: getPlatformStatus_("instagram"),
      threads: getPlatformStatus_("threads"),
      bluesky: getPlatformStatus_("bluesky"),
      tiktok: getPlatformStatus_("tiktok")
    }
  };
}

function hasOAuthClientConfig_(platform) {
  var normalized = detectSourcePlatform_(platform);
  if (!normalized || !PLATFORM_OAUTH_CONFIG[normalized]) return false;
  return !!(getPlatformClientId_(normalized) && getPlatformClientSecret_(normalized) && getOAuthRedirectUri_(normalized));
}

function getConnectedAccountRequirements_(platform) {
  var normalized = detectSourcePlatform_(platform);
  var status = getPlatformStatus_(normalized);
  return {
    requiredScopes: (status.requiredScopes || []).slice(),
    setupChecklist: (status.setupChecklist || []).slice(),
    appReviewNotes: status.appReviewNotes || "",
    defaultStatusLabel: status.connectionStatusLabel
  };
}

function getConnectedAccountStatusLabel_(account) {
  var status = String(account && account.accessStatus || "").trim().toLowerCase();
  if (status === "connected") return "Connected";
  if (status === "ready") return "Ready to connect";
  if (status === "expired") return "Error";
  if (status === "error") return "Error";
  return "Not connected";
}

function testOpenGraphFetch_() {
  try {
    var response = UrlFetchApp.fetch("https://example.com", { muteHttpExceptions: true, followRedirects: true });
    var statusCode = response.getResponseCode();
    return { available: statusCode >= 200 && statusCode < 500, statusCode: statusCode };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

function getSocialImportCapabilities(payload) {
  var openGraph = testOpenGraphFetch_();
  var instagramConfigured = !!getInstagramOEmbedToken_();
  var connectedAccounts = getConnectedAccounts();
  return {
    openGraph: {
      enabled: true,
      works: !!openGraph.available,
      statusCode: openGraph.statusCode || "",
      error: openGraph.error || ""
    },
    instagramOEmbed: {
      configured: instagramConfigured,
      enabled: instagramConfigured,
      requiresAppReview: instagramConfigured,
      note: instagramConfigured
        ? "Instagram oEmbed can be attempted when valid Meta app access and reviewable permissions are configured."
        : "Instagram oEmbed is unavailable until a valid Meta app access token is configured."
    },
    supportedModes: {
      regularArticles: "open_graph",
      instagram: instagramConfigured ? "instagram_oembed_or_manual" : "manual_social_card",
      linkedin: "manual_social_card_or_authenticated_import",
      threads: "manual_social_card_or_authenticated_import",
      bluesky: "manual_social_card_or_authenticated_import"
    },
    connectedAccounts: connectedAccounts
  };
}

function fetchOpenGraphMetadata(payload) {
  var url = String(payload && (payload.url || payload.sourceUrl || payload.source_url) || "").trim();
  if (!url) throw new Error("Missing source URL");
  var platform = detectSourcePlatform_(url) || "external";
  if (["instagram", "linkedin", "threads", "bluesky"].indexOf(platform) !== -1) {
    return {
      mode: "manual_social_card",
      sourceUrl: url,
      sourcePlatform: platform,
      blocked: true,
      supported: false,
      diagnostics: ["Open Graph import is not trusted for this platform URL. Use authenticated import when connected, or the manual Social Card."],
      metadata: {}
    };
  }
  var metadata = { title: "", description: "", image: "", siteName: "", fetched: false };
  var diagnostics = [];
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StellarSync/1.0)" }
    });
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 400) {
      var html = response.getContentText();
      metadata.title = extractMetaContent_(html, "og:title") || extractHtmlTitle_(html);
      metadata.description = extractMetaContent_(html, "og:description") || extractMetaContent_(html, "description");
      metadata.image = extractMetaContent_(html, "og:image");
      metadata.siteName = extractMetaContent_(html, "og:site_name");
      metadata.fetched = true;
    } else {
      diagnostics.push("Metadata fetch returned HTTP " + statusCode + ".");
    }
  } catch (err) {
    diagnostics.push("Metadata fetch failed: " + err.message);
  }
  return {
    mode: metadata.fetched ? "open_graph" : "manual_social_card",
    sourceUrl: url,
    sourcePlatform: platform,
    blocked: false,
    supported: true,
    metadata: metadata,
    diagnostics: diagnostics
  };
}

function fetchInstagramOEmbed(payload) {
  var url = String(payload && (payload.url || payload.sourceUrl || payload.source_url) || "").trim();
  if (!url) throw new Error("Missing source URL");
  var token = getInstagramOEmbedToken_();
  if (!token) {
    return {
      mode: "manual_social_card",
      sourceUrl: url,
      sourcePlatform: "instagram",
      blocked: true,
      supported: false,
      diagnostics: ["Instagram oEmbed is not configured. Connect Meta credentials or use the manual Social Card."],
      metadata: {}
    };
  }
  try {
    // TODO: confirm the final Graph API version and required app-review scopes before enabling production oEmbed import.
    var endpoint = "https://graph.facebook.com/v24.0/instagram_oembed?url=" + encodeURIComponent(url) + "&access_token=" + encodeURIComponent(token);
    var response = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true, followRedirects: true });
    var statusCode = response.getResponseCode();
    var body = response.getContentText();
    if (statusCode >= 200 && statusCode < 300) {
      var data = parseJsonSafe_(body) || {};
      return {
        mode: "instagram_oembed",
        sourceUrl: url,
        sourcePlatform: "instagram",
        blocked: false,
        supported: true,
        metadata: data,
        diagnostics: []
      };
    }
    return {
      mode: "manual_social_card",
      sourceUrl: url,
      sourcePlatform: "instagram",
      blocked: true,
      supported: false,
      diagnostics: ["Instagram oEmbed request failed with HTTP " + statusCode + "."],
      metadata: {}
    };
  } catch (err) {
    return {
      mode: "manual_social_card",
      sourceUrl: url,
      sourcePlatform: "instagram",
      blocked: true,
      supported: false,
      diagnostics: ["Instagram oEmbed failed: " + err.message],
      metadata: {}
    };
  }
}

function normalizeAuthenticatedSocialPost(raw, payload) {
  var platform = detectSourcePlatform_(payload && (payload.platform || payload.sourcePlatform) || raw && raw.platform || "");
  return {
    sourceUrl: String(payload && (payload.url || payload.sourceUrl || payload.source_url) || raw && (raw.permalink || raw.url || raw.published_url) || "").trim(),
    sourcePlatform: platform,
    sourcePostId: String(raw && (raw.id || raw.post_id || raw.postId || raw.uri) || "").trim(),
    sourceAccountId: String(raw && (raw.author_id || raw.account_id || raw.accountId) || "").trim(),
    sourceAccountLabel: String(raw && (raw.author || raw.author_name || raw.account_label || raw.accountLabel) || "").trim(),
    title: String(raw && (raw.title || raw.headline || raw.text) || "").trim(),
    description: String(raw && (raw.caption || raw.text || raw.description || raw.message) || "").trim(),
    image: String(raw && (raw.media_url || raw.thumbnail_url || raw.image) || "").trim(),
    mediaUrls: parseSemanticList_(raw && (raw.media_urls || raw.mediaUrls || []) || []),
    publishedAt: String(raw && (raw.timestamp || raw.published_at || raw.publishedAt) || "").trim(),
    importedAt: new Date().toISOString(),
    sourceImportStatus: "authenticated",
    mode: "authenticated_import",
    blocked: false,
    diagnostics: []
  };
}

function normalizeSocialImportResult(result) {
  var sourceUrl = String(result && result.sourceUrl || "").trim();
  var sourcePlatform = detectSourcePlatform_(result && result.sourcePlatform || sourceUrl) || "external";
  var metadata = result && (result.metadata || result.sourceMetadata) || {};
  var title = String(result && result.title || metadata.title || inferAssetNameFromUrl_(sourceUrl) || "Imported source").trim();
  var description = String(result && result.description || metadata.caption || metadata.description || "").trim();
  var mode = String(result && result.mode || "manual_social_card").trim() || "manual_social_card";
  var blocked = !!(result && result.blocked);
  var diagnostics = Array.isArray(result && result.diagnostics) ? result.diagnostics : [];
  return {
    sourceUrl: sourceUrl,
    sourcePlatform: sourcePlatform,
    title: title,
    description: description,
    platform: sourcePlatform === "instagram" ? "instagram" : "linkedin",
    status: "draft",
    sourceTitle: String(metadata.title || title).trim(),
    metadata: metadata,
    sourceMetadata: metadata,
    sourceImportStatus: String(result && result.sourceImportStatus || (mode === "authenticated_import" ? "authenticated" : mode === "open_graph" || mode === "instagram_oembed" ? "fetched" : blocked ? "limited" : diagnostics.length ? "failed" : "manual")).trim(),
    diagnostics: diagnostics,
    blocked: blocked,
    mode: mode,
    connectedAccountUsed: !!(result && result.connectedAccountUsed),
    canSaveMedia: !!String(result && (result.image || metadata.image || metadata.media_url) || "").trim()
  };
}

function getSocialAuthUrl(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (platform === "linkedin") return startLinkedInAuth();
  if (platform === "instagram") return startInstagramAuth();
  if (platform === "threads") return startThreadsAuth();
  if (platform === "bluesky") return startBlueskyAuth();
  if (platform === "tiktok") return startTikTokAuth();
  return { ok: false, platform: platform, supported: false, status: "unsupported", diagnostics: ["Unknown platform."] };
}

function handleSocialOAuthCallback(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (!platform) {
    return {
      connected: false,
      status: "unsupported",
      diagnostics: ["Missing platform for callback handling."]
    };
  }
  return {
    connected: true,
    status: getPlatformStatus_(platform).accessStatus,
    diagnostics: ["Callback handling is active server-side. Use the platform-specific callback endpoints in deployed redirect URIs."]
  };
}

function refreshSocialToken(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (!platform) throw new Error("Missing platform");
  try {
    refreshPlatformToken_(platform);
    clearPlatformError_(platform);
  } catch (err) {
    savePlatformError_(platform, err);
  }
  return buildDefaultConnectedAccount_(platform);
}

function disconnectSocialAccount(payload) {
  return disconnectPlatform(payload);
}

function disconnectPlatform(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (!platform) throw new Error("Missing platform");
  deletePlatformConnectionProps_(platform);
  return { ok: true, platform: platform, disconnected: true, account: getPlatformStatus_(platform) };
}

function getScriptProp_(key) {
  // legacy fallback/server secret access: Supabase owns workspace/client config for the hybrid app.
  return String(PropertiesService.getScriptProperties().getProperty(key) || "").trim();
}

function setScriptProp_(key, value) {
  // legacy fallback/server secret access only. Do not use for Supabase-owned workspace/client config.
  if (value === undefined || value === null || value === "") {
    PropertiesService.getScriptProperties().deleteProperty(key);
    return;
  }
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function deleteScriptProps_(keys) {
  (Array.isArray(keys) ? keys : []).forEach(function(key) {
    if (key) PropertiesService.getScriptProperties().deleteProperty(key);
  });
}

function getPlatformOAuthConfig_(platform) {
  var normalized = detectSourcePlatform_(platform);
  return PLATFORM_OAUTH_CONFIG[normalized] || null;
}

function getPublicWebAppBaseUrl_() {
  return getScriptProp_("PUBLIC_WEBAPP_BASE_URL");
}

function getPublicWebappBaseUrl_() {
  return getPublicWebAppBaseUrl_();
}

function normalizeDeploymentUrl_(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getOAuthRedirectUri_(platform) {
  var baseUrl = getPublicWebAppBaseUrl_();
  if (!baseUrl) return "";
  return baseUrl.replace(/\/+$/, "") + "/auth/" + String(platform || "").trim().toLowerCase() + "/callback";
}

function getPlatformClientId_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return "";
  if (platform === "threads") {
    return getScriptProp_(config.clientIdKey) || getScriptProp_("META_APP_ID");
  }
  return getScriptProp_(config.clientIdKey);
}

function getPlatformClientSecret_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return "";
  if (platform === "threads") {
    return getScriptProp_(config.clientSecretKey) || getScriptProp_("META_APP_SECRET");
  }
  return getScriptProp_(config.clientSecretKey);
}

function getPlatformApiVersion_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config || !config.apiVersionKey) return "";
  if (platform === "threads") {
    return getScriptProp_(config.apiVersionKey) || getScriptProp_("META_API_VERSION");
  }
  return getScriptProp_(config.apiVersionKey);
}

function getInstagramAuthMode_() {
  var mode = String(getScriptProp_("INSTAGRAM_AUTH_MODE") || "instagram_login").trim().toLowerCase();
  return mode === "facebook_graph" ? "facebook_graph" : "instagram_login";
}

function validateInstagramScopes_() {
  var mode = getInstagramAuthMode_();
  var scopes = getPlatformScopes_("instagram");
  if (mode === "instagram_login") {
    var invalidFound = scopes.filter(function(scope) {
      return INSTAGRAM_INVALID_LOGIN_SCOPES.indexOf(scope) !== -1;
    });
    if (invalidFound.length) {
      return { valid: false, invalidScopes: invalidFound, message: "Invalid Instagram scopes for instagram_login mode. These scopes are only valid for Facebook Graph mode: " + invalidFound.join(", ") };
    }
  }
  return { valid: true, invalidScopes: [], message: "" };
}

function getPlatformScopes_(platform) {
  if (platform === "instagram") {
    return getInstagramAuthMode_() === "instagram_login" ? INSTAGRAM_LOGIN_SCOPES.slice() : INSTAGRAM_FACEBOOK_GRAPH_SCOPES.slice();
  }
  var config = getPlatformOAuthConfig_(platform);
  return config ? config.scopes.slice() : [];
}

function getInstagramAuthBase_() {
  return getInstagramAuthMode_() === "instagram_login" ? "https://www.instagram.com" : "https://www.facebook.com";
}

function getInstagramGraphBase_() {
  return getInstagramAuthMode_() === "instagram_login" ? "https://graph.instagram.com" : "https://graph.facebook.com";
}

function getInstagramTokenEndpoint_() {
  var version = getPlatformApiVersion_("instagram");
  return getInstagramGraphBase_() + "/" + version + "/oauth/access_token";
}

function getRequiredSetupKeys_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return [];
  if (platform === "linkedin") {
    return ["PUBLIC_WEBAPP_BASE_URL", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"];
  }
  if (platform === "instagram") {
    return ["PUBLIC_WEBAPP_BASE_URL", "META_APP_ID", "META_APP_SECRET", "META_API_VERSION"];
  }
  if (platform === "threads") {
    var keys = ["PUBLIC_WEBAPP_BASE_URL", "THREADS_API_VERSION"];
    var hasThreadsId = !!getScriptProp_(config.clientIdKey);
    var hasThreadsSecret = !!getScriptProp_(config.clientSecretKey);
    var hasMetaId = !!getScriptProp_("META_APP_ID");
    var hasMetaSecret = !!getScriptProp_("META_APP_SECRET");
    if (!hasThreadsId && !hasMetaId) keys.push("THREADS_APP_ID or META_APP_ID");
    if (!hasThreadsSecret && !hasMetaSecret) keys.push("THREADS_APP_SECRET or META_APP_SECRET");
    return keys;
  }
  return config.requiredSetupKeys.slice();
}

function getMissingSetupKeys_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return [];
  if (platform === "linkedin") {
    var missingLinkedIn = [];
    if (!getPublicWebappBaseUrl_()) missingLinkedIn.push("PUBLIC_WEBAPP_BASE_URL");
    if (!getPlatformClientId_(platform)) missingLinkedIn.push("LINKEDIN_CLIENT_ID");
    if (!getPlatformClientSecret_(platform)) missingLinkedIn.push("LINKEDIN_CLIENT_SECRET");
    return missingLinkedIn;
  }
  if (platform === "instagram") {
    var missingInstagram = [];
    if (!getPublicWebappBaseUrl_()) missingInstagram.push("PUBLIC_WEBAPP_BASE_URL");
    if (!getPlatformClientId_(platform)) missingInstagram.push("META_APP_ID");
    if (!getPlatformClientSecret_(platform)) missingInstagram.push("META_APP_SECRET");
    if (!getPlatformApiVersion_(platform)) missingInstagram.push("META_API_VERSION");
    return missingInstagram;
  }
  if (platform === "threads") {
    var missing = [];
    if (!getPublicWebappBaseUrl_()) missing.push("PUBLIC_WEBAPP_BASE_URL");
    if (!getPlatformApiVersion_(platform)) missing.push("THREADS_API_VERSION or META_API_VERSION");
    if (!getPlatformClientId_(platform)) missing.push("THREADS_APP_ID or META_APP_ID");
    if (!getPlatformClientSecret_(platform)) missing.push("THREADS_APP_SECRET or META_APP_SECRET");
    return missing;
  }
  return getRequiredSetupKeys_(platform).filter(function(key) {
    if (key === "PUBLIC_WEBAPP_BASE_URL") return !getPublicWebappBaseUrl_();
    return !getScriptProp_(key);
  });
}

function buildOAuthState_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) throw new Error("Unsupported platform");
  var state = Utilities.getUuid() + ":" + platform + ":" + new Date().getTime();
  setScriptProp_(config.stateKey, state);
  setScriptProp_(config.stateExpiresAtKey, String(new Date().getTime() + OAUTH_STATE_TTL_MS));
  return state;
}

function getLegacyRedirectPropertyPresence_() {
  return {
    LINKEDIN_REDIRECT_URI: !!getScriptProp_("LINKEDIN_REDIRECT_URI"),
    INSTAGRAM_REDIRECT_URI: !!getScriptProp_("INSTAGRAM_REDIRECT_URI"),
    THREADS_REDIRECT_URI: !!getScriptProp_("THREADS_REDIRECT_URI")
  };
}

function getLegacyRedirectRuntimeReferences_() {
  return {
    LINKEDIN_REDIRECT_URI: false,
    INSTAGRAM_REDIRECT_URI: false,
    THREADS_REDIRECT_URI: false
  };
}

function getDashboardUpdateRequired_(platform, frontendUrl, publicBaseUrl) {
  var normalizedFrontend = normalizeDeploymentUrl_(frontendUrl);
  var normalizedPublic = normalizeDeploymentUrl_(publicBaseUrl);
  if (!normalizedPublic) return "yes";
  if (normalizedFrontend && normalizedFrontend !== normalizedPublic) return "yes";
  return "no";
}

function authUrlContainsMetaCallback_(authUrl) {
  var raw = String(authUrl || "");
  var decoded = "";
  try {
    decoded = decodeURIComponent(raw);
  } catch (err) {
    decoded = raw;
  }
  return raw.indexOf("metaCallback") !== -1 || decoded.indexOf("metaCallback") !== -1;
}

function assertNoMetaCallbackAuthUrl_(platform, authUrl) {
  if ((platform === "instagram" || platform === "threads") && authUrlContainsMetaCallback_(authUrl)) {
    throw new Error("Blocked stale Meta OAuth callback. " + platform + " auth must use " + getOAuthRedirectUri_(platform));
  }
}

function buildInstagramAuthDiagnostics_() {
  var mode = getInstagramAuthMode_();
  return {
    instagramAuthMode: mode,
    authEndpoint: getInstagramAuthBase_() + "/" + getPlatformApiVersion_("instagram") + "/dialog/oauth",
    tokenEndpoint: getInstagramTokenEndpoint_(),
    profileEndpoint: getInstagramGraphBase_() + "/" + getPlatformApiVersion_("instagram") + "/me",
    requestedScopes: getPlatformScopes_("instagram"),
    invalidScopeWarnings: mode === "instagram_login" ? getPlatformScopes_("instagram").filter(function(s) { return INSTAGRAM_INVALID_LOGIN_SCOPES.indexOf(s) !== -1; }) : [],
    expectedGraphHost: getInstagramGraphBase_()
  };
}

function buildOAuthRouteHealth_(frontendUrl) {
  var publicBaseUrl = getPublicWebAppBaseUrl_();
  return ["linkedin", "instagram", "threads", "tiktok"].map(function(platform) {
    var config = getPlatformOAuthConfig_(platform);
    var state = getScriptProp_(config.stateKey);
    var authUrl = "";
    try {
      authUrl = buildPlatformAuthUrl_(platform, state || "[diagnostic-state]");
    } catch (err) {
      authUrl = "";
    }
	    var derivedRedirectUri = getOAuthRedirectUri_(platform);
	    var containsMetaCallback = authUrlContainsMetaCallback_(authUrl) || authUrlContainsMetaCallback_(derivedRedirectUri);
	    return {
	      platform: platform,
	      label: config.label,
	      derivedRedirectUri: derivedRedirectUri,
	      authUrlPreview: redactAuthUrlPreview_(authUrl),
	      redirectUriContainsMetaCallback: containsMetaCallback,
	      connectActionUsed: platform === "instagram" ? "startInstagramAuth" : platform === "threads" ? "startThreadsAuth" : "startLinkedInAuth",
	      callbackActionExpected: platform + "Callback",
	      frontendAppScriptUrl: frontendUrl || "",
	      backendPublicWebAppBaseUrl: publicBaseUrl || "",
	      callbackAction: platform + "Callback",
      statePlatform: platform,
      hasState: !!state,
      lastCallbackActionHit: getScriptProp_("LAST_OAUTH_CALLBACK_ACTION") || "",
      lastError: getScriptProp_(config.lastErrorKey) || "",
      dashboardUpdateRequired: getDashboardUpdateRequired_(platform, frontendUrl, publicBaseUrl),
      authMode: platform === "instagram" ? getInstagramAuthMode_() : "",
      tokenHost: platform === "instagram" ? getInstagramGraphBase_() : platform === "threads" ? "https://graph.threads.net" : "https://www.linkedin.com",
      requiredScopes: getPlatformScopes_(platform),
      instagramAuthMode: platform === "instagram" ? getInstagramAuthMode_() : "",
      threadsRedirectUri: platform === "threads" ? derivedRedirectUri : "",
      threadsCallbackAction: platform === "threads" ? "threadsCallback" : "",
      diagnostics: {
        appDomainIssue: !publicBaseUrl || publicBaseUrl.indexOf("script.google.com") === -1 ? "Check provider App Domains: script.google.com and script.googleusercontent.com may be required." : "",
        redirectAllowlistIssue: getDashboardUpdateRequired_(platform, frontendUrl, publicBaseUrl) === "yes" ? "Provider dashboard redirect allowlist may not match the active deployment URL." : "",
        invalidScopeIssue: platform === "instagram" ? function() {
          var scopes = getPlatformScopes_("instagram");
          var mode = getInstagramAuthMode_();
          var invalid = scopes.filter(function(s) { return INSTAGRAM_INVALID_LOGIN_SCOPES.indexOf(s) !== -1; });
          return invalid.length ? (mode === "instagram_login" ? "Instagram Login mode requests Facebook Graph-only scopes: " + invalid.join(", ") : "Facebook Graph mode with scopes that may require app review: " + invalid.join(", ")) : "";
        }() : "",
        tokenHostMismatchIssue: platform === "instagram" && getInstagramAuthMode_() === "instagram_login" && getInstagramGraphBase_().indexOf("graph.instagram.com") === -1 ? "Instagram Login tokens must use graph.instagram.com endpoints." : "",
        threadsRedirectAllowlistIssue: platform === "threads" ? function() {
          var redirectUri = derivedRedirectUri;
          if (redirectUri.indexOf("/threads/callback") === -1) return "Threads redirect URI must end with /auth/threads/callback";
          return "";
        }() : "",
        threadsError1349168: platform === "threads" ? "If Meta returns error_code 1349168, the redirect URI is not whitelisted in Meta App dashboard. Add " + derivedRedirectUri + " to Valid OAuth Redirect URIs under Facebook Login > Settings." : ""
      }
    };
  });
}

function validateOAuthState_(platform, state) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return false;
  var expected = getScriptProp_(config.stateKey);
  var expiresAt = Number(getScriptProp_(config.stateExpiresAtKey) || 0);
  deleteScriptProps_([config.stateKey, config.stateExpiresAtKey]);
  return !!state && !!expected && state === expected && expiresAt > new Date().getTime();
}

function parseOAuthStatePlatform_(state) {
  var s = String(state || "");
  if (s.indexOf(":instagram:") !== -1) return "instagram";
  if (s.indexOf(":threads:") !== -1) return "threads";
  return "";
}

function startLinkedInAuth() {
  return startPlatformAuth_("linkedin");
}

function startInstagramAuth() {
  return startPlatformAuth_("instagram");
}

function setInstagramAuthMode(payload) {
  var mode = String(payload && payload.mode || "").trim().toLowerCase();
  if (mode !== "instagram_login" && mode !== "facebook_graph") {
    return { ok: false, error: "Invalid mode. Use instagram_login or facebook_graph." };
  }
  setScriptProp_("INSTAGRAM_AUTH_MODE", mode);
  return { ok: true, mode: mode, previousMode: getInstagramAuthMode_() };
}

function startThreadsAuth() {
  return startPlatformAuth_("threads");
}

function startPlatformAuth_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) throw new Error("Unsupported platform");
  var missingSetupKeys = getMissingSetupKeys_(platform);
  if (missingSetupKeys.length) {
    var missingResponse = {
      ok: false,
      codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
      platform: platform,
      authUrl: "",
      error: "Missing Script Properties: " + missingSetupKeys.join(", "),
      missingSetupKeys: missingSetupKeys,
      requiredScopes: getPlatformScopes_(platform),
      setupChecklist: buildPlatformSetupChecklist_(platform),
      appReviewNotes: getPlatformAppReviewNotes_(platform),
      status: "missing_setup"
    };
    if (platform === "linkedin") {
      return Object.assign(missingResponse, buildLinkedInAuthDiagnostics_("", ""));
    }
    if (platform === "instagram") {
      return Object.assign(missingResponse, buildInstagramAuthDiagnostics_());
    }
    return missingResponse;
  }
  var state = buildOAuthState_(platform);
  if (platform === "instagram") {
    var scopeCheck = validateInstagramScopes_();
    if (!scopeCheck.valid) {
      return {
        ok: false,
        codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
        platform: platform,
        authUrl: "",
        error: scopeCheck.message,
        invalidScopes: scopeCheck.invalidScopes,
        instagramAuthMode: getInstagramAuthMode_(),
        requiredScopes: getPlatformScopes_(platform),
        status: "invalid_scopes"
      };
    }
  }
  var authUrl = buildPlatformAuthUrl_(platform, state);
  assertNoMetaCallbackAuthUrl_(platform, authUrl);
  var response = {
    ok: true,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    platform: platform,
    authUrl: authUrl,
    requiredScopes: getPlatformScopes_(platform),
    setupChecklist: buildPlatformSetupChecklist_(platform),
    appReviewNotes: getPlatformAppReviewNotes_(platform),
    missingSetupKeys: []
  };
  if (platform === "linkedin") {
    return Object.assign(response, buildLinkedInAuthDiagnostics_(getOAuthRedirectUri_(platform), authUrl));
  }
  var diag = {
    authUrlPreview: redactAuthUrlPreview_(authUrl),
    derivedRedirectUri: getOAuthRedirectUri_(platform),
    redirectUriContainsMetaCallback: authUrlContainsMetaCallback_(authUrl) || authUrlContainsMetaCallback_(getOAuthRedirectUri_(platform)),
    connectActionUsed: platform === "instagram" ? "startInstagramAuth" : platform === "threads" ? "startThreadsAuth" : "startLinkedInAuth",
    callbackActionExpected: platform + "Callback",
    frontendAppScriptUrl: "",
    backendPublicWebAppBaseUrl: getPublicWebAppBaseUrl_(),
    statePlatform: platform,
    hasState: !!state
  };
  if (platform === "instagram") {
    var instaMode = getInstagramAuthMode_();
    diag.instagramAuthMode = instaMode;
    diag.authEndpoint = getInstagramAuthBase_() + "/" + getPlatformApiVersion_("instagram") + "/dialog/oauth";
    diag.tokenEndpoint = getInstagramTokenEndpoint_();
    diag.profileEndpoint = getInstagramGraphBase_() + "/" + getPlatformApiVersion_("instagram") + "/me";
    diag.requestedScopes = getPlatformScopes_("instagram");
    diag.invalidScopeWarnings = [];
    if (instaMode === "instagram_login") {
      var scopeV = validateInstagramScopes_();
      if (!scopeV.valid) diag.invalidScopeWarnings = scopeV.invalidScopes;
    }
    diag.expectedGraphHost = getInstagramGraphBase_();
  }
  if (platform === "threads") {
    diag.threadsRedirectUri = getOAuthRedirectUri_("threads");
    diag.authEndpoint = config.authUrl;
    diag.tokenEndpoint = config.tokenUrl;
    diag.profileEndpoint = config.graphUrlBase + "/" + getPlatformApiVersion_("threads") + "/me";
    diag.threadsMetaAppIdSource = getPlatformClientId_("threads") === getScriptProp_("META_APP_ID") ? "fallback (META_APP_ID)" : "dedicated (THREADS_APP_ID)";
  }
  return Object.assign(response, diag);
}

function buildPlatformAuthUrl_(platform, state) {
  var config = getPlatformOAuthConfig_(platform);
  if (platform === "linkedin") {
    return buildLinkedInAuthUrl_(state);
  }
  if (platform === "instagram") {
    var instagramRedirectUri = getOAuthRedirectUri_("instagram");
    return getInstagramAuthBase_() + "/" + getPlatformApiVersion_(platform) + "/dialog/oauth?" + toQueryString_({
      client_id: getPlatformClientId_("instagram"),
      redirect_uri: instagramRedirectUri,
      state: state,
      response_type: "code",
      scope: getPlatformScopes_("instagram").join(config.scopeDelimiter)
    });
  }
  if (platform === "threads") {
    var threadsRedirectUri = getOAuthRedirectUri_("threads");
    return config.authUrl + "?" + toQueryString_({
      client_id: getPlatformClientId_("threads"),
      redirect_uri: threadsRedirectUri,
      state: state,
      response_type: "code",
      scope: getPlatformScopes_("threads").join(config.scopeDelimiter)
    });
  }
  if (platform === "tiktok") {
    var tiktokRedirectUri = getOAuthRedirectUri_("tiktok");
    return config.authUrl + "?" + toQueryString_({
      client_key: getPlatformClientId_("tiktok"),
      scope: getPlatformScopes_("tiktok").join(config.scopeDelimiter),
      response_type: "code",
      redirect_uri: tiktokRedirectUri,
      state: state
    });
  }
  return config.authUrl + "?" + toQueryString_({
    client_id: getPlatformClientId_(platform),
    redirect_uri: getOAuthRedirectUri_(platform),
    state: state,
    response_type: "code",
    scope: getPlatformScopes_(platform).join(config.scopeDelimiter)
  });
}

function buildLinkedInAuthUrl_(state) {
  var config = getPlatformOAuthConfig_("linkedin");
  var derivedRedirectUri = getOAuthRedirectUri_("linkedin");
  var encodedRedirectUri = encodeURIComponent(derivedRedirectUri);
  return config.authUrl
    + "?response_type=code"
    + "&client_id=" + encodeURIComponent(getPlatformClientId_("linkedin"))
    + "&redirect_uri=" + encodedRedirectUri
    + "&state=" + encodeURIComponent(String(state || ""))
    + "&scope=" + encodeURIComponent(getPlatformScopes_("linkedin").join(config.scopeDelimiter));
}

function buildLinkedInAuthDiagnostics_(derivedRedirectUri, authUrl) {
  var derived = String(derivedRedirectUri || getOAuthRedirectUri_("linkedin") || "").trim();
  var encoded = derived ? encodeURIComponent(derived) : "";
  return {
    derivedRedirectUri: derived,
    encodedRedirectUri: encoded,
    authUrlPreview: redactLinkedInAuthUrlPreview_(authUrl || "")
  };
}

function redactLinkedInAuthUrlPreview_(authUrl) {
  return redactAuthUrlPreview_(authUrl);
}

function redactAuthUrlPreview_(authUrl) {
  return String(authUrl || "")
    .replace(/([?&]state=)[^&]*/i, "$1[redacted]");
}

function linkedinCallback(e) {
  return handleOAuthCallback_("linkedin", e);
}

function instagramCallback(e) {
  return handleOAuthCallback_("instagram", e);
}

function threadsCallback(e) {
  return handleOAuthCallback_("threads", e);
}

function metaCallback(e) {
  setScriptProp_("LAST_OAUTH_CALLBACK_ACTION", "metaCallback");
  var params = payloadOrParams_(e);
  var rawState = String(params.state || "").trim();
  var rawCode = String(params.code || "").trim();
  var rawError = String(params.error || "").trim();
  var rawErrorDescription = String(params.error_description || "").trim();

  var platform = parseOAuthStatePlatform_(rawState);
  if (!platform) {
    platform = detectSourcePlatform_(String(params.platform || "").trim());
  }

  return HtmlService.createHtmlOutput(buildOAuthCallbackHtml_("Meta callback deprecated", "Shared Meta callback is deprecated. Use instagramCallback or threadsCallback.", "#fbbf24", {
    hasCode: !!rawCode,
    hasState: !!rawState,
    parsedPlatform: platform || "",
    statePrefix: rawState ? rawState.slice(0, 8) + "..." : "",
    endpointFamily: "meta-shared-callback-deprecated",
    action: "metaCallback"
  }, [
    "This shared callback URL (?action=metaCallback) is no longer used for new connections.",
    "Update Meta App dashboard Valid OAuth Redirect URIs to include the per-platform callback URLs:",
    "  " + getOAuthRedirectUri_("instagram"),
    "  " + getOAuthRedirectUri_("threads"),
    "Restart the connection flow from StellarSync using the platform-specific buttons."
  ])).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleOAuthCallback_(platform, e) {
  try {
    setScriptProp_("LAST_OAUTH_CALLBACK_ACTION", platform + "Callback");
    var params = payloadOrParams_(e);
    if (params.error) throw buildOAuthCallbackError_(platform, params);
    var code = String(params.code || "").trim();
    if (!code) {
      var callbackState = String(params.state || "").trim();
      var looksLikeOAuthAttempt = !!callbackState || !!String(params.error || "").trim() || !!String(params.error_description || "").trim();
      if (!looksLikeOAuthAttempt) {
        return HtmlService.createHtmlOutput(buildOAuthCallbackHtml_(PLATFORM_OAUTH_CONFIG[platform].label + " callback ready", "This callback endpoint is reachable, but no authorization code was provided.", "#38bdf8", {
          platform: platform,
          callbackUrl: getOAuthRedirectUri_(platform),
          codeVersionStamp: STELLARSYNC_BACKEND_VERSION
        }, [
          "Start the connection flow from StellarSync instead of opening the callback URL directly.",
          "If LinkedIn still rejects the redirect URI, compare the exact redirect URI in diagnostics with the one registered in the provider dashboard."
        ])).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
      throw new Error("Missing authorization code.");
    }
    if (!validateOAuthState_(platform, String(params.state || "").trim())) throw new Error("OAuth state validation failed.");
    var result = exchangeOAuthCode_(platform, code);
    clearPlatformError_(platform);
    return HtmlService.createHtmlOutput(buildOAuthCallbackHtml_(PLATFORM_OAUTH_CONFIG[platform].label + " connected", "OAuth completed server-side. You can return to StellarSync.", "#00ffaa", result, [
      "Return to StellarSync and click Test Status to verify the stored account.",
      result.refreshSupported ? "Refresh is configured when the platform supports it." : "Refresh is unavailable for this token. Reconnect when it expires."
    ]))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    if (sanitizeErrorMessage_(err && err.message || "").toLowerCase() !== "missing authorization code.") {
      savePlatformError_(platform, err);
    }
    return HtmlService.createHtmlOutput(buildOAuthCallbackHtml_(PLATFORM_OAUTH_CONFIG[platform].label + " connection error", sanitizeErrorMessage_(err && err.message || "OAuth failed. Return to StellarSync and test the connection again."), "#f87171", buildSafeErrorDetails_(platform, err), [
      "Return to StellarSync and review the Connected Accounts card.",
      "Confirm redirect URI, app review permissions, and API version settings in the platform dashboard."
    ]))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function exchangeOAuthCode_(platform, code) {
  var tokenData = maybeUpgradeTokenLifetime_(platform, requestAccessToken_(platform, code));
  var config = getPlatformOAuthConfig_(platform);
  setScriptProp_(config.accessTokenKey, tokenData.access_token || "");
  if (config.refreshTokenKey) setScriptProp_(config.refreshTokenKey, tokenData.refresh_token || "");
  setScriptProp_(config.tokenExpiresAtKey, computeExpiryIso_(tokenData.expires_in));
  var profile = fetchPlatformProfile_(platform, tokenData.access_token);
  savePlatformProfile_(platform, profile);
  return {
    platform: platform,
    tokenStored: !!tokenData.access_token,
    tokenExpiresAt: getScriptProp_(config.tokenExpiresAtKey),
    refreshSupported: isPlatformRefreshSupported_(platform, tokenData),
    profile: redactProfile_(profile)
  };
}

function requestAccessToken_(platform, code) {
  var config = getPlatformOAuthConfig_(platform);
  if (platform === "linkedin") {
    return fetchJson_(
      config.tokenUrl,
      {
        method: "post",
        metaLabel: config.label + " code exchange",
        payload: {
          grant_type: "authorization_code",
          code: code,
          redirect_uri: getOAuthRedirectUri_(platform),
          client_id: getPlatformClientId_(platform),
          client_secret: getPlatformClientSecret_(platform)
        }
      }
    );
  }
  if (platform === "instagram") {
    return fetchJson_(
      getInstagramTokenEndpoint_(),
      {
        method: "post",
        metaLabel: config.label + " code exchange [" + getPlatformApiVersion_(platform) + " / " + getInstagramAuthMode_() + "]",
        payload: {
          client_id: getPlatformClientId_(platform),
          client_secret: getPlatformClientSecret_(platform),
          redirect_uri: getOAuthRedirectUri_(platform),
          code: code,
          grant_type: "authorization_code"
        }
      }
    );
  }
  if (platform === "tiktok") {
    return fetchJson_(
      config.tokenUrl,
      {
        method: "post",
        metaLabel: config.label + " code exchange",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        payload: {
          client_key: getPlatformClientId_(platform),
          client_secret: getPlatformClientSecret_(platform),
          code: code,
          grant_type: "authorization_code",
          redirect_uri: getOAuthRedirectUri_(platform)
        }
      }
    );
  }
  return fetchJson_(
    config.tokenUrl,
    {
      method: "post",
      metaLabel: config.label + " code exchange [" + getPlatformApiVersion_(platform) + "]",
      payload: {
        client_id: getPlatformClientId_(platform),
        client_secret: getPlatformClientSecret_(platform),
        redirect_uri: getOAuthRedirectUri_(platform),
        code: code,
        grant_type: "authorization_code"
      }
    }
  );
}

function fetchPlatformProfile_(platform, accessToken) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config || !accessToken) return {};
  if (platform === "linkedin") {
    var linkedinProfile = fetchJson_(config.profileUrl, {
      method: "get",
      metaLabel: config.label + " profile fetch",
      headers: { Authorization: "Bearer " + accessToken }
    }) || {};
    return {
      userId: String(linkedinProfile.sub || linkedinProfile.id || "").trim(),
      displayName: String(linkedinProfile.name || "").trim(),
      username: String(linkedinProfile.name || "").trim()
    };
  }
  if (platform === "instagram") {
    var version = getPlatformApiVersion_(platform);
    if (getInstagramAuthMode_() === "instagram_login") {
      var instagramMe = fetchJson_(getInstagramGraphBase_() + "/" + version + "/me?fields=id,username&access_token=" + encodeURIComponent(accessToken), {
        method: "get",
        metaLabel: config.label + " profile fetch [" + version + " / instagram_login]"
      }) || {};
      return {
        userId: String(instagramMe.id || "").trim(),
        displayName: String(instagramMe.username || "").trim(),
        username: String(instagramMe.username || "").trim(),
        pageId: ""
      };
    }
    var me = fetchJson_(getInstagramGraphBase_() + "/" + version + "/me?fields=id,name,accounts{id,name,instagram_business_account{id,username}}&access_token=" + encodeURIComponent(accessToken), {
      method: "get",
      metaLabel: config.label + " profile fetch [" + version + " / facebook_graph]"
    }) || {};
    var pages = (((me || {}).accounts || {}).data || []);
    var selectedPage = null;
    for (var i = 0; i < pages.length; i += 1) {
      if (pages[i] && pages[i].instagram_business_account) {
        selectedPage = pages[i];
        break;
      }
    }
    if (!selectedPage && pages.length) selectedPage = pages[0];
    var ig = selectedPage && selectedPage.instagram_business_account ? selectedPage.instagram_business_account : {};
    return {
      userId: String(ig.id || me.id || "").trim(),
      displayName: String(ig.username || selectedPage && selectedPage.name || me.name || "").trim(),
      username: String(ig.username || "").trim(),
      pageId: String(selectedPage && selectedPage.id || "").trim()
    };
  }
  if (platform === "tiktok") {
    var tiktokUserInfo = fetchJson_(config.graphUrlBase + "/user/info/?fields=open_id,union_id,avatar_url,display_name&access_token=" + encodeURIComponent(accessToken), {
      method: "get",
      metaLabel: config.label + " profile fetch"
    }) || {};
    var tiktokData = (tiktokUserInfo && tiktokUserInfo.data) || {};
    return {
      userId: String(tiktokData.open_id || tiktokData.union_id || "").trim(),
      displayName: String(tiktokData.display_name || "").trim(),
      username: String(tiktokData.display_name || "").trim()
    };
  }
  var threadsVersion = getPlatformApiVersion_(platform);
  var threadsProfile = fetchJson_(config.graphUrlBase + "/" + threadsVersion + "/me?fields=id,username&access_token=" + encodeURIComponent(accessToken), {
    method: "get",
    metaLabel: config.label + " profile fetch [" + threadsVersion + "]"
  }) || {};
  return {
    userId: String(threadsProfile.id || "").trim(),
    displayName: String(threadsProfile.username || "").trim(),
    username: String(threadsProfile.username || "").trim()
  };
}

function savePlatformProfile_(platform, profile) {
  var config = getPlatformOAuthConfig_(platform);
  profile = profile || {};
  setScriptProp_(config.userIdKey, profile.userId || "");
  setScriptProp_(config.displayNameKey, profile.displayName || profile.username || "");
  if (config.usernameKey && config.usernameKey !== config.displayNameKey) setScriptProp_(config.usernameKey, profile.username || "");
  if (config.pageIdKey) setScriptProp_(config.pageIdKey, profile.pageId || "");
}

function clearPlatformError_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return;
  deleteScriptProps_([config.lastErrorKey]);
}

function savePlatformError_(platform, error) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return;
  var message = sanitizeErrorMessage_(error && error.message || error || "Unknown error");
  setScriptProp_(config.lastErrorKey, message.slice(0, 500));
}

function deletePlatformConnectionProps_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return;
  var keys = [
    config.accessTokenKey,
    config.refreshTokenKey,
    config.tokenExpiresAtKey,
    config.userIdKey,
    config.displayNameKey,
    config.usernameKey,
    config.pageIdKey,
    config.lastErrorKey,
    config.stateKey,
    config.stateExpiresAtKey
  ].filter(Boolean);
  deleteScriptProps_(keys);
}

function getPlatformStatus_(platform) {
  var normalized = detectSourcePlatform_(platform);
  if (!normalized || (!PLATFORM_OAUTH_CONFIG[normalized] && normalized !== "bluesky")) {
    return {
      platform: normalized,
      hasClientId: false,
      hasClientSecret: false,
      hasRedirectUri: false,
      hasAccessToken: false,
      connected: false,
      username: "",
      displayName: "",
      tokenExpiresAt: "",
      missingSetupKeys: [],
      lastError: "Unsupported platform",
      accessStatus: "error",
      tokenStatus: "missing",
      requiredScopes: [],
      requiredSetupKeys: [],
      setupChecklist: [],
      appReviewNotes: "",
      connectionStatusLabel: "Error",
      importSupported: false,
      publishSupported: false
    };
  }
  if (normalized === "bluesky") return buildBlueskyStatus_();
  var config = PLATFORM_OAUTH_CONFIG[normalized];
  var missingSetupKeys = getMissingSetupKeys_(normalized);
  var accessToken = getScriptProp_(config.accessTokenKey);
  var tokenExpiresAt = getScriptProp_(config.tokenExpiresAtKey);
  var expired = !!tokenExpiresAt && isExpiredIso_(tokenExpiresAt);
  var lastError = getScriptProp_(config.lastErrorKey);
  var hasClientId = !!getPlatformClientId_(normalized);
  var hasClientSecret = !!getPlatformClientSecret_(normalized);
  var hasRedirectUri = !!getOAuthRedirectUri_(normalized);
  var connected = !!accessToken && !expired;
  var accessStatus = lastError ? "error" : connected ? "connected" : expired ? "error" : missingSetupKeys.length ? "not_connected" : "ready";
  var refreshSupported = isPlatformRefreshSupported_(normalized);
  var reconnectRequired = !!accessToken && expired && !refreshSupported;
  var publishSupported = false;
  if (connected) {
    if (normalized === "linkedin") publishSupported = config.scopes.indexOf("w_member_social") !== -1;
    if (normalized === "instagram") {
      var instaMode = getInstagramAuthMode_();
      publishSupported = instaMode === "facebook_graph" && getPlatformScopes_(normalized).join(",").indexOf("content_publish") !== -1;
    }
    if (normalized === "threads") publishSupported = config.scopes.indexOf("threads_content_publish") !== -1;
  }
  var publishSupportLabel = connected
    ? (publishSupported ? "Live" : "Connected but missing publish scope")
    : "Requires connection";
  return {
    platform: normalized,
    hasClientId: hasClientId,
    hasClientSecret: hasClientSecret,
    hasRedirectUri: hasRedirectUri,
    hasAccessToken: !!accessToken,
    connected: connected,
    username: config.usernameKey ? getScriptProp_(config.usernameKey) : "",
    displayName: getScriptProp_(config.displayNameKey),
    tokenExpiresAt: tokenExpiresAt,
    missingSetupKeys: missingSetupKeys,
    lastError: lastError,
    accessStatus: accessStatus,
    tokenStatus: !accessToken ? "missing" : expired ? "expired" : "active",
    refreshSupported: refreshSupported,
    reconnectRequired: reconnectRequired,
    requiredScopes: getPlatformScopes_(normalized),
    requiredSetupKeys: getRequiredSetupKeys_(normalized),
    setupChecklist: buildPlatformSetupChecklist_(normalized),
    appReviewNotes: getPlatformAppReviewNotes_(normalized),
    connectionStatusLabel: accessStatus === "connected" ? "Connected" : accessStatus === "ready" ? "Ready to connect" : accessStatus === "error" ? "Error" : "Not connected",
    importSupported: connected,
    publishSupported: publishSupported,
    publishSupportLabel: publishSupportLabel,
    callbackUrl: getOAuthRedirectUri_(normalized),
    apiVersion: config.apiVersionKey ? getPlatformApiVersion_(normalized) : "",
    endpointFamily: getPlatformEndpointFamily_(normalized),
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION
  };
}

function buildPlatformSetupChecklist_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  var notes = [
    "Register the app/client with the platform.",
    "Store app secrets only in Script Properties.",
    "Configure the Apps Script callback URL as the redirect URI.",
    "Start OAuth from StellarSync so code exchange stays server-side."
  ];
  if (platform === "linkedin") notes.push("Past post sync may also require r_member_social or restricted LinkedIn approval.");
  if (platform === "threads") notes.push("Threads scopes are centralized in one backend constant so Meta-compatible scopes can be edited in one place.");
  if (platform === "tiktok") notes.push("TikTok requires a registered app in TikTok Developer Portal with Content Posting API enabled.");
  if (platform === "bluesky") notes.push("Bluesky uses AT Protocol with App Password. No OAuth setup needed.");
  if (platform === "instagram") {
    var mode = getInstagramAuthMode_();
    if (mode === "instagram_login") {
      notes.push("Instagram Login mode: connect and read basic profile via graph.instagram.com.");
      notes.push("Publishing and insights are NOT available in this mode. Use Facebook Graph mode for those.");
    } else {
      notes.push("Facebook Graph mode: requires professional Instagram account connected to a Facebook Page.");
      notes.push("Publishing and insights require app review by Meta before production use.");
    }
  }
  return notes.concat(getRequiredSetupKeys_(platform).map(function(key) { return "Required property: " + key; }));
}

function getPlatformAppReviewNotes_(platform) {
  if (platform === "linkedin") return "Past post sync may also require r_member_social or restricted LinkedIn approval.";
  if (platform === "instagram") {
    var mode = getInstagramAuthMode_();
    if (mode === "instagram_login") {
      return "Instagram Login mode: basic profile connection works without app review. Publishing and insights require Facebook Graph mode with app review.";
    }
    return "Facebook Graph mode: Meta app review is required before production-grade Instagram publish and insights access. Requires a professional Instagram account linked to a Facebook Page.";
  }
  if (platform === "threads") return "Threads permissions depend on the currently supported Meta OAuth scopes and app review status.";
  if (platform === "tiktok") return "TikTok Content Posting API requires TikTok app review before production use.";
  if (platform === "bluesky") return "Bluesky AT Protocol via App Password is for prelaunch/internal use only.";
  return "";
}

function getDeploymentDiagnostics() {
  var spreadsheetAccess = false;
  var spreadsheetError = "";
  var activeDeploymentUrlFromFrontend = getScriptProp_("ACTIVE_DEPLOYMENT_URL_FROM_FRONTEND");
  var publicWebappBaseUrl = getPublicWebAppBaseUrl_();
  var normalizedFrontendUrl = normalizeDeploymentUrl_(activeDeploymentUrlFromFrontend);
  var normalizedPublicBaseUrl = normalizeDeploymentUrl_(publicWebappBaseUrl);
  var deploymentUrlMismatch = !!(normalizedFrontendUrl && normalizedPublicBaseUrl && normalizedFrontendUrl !== normalizedPublicBaseUrl);
  var providerDashboardUrls = {
    publicWebappBaseUrl: publicWebappBaseUrl,
    linkedinRedirectUri: getOAuthRedirectUri_("linkedin"),
    metaInstagramRedirectUri: getOAuthRedirectUri_("instagram"),
    metaThreadsRedirectUri: getOAuthRedirectUri_("threads")
  };
  try {
    spreadsheetAccess = !!getSpreadsheet_();
  } catch (err) {
    spreadsheetError = sanitizeErrorMessage_(err && err.message || err || "Spreadsheet access failed");
  }
  return {
    ok: true,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    deploymentBaseUrlConfigured: !!publicWebappBaseUrl,
    activeDeploymentUrlFromFrontend: activeDeploymentUrlFromFrontend,
    publicWebappBaseUrl: publicWebappBaseUrl,
    normalizedActiveDeploymentUrlFromFrontend: normalizedFrontendUrl,
    normalizedPublicWebappBaseUrl: normalizedPublicBaseUrl,
    deploymentUrlMismatch: deploymentUrlMismatch,
    deploymentMismatchMessage: deploymentUrlMismatch ? "Deployment URL mismatch. Update APP_SCRIPT_URL or PUBLIC_WEBAPP_BASE_URL." : "",
    providerDashboardUrls: providerDashboardUrls,
    providerDashboardNote: "Provider dashboards must be updated when the deployment URL changes. StellarSync cannot update LinkedIn/Meta dashboard allowlists automatically.",
    appDomainsNeeded: ["script.google.com", "script.googleusercontent.com"],
    oauthRouteHealth: buildOAuthRouteHealth_(activeDeploymentUrlFromFrontend),
    linkedinDerivedRedirectUri: getOAuthRedirectUri_("linkedin"),
    linkedinEncodedRedirectUri: encodeURIComponent(getOAuthRedirectUri_("linkedin") || ""),
    instagramRedirectUri: getOAuthRedirectUri_("instagram"),
    threadsRedirectUri: getOAuthRedirectUri_("threads"),
    linkedinRequiredSetupKeys: getRequiredSetupKeys_("linkedin"),
    linkedInAuthUrlPreview: redactLinkedInAuthUrlPreview_(buildLinkedInAuthUrl_("[diagnostic-state]")),
    legacyRedirectPropertiesPresent: getLegacyRedirectPropertyPresence_(),
    legacyRedirectPropertiesReferencedByRuntime: getLegacyRedirectRuntimeReferences_(),
    hasExternalRequestScope: "Manifest or deployment should include https://www.googleapis.com/auth/script.external_request.",
    hasSpreadsheetAccess: spreadsheetAccess,
    spreadsheetIdConfigured: !!getScriptProp_("SPREADSHEET_ID"),
    spreadsheetAccessError: spreadsheetError,
    connectedAccountSetupStatus: getConnectedAccountsStatus().accounts,
    availableActions: [
      "getConnectedAccountsStatus",
      "startLinkedInAuth",
      "startInstagramAuth",
      "startThreadsAuth",
      "linkedinCallback",
      "instagramCallback",
      "threadsCallback",
      "metaCallback",
      "testPlatformConnection",
      "testLinkedInHistoricalAccess",
      "getLinkedInHistoricalAccessDiagnostics",
      "importLinkedInPosts",
      "importCapturedPosts",
      "importLinkedInCapturedPosts",
      "testImportCapturedPostsRoute",
      "getImportJobs",
      "getImportJobStatus",
      "createImportJob",
      "runImportJobBatch",
      "cancelImportJob",
      "retryImportJobFailures",
      "cleanupImportedLinkedInPosts",
      "mergeCampaignIntoCampaign",
      "deleteCampaignAndUnassignPosts",
      "disconnectPlatform",
      "savePost",
      "generateAIDraft"
    ],
    writePostRouteStatus: {
      savePostActionAvailable: true,
      postsSheetReachable: !!findExistingSheet_("posts"),
      requiredHeadersPresent: validateRequiredHeaders_("posts", REQUIRED_POST_HEADERS),
      spreadsheetIdConfigured: !!getScriptProp_("SPREADSHEET_ID")
    }
  };
}

function getPlatformEndpointFamily_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) return "";
  if (platform === "tiktok") return "tiktok-oauth";
  return platform === "linkedin"
    ? "linkedin-oauth"
    : "meta-" + (config.apiVersionKey ? getPlatformApiVersion_(platform) || "unconfigured" : "unversioned");
}

function isPlatformRefreshSupported_(platform, tokenData) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config || config.refreshSupported !== true) return false;
  if (platform === "linkedin") return !!(tokenData && tokenData.refresh_token || getScriptProp_(config.refreshTokenKey));
  return !!(tokenData && tokenData.access_token || getScriptProp_(config.accessTokenKey));
}

function maybeUpgradeTokenLifetime_(platform, tokenData) {
  if (!tokenData || !tokenData.access_token) return tokenData;
  var config = getPlatformOAuthConfig_(platform);
  if (!config || !config.supportsLongLivedExchange) return tokenData;
  try {
    return exchangeForLongLivedToken_(platform, tokenData);
  } catch (err) {
    savePlatformError_(platform, err);
    return tokenData;
  }
}

function exchangeForLongLivedToken_(platform, tokenData) {
  var config = getPlatformOAuthConfig_(platform);
  var accessToken = String(tokenData && tokenData.access_token || "").trim();
  if (!config || !accessToken) return tokenData;
  var version = getPlatformApiVersion_(platform);
  var graphBase = platform === "instagram" ? getInstagramGraphBase_() : config.graphUrlBase;
  var endpoint = graphBase + "/" + version + config.longLivedExchangePath + "?" + toQueryString_({
    grant_type: config.longLivedExchangeGrantType,
    client_secret: getPlatformClientSecret_(platform),
    access_token: accessToken
  });
  var upgraded = fetchJson_(endpoint, {
    method: "get",
    metaLabel: config.label + " long-lived token exchange [" + version + "]"
  }) || {};
  if (upgraded.access_token) return upgraded;
  return tokenData;
}

function refreshPlatformToken_(platform) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config) throw new Error("Unsupported platform");
  if (!config.refreshSupported) throw new Error(config.label + " refresh is not supported by this scaffold.");

  if (platform === "linkedin") {
    var refreshToken = getScriptProp_(config.refreshTokenKey);
    if (!refreshToken) throw new Error("LinkedIn refresh token is unavailable. Reconnect the account.");
    var linkedinRefresh = fetchJson_(config.tokenUrl, {
      method: "post",
      payload: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: getPlatformClientId_(platform),
        client_secret: getPlatformClientSecret_(platform)
      },
      metaLabel: config.label + " token refresh"
    }) || {};
    persistRefreshedToken_(platform, linkedinRefresh);
    return linkedinRefresh;
  }

  var accessToken = getScriptProp_(config.accessTokenKey);
  if (!accessToken) throw new Error(config.label + " access token is unavailable. Reconnect the account.");
  var version = getPlatformApiVersion_(platform);
  var graphBase = platform === "instagram" ? getInstagramGraphBase_() : config.graphUrlBase;
  var endpoint = graphBase + "/" + version + config.refreshPath + "?" + toQueryString_({
    grant_type: config.refreshGrantType,
    access_token: accessToken
  });
  var refreshed = fetchJson_(endpoint, {
    method: "get",
    metaLabel: config.label + " token refresh [" + version + "]"
  }) || {};
  if (!refreshed.access_token) refreshed.access_token = accessToken;
  persistRefreshedToken_(platform, refreshed);
  return refreshed;
}

function persistRefreshedToken_(platform, tokenData) {
  var config = getPlatformOAuthConfig_(platform);
  if (!config || !tokenData) return;
  if (tokenData.access_token) setScriptProp_(config.accessTokenKey, tokenData.access_token);
  if (config.refreshTokenKey && tokenData.refresh_token) setScriptProp_(config.refreshTokenKey, tokenData.refresh_token);
  if (config.tokenExpiresAtKey) setScriptProp_(config.tokenExpiresAtKey, computeExpiryIso_(tokenData.expires_in));
}

function tryAutoRefreshIfNeeded_(platform) {
  var status = getPlatformStatus_(platform);
  if (!status.hasAccessToken || status.connected || !status.refreshSupported) return status;
  try {
    refreshPlatformToken_(platform);
    clearPlatformError_(platform);
  } catch (err) {
    savePlatformError_(platform, err);
  }
  return getPlatformStatus_(platform);
}

function buildOAuthCallbackError_(platform, params) {
  var config = getPlatformOAuthConfig_(platform);
  var errorCode = String(params && (params.error_code || params.errorCode) || "").trim();
  var errorReason = String(params && (params.error_reason || params.errorReason || params.error) || "").trim();
  var errorDescription = String(params && (params.error_description || params.errorDescription || "") || "").trim();
  var errorMsg = params && (params.error_message || "") || "";

  var reason;
  if (platform === "threads" && errorCode === "1349168") {
    reason = "threads_redirect_uri_not_whitelisted: Add this exact Threads redirect URI to Meta Client OAuth Settings. Redirect URI: " + getOAuthRedirectUri_("threads");
  } else if (errorCode) {
    reason = "error_code " + errorCode + ": " + (errorDescription || errorMsg || errorReason || "OAuth denied");
  } else {
    reason = errorDescription || errorMsg || errorReason || "Authorization failed";
  }

  if (platform === "instagram") {
    reason = "Instagram OAuth error | error=" + (params && params.error || "") + " | error_code=" + errorCode + " | error_reason=" + errorReason + " | error_description=" + errorDescription + " | error_message=" + errorMsg;
  }

  var detail = config && config.apiVersionKey ? " [" + getPlatformApiVersion_(platform) + "]" : "";
  return new Error((config ? config.label : "OAuth") + " callback error" + detail + ": " + reason);
}

function buildSafeErrorDetails_(platform, err) {
  var config = getPlatformOAuthConfig_(platform);
  return {
    platform: platform,
    label: config ? config.label : platform,
    callbackUrl: getOAuthRedirectUri_(platform),
    endpointFamily: getPlatformEndpointFamily_(platform),
    apiVersion: config && config.apiVersionKey ? getPlatformApiVersion_(platform) : "",
    refreshSupported: isPlatformRefreshSupported_(platform),
    message: sanitizeErrorMessage_(err && err.message || err || "Unknown error")
  };
}

function sanitizeErrorMessage_(message) {
  var text = String(message || "Unknown error").trim();
  return text
    .replace(/(access_token|refresh_token|client_secret|app_secret)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._\-~+/]+=*/gi, "Bearer [redacted]")
    .replace(/"?(access_token|refresh_token|client_secret|app_secret)"?\s*:\s*"[^"]*"/gi, "\"$1\":\"[redacted]\"")
    .slice(0, 500);
}

function testPlatformConnection(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (!platform) return getConnectedAccountsStatus();
  tryAutoRefreshIfNeeded_(platform);
  var status = getPlatformStatus_(platform);
  if (!status.hasAccessToken) {
    return { ok: true, account: status, message: PLATFORM_OAUTH_CONFIG[platform].label + " has no stored access token." };
  }
  try {
    var profile = fetchPlatformProfile_(platform, getScriptProp_(PLATFORM_OAUTH_CONFIG[platform].accessTokenKey));
    if (profile && (profile.userId || profile.username || profile.displayName || profile.pageId)) savePlatformProfile_(platform, profile);
    clearPlatformError_(platform);
    return { ok: true, account: getPlatformStatus_(platform), profile: redactProfile_(profile) };
  } catch (err) {
    savePlatformError_(platform, err);
    return { ok: true, connectionOk: false, error: err.message || String(err), account: getPlatformStatus_(platform) };
  }
}

// ===== BLUESKY (AT Protocol / App Password) =====

function getBlueskyConfig_() {
  var handle = getScriptProp_("BLUESKY_HANDLE");
  var accessJwt = getScriptProp_("BLUESKY_ACCESS_JWT");
  var refreshJwt = getScriptProp_("BLUESKY_REFRESH_JWT");
  var did = getScriptProp_("BLUESKY_DID");
  var serviceUrl = getScriptProp_("BLUESKY_SERVICE_URL") || BLUESKY_DEFAULT_SERVICE;
  var lastError = getScriptProp_("BLUESKY_LAST_ERROR");
  return {
    handle: handle,
    accessJwt: accessJwt,
    refreshJwt: refreshJwt,
    did: did,
    serviceUrl: serviceUrl,
    lastError: lastError,
    connected: !!accessJwt && !!handle
  };
}

function saveBlueskyConfig_(handle, accessJwt, refreshJwt, did, serviceUrl) {
  setScriptProp_("BLUESKY_HANDLE", handle || "");
  setScriptProp_("BLUESKY_ACCESS_JWT", accessJwt || "");
  setScriptProp_("BLUESKY_REFRESH_JWT", refreshJwt || "");
  setScriptProp_("BLUESKY_DID", did || "");
  if (serviceUrl) setScriptProp_("BLUESKY_SERVICE_URL", serviceUrl);
  clearBlueskyError_();
}

function clearBlueskyError_() {
  deleteScriptProps_(["BLUESKY_LAST_ERROR"]);
}

function saveBlueskyError_(error) {
  var message = sanitizeErrorMessage_(error && error.message || error || "Unknown Bluesky error");
  setScriptProp_("BLUESKY_LAST_ERROR", message.slice(0, 500));
}

function deleteBlueskyConnectionProps_() {
  deleteScriptProps_(["BLUESKY_HANDLE", "BLUESKY_ACCESS_JWT", "BLUESKY_REFRESH_JWT", "BLUESKY_DID", "BLUESKY_SERVICE_URL", "BLUESKY_LAST_ERROR"]);
}

function buildBlueskyStatus_() {
  var cfg = getBlueskyConfig_();
  var connected = cfg.connected;
  return {
    platform: "bluesky",
    hasClientId: true,
    hasClientSecret: true,
    hasRedirectUri: true,
    hasAccessToken: connected,
    connected: connected,
    username: cfg.handle,
    displayName: cfg.handle,
    tokenExpiresAt: "",
    missingSetupKeys: [],
    lastError: cfg.lastError || "",
    accessStatus: cfg.lastError ? "error" : connected ? "connected" : "not_connected",
    tokenStatus: connected ? "active" : "missing",
    refreshSupported: true,
    reconnectRequired: false,
    requiredScopes: [],
    requiredSetupKeys: [],
    setupChecklist: ["Set up Bluesky App Password in Settings > App Passwords (bsky.app) or your PDS.", "Enter your handle (e.g. user.bsky.social) and the generated App Password.", "StellarSync stores only JWTs, never the password."],
    appReviewNotes: "Bluesky AT Protocol: App Password flow for prelaunch helper. No OAuth required.",
    connectionStatusLabel: connected ? "Connected" : cfg.lastError ? "Error" : "Not connected",
    importSupported: connected,
    publishSupported: connected,
    publishSupportLabel: connected ? "Live" : "Requires connection",
    callbackUrl: "",
    apiVersion: "",
    endpointFamily: "bluesky-atproto",
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION
  };
}

function startBlueskyAuth() {
  return {
    ok: true,
    platform: "bluesky",
    authUrl: "",
    mode: "app_password",
    requiredScopes: ["atproto"],
    setupChecklist: ["Create an App Password at bsky.app/settings/app-passwords", "Enter your handle and the App Password in StellarSync"],
    appReviewNotes: "Bluesky AT Protocol via App Password. No OAuth redirect needed.",
    missingSetupKeys: [],
    serviceUrl: getScriptProp_("BLUESKY_SERVICE_URL") || BLUESKY_DEFAULT_SERVICE,
    status: "app_password_required"
  };
}

function blueskyConnect(payload) {
  if (!payload) throw new Error("Missing payload");
  var handle = String(payload.handle || "").trim().toLowerCase();
  var password = String(payload.password || "").trim();
  var serviceUrl = String(payload.serviceUrl || BLUESKY_DEFAULT_SERVICE).trim().replace(/\/+$/, "");

  if (!handle) throw new Error("Missing Bluesky handle");
  if (!password) throw new Error("Missing Bluesky App Password");

  try {
    var sessionResponse = fetchJson_(serviceUrl + "/xrpc/com.atproto.server.createSession", {
      method: "post",
      metaLabel: "Bluesky createSession",
      contentType: "application/json",
      payload: JSON.stringify({
        identifier: handle,
        password: password
      })
    });

    if (!sessionResponse || !sessionResponse.accessJwt) {
      throw new Error("Bluesky authentication failed. Check handle and App Password.");
    }

    var accessJwt = String(sessionResponse.accessJwt || "").trim();
    var refreshJwt = String(sessionResponse.refreshJwt || "").trim();
    var did = String(sessionResponse.did || "").trim();
    var sessionHandle = String(sessionResponse.handle || handle).trim();

    saveBlueskyConfig_(sessionHandle, accessJwt, refreshJwt, did, serviceUrl);

    return {
      ok: true,
      platform: "bluesky",
      connected: true,
      status: buildBlueskyStatus_(),
      diagnostics: ["Session created at " + serviceUrl, "DID: " + did, "Handle: " + sessionHandle]
    };
  } catch (err) {
    saveBlueskyError_(err);
    throw err;
  }
}

function testBlueskyConnection() {
  var cfg = getBlueskyConfig_();
  if (!cfg.accessJwt || !cfg.handle) {
    return { ok: true, connected: false, status: buildBlueskyStatus_(), diagnostics: ["No stored Bluesky session. Connect first."] };
  }
  try {
    var profile = fetchJson_(cfg.serviceUrl + "/xrpc/app.bsky.actor.getProfile?actor=" + encodeURIComponent(cfg.handle), {
      method: "get",
      metaLabel: "Bluesky getProfile",
      headers: { Authorization: "Bearer " + cfg.accessJwt }
    });
    if (profile && profile.did) {
      clearBlueskyError_();
      return { ok: true, connected: true, profile: { did: profile.did, handle: profile.handle, displayName: profile.displayName || "" }, status: buildBlueskyStatus_(), diagnostics: ["Profile fetch succeeded for @" + cfg.handle] };
    }
    throw new Error("Profile fetch returned no DID");
  } catch (err) {
    saveBlueskyError_(err);
    return { ok: true, connected: false, status: buildBlueskyStatus_(), diagnostics: ["Connection test failed: " + sanitizeErrorMessage_(err && err.message || err)] };
  }
}

function disconnectBluesky() {
  deleteBlueskyConnectionProps_();
  return { ok: true, platform: "bluesky", disconnected: true, status: buildBlueskyStatus_() };
}

function blueskySyncRecentPosts(payload) {
  var cfg = getBlueskyConfig_();
  if (!cfg.accessJwt) throw new Error("Bluesky not connected.");
  var limit = Math.min(Number(payload && payload.limit || 10) || 10, 100);

  try {
    var feed = fetchJson_(cfg.serviceUrl + "/xrpc/app.bsky.feed.getAuthorFeed?actor=" + encodeURIComponent(cfg.handle) + "&limit=" + limit, {
      method: "get",
      metaLabel: "Bluesky getAuthorFeed",
      headers: { Authorization: "Bearer " + cfg.accessJwt }
    });
    var posts = (feed && feed.feed) || [];
    var results = posts.map(function(item) {
      var post = item && item.post || {};
      var record = post.record || {};
      return {
        uri: String(post.uri || "").trim(),
        cid: String(post.cid || "").trim(),
        text: String(record.text || "").trim(),
        createdAt: String(record.createdAt || "").trim(),
        replyCount: Number(post.replyCount || 0),
        repostCount: Number(post.repostCount || 0),
        likeCount: Number(post.likeCount || 0)
      };
    });
    clearBlueskyError_();
    return { ok: true, platform: "bluesky", posts: results, count: results.length };
  } catch (err) {
    saveBlueskyError_(err);
    throw err;
  }
}

function prepareBlueskyPayload(payload) {
  if (!payload) throw new Error("Missing payload");
  var text = String(payload.text || "").trim();
  var postUrl = String(payload.url || "").trim();
  var postImage = String(payload.image || "").trim();

  if (!text && !postUrl && !postImage) {
    return { ok: true, payload: null, status: "empty", diagnostics: ["No content to prepare."] };
  }

  var fullText = text;
  if (postUrl) {
    fullText = fullText ? fullText + "\n" + postUrl : postUrl;
  }

  var exceedsLimit = fullText.length > BLUESKY_POST_MAX_CHARS;
  var record = {
    $type: "app.bsky.feed.post",
    text: exceedsLimit ? fullText.slice(0, BLUESKY_POST_MAX_CHARS) : fullText,
    createdAt: new Date().toISOString()
  };

  if (postImage) {
    record.embed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: postUrl || postImage,
        title: payload.title || "",
        description: text.slice(0, 200)
      }
    };
  }

  return {
    ok: true,
    platform: "bluesky",
    payload: record,
    textLength: fullText.length,
    maxLength: BLUESKY_POST_MAX_CHARS,
    exceedsLimit: exceedsLimit,
    status: exceedsLimit ? "truncated" : "ready",
    diagnostics: [
      "Text: " + text.length + " chars" + (postUrl ? " + URL" : ""),
      exceedsLimit ? "Text exceeds " + BLUESKY_POST_MAX_CHARS + " char limit. Truncated." : "Within limit.",
      postImage ? "Image/link attachment included (experimental)." : "No attachment."
    ]
  };
}

function getBlueskyDiagnostics_() {
  var cfg = getBlueskyConfig_();
  return {
    serviceUrl: cfg.serviceUrl,
    handle: cfg.handle,
    did: cfg.did,
    tokenPresent: !!cfg.accessJwt,
    lastError: cfg.lastError || ""
  };
}

// ===== TIKTOK =====

function startTikTokAuth() {
  var clientKey = getScriptProp_("TIKTOK_CLIENT_KEY");
  var clientSecret = getScriptProp_("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) {
    return {
      ok: false,
      platform: "tiktok",
      authUrl: "",
      error: "Missing TikTok Client Key or Client Secret.",
      missingSetupKeys: getMissingSetupKeys_("tiktok"),
      requiredScopes: TIKTOK_OAUTH_SCOPES,
      setupChecklist: ["Register a TikTok App in TikTok Developer Portal.", "Store TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Script Properties.", "Add redirect URI to TikTok App settings: " + getOAuthRedirectUri_("tiktok")],
      appReviewNotes: "TikTok Content Posting API requires app review approval before production publishing.",
      status: "missing_setup"
    };
  }
  var state = buildOAuthState_("tiktok");
  var redirectUri = getOAuthRedirectUri_("tiktok");
  var authUrl = "https://www.tiktok.com/v2/auth/authorize?" + toQueryString_({
    client_key: clientKey,
    scope: TIKTOK_OAUTH_SCOPES.join(","),
    response_type: "code",
    redirect_uri: redirectUri,
    state: state
  });
  return {
    ok: true,
    platform: "tiktok",
    authUrl: authUrl,
    requiredScopes: TIKTOK_OAUTH_SCOPES,
    setupChecklist: ["Redirect URI must be exactly: " + redirectUri, "Scopes: " + TIKTOK_OAUTH_SCOPES.join(", ")],
    appReviewNotes: "TikTok Content Posting API requires TikTok app review before publishing is enabled.",
    missingSetupKeys: [],
    status: "ready",
    diagnostics: {
      redirectUri: redirectUri,
      scopes: TIKTOK_OAUTH_SCOPES,
      clientKeyConfigured: !!clientKey,
      clientSecretConfigured: !!clientSecret
    }
  };
}

function tiktokCallback(e) {
  setScriptProp_("LAST_OAUTH_CALLBACK_ACTION", "tiktokCallback");
  try {
    return handleOAuthCallback_("tiktok", e);
  } catch (err) {
    return HtmlService.createHtmlOutput(buildOAuthCallbackHtml_("TikTok connection error", sanitizeErrorMessage_(err && err.message || "OAuth failed"), "#f87171", buildSafeErrorDetails_("tiktok", err), [
      "Return to StellarSync and review the Connected Accounts card.",
      "Confirm redirect URI and TikTok app settings."
    ])).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function testTikTokConnection() {
  var status = getPlatformStatus_("tiktok");
  if (!status.hasAccessToken) {
    return { ok: true, connected: false, status: status, diagnostics: ["No stored TikTok access token."] };
  }
  try {
    var token = getScriptProp_(PLATFORM_OAUTH_CONFIG.tiktok.accessTokenKey);
    var userInfo = fetchJson_("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url&access_token=" + encodeURIComponent(token), {
      method: "get",
      metaLabel: "TikTok user info",
      headers: { "Content-Type": "application/json" }
    });
    if (userInfo && userInfo.data) {
      clearPlatformError_("tiktok");
      return { ok: true, connected: true, profile: userInfo.data, status: getPlatformStatus_("tiktok"), diagnostics: ["User info fetched. Open ID: " + (userInfo.data.open_id || "")] };
    }
    throw new Error("Invalid TikTok user info response");
  } catch (err) {
    savePlatformError_("tiktok", err);
    return { ok: true, connected: false, status: getPlatformStatus_("tiktok"), diagnostics: ["Connection test failed: " + sanitizeErrorMessage_(err && err.message || err)] };
  }
}

function getTikTokDiagnostics_() {
  var config = PLATFORM_OAUTH_CONFIG.tiktok;
  return {
    redirectUri: getOAuthRedirectUri_("tiktok"),
    scopes: TIKTOK_OAUTH_SCOPES,
    clientKeyConfigured: !!getPlatformClientId_("tiktok"),
    clientSecretConfigured: !!getPlatformClientSecret_("tiktok"),
    tokenPresent: !!getScriptProp_(config.accessTokenKey),
    lastError: getScriptProp_(config.lastErrorKey)
  };
}

function testLinkedInHistoricalAccess(payload) {
  tryAutoRefreshIfNeeded_("linkedin");
  var status = getPlatformStatus_("linkedin");
  var token = getScriptProp_(PLATFORM_OAUTH_CONFIG.linkedin.accessTokenKey);
  var apiVersionCandidates = getLinkedInApiVersionCandidates_(payload);
  if (!token) {
    return {
      ok: true,
      codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
      platform: "linkedin",
      apiVersion: apiVersionCandidates.join(", "),
      classification: "not_connected",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      account: status,
      attempted: [],
      message: "LinkedIn is not connected."
    };
  }

  var personId = getScriptProp_(PLATFORM_OAUTH_CONFIG.linkedin.userIdKey);
  if (!personId) {
    try {
      var profile = fetchPlatformProfile_("linkedin", token);
      if (profile && (profile.userId || profile.displayName || profile.username)) {
        savePlatformProfile_("linkedin", profile);
        personId = profile.userId || "";
      }
    } catch (profileErr) {
      return {
        ok: true,
        codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
        platform: "linkedin",
        apiVersion: apiVersionCandidates.join(", "),
        classification: "token_valid_but_no_history_access",
        postsReturned: false,
        permissionDenied: false,
        approvalRequired: false,
        endpointDeprecated: false,
        account: getPlatformStatus_("linkedin"),
        attempted: [],
        message: "LinkedIn token exists, but the member identifier could not be refreshed for historical post lookup.",
        profileError: sanitizeErrorMessage_(profileErr && profileErr.message || profileErr || "Profile lookup failed")
      };
    }
  }

  var personUrn = toLinkedInPersonUrn_(personId);
  if (!personUrn) {
    return {
      ok: true,
      codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
      platform: "linkedin",
      apiVersion: apiVersionCandidates.join(", "),
      classification: "token_valid_but_no_history_access",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      account: getPlatformStatus_("linkedin"),
      attempted: [],
      message: "LinkedIn token exists, but no member URN is available for authored-post lookup."
    };
  }

  var attempts = [];
  for (var i = 0; i < apiVersionCandidates.length; i += 1) {
    var apiVersion = apiVersionCandidates[i];
    var authorAttempt = runLinkedInHistoricalEndpointAttempt_("member_posts_author", personUrn, token, payload, apiVersion);
    attempts.push(authorAttempt);
    if (authorAttempt.responseStatus !== 426) break;
    var readerAttempt = runLinkedInHistoricalEndpointAttempt_("member_posts_author_reader", personUrn, token, Object.assign({}, payload || {}, { viewContext: "READER" }), apiVersion);
    attempts.push(readerAttempt);
    if (readerAttempt.responseStatus !== 426) break;
  }

  var result = classifyLinkedInHistoricalAccess_(attempts);
  var successfulAttempt = attempts.filter(function(item) { return item && item.responseStatus !== 426; })[0] || null;
  return {
    ok: true,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    platform: "linkedin",
    personUrn: personUrn,
    apiVersion: successfulAttempt && successfulAttempt.apiVersion || apiVersionCandidates.join(", "),
    attemptedApiVersions: apiVersionCandidates,
    account: getPlatformStatus_("linkedin"),
    classification: result.classification,
    postsReturned: result.postsReturned,
    permissionDenied: result.permissionDenied,
    approvalRequired: result.approvalRequired,
    endpointDeprecated: result.endpointDeprecated,
    attempted: attempts,
    recommendedAction: result.recommendedAction,
    message: result.message
  };
}

function importLinkedInPosts(payload) {
  var diagnostics = testLinkedInHistoricalAccess(payload || {});
  if (!diagnostics.postsReturned) {
    return {
      ok: true,
      codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
      platform: "linkedin",
      enabled: false,
      diagnostics: diagnostics,
      items: [],
      message: "Historical LinkedIn access is not available yet, so import remains disabled."
    };
  }
  var firstSuccessful = (diagnostics.attempted || []).filter(function(item) {
    return !!(item && item.postsReturned && Array.isArray(item.elements) && item.elements.length);
  })[0];
  var elements = firstSuccessful && firstSuccessful.elements || [];
  return {
    ok: true,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    platform: "linkedin",
    enabled: true,
    limit: Number(payload && payload.limit || 10) || 10,
    cursor: String(payload && payload.cursor || "").trim(),
    items: elements.map(normalizeLinkedInHistoricalPost_),
    paging: firstSuccessful && firstSuccessful.paging || {},
    diagnostics: diagnostics,
    message: "Diagnostics-first scaffold only. LinkedIn posts were normalized into StellarSync schema previews but were not written to the sheet."
  };
}

function importCapturedPosts(payload) {
  payload = payload || {};
  if (normalizeBoolean_(payload.dryRun)) {
    return {
      ok: true,
      dryRun: true,
      action: "importCapturedPosts",
      backendVersion: APP_BACKEND_VERSION,
      codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
      importedCount: 0,
      skippedDuplicates: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
      report: {
        detectedCount: 0,
        selectedCount: 0,
        importedCount: 0,
        skippedDuplicates: 0,
        updatedCount: 0,
        failedCount: 0,
        errors: []
      }
    };
  }
  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("Missing captured import items.");
  var overwriteDuplicates = normalizeBoolean_(payload.overwriteDuplicates);
  var existingPosts = getPosts();
  var importedCount = 0;
  var skippedDuplicates = 0;
  var updatedCount = 0;
  var errors = [];
  var savedPosts = [];
  var importedPostIds = [];
  var dateParseStats = { exact: 0, relative: 0, label_only: 0, missing: 0 };
  var repostStats = { original: 0, repost: 0, reshare: 0, url_only: 0 };

  items.forEach(function(item, index) {
    try {
      var normalized = normalizeCapturedImportItem_(item, payload);
      if (dateParseStats[normalized.dateConfidence] == null) dateParseStats[normalized.dateConfidence] = 0;
      dateParseStats[normalized.dateConfidence] += 1;
      var repostKey = normalized.sourceType === "linkedin_url_only"
        ? "url_only"
        : normalized.postType === "repost"
        ? "repost"
        : normalized.postType === "reshare"
        ? "reshare"
        : "original";
      if (repostStats[repostKey] == null) repostStats[repostKey] = 0;
      repostStats[repostKey] += 1;
      var duplicate = findCapturedImportDuplicate_(normalized, existingPosts);
      if (duplicate && !overwriteDuplicates) {
        skippedDuplicates += 1;
        return;
      }
      var savePayload = Object.assign({}, normalized, duplicate && overwriteDuplicates ? { postId: duplicate.postId } : {});
      savePayload.sourceImportJobId = String(payload && payload.importJobId || "").trim();
      savePayload.createdFromFlow = "linkedin_import";
      var saved = savePost(savePayload);
      savedPosts.push(saved);
      importedPostIds.push(String(saved.postId || saved.post_id || "").trim());
      if (duplicate && overwriteDuplicates) updatedCount += 1;
      else importedCount += 1;
      existingPosts = existingPosts.filter(function(post) { return post.postId !== saved.postId; }).concat(saved);
    } catch (err) {
      errors.push({
        index: index,
        title: String(item && item.title || "").trim(),
        sourceUrl: String(item && (item.sourceUrl || item.source_url) || "").trim(),
        message: sanitizeErrorMessage_(err && err.message || err || "Import failed")
      });
    }
  });

  return {
    ok: true,
    action: "importCapturedPosts",
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    backendVersion: APP_BACKEND_VERSION,
    importedCount: importedCount,
    skippedDuplicates: skippedDuplicates,
    updatedCount: updatedCount,
    failedCount: errors.length,
    errors: errors,
    posts: savedPosts,
    firstImportedPostIds: importedPostIds.slice(0, 10),
    importedPostIds: importedPostIds,
    report: {
      detectedCount: items.length,
      selectedCount: items.length,
      importedCount: importedCount,
      skippedDuplicates: skippedDuplicates,
      updatedCount: updatedCount,
      failedCount: errors.length,
      errors: errors,
      firstImportedPostIds: importedPostIds.slice(0, 10),
      importedPostIds: importedPostIds,
      dateParseStats: dateParseStats,
      repostStats: repostStats
    },
    previewInfo: {
      itemsReceived: items.length,
      itemsSaved: savedPosts.length
    }
  };
}

function testImportCapturedPostsRoute() {
  return {
    ok: true,
    action: "testImportCapturedPostsRoute",
    importCapturedPostsRegistered: true,
    importLinkedInCapturedPostsRegistered: true,
    backendVersion: STELLARSYNC_BACKEND_VERSION,
    expectedPostActions: LINKEDIN_CAPTURE_IMPORT_ACTIONS.slice()
  };
}

function testRewriteImportedLinkedInRowsRoute() {
  return {
    ok: true,
    action: "testRewriteImportedLinkedInRowsRoute",
    rewriteImportedLinkedInRowsRegistered: true,
    cleanupImportedLinkedInPostsRegistered: true,
    backendVersion: APP_BACKEND_VERSION,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION
  };
}

function importJobRowToObject_(row) {
  return {
    jobId: String(row.job_id || "").trim(),
    type: String(row.type || "").trim(),
    status: String(row.status || "queued").trim() || "queued",
    totalCount: normalizeNumber_(row.total_count),
    processedCount: normalizeNumber_(row.processed_count),
    importedCount: normalizeNumber_(row.imported_count),
    skippedDuplicates: normalizeNumber_(row.skipped_duplicates),
    updatedCount: normalizeNumber_(row.updated_count),
    failedCount: normalizeNumber_(row.failed_count),
    verifiedInLedgerCount: normalizeNumber_(row.verified_in_ledger_count),
    overwriteDuplicates: normalizeBoolean_(row.overwrite_duplicates),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim(),
    lastError: String(row.last_error || "").trim(),
    report: parseJsonSafe_(String(row.report_json || "").trim()) || {}
  };
}

function importJobItemRowToObject_(row) {
  return {
    jobItemId: String(row.job_item_id || "").trim(),
    jobId: String(row.job_id || "").trim(),
    itemIndex: normalizeNumber_(row.item_index),
    status: String(row.status || "pending").trim() || "pending",
    title: String(row.title || "").trim(),
    sourceUrl: String(row.source_url || "").trim(),
    linkedinPostId: String(row.linkedin_post_id || "").trim(),
    normalizedTextHash: String(row.normalized_text_hash || "").trim(),
    postId: String(row.post_id || "").trim(),
    attemptCount: normalizeNumber_(row.attempt_count),
    errorMessage: String(row.error_message || "").trim(),
    rawJson: String(row.raw_json || "").trim(),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim()
  };
}

function getImportJobRows_(jobId) {
  var sheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  var rows = getObjectsFromSheet_(sheet);
  if (!jobId) return rows;
  return rows.filter(function(row) {
    return String(row.job_id || "").trim() === String(jobId || "").trim();
  });
}

function getImportJobItemRows_(jobId) {
  var sheet = ensureSheet_("importJobItems", IMPORT_JOB_ITEM_HEADERS);
  var rows = getObjectsFromSheet_(sheet);
  if (!jobId) return rows;
  return rows.filter(function(row) {
    return String(row.job_id || "").trim() === String(jobId || "").trim();
  });
}

function recomputeImportJobFromItems_(jobRow, itemRows) {
  var stats = {
    totalCount: itemRows.length,
    processedCount: 0,
    importedCount: 0,
    skippedDuplicates: 0,
    updatedCount: 0,
    failedCount: 0
  };
  itemRows.forEach(function(row) {
    var status = String(row.status || "pending").trim();
    if (["imported", "updated", "skipped_duplicate", "failed"].indexOf(status) !== -1) stats.processedCount += 1;
    if (status === "imported") stats.importedCount += 1;
    if (status === "updated") stats.updatedCount += 1;
    if (status === "skipped_duplicate") stats.skippedDuplicates += 1;
    if (status === "failed") stats.failedCount += 1;
  });
  var importedPosts = getPosts().filter(function(post) {
    return String(post.importJobId || "").trim() === String(jobRow.job_id || "").trim();
  });
  var nextStatus = String(jobRow.status || "queued").trim() || "queued";
  var pendingCount = itemRows.filter(function(row) { return String(row.status || "pending").trim() === "pending"; }).length;
  if (nextStatus !== "cancelled" && nextStatus !== "paused") {
    if (!pendingCount && stats.failedCount > 0) nextStatus = "failed";
    else if (!pendingCount) nextStatus = "completed";
    else if (stats.processedCount > 0) nextStatus = "running";
  }
  jobRow.total_count = stats.totalCount;
  jobRow.processed_count = stats.processedCount;
  jobRow.imported_count = stats.importedCount;
  jobRow.skipped_duplicates = stats.skippedDuplicates;
  jobRow.updated_count = stats.updatedCount;
  jobRow.failed_count = stats.failedCount;
  jobRow.verified_in_ledger_count = importedPosts.length;
  jobRow.status = nextStatus;
  jobRow.updated_at = new Date().toISOString();
  jobRow.report_json = JSON.stringify({
    importedPostIds: importedPosts.map(function(post) { return post.postId; }).filter(Boolean),
    verifiedInLedgerCount: importedPosts.length
  });
  return jobRow;
}

function saveImportJobRow_(row) {
  var sheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  upsertObjectRowByAliases_(sheet, ["job_id"], row);
  return row;
}

function saveImportJobItemRow_(row) {
  var sheet = ensureSheet_("importJobItems", IMPORT_JOB_ITEM_HEADERS);
  upsertObjectRowByAliases_(sheet, ["job_item_id"], row);
  return row;
}

function getImportJobs(payload) {
  payload = payload || {};
  var includeCompleted = normalizeBoolean_(payload.includeCompleted);
  return getImportJobRows_()
    .map(importJobRowToObject_)
    .filter(function(job) {
      return includeCompleted || ["queued", "running", "paused", "failed"].indexOf(job.status) !== -1;
    })
    .sort(function(a, b) {
      return parseSheetDate_(b.updatedAt || b.createdAt) - parseSheetDate_(a.updatedAt || a.createdAt);
    })
    .slice(0, 20);
}

function createImportJob(payload) {
  payload = payload || {};
  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("Missing captured import items.");
  var jobId = createImportJobId_();
  var createdAt = new Date().toISOString();
  var overwriteDuplicates = normalizeBoolean_(payload.overwriteDuplicates);
  var jobRow = {
    job_id: jobId,
    type: String(payload.type || "linkedin_capture_import").trim() || "linkedin_capture_import",
    status: "queued",
    total_count: items.length,
    processed_count: 0,
    imported_count: 0,
    skipped_duplicates: 0,
    updated_count: 0,
    failed_count: 0,
    verified_in_ledger_count: 0,
    overwrite_duplicates: overwriteDuplicates,
    created_at: createdAt,
    updated_at: createdAt,
    last_error: "",
    report_json: JSON.stringify({
      detectedCount: items.length,
      selectedCount: items.length,
      importedCount: 0,
      skippedDuplicates: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: []
    })
  };
  saveImportJobRow_(jobRow);
  items.forEach(function(item, index) {
    var title = String(item && item.title || "").trim();
    var sourceUrl = normalizeCapturedSourceUrl_(item && (item.sourceUrl || item.source_url || item.url) || "");
    var linkedinPostId = String(item && (item.linkedinPostId || item.linkedin_post_id || parseLinkedInPostIdFromUrl_(sourceUrl)) || "").trim();
    var normalizedTextHash = String(item && (item.normalizedTextHash || item.normalized_text_hash || computeTextHash_(item.description || item.text || item.title || sourceUrl)) || "").trim();
    saveImportJobItemRow_({
      job_item_id: createImportJobItemId_(),
      job_id: jobId,
      item_index: index,
      status: "pending",
      title: title,
      source_url: sourceUrl,
      linkedin_post_id: linkedinPostId,
      normalized_text_hash: normalizedTextHash,
      post_id: "",
      attempt_count: 0,
      error_message: "",
      raw_json: JSON.stringify(item || {}),
      created_at: createdAt,
      updated_at: createdAt
    });
  });
  return getImportJobStatus({ jobId: jobId });
}

function getImportJobStatus(payload) {
  payload = payload || {};
  var jobId = String(payload.jobId || payload.job_id || "").trim();
  if (!jobId) throw new Error("Missing jobId");
  var sheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  var jobRow = findObjectByHeaders_(sheet, ["job_id"], jobId);
  if (!jobRow) throw new Error("Import job not found.");
  var itemRows = getImportJobItemRows_(jobId);
  recomputeImportJobFromItems_(jobRow, itemRows);
  saveImportJobRow_(jobRow);
  var job = importJobRowToObject_(jobRow);
  var items = itemRows.map(importJobItemRowToObject_).sort(function(a, b) {
    return Number(a.itemIndex || 0) - Number(b.itemIndex || 0);
  });
  var failedItems = items.filter(function(item) { return item.status === "failed"; });
  return {
    ok: true,
    action: "getImportJobStatus",
    backendVersion: APP_BACKEND_VERSION,
    job: job,
    items: items.slice(0, 50),
    failedItems: failedItems.slice(0, 50),
    verifiedInLedgerCount: job.verifiedInLedgerCount
  };
}

function runImportJobBatch(payload) {
  payload = payload || {};
  var jobId = String(payload.jobId || payload.job_id || "").trim();
  var batchSize = Math.max(1, Math.min(50, Number(payload.batchSize || payload.batch_size || 25) || 25));
  if (!jobId) throw new Error("Missing jobId");
  var jobSheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  var jobRow = findObjectByHeaders_(jobSheet, ["job_id"], jobId);
  if (!jobRow) throw new Error("Import job not found.");
  if (String(jobRow.status || "").trim() === "cancelled") throw new Error("Import job was cancelled.");
  if (String(jobRow.status || "").trim() === "paused") {
    jobRow.status = "running";
  }
  var overwriteDuplicates = normalizeBoolean_(jobRow.overwrite_duplicates);
  var itemRows = getImportJobItemRows_(jobId).sort(function(a, b) {
    return Number(a.item_index || 0) - Number(b.item_index || 0);
  });
  var pendingRows = itemRows.filter(function(row) {
    return String(row.status || "pending").trim() === "pending";
  }).slice(0, batchSize);
  if (!pendingRows.length) {
    recomputeImportJobFromItems_(jobRow, itemRows);
    saveImportJobRow_(jobRow);
    return getImportJobStatus({ jobId: jobId });
  }
  jobRow.status = "running";
  jobRow.updated_at = new Date().toISOString();
  saveImportJobRow_(jobRow);
  var existingPosts = getPosts();
  var batchErrors = [];
  pendingRows.forEach(function(row) {
    row.attempt_count = normalizeNumber_(row.attempt_count) + 1;
    row.updated_at = new Date().toISOString();
    try {
      var item = parseJsonSafe_(row.raw_json) || {};
      var normalized = normalizeCapturedImportItem_(item, { overwriteDuplicates: overwriteDuplicates });
      var duplicate = findCapturedImportDuplicate_(normalized, existingPosts);
      if (duplicate && !overwriteDuplicates) {
        row.status = "skipped_duplicate";
        row.post_id = String(duplicate.postId || "").trim();
        row.error_message = "Duplicate skipped";
      } else {
        var saved = savePost(Object.assign({}, normalized, {
          postId: duplicate && overwriteDuplicates ? duplicate.postId : "",
          importJobId: jobId,
          sourceImportJobId: jobId,
          createdFromFlow: "linkedin_import"
        }));
        row.status = duplicate && overwriteDuplicates ? "updated" : "imported";
        row.post_id = String(saved.postId || saved.post_id || "").trim();
        row.error_message = "";
        existingPosts = existingPosts.filter(function(post) {
          return String(post.postId || "").trim() !== row.post_id;
        }).concat(saved);
      }
    } catch (err) {
      row.status = "failed";
      row.error_message = sanitizeErrorMessage_(err && err.message || err || "Import failed");
      batchErrors.push({
        index: normalizeNumber_(row.item_index),
        title: String(row.title || "").trim(),
        sourceUrl: String(row.source_url || "").trim(),
        message: row.error_message
      });
    }
    saveImportJobItemRow_(row);
  });
  itemRows = getImportJobItemRows_(jobId);
  recomputeImportJobFromItems_(jobRow, itemRows);
  if (batchErrors.length) jobRow.last_error = batchErrors[0].message;
  saveImportJobRow_(jobRow);
  var status = getImportJobStatus({ jobId: jobId });
  status.action = "runImportJobBatch";
  status.errors = batchErrors;
  return status;
}

function cancelImportJob(payload) {
  payload = payload || {};
  var jobId = String(payload.jobId || payload.job_id || "").trim();
  var mode = String(payload.mode || "cancel").trim().toLowerCase();
  if (!jobId) throw new Error("Missing jobId");
  var sheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  var jobRow = findObjectByHeaders_(sheet, ["job_id"], jobId);
  if (!jobRow) throw new Error("Import job not found.");
  jobRow.status = mode === "pause" ? "paused" : "cancelled";
  jobRow.updated_at = new Date().toISOString();
  saveImportJobRow_(jobRow);
  return getImportJobStatus({ jobId: jobId });
}

function retryImportJobFailures(payload) {
  payload = payload || {};
  var jobId = String(payload.jobId || payload.job_id || "").trim();
  if (!jobId) throw new Error("Missing jobId");
  var itemRows = getImportJobItemRows_(jobId);
  var resetCount = 0;
  itemRows.forEach(function(row) {
    if (String(row.status || "").trim() !== "failed") return;
    row.status = "pending";
    row.error_message = "";
    row.updated_at = new Date().toISOString();
    saveImportJobItemRow_(row);
    resetCount += 1;
  });
  var sheet = ensureSheet_("importJobs", IMPORT_JOB_HEADERS);
  var jobRow = findObjectByHeaders_(sheet, ["job_id"], jobId);
  if (!jobRow) throw new Error("Import job not found.");
  jobRow.status = "queued";
  jobRow.last_error = "";
  recomputeImportJobFromItems_(jobRow, getImportJobItemRows_(jobId));
  if (String(jobRow.status || "").trim() === "failed") jobRow.status = "queued";
  saveImportJobRow_(jobRow);
  var status = getImportJobStatus({ jobId: jobId });
  status.action = "retryImportJobFailures";
  status.retryCount = resetCount;
  return status;
}

function importExistingPostAsIdea(payload) {
  payload = payload || {};
  var item = payload.item || payload;
  var normalized = normalizeCapturedImportItem_(item, payload);
  var platform = detectSourcePlatform_(pickFirstDefined_(item.platform, normalized.platform, item.sourceUrl, item.source_url, "")) || "linkedin";
  var sourceType = platform === "linkedin" ? "linkedin_existing_post" : "existing_post_import";
  var metrics = normalizeCapturedMetrics_(pickFirstDefined_(item.metrics, item.sourceMetrics, {}), item);
  var originalDate = String(normalized.scheduledAt || normalized.publishedAt || "").trim();
  var sourceUrl = String(pickFirstDefined_(payload.sourceUrl, item.sourceUrl, item.source_url, normalized.sourceUrl, "")).trim();
  var contextUrl = String(pickFirstDefined_(payload.sourceContextUrl, item.sourcePageUrl, item.source_page_url, "")).trim();
  var notes = [
    String(item.note || "").trim(),
    sourceUrl ? "Source URL: " + sourceUrl : "",
    contextUrl ? "Context URL: " + contextUrl : "",
    originalDate ? "Original post date: " + originalDate : "",
    "Metrics: " + JSON.stringify(metrics)
  ].filter(Boolean).join("\n");
  var domainOrMeta = [sourceUrl, contextUrl, originalDate].filter(Boolean).join(" • ");
  var title = String(normalized.title || buildCapturedImportTitle_(normalized.description, sourceUrl) || "Imported Existing Post").trim();
  var summary = String(normalized.description || "").trim();
  if (!title && !summary && !sourceUrl) throw new Error("Existing post import is empty.");
  var saved = saveInspo({
    inspoType: normalized.postType === "video" ? "video" : normalized.postType === "image" ? "image" : "article",
    title: title,
    sourceLabel: platform === "linkedin" ? "LinkedIn existing post" : "Existing post import",
    sourceType: sourceType,
    sourceUrl: sourceUrl,
    summary: summary,
    domainOrMeta: domainOrMeta,
    suggestedPlatform: platform,
    suggestedPillar: normalized.pillar || getSettingsRegistry().pillars[0] || "authority",
    createPostTitle: title,
    createPostDescription: summary || (item.requiresManualReview || item.requiresContentPaste ? "Paste the post text or browser-capture JSON to import content." : ""),
    createPostType: normalized.postType || "text",
    notes: notes,
    importedAt: String(pickFirstDefined_(item.importedAt, item.imported_at, new Date().toISOString())).trim(),
    originalPostDate: originalDate,
    metricsJson: JSON.stringify(metrics),
    status: "active"
  });
  return {
    ok: true,
    codeVersionStamp: STELLARSYNC_BACKEND_VERSION,
    inspo: saved
  };
}

function cleanLinkedInImportText_(value) {
  var text = String(value || "").replace(/\r\n/g, "\n");
  return text
    .split(/\n+/)
    .map(function(line) { return String(line || "").replace(/\u00a0/g, " ").trim(); })
    .filter(Boolean)
    .filter(function(line) {
      return ![
        /^like$/i,
        /^comment$/i,
        /^repost$/i,
        /^send$/i,
        /^view analytics$/i,
        /^promote this post$/i,
        /^activate to view larger image$/i,
        /^visible to anyone on or off linkedin$/i,
        /^feed post number\b/i,
        /^copy link$/i,
        /^more$/i
      ].some(function(pattern) { return pattern.test(line); });
    })
    .filter(function(line) { return !/^\d[\d,.kKmM]*\s+impressions?$/i.test(line); })
    .filter(function(line) { return !/^(?:like|comment|repost|send)(?:\s+(?:like|comment|repost|send))*$/i.test(line); })
    .join("\n")
    .trim();
}

function parseImportedDateDetails_(value, generatedAt) {
  var text = String(value || "").trim();
  var generated = generatedAt ? new Date(generatedAt) : null;
  var generatedValid = generated && !Number.isNaN(generated.getTime());
  var result = {
    originalPostDate: "",
    originalPostDateLabel: text,
    scheduledAt: "",
    queueDateLabel: "",
    confidence: text ? "label_only" : "missing"
  };
  if (!text) return result;
  var direct = text.indexOf("T") >= 0 || text.indexOf(":") >= 0 || text.indexOf(" ") >= 0 || text.match(/[a-z]/i)
    ? new Date(text)
    : new Date(text + "T12:00:00");
  if (direct && !Number.isNaN(direct.getTime())) {
    result.originalPostDate = direct.toISOString();
    result.scheduledAt = result.originalPostDate;
    result.queueDateLabel = Utilities.formatDate(direct, Session.getScriptTimeZone(), "M/d/yyyy");
    result.confidence = "exact";
    return result;
  }
  var isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}(?:[tT ][\d:.+-Zz]+)?\b/);
  if (isoMatch) {
    var isoParsed = new Date(String(isoMatch[0]).indexOf("T") >= 0 ? isoMatch[0] : isoMatch[0] + "T12:00:00");
    if (!Number.isNaN(isoParsed.getTime())) {
      result.originalPostDate = isoParsed.toISOString();
      result.scheduledAt = result.originalPostDate;
      result.queueDateLabel = Utilities.formatDate(isoParsed, Session.getScriptTimeZone(), "M/d/yyyy");
      result.confidence = "exact";
      return result;
    }
  }
  var slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashMatch) {
    var year = slashMatch[3].length === 2 ? "20" + slashMatch[3] : slashMatch[3];
    var slashParsed = new Date(year + "-" + ("0" + slashMatch[1]).slice(-2) + "-" + ("0" + slashMatch[2]).slice(-2) + "T12:00:00");
    if (!Number.isNaN(slashParsed.getTime())) {
      result.originalPostDate = slashParsed.toISOString();
      result.scheduledAt = result.originalPostDate;
      result.queueDateLabel = Utilities.formatDate(slashParsed, Session.getScriptTimeZone(), "M/d/yyyy");
      result.confidence = "exact";
      return result;
    }
  }
  var monthDayYearMatch = text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|march)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i);
  if (monthDayYearMatch) {
    var monthParsed = new Date(String(monthDayYearMatch[0]).replace(/,/g, ""));
    if (!Number.isNaN(monthParsed.getTime())) {
      result.originalPostDate = monthParsed.toISOString();
      result.scheduledAt = result.originalPostDate;
      result.queueDateLabel = Utilities.formatDate(monthParsed, Session.getScriptTimeZone(), "M/d/yyyy");
      result.confidence = "exact";
      return result;
    }
  }
  var monthDayMatch = text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|march)[a-z]*\s+\d{1,2}\b/i);
  if (monthDayMatch && generatedValid) {
    var guessYear = generated.getFullYear();
    var guessed = new Date(String(monthDayMatch[0]).replace(/,/g, "") + " " + guessYear);
    if (!Number.isNaN(guessed.getTime())) {
      if (guessed.getTime() > generated.getTime()) guessed.setFullYear(guessYear - 1);
      result.originalPostDate = guessed.toISOString();
      result.originalPostDateLabel = monthDayMatch[0];
      result.scheduledAt = result.originalPostDate;
      result.queueDateLabel = Utilities.formatDate(guessed, Session.getScriptTimeZone(), "M/d/yyyy");
      result.confidence = "relative";
      return result;
    }
  }
  var relativeMatch = text.match(/\b(\d+)\s*(h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|mos|month|months|yr|yrs|year|years)\b/i);
  if (relativeMatch) {
    result.confidence = generatedValid ? "relative" : "label_only";
    if (generatedValid) {
      var amount = Number(relativeMatch[1] || 0);
      var unit = String(relativeMatch[2] || "").toLowerCase();
      var parsed = new Date(generated.getTime());
      if (/^h/.test(unit)) parsed.setHours(parsed.getHours() - amount);
      else if (/^d/.test(unit)) parsed.setDate(parsed.getDate() - amount);
      else if (/^w/.test(unit)) parsed.setDate(parsed.getDate() - amount * 7);
      else if (/^mo/.test(unit) || /^month/.test(unit)) parsed.setMonth(parsed.getMonth() - amount);
      else parsed.setFullYear(parsed.getFullYear() - amount);
      result.originalPostDate = parsed.toISOString();
    }
    return result;
  }
  return result;
}

function detectCapturedRepostMeta_(item, description, rawText) {
  var combined = [String(item && (item.actionText || item.action_text) || ""), rawText, description].join("\n");
  var isRepost = /reposted this|(?:^|\b)reposted(?:\b|$)|view repost/i.test(combined);
  var isReshare = !isRepost && /shared this|(?:^|\b)shared(?:\b|$)/i.test(combined);
  var authorMatch = combined.match(/(?:reposted this|shared this|original post|view repost)\s+([A-Z][^\n|]{2,80})/i);
  return {
    postType: isRepost ? "repost" : isReshare ? "reshare" : "",
    isRepost: isRepost || isReshare,
    repostAuthor: authorMatch && authorMatch[1] ? String(authorMatch[1]).trim() : "",
    repostCommentary: rawText && description && rawText !== description && rawText.indexOf(description) >= 0 ? rawText.replace(description, "").trim().slice(0, 500) : "",
    originalAuthor: authorMatch && authorMatch[1] ? String(authorMatch[1]).trim() : "",
    originalPostExcerpt: cleanLinkedInImportText_(description).slice(0, 240)
  };
}

function normalizeCapturedImportItem_(item, payload) {
  item = item || {};
  var settings = getSettingsRegistry();
  var defaultPillar = settings.pillars[0] || "authority";
  var rawText = String(pickFirstDefined_(item.rawText, item.raw_text, "")).trim();
  var description = cleanLinkedInImportText_(pickFirstDefined_(item.description, item.caption, item.body, item.text, rawText, ""));
  var sourceUrl = normalizeCapturedSourceUrl_(pickFirstDefined_(item.sourceUrl, item.source_url, item.url));
  var title = String(pickFirstDefined_(item.title, buildCapturedImportTitle_(description, sourceUrl))).trim();
  var platform = detectSourcePlatform_(pickFirstDefined_(item.platform, "linkedin")) || "linkedin";
  var dateDetails = parseImportedDateDetails_(pickFirstDefined_(item.originalPostDateLabel, item.original_post_date_label, item.dateLabel, item.date_label, item.timestamp, item.publishedAt, item.published_at, item.scheduledAt, item.scheduled_at, item.date), pickFirstDefined_(item.generatedAt, item.generated_at, ""));
  var repostMeta = detectCapturedRepostMeta_(item, description, rawText);
  var postType = String(pickFirstDefined_(item.postType, item.post_type, repostMeta.postType, inferCapturedImportPostType_(item))).trim().toLowerCase() || "text";
  var dateValue = normalizeImportedDateValue_(pickFirstDefined_(item.scheduledAt, item.scheduled_at, dateDetails.scheduledAt, item.date, item.publishedAt, item.published_at));
  var normalizedTextHash = computeTextHash_(description || title || sourceUrl);
  var linkedinPostId = String(pickFirstDefined_(item.linkedinPostId, item.linkedin_post_id, parseLinkedInPostIdFromUrl_(sourceUrl), item.apiPostId, item.api_post_id)).trim();
  var metrics = normalizeCapturedMetrics_(pickFirstDefined_(item.metrics, item.sourceMetrics, {}), item);
  var media = normalizeCapturedMedia_(item);
  var sourceType = String(pickFirstDefined_(item.sourceType, item.source_type, "linkedin_browser_capture")).trim() || "linkedin_browser_capture";
  var reviewNeeded = normalizeBoolean_(pickFirstDefined_(item.requiresManualReview, item.requires_manual_review, item.reviewNeeded, sourceType === "linkedin_url_only"));
  var sourceMetadata = {
    source_type: "linkedin_browser_capture",
    source_label: sourceType,
    generated_at: String(pickFirstDefined_(item.generatedAt, item.generated_at, new Date().toISOString())).trim(),
    source_url: String(pickFirstDefined_(item.sourcePageUrl, item.source_page_url, item.pageUrl, item.page_url, sourceUrl)).trim(),
    date_label: String(pickFirstDefined_(item.dateLabel, item.date_label, dateDetails.originalPostDateLabel, "")).trim(),
    media_urls: media.urls,
    media_alt_texts: media.altTexts,
    media_rich: media.rich,
    raw_text_excerpt: rawText ? rawText.slice(0, 1200) : "",
    impression_count: metrics.impressions,
    reaction_count: metrics.likes,
    comment_count: metrics.comments,
    repost_count: metrics.shares,
    date_confidence: dateDetails.confidence,
    repost_author: repostMeta.repostAuthor,
    original_author: repostMeta.originalAuthor,
    original_post_excerpt: repostMeta.originalPostExcerpt
  };
  if (!title && !description && !sourceUrl) throw new Error("Captured item is empty.");
  return {
    title: title || "Imported LinkedIn Post",
    platform: platform,
    postType: postType,
    pillar: String(pickFirstDefined_(item.pillar, payload && payload.pillar, defaultPillar)).trim() || defaultPillar,
    status: "published",
    description: description,
    sourceUrl: sourceUrl,
    sourceType: sourceType,
    sourcePlatform: platform,
    sourceTitle: title || "Imported LinkedIn Post",
    sourceMetadata: JSON.stringify(sourceMetadata),
    sourceImportStatus: String(pickFirstDefined_(item.sourceImportStatus, reviewNeeded ? "review_needed" : sourceType)).trim(),
    importedAt: String(pickFirstDefined_(item.importedAt, item.imported_at, new Date().toISOString())).trim(),
    originalPostDate: String(pickFirstDefined_(item.originalPostDate, item.original_post_date, dateDetails.originalPostDate, "")).trim(),
    originalPostDateLabel: String(pickFirstDefined_(item.originalPostDateLabel, item.original_post_date_label, item.dateLabel, item.date_label, dateDetails.originalPostDateLabel, "")).trim(),
    dateConfidence: String(pickFirstDefined_(item.dateConfidence, item.date_confidence, dateDetails.confidence)).trim() || "missing",
    linkedinPostId: linkedinPostId,
    normalizedTextHash: normalizedTextHash,
    scheduledAt: dateValue,
    publishedAt: dateValue,
    queueDateLabel: String(pickFirstDefined_(item.queueDateLabel, item.queue_date_label, dateDetails.queueDateLabel, "")).trim(),
    publishedUrl: sourceUrl,
    apiPostId: linkedinPostId,
    platformTargets: ["linkedin"],
    impressions: metrics.impressions,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    isRepost: normalizeBoolean_(pickFirstDefined_(item.isRepost, item.is_repost, repostMeta.isRepost)),
    repostAuthor: String(pickFirstDefined_(item.repostAuthor, item.repost_author, repostMeta.repostAuthor, "")).trim(),
    repostCommentary: String(pickFirstDefined_(item.repostCommentary, item.repost_commentary, repostMeta.repostCommentary, "")).trim(),
    originalAuthor: String(pickFirstDefined_(item.originalAuthor, item.original_author, repostMeta.originalAuthor, "")).trim(),
    originalPostExcerpt: String(pickFirstDefined_(item.originalPostExcerpt, item.original_post_excerpt, repostMeta.originalPostExcerpt, "")).trim(),
    notes: String(pickFirstDefined_(item.notes, item.previewNote, reviewNeeded ? "LinkedIn URL saved as source. Paste the post text or browser capture JSON to import content." : rawText && !String(pickFirstDefined_(item.text, item.description, "")).trim() ? "Imported from pasted LinkedIn page text. Review and enrich formatting if needed." : "")).trim(),
    requiresManualReview: reviewNeeded
  };
}

function normalizeCapturedMedia_(item) {
  var rawMedia = normalizeListField_(pickFirstDefined_(item.media, item.mediaUrls, item.media_urls, []));
  var urls = [];
  var altTexts = normalizeListField_(pickFirstDefined_(item.mediaAltTexts, item.media_alt_texts, item.mediaAlt, []))
    .map(function(value) { return String(value || "").trim(); })
    .filter(Boolean);
  var rich = [];
  rawMedia.forEach(function(entry) {
    if (typeof entry === "string") {
      var direct = String(entry || "").trim();
      if (direct) {
        urls.push(direct);
        rich.push({ url: direct, type: "image", source: "linkedin_dom" });
      }
      return;
    }
    if (!entry || typeof entry !== "object") return;
    var url = String(entry.url || entry.src || "").trim();
    var alt = String(entry.alt || entry.label || "").trim();
    if (url) {
      urls.push(url);
      rich.push({
        url: url,
        alt: alt,
        type: String(entry.type || "image").trim(),
        width: Math.max(0, parseInt(entry.width, 10) || 0),
        height: Math.max(0, parseInt(entry.height, 10) || 0),
        source: String(entry.source || "linkedin_dom").trim()
      });
    }
    if (alt) altTexts.push(alt);
  });
  return {
    urls: urls.filter(Boolean),
    altTexts: altTexts.filter(Boolean),
    rich: rich
  };
}

function normalizeCapturedMetrics_(metrics, item) {
  metrics = metrics || {};
  return {
    impressions: normalizeNumber_(pickFirstDefined_(metrics.impressions, item.impressions, item.impressionCount, item.impression_count)),
    likes: normalizeNumber_(pickFirstDefined_(metrics.likes, metrics.reactions, item.likes, item.reactions, item.reactionCount, item.reaction_count)),
    comments: normalizeNumber_(pickFirstDefined_(metrics.comments, item.comments, item.commentCount, item.comment_count)),
    shares: normalizeNumber_(pickFirstDefined_(metrics.shares, metrics.reposts, item.shares, item.reposts, item.repostCount, item.repost_count))
  };
}

function normalizeCapturedSourceUrl_(value) {
  var url = String(value || "").trim();
  if (!url) return "";
  return url.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

function buildCapturedImportTitle_(description, sourceUrl) {
  var text = String(description || "").trim();
  if (text) return text.split(/\n+/)[0].trim().slice(0, 80);
  var url = String(sourceUrl || "").trim();
  if (!url) return "Imported LinkedIn Post";
  return "LinkedIn Post " + (parseLinkedInPostIdFromUrl_(url) || "");
}

function inferCapturedImportPostType_(item) {
  var mediaUrls = normalizeListField_(pickFirstDefined_(item.mediaUrls, item.media_urls, item.media, [])).filter(Boolean);
  if (mediaUrls.length > 1) return "carousel";
  if (mediaUrls.length === 1) return "image";
  return "text";
}

function normalizeImportedDateValue_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  var direct = normalizeDateTime_(text);
  if (direct) return direct;
  var parsed = parseSheetDate_(text);
  if (parsed && !isNaN(parsed)) return Utilities.formatDate(parsed, getPlanningTimeZone_(), "yyyy-MM-dd'T'HH:mm");
  return "";
}

function computeTextHash_(value) {
  var text = normalizeImportComparableText_(value);
  var hash = 2166136261;
  for (var index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

function normalizeImportComparableText_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function parseLinkedInPostIdFromUrl_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  var activityMatch = text.match(/activity[-:/](\d{6,})/i);
  if (activityMatch && activityMatch[1]) return activityMatch[1];
  var urnMatch = text.match(/urn:li:(?:ugcPost|share):([^/?#]+)/i);
  if (urnMatch && urnMatch[1]) return urnMatch[1];
  return "";
}

function findCapturedImportDuplicate_(normalized, existingPosts) {
  var posts = Array.isArray(existingPosts) ? existingPosts : [];
  var normalizedUrl = normalizeCapturedSourceUrl_(normalized.sourceUrl);
  var normalizedHash = String(normalized.normalizedTextHash || "").trim();
  var normalizedDate = String(normalized.scheduledAt || normalized.publishedAt || "").slice(0, 10);
  var normalizedPrefix = normalizeImportComparableText_(normalized.description || normalized.title).slice(0, 120);
  for (var index = 0; index < posts.length; index += 1) {
    var post = posts[index];
    if (normalized.linkedinPostId && normalized.linkedinPostId === String(post.linkedinPostId || post.apiPostId || "").trim()) return post;
    if (normalizedUrl && normalizedUrl === normalizeCapturedSourceUrl_(post.sourceUrl)) return post;
    var postHash = String(post.normalizedTextHash || computeTextHash_(post.description || post.title || post.sourceUrl || "")).trim();
    if (normalizedHash && normalizedHash === postHash) return post;
    var postDate = String(post.publishedAt || post.scheduledAt || post.date || "").slice(0, 10);
    var postPrefix = normalizeImportComparableText_(post.description || post.title).slice(0, 120);
    var postTargets = post.platformTargets && post.platformTargets.length ? post.platformTargets : parsePlatformTargets_(post.platform);
    if (postTargets.indexOf(normalized.platform) !== -1 && normalizedDate && postDate === normalizedDate && normalizedPrefix && postPrefix === normalizedPrefix) return post;
  }
  return null;
}

function fetchJson_(url, options) {
  var requestOptions = options || {};
  requestOptions.muteHttpExceptions = true;
  if (requestOptions.payload && !requestOptions.contentType) requestOptions.contentType = "application/x-www-form-urlencoded";
  var response = UrlFetchApp.fetch(url, requestOptions);
  var text = response.getContentText();
  var parsed = parseJsonSafe_(text) || {};
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    var message = String(parsed.error_description || parsed.message || parsed.error && parsed.error.message || "HTTP " + code).trim();
    if (requestOptions.metaLabel) message = requestOptions.metaLabel + ": " + message;
    throw new Error(message);
  }
  return parsed;
}

function getLinkedInApiVersion_() {
  return String(getScriptProp_("LINKEDIN_API_VERSION") || LINKEDIN_API_VERSION).trim() || LINKEDIN_API_VERSION;
}

function getLinkedInApiVersionCandidates_(payload) {
  var candidates = [];
  var explicit = String(payload && payload.apiVersion || getScriptProp_("LINKEDIN_API_VERSION") || "").trim();
  if (explicit) candidates.push(explicit);
  ["202605", "202604", "202603", "202602", "202601", "202512", "202511", "202510", "202509", "202508", "202507", "202506", "202505", "202411", "202410", "202409"].forEach(function(version) {
    var value = String(version || "").trim();
    if (value && candidates.indexOf(value) === -1) candidates.push(value);
  });
  return candidates;
}

function buildLinkedInRestHeaders_(accessToken, apiVersion, extraHeaders) {
  return Object.assign({
    Authorization: "Bearer " + accessToken,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": String(apiVersion || getLinkedInApiVersion_()).trim() || LINKEDIN_API_VERSION
  }, extraHeaders || {});
}

function toLinkedInPersonUrn_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  return text.indexOf("urn:li:person:") === 0 ? text : "urn:li:person:" + text;
}

function buildLinkedInHistoricalPostsUrl_(personUrn, options) {
  var normalizedOptions = options || {};
  var query = {
    author: personUrn,
    q: "author",
    count: Number(normalizedOptions.limit || 5) || 5,
    sortBy: "LAST_MODIFIED",
    viewContext: String(normalizedOptions.viewContext || "AUTHOR").trim() || "AUTHOR"
  };
  if (normalizedOptions.cursor !== undefined && normalizedOptions.cursor !== null && normalizedOptions.cursor !== "") {
    query.start = Number(normalizedOptions.cursor || 0) || 0;
  }
  return "https://api.linkedin.com/rest/posts?" + toQueryString_(query);
}

function runLinkedInHistoricalEndpointAttempt_(attemptKey, personUrn, accessToken, payload, apiVersion) {
  var resolvedApiVersion = String(apiVersion || getLinkedInApiVersion_()).trim() || LINKEDIN_API_VERSION;
  var url = buildLinkedInHistoricalPostsUrl_(personUrn, payload);
  var response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: buildLinkedInRestHeaders_(accessToken, resolvedApiVersion, { "X-RestLi-Method": "FINDER" })
  });
  var text = response.getContentText();
  var parsed = parseJsonSafe_(text) || {};
  var statusCode = response.getResponseCode();
  var elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  var snippet = sanitizeLinkedInHistoricalSnippet_(text, parsed);
  return {
    attemptKey: attemptKey,
    requestedApiVersionCandidate: resolvedApiVersion,
    outboundLinkedInVersionHeader: resolvedApiVersion,
    endpointAttempted: buildLinkedInHistoricalEndpointPreview_(url),
    responseStatus: statusCode,
    responseBodySnippet: snippet,
    apiVersion: resolvedApiVersion,
    postsReturned: elements.length > 0,
    unauthorized: statusCode === 401,
    apiVersionRequired: statusCode === 426,
    apiVersionFormatInvalid: isLinkedInHistoricalApiVersionFormatInvalid_(statusCode, snippet),
    permissionDenied: isLinkedInHistoricalPermissionDenied_(statusCode, snippet),
    approvalRequired: isLinkedInHistoricalApprovalRequired_(statusCode, snippet),
    endpointDeprecated: isLinkedInHistoricalEndpointDeprecated_(statusCode, snippet),
    elementsCount: elements.length,
    paging: parsed.paging || {},
    elements: elements.slice(0, Number(payload && payload.limit || 5) || 5)
  };
}

function buildLinkedInHistoricalEndpointPreview_(url) {
  return String(url || "").replace(/author=([^&]+)/i, "author=[encoded-person-urn]");
}

function sanitizeLinkedInHistoricalSnippet_(text, parsed) {
  var source = "";
  if (parsed && typeof parsed === "object") {
    source = JSON.stringify({
      message: parsed.message,
      error: parsed.error,
      status: parsed.status,
      serviceErrorCode: parsed.serviceErrorCode
    });
  }
  if (!source || source === "{}") source = String(text || "");
  return sanitizeErrorMessage_(source).slice(0, 350);
}

function isLinkedInHistoricalPermissionDenied_(statusCode, snippet) {
  var lower = String(snippet || "").toLowerCase();
  return statusCode === 403 || lower.indexOf("permission") !== -1 || lower.indexOf("scope") !== -1 || lower.indexOf("r_member_social") !== -1 || lower.indexOf("not enough permissions") !== -1;
}

function isLinkedInHistoricalApprovalRequired_(statusCode, snippet) {
  var lower = String(snippet || "").toLowerCase();
  return statusCode === 403 && (
    lower.indexOf("developer application") !== -1 ||
    lower.indexOf("product") !== -1 ||
    lower.indexOf("not authorized to access this resource") !== -1 ||
    lower.indexOf("application does not have permission") !== -1 ||
    lower.indexOf("access to this api has been restricted") !== -1
  );
}

function isLinkedInHistoricalEndpointDeprecated_(statusCode, snippet) {
  var lower = String(snippet || "").toLowerCase();
  return statusCode === 404 || statusCode === 410 || lower.indexOf("deprecated") !== -1 || lower.indexOf("no virtual resource found") !== -1 || lower.indexOf("not found") !== -1;
}

function isLinkedInHistoricalApiVersionFormatInvalid_(statusCode, snippet) {
  var lower = String(snippet || "").toLowerCase();
  return statusCode === 400 && lower.indexOf("api versions should have date format as yyyymm or yyyymm.rr") !== -1;
}

function classifyLinkedInHistoricalAccess_(attempts) {
  var list = Array.isArray(attempts) ? attempts : [];
  var hasPosts = list.some(function(item) { return !!(item && item.postsReturned); });
  if (hasPosts) {
    return {
      classification: "historical_access_available",
      postsReturned: true,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      recommendedAction: "Historical post retrieval is available. You can safely wire the importLinkedInPosts scaffold into a review/import flow next.",
      message: "LinkedIn returned authored posts for the connected member."
    };
  }
  var unauthorized = list.some(function(item) { return !!(item && item.unauthorized); });
  if (unauthorized) {
    return {
      classification: "token_invalid_or_expired",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      recommendedAction: "Reconnect LinkedIn or refresh the token before testing historical authored-post access again.",
      message: "LinkedIn rejected the stored token before historical authored-post access could be verified."
    };
  }
  var apiVersionFormatInvalid = list.some(function(item) { return !!(item && item.apiVersionFormatInvalid); });
  if (apiVersionFormatInvalid) {
    return {
      classification: "linkedin_api_version_format_invalid",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      recommendedAction: "Set LINKEDIN_API_VERSION to a YYYYMM or YYYYMM.RR value and retry.",
      message: "LINKEDIN_API_VERSION is invalid. Use YYYYMM or YYYYMM.RR, for example 202411."
    };
  }
  var apiVersionRequired = list.some(function(item) { return !!(item && item.apiVersionRequired); });
  if (apiVersionRequired) {
    var allVersionRequired = list.length > 0 && list.every(function(item) { return !!(item && item.apiVersionRequired); });
    var versionMessage = allVersionRequired
      ? "No tested LinkedIn API version is active for this app/endpoint."
      : "LinkedIn returned HTTP 426 for the Posts API request, which usually means the required API version or REST protocol headers are missing or mismatched.";
    return {
      classification: "linkedin_api_version_required",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: false,
      recommendedAction: "Set LINKEDIN_API_VERSION if needed and retry with LinkedIn-Version plus X-Restli-Protocol-Version headers.",
      message: versionMessage
    };
  }
  var permissionDenied = list.some(function(item) { return !!(item && item.permissionDenied); });
  var approvalRequired = list.some(function(item) { return !!(item && item.approvalRequired); });
  var endpointDeprecated = list.some(function(item) { return !!(item && item.endpointDeprecated); });
  if (approvalRequired) {
    return {
      classification: "product_approval_required",
      postsReturned: false,
      permissionDenied: true,
      approvalRequired: true,
      endpointDeprecated: endpointDeprecated,
      recommendedAction: "Check LinkedIn product access and app-review approvals for member social read endpoints.",
      message: "The token is present, but LinkedIn appears to require additional product approval for historical authored-post access."
    };
  }
  if (permissionDenied) {
    return {
      classification: "scope_missing",
      postsReturned: false,
      permissionDenied: true,
      approvalRequired: false,
      endpointDeprecated: endpointDeprecated,
      recommendedAction: "Reconnect only after the app is approved for r_member_social or the current LinkedIn equivalent member-post read permission.",
      message: "The token is valid enough to reach LinkedIn, but authored-post history access appears to be missing required read scope."
    };
  }
  if (endpointDeprecated) {
    return {
      classification: "endpoint_deprecated",
      postsReturned: false,
      permissionDenied: false,
      approvalRequired: false,
      endpointDeprecated: true,
      recommendedAction: "Review LinkedIn Posts API docs and update the endpoint/version headers before enabling import.",
      message: "The attempted LinkedIn historical-post endpoint appears deprecated or unavailable for the current version."
    };
  }
  return {
    classification: "token_valid_but_no_history_access",
    postsReturned: false,
    permissionDenied: false,
    approvalRequired: false,
    endpointDeprecated: false,
    recommendedAction: "Verify the member has authored posts, and confirm LinkedIn still grants this token the member-history read capability you expect.",
    message: "LinkedIn accepted the request path, but no historical authored posts were returned."
  };
}

function normalizeLinkedInHistoricalPost_(raw) {
  raw = raw || {};
  var sourceUrl = buildLinkedInPostUrlFromUrn_(raw.id || raw.urn || "");
  var importedAt = new Date().toISOString();
  var linkedinPostId = String(raw.id || raw.urn || "").trim();
  return {
    postId: "",
    title: buildLinkedInHistoricalTitle_(raw),
    platform: "linkedin",
    postType: inferLinkedInHistoricalPostType_(raw),
    description: String(raw.commentary || "").trim(),
    status: "draft",
    source: "linkedin_import",
    source_type: "linkedin_import",
    sourceType: "linkedin_import",
    sourcePlatform: "linkedin",
    sourceUrl: sourceUrl,
    sourcePostId: String(raw.id || raw.urn || "").trim(),
    sourceAccountId: String(raw.author || "").trim(),
    importedAt: importedAt,
    imported_at: importedAt,
    linkedinPostId: linkedinPostId,
    linkedin_post_id: linkedinPostId,
    publishedAt: stringifyLinkedInTimestamp_(raw.publishedAt || raw.createdAt),
    queueDateLabel: "",
    queueTimeLabel: "",
    campaignId: "",
    campaignName: "",
    assetId: "",
    carouselAssetIds: [],
    platformTargets: ["linkedin"],
    sourceImportStatus: "diagnostic_preview",
    diagnostics: ["Historical LinkedIn import preview only. No row was written to POSTS."]
  };
}

function buildLinkedInHistoricalTitle_(raw) {
  var commentary = String(raw && raw.commentary || "").trim();
  if (!commentary) return "Imported LinkedIn Post";
  return commentary.split(/\n+/)[0].trim().slice(0, 80) || "Imported LinkedIn Post";
}

function inferLinkedInHistoricalPostType_(raw) {
  var content = raw && raw.content || {};
  if (content.multiImage) return "carousel";
  if (content.media && content.media.id && String(content.media.id).toLowerCase().indexOf("video") !== -1) return "video";
  if (content.article) return "article";
  return "text";
}

function stringifyLinkedInTimestamp_(value) {
  var numeric = Number(value || 0);
  if (!numeric) return "";
  return new Date(numeric).toISOString();
}

function buildLinkedInPostUrlFromUrn_(urn) {
  var text = String(urn || "").trim();
  if (!text) return "";
  if (text.indexOf("urn:li:ugcPost:") === 0) return "https://www.linkedin.com/feed/update/" + text + "/";
  if (text.indexOf("urn:li:share:") === 0) return "https://www.linkedin.com/feed/update/" + text + "/";
  return "";
}

function computeExpiryIso_(expiresInSeconds) {
  var seconds = Number(expiresInSeconds || 0);
  if (!seconds || seconds < 0) return "";
  return new Date(new Date().getTime() + (seconds * 1000)).toISOString();
}

function isExpiredIso_(isoString) {
  if (!isoString) return false;
  var time = new Date(isoString).getTime();
  return !!time && time <= new Date().getTime();
}

function redactProfile_(profile) {
  profile = profile || {};
  return {
    username: String(profile.username || "").trim(),
    displayName: String(profile.displayName || "").trim()
  };
}

function toQueryString_(params) {
  return Object.keys(params || {}).filter(function(key) {
    return params[key] !== undefined && params[key] !== null && params[key] !== "";
  }).map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
  }).join("&");
}

function buildOAuthCallbackHtml_(title, message, accent, details, nextSteps) {
  var detailText = details ? "<pre style=\"white-space:pre-wrap;background:#0f172a;border:1px solid rgba(255,255,255,0.08);padding:12px;border-radius:12px;color:#cbd5e1;font-size:12px;\">" + escapeHtmlForHtml_(JSON.stringify(details, null, 2)) + "</pre>" : "";
  var steps = Array.isArray(nextSteps) && nextSteps.length
    ? "<ul style=\"margin:18px 0 0 18px;padding:0;color:#cbd5e1;line-height:1.6;\">" + nextSteps.map(function(step) { return "<li style=\"margin:0 0 8px 0;\">" + escapeHtmlForHtml_(step) + "</li>"; }).join("") + "</ul>"
    : "";
  return ""
    + "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + escapeHtmlForHtml_(title) + "</title><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head>"
    + "<body style=\"margin:0;font-family:Inter,Arial,sans-serif;background:#0a0612;color:#e2e8f0;\">"
    + "<div style=\"max-width:680px;margin:48px auto;padding:24px;\">"
    + "<div style=\"background:#120c1d;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:28px;\">"
    + "<div style=\"font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:" + accent + ";font-weight:700;margin-bottom:12px;\">StellarSync OAuth</div>"
    + "<h1 style=\"margin:0 0 12px 0;font-size:28px;line-height:1.2;\">" + escapeHtmlForHtml_(title) + "</h1>"
    + "<p style=\"margin:0 0 18px 0;color:#cbd5e1;line-height:1.6;\">" + escapeHtmlForHtml_(message) + "</p>"
    + detailText
    + steps
    + "<p style=\"margin:18px 0 0 0;color:#94a3b8;font-size:13px;\">You can close this tab and return to StellarSync.</p>"
    + "</div></div></body></html>";
}

function escapeHtmlForHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function importSocialPostByUrl(payload) {
  var url = String(payload && (payload.url || payload.sourceUrl || payload.source_url) || "").trim();
  var captionFallback = String(payload && (payload.captionFallback || payload.caption || payload.description) || "").trim();
  var titleFallback = String(payload && (payload.titleFallback || payload.title) || "").trim();
  if (!url) throw new Error("Missing source URL");
  var platform = detectSourcePlatform_(url) || "external";
  var connected = getConnectedAccounts().filter(function(item) { return item.platform === platform; })[0] || buildDefaultConnectedAccount_(platform);

  if (connected.accessStatus === "connected" && connected.importSupported && platform !== "external") {
    return normalizeSocialImportResult(Object.assign(
      normalizeAuthenticatedSocialPost({ title: titleFallback, caption: captionFallback, permalink: url }, { platform: platform, url: url }),
      {
        connectedAccountUsed: true,
        diagnostics: ["Authenticated import scaffold is connected conceptually, but live API retrieval is not enabled yet."]
      }
    ));
  }

  if (platform === "instagram") {
    var instagram = fetchInstagramOEmbed({ url: url });
    if (captionFallback && !instagram.metadata.caption) instagram.metadata.caption = captionFallback;
    if (titleFallback && !instagram.metadata.title) instagram.metadata.title = titleFallback;
    return normalizeSocialImportResult(instagram);
  }

  if (platform === "external") {
    var openGraph = fetchOpenGraphMetadata({ url: url });
    if (captionFallback && !openGraph.metadata.description) openGraph.metadata.description = captionFallback;
    if (titleFallback && !openGraph.metadata.title) openGraph.metadata.title = titleFallback;
    return normalizeSocialImportResult(openGraph);
  }

  return normalizeSocialImportResult({
    sourceUrl: url,
    sourcePlatform: platform,
    title: titleFallback,
    description: captionFallback,
    mode: "manual_social_card",
    blocked: true,
    sourceImportStatus: "limited",
    diagnostics: [
      platform === "linkedin"
        ? "LinkedIn URL capture stays client-side. Paste copied post text or browser-capture JSON to import visible content; StellarSync will not fetch LinkedIn pages server-side by default."
        : "This platform currently falls back to the manual Social Card unless authenticated access is configured."
    ]
  });
}

function importSocialPostById(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  var postId = String(payload && (payload.postId || payload.sourcePostId || payload.id) || "").trim();
  if (!postId) throw new Error("Missing social post ID");
  return normalizeSocialImportResult({
    sourcePlatform: platform,
    mode: "unsupported",
    blocked: true,
    sourceImportStatus: "failed",
    diagnostics: ["Import by platform post ID is scaffolded only until authenticated retrieval is implemented."]
  });
}

function importRecentSocialPosts(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  return [{
    platform: platform,
    status: "unsupported",
    diagnostics: ["Recent authenticated import is scaffolded only. Connect credentials and implement retrieval before enabling it."]
  }];
}

function saveImportedSocialPostCard(payload) {
  return normalizeSocialImportResult({
    sourceUrl: String(payload && (payload.sourceUrl || payload.url) || "").trim(),
    sourcePlatform: payload && (payload.sourcePlatform || payload.platform) || "",
    title: String(payload && payload.title || "").trim(),
    description: String(payload && (payload.description || payload.caption) || "").trim(),
    metadata: payload && payload.metadata || {},
    mode: String(payload && payload.mode || "manual_social_card").trim() || "manual_social_card",
    blocked: !!(payload && payload.blocked),
    diagnostics: parseSemanticList_(payload && payload.diagnostics || [])
  });
}

function extractMetaContent_(html, key) {
  if (!html || !key) return "";
  const patterns = [
    new RegExp('<meta[^>]+property=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\']', "i"),
    new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+property=["\\\']' + key + '["\\\']', "i"),
    new RegExp('<meta[^>]+name=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\']', "i"),
    new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+name=["\\\']' + key + '["\\\']', "i")
  ];
  for (var i = 0; i < patterns.length; i += 1) {
    var match = html.match(patterns[i]);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function importPostFromUrl(payload) {
  return importSocialPostByUrl(payload);
}

function extractHtmlTitle_(html) {
  const match = String(html || "").match(/<title[^>]*>([^<]+)<\/title>/i);
  return match && match[1] ? String(match[1]).trim() : "";
}

var KEYWORD_BLOCKLIST_ = {
  "content": true, "post": true, "social": true, "media": true,
  "update": true, "thing": true, "things": true, "people": true,
  "make": true, "making": true, "today": true, "learn": true,
  "help": true, "good": true, "great": true, "digital": true,
  "strategy": true, "climate": true, "clean": true, "energy": true,
  "work": true, "system": true, "just": true, "like": true,
  "really": true, "very": true, "way": true, "need": true,
  "know": true, "think": true, "want": true, "time": true,
  "get": true, "use": true, "take": true, "see": true, "look": true,
  "say": true, "new": true, "also": true, "even": true, "much": true,
  "many": true, "still": true, "yet": true, "already": true,
  "however": true, "therefore": true, "moreover": true,
  "nevertheless": true, "life": true, "world": true, "day": true,
  "year": true, "business": true, "company": true, "brand": true,
  "industry": true, "market": true, "trend": true, "future": true,
  "topic": true, "idea": true, "concept": true, "approach": true,
  "method": true, "result": true, "impact": true, "change": true,
  "growth": true, "value": true, "quality": true, "data": true,
  "information": true
};

function isGenericKeyword_(keyword) {
  var text = String(keyword || "").trim().toLowerCase();
  if (!text) return true;
  var words = text.split(/\s+/);
  if (words.length > 1) {
    return words.every(function(w) { return !!KEYWORD_BLOCKLIST_[w]; });
  }
  return !!KEYWORD_BLOCKLIST_[text] || words[0].length < 3;
}

function extractKeywordPhrases_(text) {
  if (!text) return [];
  var normalized = String(text || "").toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  var words = normalized.split(/\s+/);
  var phrases = [];
  var seen = {};
  // Extract 2-4 word sequences
  for (var n = 2; n <= 4; n += 1) {
    for (var i = 0; i <= words.length - n; i += 1) {
      var phrase = words.slice(i, i + n).join(" ");
      if (seen[phrase]) continue;
      seen[phrase] = true;
      var firstWord = words[i];
      var lastWord = words[i + n - 1];
      // Skip if starts with generic verb/preposition or ends with article
      if (["a", "an", "the", "and", "or", "for", "with", "in", "on", "at", "to", "from", "of", "by", "is", "was", "be", "this", "that", "it", "its", "your", "our", "their"].indexOf(firstWord) !== -1) continue;
      if (["a", "an", "the", "and", "or", "for", "in", "on", "at", "to", "of", "is", "are", "was", "were"].indexOf(lastWord) !== -1) continue;
      if (isGenericKeyword_(phrase)) continue;
      phrases.push(phrase);
    }
  }
  // Also include 1-word tokens if they're not blocklisted and >= 4 chars
  words.forEach(function(w) {
    if (w.length >= 4 && !KEYWORD_BLOCKLIST_[w] && !seen[w]) {
      seen[w] = true;
      phrases.push(w);
    }
  });
  return phrases;
}

function collectKeywordCandidatesFromContext_(item, context) {
  context = context || {};
  var candidates = [];

  function addCandidate(keyword, source, score) {
    if (!keyword || isGenericKeyword_(keyword)) return;
    candidates.push({ keyword: String(keyword).toLowerCase().trim(), source: source, score: score });
  }

  function addCandidates(list, source, score) {
    if (!list || !list.length) return;
    list.forEach(function(k) { addCandidate(k, source, score); });
  }

  // 1. Item's own semantic clusters (highest priority)
  addCandidates(parseSemanticList_(pickFirstDefined_(item.semantic_clusters, item.semanticClusters)), "clusters", 1.0);

  // 2. Item's semantic summary phrases
  var summary = String(pickFirstDefined_(item.semantic_summary, item.semanticSummary, "")).trim();
  if (summary) {
    extractKeywordPhrases_(summary).forEach(function(p) { addCandidate(p, "summary", 0.9); });
  }

  // 3. Item's existing semantic tags (high relevance)
  addCandidates(parseSemanticList_(pickFirstDefined_(item.semantic_tags, item.semanticTags)), "tags", 0.85);

  // 4. Campaign context
  var campaignName = String(pickFirstDefined_(item.campaign_name, item.campaignName, "")).trim();
  if (campaignName && context.campaigns) {
    context.campaigns.forEach(function(camp) {
      if (String(pickFirstDefined_(camp.campaign_name, camp.campaignName, "")).trim().toLowerCase() !== campaignName.toLowerCase()) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(camp.semantic_clusters, camp.semanticClusters)), "campaign_clusters", 0.85);
      addCandidates(parseSemanticList_(pickFirstDefined_(camp.semantic_tags, camp.semanticTags)), "campaign_tags", 0.8);
      var campSummary = String(pickFirstDefined_(camp.semantic_summary, camp.semanticSummary, "")).trim();
      if (campSummary) {
        extractKeywordPhrases_(campSummary).forEach(function(p) { addCandidate(p, "campaign_summary", 0.75); });
      }
      extractKeywordPhrases_(String(camp.title || camp.campaignName || camp.campaign_name || "")).forEach(function(p) {
        addCandidate(p, "campaign_title", 0.7);
      });
    });
  }

  // 5. Pillar context
  var pillar = String(pickFirstDefined_(item.pillar, item.suggested_pillar, "")).trim().toLowerCase();
  if (pillar) {
    addCandidate(pillar, "pillar", 0.65);
    if (pillar === "advocacy") addCandidate("policy advocacy and public messaging", "pillar", 0.6);
    if (pillar === "wellness") addCandidate("wellbeing and holistic health", "pillar", 0.6);
    if (pillar === "community") addCandidate("audience engagement and community building", "pillar", 0.6);
    if (pillar === "leadership") addCandidate("thought leadership and vision", "pillar", 0.6);
    if (pillar === "edu" || pillar === "education") addCandidate("educational content", "pillar", 0.6);
    if (pillar === "engage" || pillar === "engagement") addCandidate("audience engagement", "pillar", 0.6);
    if (pillar === "aware" || pillar === "awareness") addCandidate("brand awareness", "pillar", 0.6);
    if (pillar === "distrib" || pillar.indexOf("distribution") !== -1) addCandidate("content distribution", "pillar", 0.6);
    if (pillar === "authority") addCandidate("thought leadership", "pillar", 0.6);
    if (pillar === "applic" || pillar.indexOf("application") !== -1) addCandidate("practical application", "pillar", 0.6);
  }

  // 6. Source artifact keywords
  var sourceInspoId = String(pickFirstDefined_(item.source_inspo_id, item.sourceInspoId, "")).trim();
  var sourceNoteId = String(pickFirstDefined_(item.source_note_id, item.sourceNoteId, "")).trim();
  var sourceAiDraftId = String(pickFirstDefined_(item.source_ai_draft_id, item.sourceAiDraftId, "")).trim();

  if (sourceInspoId && context.allInspo) {
    context.allInspo.forEach(function(src) {
      if (String(pickFirstDefined_(src.inspo_id, src.inspoId, "")).trim() !== sourceInspoId) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_tags, src.semanticTags)), "source_inspo", 0.82);
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_clusters, src.semanticClusters)), "source_inspo", 0.82);
      extractKeywordPhrases_(String(pickFirstDefined_(src.title, src.summary, src.description, src.notes, ""))).forEach(function(p) {
        addCandidate(p, "source_inspo", 0.6);
      });
    });
  }

  if (sourceNoteId && context.allNotes) {
    context.allNotes.forEach(function(src) {
      if (String(pickFirstDefined_(src.note_id, src.noteId, "")).trim() !== sourceNoteId) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_tags, src.semanticTags)), "source_note", 0.82);
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_clusters, src.semanticClusters)), "source_note", 0.82);
      extractKeywordPhrases_(String(pickFirstDefined_(src.title, src.body, src.summary, ""))).forEach(function(p) {
        addCandidate(p, "source_note", 0.6);
      });
    });
  }

  if (sourceAiDraftId && context.allDrafts) {
    context.allDrafts.forEach(function(src) {
      if (String(pickFirstDefined_(src.ai_draft_id, src.aiDraftId, "")).trim() !== sourceAiDraftId) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_tags, src.semanticTags)), "source_draft", 0.82);
      addCandidates(parseSemanticList_(pickFirstDefined_(src.semantic_clusters, src.semanticClusters)), "source_draft", 0.82);
      extractKeywordPhrases_(String(pickFirstDefined_(src.draft_title, src.title, src.draft_text, src.prompt, src.hook_text, src.cta_text, ""))).forEach(function(p) {
        addCandidate(p, "source_draft", 0.6);
      });
    });
  }

  // 7. Same-campaign related posts
  if (campaignName && context.allPosts) {
    context.allPosts.forEach(function(post) {
      var postCampaign = String(pickFirstDefined_(post.campaign_name, post.campaignName, "")).trim().toLowerCase();
      if (postCampaign !== campaignName.toLowerCase()) return;
      if (String(post.post_id || "").trim() === String(item.post_id || "").trim()) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(post.semantic_tags, post.semanticTags)), "related_post", 0.7);
      addCandidates(parseSemanticList_(pickFirstDefined_(post.semantic_clusters, post.semanticClusters)), "related_post", 0.7);
    });
  }

  // 8. Same-campaign related INSPO
  if (campaignName && context.allInspo) {
    context.allInspo.forEach(function(inspo) {
      var inspoCampaign = String(pickFirstDefined_(inspo.campaign_name, inspo.campaignName, "")).trim().toLowerCase();
      if (inspoCampaign !== campaignName.toLowerCase()) return;
      addCandidates(parseSemanticList_(pickFirstDefined_(inspo.semantic_tags, inspo.semanticTags)), "related_inspo", 0.68);
      addCandidates(parseSemanticList_(pickFirstDefined_(inspo.semantic_clusters, inspo.semanticClusters)), "related_inspo", 0.68);
    });
  }

  // 9. Title + description from the item itself (lower priority)
  extractKeywordPhrases_(String(pickFirstDefined_(item.title, item.draft_title, item.post_title, ""))).forEach(function(p) {
    addCandidate(p, "title", 0.55);
  });
  extractKeywordPhrases_(String(pickFirstDefined_(item.description, item.summary, item.body, item.notes, item.draft_text, ""))).forEach(function(p) {
    addCandidate(p, "text", 0.4);
  });

  return candidates;
}

function rankAndFilterKeywords_(candidates) {
  // Deduplicate, keeping highest score per keyword
  var best = {};
  candidates.forEach(function(c) {
    var k = c.keyword;
    if (!k) return;
    if (!best[k] || c.score > best[k].score) {
      best[k] = { keyword: k, score: c.score, source: c.source };
    }
  });

  var ranked = Object.keys(best).map(function(k) { return best[k]; });
  // Sort by score descending
  ranked.sort(function(a, b) { return b.score - a.score; });
  // Take top 15
  var top = ranked.slice(0, 15);
  return top.map(function(t) { return t.keyword; });
}

function buildSemanticKeywordsForItem_(item, context) {
  var candidates = collectKeywordCandidatesFromContext_(item, context || {});
  var keywords = rankAndFilterKeywords_(candidates);
  return keywords.length ? keywords : ["uncategorized"];
}

function ensureKeywordsForItem_(item, context) {
  var existingTags = parseSemanticList_(pickFirstDefined_(item.semantic_tags, item.semanticTags));
  if (existingTags.length) return existingTags;
  return buildSemanticKeywordsForItem_(item, context);
}

function buildKeywordGenerationContext_() {
  var context = {};
  try { context.allPosts = getPosts(true); } catch (_) {}
  try { context.allInspo = getInspo(true); } catch (_) {}
  try { context.allNotes = getNotes(); } catch (_) {}
  try { context.allDrafts = getAIDrafts ? getAIDrafts() : []; } catch (_) {}
  try { context.campaigns = getCampaigns(); } catch (_) {}
  return context;
}

function maybeAutoGenerateKeywords_(normalized, payload, existing) {
  // Check if existing has non-empty semantic_tags (no-overwrite)
  var existingTags = parseSemanticList_(pickFirstDefined_(existing && (existing.semantic_tags || existing.semanticTags), ""));
  var forceRegenerate = payload && (payload.forceRegenerateKeywords === true || payload.forceRegenerateKeywords === "true");
  if (existingTags.length > 0 && !forceRegenerate) return;

  // Check if payload explicitly provides tags (respect manual input)
  var payloadTags = parseSemanticList_(pickFirstDefined_(payload && (payload.semanticTags || payload.semantic_tags), ""));
  if (payloadTags.length > 0) return;

  // When forceRegenerate, skip the current-tags check since applySemanticFieldsToRow_ already set them
  if (!forceRegenerate) {
    var currentTags = parseSemanticList_(pickFirstDefined_(normalized.semantic_tags, ""));
    if (currentTags.length > 0) return;
  }

  var context = buildKeywordGenerationContext_();
  var keywords = buildSemanticKeywordsForItem_(Object.assign({}, existing || {}, normalized), context);
  if (keywords.length) {
    normalized.semantic_tags = stringifySemanticList_(keywords);
  }
}

function extractSemanticTokens_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/#-]+/g, " ")
    .split(/\s+/)
    .map(function(token) { return String(token || "").trim(); })
    .filter(function(token) {
      return token && token.length > 2 && ["the", "and", "for", "with", "from", "that", "this", "into", "your", "about"].indexOf(token) === -1;
    })
    .filter(function(token, index, list) {
      return list.indexOf(token) === index;
    });
}

function buildSemanticRecord_(type, item) {
  var id = String(
    item.postId || item.noteId || item.inspoId || item.campaignId || item.aiDraftId || item.assetId || item.id || ""
  ).trim();
  var title = String(item.title || item.campaignName || item.assetName || "").trim();
  var text = [
    title,
    item.description,
    item.body,
    item.summary,
    item.notes,
    item.prompt,
    item.draftText,
    item.hookText,
    item.ctaText,
    item.semanticSummary
  ].join(" ");
  var tags = parseSemanticList_(item.semanticTags).concat(extractSemanticTokens_(text)).filter(function(token, index, list) {
    return token && list.indexOf(token) === index;
  });
  return {
    id: id,
    type: type,
    title: title,
    campaignId: String(item.campaignId || "").trim(),
    campaignName: String(item.campaignName || item.campaign || title).trim(),
    platform: String(item.platform || item.suggestedPlatform || item.sourcePlatform || "").trim(),
    tags: tags,
    semanticSummary: String(item.semanticSummary || "").trim(),
    recurringPatternFlags: parseSemanticList_(item.recurringPatternFlags),
    createdAt: String(item.createdAt || item.updatedAt || "").trim()
  };
}

function semanticSimilarity_(a, b) {
  var aTags = a.tags || [];
  var bTags = b.tags || [];
  if (!aTags.length || !bTags.length) return 0;
  var overlap = aTags.filter(function(tag) { return bTags.indexOf(tag) !== -1; }).length;
  var union = aTags.concat(bTags).filter(function(tag, index, list) { return list.indexOf(tag) === index; }).length || 1;
  var sharedCampaign = a.campaignId && b.campaignId && a.campaignId === b.campaignId ? 0.18 : 0;
  var sharedPlatform = a.platform && b.platform && a.platform === b.platform ? 0.08 : 0;
  return (overlap / union) + sharedCampaign + sharedPlatform;
}

function inferSemanticRelationships(records) {
  var relations = [];
  (records || []).forEach(function(record, index) {
    for (var i = index + 1; i < records.length; i += 1) {
      var other = records[i];
      var score = semanticSimilarity_(record, other);
      if (score < 0.22) continue;
      var relationshipType = score > 0.58
        ? "repeated_pattern"
        : record.campaignId && record.campaignId === other.campaignId
        ? "continues"
        : record.platform && record.platform === other.platform
        ? "repeated_platform_signal"
        : "semantic_neighbor";
      relations.push({
        fromId: record.id,
        fromType: record.type,
        toId: other.id,
        toType: other.type,
        relationshipType: relationshipType,
        strength: Number(score.toFixed(3))
      });
    }
  });
  return relations.sort(function(a, b) { return b.strength - a.strength; });
}

function getSemanticNeighbors(targetId, targetType, limit) {
  var records = buildSemanticRecordSet_();
  var relations = inferSemanticRelationships(records);
  var capped = Number(limit || 5) || 5;
  return relations.filter(function(relation) {
    return (relation.fromId === targetId && relation.fromType === targetType) || (relation.toId === targetId && relation.toType === targetType);
  }).slice(0, capped);
}

function detectRecurringPatterns(records) {
  var patternMap = {};
  (records || []).forEach(function(record) {
    var key = (record.tags || []).slice(0, 3).join(" / ");
    if (!key) return;
    patternMap[key] = (patternMap[key] || 0) + 1;
  });
  return Object.keys(patternMap).map(function(key) {
    return { pattern: key, count: patternMap[key] };
  }).filter(function(item) { return item.count > 1; }).sort(function(a, b) { return b.count - a.count; });
}

function detectOverusedPatterns(records) {
  return detectRecurringPatterns(records).filter(function(item) { return item.count >= 3; });
}

function detectCampaignClusters(records) {
  var campaigns = {};
  (records || []).forEach(function(record) {
    var key = record.campaignId || record.campaignName;
    if (!key) return;
    campaigns[key] = campaigns[key] || { campaignKey: key, tags: [], count: 0 };
    campaigns[key].count += 1;
    campaigns[key].tags = campaigns[key].tags.concat(record.tags || []);
  });
  return Object.keys(campaigns).map(function(key) {
    var item = campaigns[key];
    item.tags = item.tags.filter(function(tag, index, list) { return list.indexOf(tag) === index; });
    return item;
  });
}

function detectPlatformClassificationSignals(records) {
  var platformMap = {};
  (records || []).forEach(function(record) {
    if (!record.platform) return;
    platformMap[record.platform] = platformMap[record.platform] || {};
    (record.tags || []).forEach(function(tag) {
      platformMap[record.platform][tag] = (platformMap[record.platform][tag] || 0) + 1;
    });
  });
  return Object.keys(platformMap).map(function(platform) {
    var tags = Object.keys(platformMap[platform]).sort(function(a, b) { return platformMap[platform][b] - platformMap[platform][a]; }).slice(0, 5);
    return { platform: platform, tags: tags, weak: tags.length < 2 };
  });
}

function detectSemanticDrift(records) {
  var dated = (records || []).filter(function(record) { return record.createdAt; });
  if (dated.length < 4) return [];
  var midpoint = Math.floor(dated.length / 2);
  var older = dated.slice(0, midpoint);
  var newer = dated.slice(midpoint);
  var olderTags = older.reduce(function(acc, record) { return acc.concat(record.tags || []); }, []);
  var newerTags = newer.reduce(function(acc, record) { return acc.concat(record.tags || []); }, []);
  var overlap = olderTags.filter(function(tag) { return newerTags.indexOf(tag) !== -1; }).length;
  return overlap < Math.max(2, Math.floor(newerTags.length * 0.12))
    ? [{ issue: "semantic drift over time", overlap: overlap }]
    : [];
}

function calculateSemanticNovelty(record, records) {
  var scores = (records || []).filter(function(item) { return item.id !== record.id; }).map(function(item) { return semanticSimilarity_(record, item); });
  var strongest = scores.length ? Math.max.apply(null, scores) : 0;
  return Number((1 - Math.min(strongest, 1)).toFixed(3));
}

function calculateSemanticDensity(record) {
  return Number((((record.tags || []).length + (record.recurringPatternFlags || []).length) / 10).toFixed(3));
}

function buildSemanticConstellation(records) {
  var clusters = detectCampaignClusters(records);
  var bridges = [];
  for (var i = 0; i < clusters.length; i += 1) {
    for (var j = i + 1; j < clusters.length; j += 1) {
      var a = { tags: clusters[i].tags, campaignId: clusters[i].campaignKey };
      var b = { tags: clusters[j].tags, campaignId: clusters[j].campaignKey };
      var strength = semanticSimilarity_(a, b);
      if (strength >= 0.18) {
        bridges.push({ fromCampaign: clusters[i].campaignKey, toCampaign: clusters[j].campaignKey, strength: Number(strength.toFixed(3)) });
      }
    }
  }
  return { clusters: clusters, bridges: bridges };
}

function buildSemanticRecordSet_() {
  return []
    .concat(getPosts().map(function(item) { return buildSemanticRecord_("post", item); }))
    .concat(getNotes().map(function(item) { return buildSemanticRecord_("note", item); }))
    .concat(getInspo().map(function(item) { return buildSemanticRecord_("inspo", item); }))
    .concat(getCampaigns().map(function(item) { return buildSemanticRecord_("campaign", item); }))
    .concat(getAIDrafts().map(function(item) { return buildSemanticRecord_("ai_draft", item); }))
    .concat(getMedia().map(function(item) { return buildSemanticRecord_("media", item); }))
    .filter(function(record) { return record.id && (record.title || (record.tags || []).length); });
}

function getSemanticMemory(payload) {
  var records = buildSemanticRecordSet_();
  var relationships = inferSemanticRelationships(records);
  var targetId = String(payload && (payload.id || payload.targetId) || "").trim();
  var targetType = String(payload && (payload.type || payload.targetType) || "").trim();
  return {
    embeddingVersion: "heuristic-overlap-v1",
    recordsCount: records.length,
    relationships: relationships.slice(0, 120),
    recurringPatterns: detectRecurringPatterns(records),
    overusedPatterns: detectOverusedPatterns(records),
    campaignClusters: detectCampaignClusters(records),
    platformSignals: detectPlatformClassificationSignals(records),
    semanticDrift: detectSemanticDrift(records),
    constellation: buildSemanticConstellation(records),
    neighbors: targetId && targetType ? getSemanticNeighbors(targetId, targetType, 8) : []
  };
}

function buildDateDiagnostics_(scheduledAt, scheduledDateKey) {
  var queueDateLabel = arguments.length > 2 ? arguments[2] : "";
  var queueTimeLabel = arguments.length > 3 ? arguments[3] : "";
  var selectedTime = arguments.length > 4 ? !!arguments[4] : !!String(queueTimeLabel || "").trim();
  if (!scheduledAt && !queueDateLabel) return [];
  const diagnostics = [];
  const normalized = normalizeDateTime_(scheduledAt);
  const queueDateNormalized = normalizeQueueDateLabel(queueDateLabel);
  var queueDateKey = parseDisplayDateKey_(queueDateNormalized);
  var scheduledPlanningKey = getPlanningDateKeyFromValue_(scheduledAt || normalized);
  var parsedScheduled = parseSheetDate_(normalized);

  if (queueDateLabel && !queueDateNormalized) {
    diagnostics.push({ severity: "error", code: "invalid_queue_date_label", message: "queue_date_label is invalid." });
  }
  if (scheduledAt && !normalized) {
    diagnostics.push({ severity: "error", code: "invalid_scheduled_at", message: "scheduled_at is invalid." });
  }
  if (scheduledPlanningKey && scheduledDateKey && scheduledPlanningKey !== scheduledDateKey) {
    diagnostics.push({ severity: "warning", code: "scheduled_date_key_mismatch", message: "Scheduled timestamp date differs from stored calendar date key." });
  }
  if (queueDateKey && scheduledPlanningKey && scheduledPlanningKey !== queueDateKey) {
    diagnostics.push({ severity: "warning", code: "queue_vs_scheduled_mismatch", message: "queue_date_label differs from scheduled_at. Calendar uses queue_date_label first." });
  }
  if (queueDateKey && !normalized) {
    diagnostics.push({ severity: "error", code: "date_without_scheduled_at", message: "Date exists but scheduled_at is missing." });
  }
  if (!queueDateKey && normalized) {
    diagnostics.push({ severity: "warning", code: "scheduled_without_queue_date", message: "scheduled_at exists but queue_date_label is missing." });
  }
  if (normalized && parsedScheduled && !isNaN(parsedScheduled)) {
    var normalizedTime = Utilities.formatDate(parsedScheduled, Session.getScriptTimeZone(), "h:mm a");
    if (!selectedTime && normalizedTime === "9:15 AM") {
      diagnostics.push({ severity: "warning", code: "default_internal_time", message: "No user-selected time. Default internal time 9:15 AM is in scheduled_at." });
    }
  }
  if (queueDateLabel && /(GMT|UTC|[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{2}\s\d{4})/.test(String(queueDateLabel))) {
    diagnostics.push({ severity: "error", code: "queue_date_label_gmt_string", message: "queue_date_label contains a GMT/stringified date value." });
  }
  return diagnostics;
}

function comparePostRowShape(post) {
  var required = [
    "postId",
    "title",
    "platform",
    "postType",
    "scheduledAt",
    "queueDateLabel",
    "queueTimeLabel",
    "calendarMonth",
    "calendarYear",
    "calendarDay",
    "status",
    "publishStatus",
    "campaignId",
    "campaignName"
  ];
  return {
    postId: String(post && post.postId || "").trim(),
    missingKeys: required.filter(function(key) {
      return post[key] === undefined || post[key] === null;
    })
  };
}

function getDateKeyDeltaDays_(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  var fromDate = parseLocalDateTime_(fromKey + "T00:00");
  var toDate = parseLocalDateTime_(toKey + "T00:00");
  if (!fromDate || !toDate) return 0;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function buildDateRepairPreview_(rows) {
  var previewRows = [];
  var deltaCounts = {};
  rows.forEach(function(row) {
    var postId = String(pickFirstDefined_(row.post_id, row.postId)).trim();
    if (!postId) return;
    var rawScheduledAt = pickFirstDefined_(row.scheduled_at, row.scheduledAt, row.date);
    var scheduledAt = String(rawScheduledAt || "").trim();
    var workflow = normalizePostScheduleForWorkflow_(row);
    var proposedDateKey = workflow.dateKey;
    var currentStoredDateKey = getStoredCalendarDateKey_(row) || parseDisplayDateKey_(pickFirstDefined_(row.queue_date_label, row.queueDateLabel, row.scheduledDateKey, ""));
    var currentVisibleDateKey = getPostPlanningDateKey(row);
    var proposedQueueDateLabel = proposedDateKey ? normalizeQueueDateLabel(proposedDateKey) : "";
    if (currentVisibleDateKey && proposedDateKey) {
      var delta = getDateKeyDeltaDays_(proposedDateKey, currentVisibleDateKey);
      if (delta) deltaCounts[delta] = (deltaCounts[delta] || 0) + 1;
    }
    previewRows.push({
      postId: postId,
      title: String(row.title || "").trim(),
      scheduledAt: scheduledAt,
      currentStoredDateKey: currentStoredDateKey,
      currentVisibleDateKey: currentVisibleDateKey,
      proposedDateKey: proposedDateKey,
      proposedQueueDateLabel: proposedQueueDateLabel,
      queueDateLabel: String(pickFirstDefined_(row.queue_date_label, row.queueDateLabel, "")).trim(),
      workflowBucket: workflow.workflowBucket,
      isScheduledValid: workflow.isScheduledValid
    });
  });
  var dominantShiftEntry = Object.keys(deltaCounts).sort(function(a, b) { return Number(deltaCounts[b]) - Number(deltaCounts[a]); })[0] || "";
  var dominantShift = Number(dominantShiftEntry || 0);
  var dominantShiftCount = dominantShift ? Number(deltaCounts[dominantShiftEntry] || 0) : 0;
  var systematicShiftDetected = Math.abs(dominantShift) === 1 && dominantShiftCount >= Math.max(2, Math.ceil(previewRows.length * 0.5));
  var safeToRepair = previewRows.length > 0 && previewRows.every(function(item) {
    if (!item.isScheduledValid) return true;
    return item.proposedDateKey
      && item.proposedDateKey === getPlanningDateKeyFromValue_(item.scheduledAt)
      && (!item.currentVisibleDateKey || item.proposedDateKey === item.currentVisibleDateKey);
  }) && !systematicShiftDetected;
  return {
    rows: previewRows,
    systematicShiftDetected: systematicShiftDetected,
    dominantShiftDays: dominantShift,
    safeToRepair: safeToRepair,
    message: systematicShiftDetected
      ? "Repair disabled: frontend date parser is not trusted yet."
      : safeToRepair
      ? "Repair preview verified against scheduled_at and visible calendar keys."
      : "Repair disabled until proposed date keys match both scheduled_at and the visible calendar cell, except unscheduled drafts and invalid schedules which can be cleared safely."
  };
}

function repairDateFields(payload) {
  var sheet = getPostsSheet_();
  requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  var rows = getPostsData_().map(normalizePostSchemaAliases_);
  var preview = buildDateRepairPreview_(rows);
  if (!(payload && payload.apply)) {
    return Object.assign({ ok: true, repairedCount: 0, repairedRows: [] }, preview);
  }
  if (!preview.safeToRepair) {
    return Object.assign({ ok: false, repairedCount: 0, repairedRows: [] }, preview);
  }
  var repaired = [];
  rows.forEach(function(row) {
    var existingId = String(pickFirstDefined_(row.post_id, row.postId)).trim();
    if (!existingId) return;
    var workflow = normalizePostScheduleForWorkflow_(row);
    var scheduledAt = workflow.scheduledAt;
    var proposedDateKey = workflow.dateKey;
    var proposedQueueDateLabel = workflow.queueDateLabel;
    var queueTimeLabel = workflow.queueTimeLabel;
    var parts = getPlanningCalendarParts_(proposedQueueDateLabel, scheduledAt);
    var changed = false;
    [
      ["scheduled_at", scheduledAt],
      ["status", workflow.status],
      ["queue_date_label", proposedQueueDateLabel],
      ["queue_time_label", queueTimeLabel],
      ["calendar_month", proposedDateKey ? parts.calendarMonth : ""],
      ["calendar_year", proposedDateKey ? parts.calendarYear : ""],
      ["calendar_day", proposedDateKey ? parts.calendarDay : ""]
    ].forEach(function(entry) {
      var key = entry[0];
      var nextValue = entry[1];
      if (String(row[key] || "").trim() !== String(nextValue || "").trim()) {
        row[key] = nextValue;
        changed = true;
      }
    });
    if (!changed) return;
    row.updated_at = new Date().toISOString();
    row.publish_date = proposedQueueDateLabel;
    row.publish_time = queueTimeLabel;
    upsertPostObjectById_(sheet, row);
    repaired.push({
      postId: existingId,
      queueDateLabel: proposedQueueDateLabel,
      queueTimeLabel: queueTimeLabel,
      scheduledAt: scheduledAt,
      workflowBucket: workflow.workflowBucket
    });
  });
  return Object.assign({
    ok: true,
    repairedCount: repaired.length,
    repairedRows: repaired
  }, preview);
}

function cleanupImportedLinkedInPosts(payload) {
  return rewriteImportedLinkedInRows(payload);
}

function rewriteImportedLinkedInRows(payload) {
  payload = payload || {};
  var dryRun = payload.dryRun !== false;
  var createBackup = payload.createBackup !== false;
  var startRow = Math.max(2, Number(payload.startRow || 1006) || 1006);
  var endRowRaw = payload.endRow;
  var endRow = endRowRaw == null || String(endRowRaw).trim() === ""
    ? ""
    : Math.max(startRow, Number(endRowRaw) || startRow);
  var sheet = getPostsSheet_();
  requireHeaders_(sheet, REQUIRED_POST_HEADERS);
  var values = sheet.getDataRange().getValues();
  var headers = (values[0] || []).map(function(value) { return String(value || "").trim(); });
  var lastRow = values.length;
  var effectiveEndRow = endRow ? Math.min(endRow, lastRow) : lastRow;
  var report = {
    ok: true,
    action: "rewriteImportedLinkedInRows",
    backendVersion: APP_BACKEND_VERSION,
    dryRun: dryRun,
    createBackup: createBackup,
    startRow: startRow,
    endRow: endRow || "",
    backupWouldBeCreated: false,
    backupSheetName: "",
    scannedRows: 0,
    candidateRows: 0,
    affectedRows: 0,
    changedCells: 0,
    recoveredDates: 0,
    labelOnlyDates: 0,
    missingDates: 0,
    regeneratedTitles: 0,
    repostsDetected: 0,
    resharesDetected: 0,
    originalsDetected: 0,
    duplicatesDetected: 0,
    noRowsReasons: [],
    routeDiagnostics: testRewriteImportedLinkedInRowsRoute(),
    errors: [],
    sampleBeforeAfter: []
  };
  if (values.length < 2) return report;
  var rewriteHeadersRequired = ["title", "description", "platform", "source_type", "imported_at", "notes", "source_metadata"];
  var missingRewriteHeaders = rewriteHeadersRequired.filter(function(header) {
    return headers.indexOf(header) === -1;
  });
  if (missingRewriteHeaders.length) {
    report.noRowsReasons.push("Headers missing: " + missingRewriteHeaders.join(", "));
  }
  var rewritePlans = [];
  var duplicatesByRow = buildImportedLinkedInRewriteDuplicateMap_(values, headers, startRow, effectiveEndRow);
  for (var rowIndex = startRow; rowIndex <= effectiveEndRow; rowIndex += 1) {
    report.scannedRows += 1;
    var rowValues = values[rowIndex - 1];
    var rowObject = rowValuesToObject_(headers, rowValues);
    if (!isImportedLinkedInRewriteCandidate_(rowObject, rowIndex)) continue;
    report.candidateRows += 1;
    try {
      var plan = buildImportedLinkedInRewritePlan_(rowObject, rowValues, headers, rowIndex, duplicatesByRow[rowIndex] || null);
      if (!plan) continue;
      rewritePlans.push(plan);
      if (plan.changed) {
        report.affectedRows += 1;
        report.changedCells += plan.changedCells.length;
      }
      if (plan.dateState === "recovered") report.recoveredDates += 1;
      else if (plan.dateState === "label_only") report.labelOnlyDates += 1;
      else report.missingDates += 1;
      if (plan.regeneratedTitle) report.regeneratedTitles += 1;
      if (plan.postKind === "repost") report.repostsDetected += 1;
      if (plan.postKind === "reshare") report.resharesDetected += 1;
      if (plan.postKind === "original") report.originalsDetected += 1;
      if (plan.duplicateReason) report.duplicatesDetected += 1;
      if (report.sampleBeforeAfter.length < 8) {
        report.sampleBeforeAfter.push({
          row: rowIndex,
          before: plan.before,
          after: plan.after,
          duplicateReason: plan.duplicateReason || "",
          changedFields: plan.changedFields
        });
      }
    } catch (err) {
      report.errors.push({
        row: rowIndex,
        title: String(rowObject.title || "").trim(),
        error: sanitizeErrorMessage_(err && err.message || err || "Rewrite failed")
      });
    }
  }
  if (!report.candidateRows && !report.affectedRows) {
    report.noRowsReasons = buildLinkedInRewriteNoRowsReasons_(values, headers, startRow, effectiveEndRow, report.noRowsReasons);
  }
  report.backupWouldBeCreated = createBackup && report.affectedRows > 0;
  if (!dryRun && rewritePlans.length) {
    if (createBackup && report.affectedRows > 0) {
      report.backupSheetName = createImportedLinkedInRewriteBackupSheet_(sheet, headers, rewritePlans);
    }
    rewritePlans.forEach(function(plan) {
      if (!plan.changed) return;
      applyImportedLinkedInRewritePlan_(sheet, headers, plan);
    });
  }
  return report;
}

function buildLinkedInRewriteNoRowsReasons_(values, headers, startRow, effectiveEndRow, existingReasons) {
  var reasons = Array.isArray(existingReasons) ? existingReasons.slice() : [];
  var lastRow = values.length;
  if (startRow > lastRow) {
    reasons.push("Start row " + startRow + " is beyond the last populated row " + lastRow + ".");
    return reasons;
  }
  var linkedInSignalFound = false;
  var importedAtFound = false;
  for (var rowIndex = startRow; rowIndex <= effectiveEndRow; rowIndex += 1) {
    var row = rowValuesToObject_(headers, values[rowIndex - 1]);
    var platform = String(row.platform || "").trim().toLowerCase();
    var sourceType = String(row.source_type || "").trim().toLowerCase();
    var sourceUrl = String(row.source_url || row.published_url || "").trim().toLowerCase();
    var metadata = parseJsonSafe_(row.source_metadata) || {};
    var metadataString = normalizeMetadataString_(metadata).toLowerCase();
    if (platform === "linkedin" || sourceType.indexOf("linkedin") !== -1 || sourceUrl.indexOf("linkedin.com") !== -1 || metadataString.indexOf("linkedin") !== -1) {
      linkedInSignalFound = true;
    }
    if (String(row.imported_at || "").trim()) importedAtFound = true;
  }
  if (!linkedInSignalFound) reasons.push("No LinkedIn source_type/platform/source_url rows were found in the selected range.");
  if (!importedAtFound) reasons.push("No imported_at rows were found in the selected range.");
  if (!reasons.length) reasons.push("No imported LinkedIn rows matched the selected range.");
  return reasons;
}

function isImportedLinkedInRewriteCandidate_(row, rowIndex) {
  row = row || {};
  var platform = String(row.platform || "").trim().toLowerCase();
  var sourceType = String(row.source_type || "").trim().toLowerCase();
  var importedAt = String(row.imported_at || "").trim();
  return platform === "linkedin" || sourceType.indexOf("linkedin") !== -1 || (!!importedAt && rowIndex >= 2);
}

function rowValuesToObject_(headers, rowValues) {
  var obj = {};
  (headers || []).forEach(function(header, index) {
    if (!header) return;
    obj[header] = rowValues[index];
  });
  return obj;
}

function objectToRowValues_(headers, rowObject) {
  return (headers || []).map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : "";
  });
}

function normalizeLinkedInCleanupText_(value) {
  return cleanLinkedInImportText_(String(value || "").replace(/\u00a0/g, " "))
    .split("\n")
    .map(function(line) { return line.replace(/\s+/g, " ").trim(); })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildImportedLinkedInRewritePlan_(row, originalRowValues, headers, rowIndex, duplicateInfo) {
  row = row || {};
  var metadata = parseJsonSafe_(row.source_metadata) || {};
  var extracted = extractLinkedInSourceLabels_({
    title: pickFirstDefined_(row.title, metadata.title, ""),
    description: pickFirstDefined_(row.description, metadata.description, metadata.original_post_excerpt, metadata.raw_text_excerpt, ""),
    notes: pickFirstDefined_(row.notes, "")
  });
  var rawText = normalizeLinkedInCleanupText_(pickFirstDefined_(metadata.raw_text_excerpt, metadata.rawText, extracted.description, extracted.notes, ""));
  var cleanedDescription = normalizeLinkedInCleanupText_(pickFirstDefined_(extracted.description, metadata.description, metadata.original_post_excerpt, rawText, ""));
  var sourceUrl = normalizeCapturedSourceUrl_(pickFirstDefined_(row.source_url, metadata.source_url, row.published_url));
  var importedAt = String(pickFirstDefined_(row.imported_at, metadata.imported_at, "")).trim();
  var item = {
    title: extracted.title || pickFirstDefined_(metadata.title, ""),
    description: cleanedDescription,
    text: cleanedDescription || rawText,
    rawText: rawText,
    sourceUrl: sourceUrl,
    sourcePageUrl: pickFirstDefined_(metadata.source_url, row.source_url, row.published_url, ""),
    platform: pickFirstDefined_(row.platform, row.source_platform, metadata.platform, "linkedin"),
    sourceType: pickFirstDefined_(row.source_type, metadata.source_label, metadata.source_type, "linkedin_browser_capture"),
    originalPostDate: pickFirstDefined_(row.original_post_date, metadata.original_post_date, metadata.timestamp, ""),
    originalPostDateLabel: pickFirstDefined_(row.original_post_date_label, metadata.date_label, metadata.original_post_date_label, row.queue_date_label, ""),
    dateLabel: pickFirstDefined_(metadata.date_label, metadata.original_post_date_label, row.original_post_date_label, ""),
    timestamp: pickFirstDefined_(metadata.timestamp, metadata.published_at, metadata.publishedAt, ""),
    generatedAt: pickFirstDefined_(metadata.generated_at, importedAt, ""),
    importedAt: importedAt,
    postType: pickFirstDefined_(row.post_type, metadata.post_type, ""),
    linkedinPostId: pickFirstDefined_(row.linkedin_post_id, row.api_post_id, metadata.linkedin_post_id, metadata.api_post_id, ""),
    impressions: pickFirstDefined_(row.impressions, metadata.impression_count, ""),
    likes: pickFirstDefined_(row.likes, metadata.reaction_count, ""),
    comments: pickFirstDefined_(row.comments, metadata.comment_count, ""),
    shares: pickFirstDefined_(row.shares, metadata.repost_count, ""),
    notes: extracted.notes
  };
  var normalized = normalizeCapturedImportItem_(item, { pillar: row.pillar || "authority" });
  var sourceLabels = mergeUniqueCaseInsensitive_(extracted.sourceLabels, normalizeListField_(pickFirstDefined_(metadata.source_label, metadata.source_labels, metadata.source_type, "")));
  var sourceLabel = sourceLabels[0] || String(pickFirstDefined_(metadata.source_label, metadata.source_type, row.source_type)).trim();
  var regeneratedTitle = false;
  var titleCandidate = normalizeLinkedInCleanupTitle_(pickFirstDefined_(extracted.title, normalized.title, ""), normalized.description || cleanedDescription || rawText);
  if (!titleCandidate || /^source\s*:/i.test(titleCandidate)) {
    titleCandidate = deriveLinkedInCleanupTitle_(normalized.description || cleanedDescription || rawText || normalized.originalPostExcerpt || "");
    regeneratedTitle = !!titleCandidate;
  }
  if (!titleCandidate) titleCandidate = deriveLinkedInCleanupTitle_(normalized.title || "");
  var dateDetails = resolveImportedLinkedInCleanupDate_(row, metadata, normalized, rawText, importedAt);
  var postType = normalized.postType || inferCapturedImportPostType_(item) || "unknown";
  var postKind = postType === "repost" ? "repost" : postType === "reshare" ? "reshare" : "original";
  var normalizedHash = computeTextHash_(pickFirstDefined_(normalized.description, cleanedDescription, titleCandidate, sourceUrl));
  var notes = normalizeLinkedInCleanupNotes_(extracted.notes, sourceLabels, duplicateInfo, postKind);
  var sourceMetadata = Object.assign({}, metadata, {
    source_type: "linkedin_browser_capture",
    source_label: sourceLabel || String(metadata.source_label || "").trim(),
    source_labels: sourceLabels,
    source_url: String(pickFirstDefined_(metadata.source_url, sourceUrl)).trim(),
    date_label: dateDetails.originalPostDateLabel || String(metadata.date_label || "").trim(),
    date_confidence: dateDetails.confidence,
    raw_text_excerpt: rawText ? rawText.slice(0, 1200) : "",
    original_post_excerpt: normalizeLinkedInCleanupText_(normalized.originalPostExcerpt || cleanedDescription).slice(0, 240),
    repost_author: String(normalized.repostAuthor || "").trim(),
    original_author: String(normalized.originalAuthor || "").trim(),
    post_kind: postKind
  });
  var updated = Object.assign({}, row);
  var changedCells = [];
  var changedFields = [];
  function assignField(key, value) {
    if (LINKEDIN_REWRITE_PROTECTED_HEADERS[key]) return;
    if (isPostFormulaHeader_(key)) return;
    var nextValue = value == null ? "" : value;
    if (String(updated[key] || "") !== String(nextValue || "")) {
      updated[key] = nextValue;
      changedFields.push(key);
      var columnIndex = headers.indexOf(key);
      if (columnIndex !== -1) {
        changedCells.push({
          columnIndex: columnIndex + 1,
          value: nextValue
        });
      }
    }
  }
  assignField("platform", "linkedin");
  assignField("source_platform", "linkedin");
  assignField("source_type", String(normalized.sourceType || row.source_type || "linkedin_browser_capture").trim() || "linkedin_browser_capture");
  assignField("published_url", sourceUrl || String(row.published_url || "").trim());
  assignField("title", titleCandidate || "Imported LinkedIn Post");
  assignField("source_title", normalizeLinkedInCleanupText_(pickFirstDefined_(row.source_title, extracted.title, metadata.title, titleCandidate, "")));
  assignField("description", normalizeLinkedInCleanupText_(normalized.description || cleanedDescription || rawText));
  assignField("normalized_text_hash", normalizedHash);
  assignField("linkedin_post_id", String(normalized.linkedinPostId || row.linkedin_post_id || "").trim());
  assignField("api_post_id", String(pickFirstDefined_(row.api_post_id, normalized.linkedinPostId, "")).trim());
  assignField("original_post_date", dateDetails.originalPostDate);
  assignField("original_post_date_label", dateDetails.originalPostDateLabel);
  assignField("date_confidence", dateDetails.confidence);
  assignField("publish_date", dateDetails.queueDateLabel || dateDetails.originalPostDate || "");
  assignField("publish_time", "");
  assignField("queue_date_label", dateDetails.queueDateLabel);
  assignField("format", postType);
  assignField("post_type", postType);
  assignField("is_repost", normalized.isRepost ? true : false);
  assignField("repost_author", String(normalized.repostAuthor || "").trim());
  assignField("repost_commentary", normalizeLinkedInCleanupText_(normalized.repostCommentary || ""));
  assignField("original_author", String(normalized.originalAuthor || "").trim());
  assignField("original_post_excerpt", normalizeLinkedInCleanupText_(normalized.originalPostExcerpt || "").slice(0, 240));
  assignField("notes", notes);
  assignField("source_metadata", JSON.stringify(sourceMetadata));
  if (duplicateInfo && duplicateInfo.reason) {
    assignField("source_import_status", "duplicate_import");
    assignField("requires_manual_review", true);
  } else {
    assignField("source_import_status", String(row.source_import_status || normalized.sourceImportStatus || "").trim());
  }
  assignField("updated_at", new Date().toISOString());
  return {
    row: rowIndex,
    originalRowValues: originalRowValues.slice(),
    before: {
      title: String(row.title || "").trim(),
      description: String(row.description || "").trim().slice(0, 280),
      notes: String(row.notes || "").trim().slice(0, 220),
      original_post_date: String(row.original_post_date || "").trim(),
      original_post_date_label: String(row.original_post_date_label || "").trim(),
      date_confidence: String(row.date_confidence || "").trim(),
      post_type: String(row.post_type || "").trim(),
      source_import_status: String(row.source_import_status || "").trim()
    },
    after: {
      title: String(updated.title || "").trim(),
      description: String(updated.description || "").trim().slice(0, 280),
      notes: String(updated.notes || "").trim().slice(0, 220),
      original_post_date: String(updated.original_post_date || "").trim(),
      original_post_date_label: String(updated.original_post_date_label || "").trim(),
      date_confidence: String(updated.date_confidence || "").trim(),
      post_type: String(updated.post_type || "").trim(),
      source_import_status: String(updated.source_import_status || "").trim()
    },
    updatedRow: updated,
    changedCells: changedCells,
    changed: changedFields.length > 0,
    changedFields: changedFields,
    regeneratedTitle: regeneratedTitle,
    dateState: dateDetails.confidence === "exact" || dateDetails.confidence === "relative" ? "recovered" : dateDetails.confidence === "label_only" ? "label_only" : "missing",
    postKind: postKind,
    duplicateReason: duplicateInfo && duplicateInfo.reason || ""
  };
}

function normalizeLinkedInCleanupTitle_(title, fallbackText) {
  var cleaned = normalizeLinkedInCleanupText_(title).replace(/^source\s*:\s*/i, "").trim();
  if (!cleaned || /^linkedin$/i.test(cleaned) || /^source$/i.test(cleaned)) cleaned = "";
  if (!cleaned && fallbackText) cleaned = deriveLinkedInCleanupTitle_(fallbackText);
  return cleaned.slice(0, 140);
}

function deriveLinkedInCleanupTitle_(text) {
  var cleaned = normalizeLinkedInCleanupText_(text);
  if (!cleaned) return "";
  var firstMeaningful = cleaned
    .split(/\n+/)
    .map(function(line) { return line.replace(/^source\s*:\s*/i, "").trim(); })
    .filter(function(line) { return line && !/^linkedin$/i.test(line) && !/^source$/i.test(line); })[0] || "";
  if (!firstMeaningful) return "";
  var sentence = firstMeaningful.split(/(?<=[.!?])\s+/)[0] || firstMeaningful;
  return sentence.trim().slice(0, 140);
}

function normalizeLinkedInCleanupNotes_(existingNotes, sourceLabels, duplicateInfo, postKind) {
  var parts = normalizeLinkedInCleanupText_(existingNotes).split("\n").filter(Boolean);
  (Array.isArray(sourceLabels) ? sourceLabels : []).forEach(function(sourceLabel) {
    if (!sourceLabel) return;
    if (parts.every(function(line) { return line.toLowerCase() !== ("source label: " + sourceLabel).toLowerCase(); })) {
      parts.push("Source label: " + sourceLabel);
    }
  });
  if (postKind && parts.every(function(line) { return line.toLowerCase() !== ("post kind: " + postKind).toLowerCase(); })) {
    parts.push("Post kind: " + postKind);
  }
  if (duplicateInfo && duplicateInfo.reason) {
    var note = "Duplicate import flagged: " + duplicateInfo.reason;
    if (parts.every(function(line) { return line.toLowerCase() !== note.toLowerCase(); })) parts.push(note);
  }
  return parts.join("\n").trim();
}

function resolveImportedLinkedInCleanupDate_(row, metadata, normalized, rawText, importedAt) {
  var generatedAt = String(pickFirstDefined_(metadata.generated_at, importedAt, row.imported_at, "")).trim();
  var clues = [
    row.original_post_date,
    metadata.timestamp,
    metadata.date_label,
    row.original_post_date_label,
    metadata.original_post_date_label,
    rawText
  ];
  var details = null;
  for (var index = 0; index < clues.length; index += 1) {
    details = parseImportedDateDetails_(clues[index], generatedAt);
    if (details.originalPostDate || details.confidence === "label_only") break;
  }
  if (!details) details = parseImportedDateDetails_("", generatedAt);
  if (!details.originalPostDate && !details.originalPostDateLabel) {
    details.originalPostDateLabel = String(pickFirstDefined_(row.original_post_date_label, metadata.date_label, "")).trim();
  }
  if (details.confidence !== "exact" && details.confidence !== "relative") {
    details.scheduledAt = "";
    details.queueDateLabel = "";
  } else if (details.originalPostDate) {
    details.scheduledAt = details.originalPostDate;
    details.queueDateLabel = normalizeQueueDateLabel(details.originalPostDate);
  }
  return {
    originalPostDate: String(details.originalPostDate || row.original_post_date || "").trim(),
    originalPostDateLabel: String(details.originalPostDateLabel || row.original_post_date_label || "").trim(),
    confidence: String(details.confidence || "missing").trim() || "missing",
    scheduledAt: String(details.scheduledAt || "").trim(),
    queueDateLabel: String(details.queueDateLabel || "").trim()
  };
}

function buildImportedLinkedInRewriteDuplicateMap_(values, headers, startRow, endRow) {
  var bySourceUrl = {};
  var byHash = {};
  var byDatePrefix = {};
  var duplicateMap = {};
  for (var rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    var row = rowValuesToObject_(headers, values[rowIndex - 1]);
    if (!isImportedLinkedInRewriteCandidate_(row, rowIndex)) continue;
    var metadata = parseJsonSafe_(row.source_metadata) || {};
    var cleanedDescription = normalizeLinkedInCleanupText_(pickFirstDefined_(row.description, metadata.description, metadata.original_post_excerpt, metadata.raw_text_excerpt, ""));
    var cleanedTitle = normalizeLinkedInCleanupText_(pickFirstDefined_(row.title, metadata.title, ""));
    var sourceUrl = normalizeCapturedSourceUrl_(pickFirstDefined_(row.source_url, row.published_url));
    var hash = String(row.normalized_text_hash || computeTextHash_(pickFirstDefined_(cleanedDescription, cleanedTitle, sourceUrl))).trim();
    var dateDetails = resolveImportedLinkedInCleanupDate_(row, metadata, {}, cleanedDescription, String(row.imported_at || "").trim());
    var dateKey = String(pickFirstDefined_(dateDetails.originalPostDate, row.original_post_date, row.scheduled_at, row.published_at, "")).slice(0, 10);
    var prefix = normalizeImportComparableText_(pickFirstDefined_(cleanedDescription, cleanedTitle, "")).slice(0, 120);
    var compositeKey = [String(row.platform || "linkedin").trim().toLowerCase(), dateKey, prefix].join("|");
    var reason = "";
    if (sourceUrl && bySourceUrl[sourceUrl]) reason = "source_url matches row " + bySourceUrl[sourceUrl];
    else if (hash && byHash[hash]) reason = "normalized_text_hash matches row " + byHash[hash];
    else if (dateKey && prefix && byDatePrefix[compositeKey]) reason = "platform + date + first120 matches row " + byDatePrefix[compositeKey];
    if (reason) duplicateMap[rowIndex] = { reason: reason };
    else {
      if (sourceUrl) bySourceUrl[sourceUrl] = rowIndex;
      if (hash) byHash[hash] = rowIndex;
      if (dateKey && prefix) byDatePrefix[compositeKey] = rowIndex;
    }
  }
  return duplicateMap;
}

function extractLinkedInSourceLabels_(fields) {
  fields = fields || {};
  var sourceLabels = [];
  function strip(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(function(line) {
        var match = String(line || "").match(/^\s*source\s*:\s*(.+?)\s*$/i);
        if (match && match[1]) {
          sourceLabels.push(String(match[1]).trim());
          return "";
        }
        return line;
      })
      .join("\n");
  }
  return {
    title: normalizeLinkedInCleanupText_(strip(fields.title || "")),
    description: normalizeLinkedInCleanupText_(strip(fields.description || "")),
    notes: normalizeLinkedInCleanupText_(strip(fields.notes || "")),
    sourceLabels: mergeUniqueCaseInsensitive_(sourceLabels)
  };
}

function mergeUniqueCaseInsensitive_(listA, listB) {
  var seen = {};
  return (normalizeListField_(listA).concat(normalizeListField_(listB))).map(function(value) {
    return String(value || "").trim();
  }).filter(function(value) {
    if (!value) return false;
    var key = value.toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function createImportedLinkedInRewriteBackupSheet_(postsSheet, headers, rewritePlans) {
  var ss = getSpreadsheet_();
  var baseName = "LinkedIn Import Backup " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmm");
  var sheetName = baseName;
  var suffix = 2;
  while (ss.getSheetByName(sheetName)) {
    sheetName = baseName + " " + suffix;
    suffix += 1;
  }
  var backupSheet = ss.insertSheet(sheetName);
  var backupValues = [headers.slice()].concat(rewritePlans.filter(function(plan) {
    return plan.changed;
  }).map(function(plan) {
    return plan.originalRowValues.slice();
  }));
  if (backupValues.length) {
    backupSheet.getRange(1, 1, backupValues.length, headers.length).setValues(backupValues);
    backupSheet.setFrozenRows(1);
    backupSheet.autoResizeColumns(1, headers.length);
  }
  return sheetName;
}

function applyImportedLinkedInRewritePlan_(sheet, headers, plan) {
  var rowNumber = Number(plan && plan.row || 0);
  if (!rowNumber || !plan || !Array.isArray(plan.changedCells) || !plan.changedCells.length) return;
  var sortedCells = plan.changedCells.slice().sort(function(a, b) {
    return Number(a.columnIndex || 0) - Number(b.columnIndex || 0);
  });
  var segmentStart = null;
  var segmentValues = [];
  function flushSegment() {
    if (!segmentStart || !segmentValues.length) return;
    sheet.getRange(rowNumber, segmentStart, 1, segmentValues.length).setValues([segmentValues.slice()]);
    segmentStart = null;
    segmentValues = [];
  }
  sortedCells.forEach(function(cell) {
    var columnIndex = Number(cell.columnIndex || 0);
    if (!columnIndex) return;
    if (segmentStart == null) {
      segmentStart = columnIndex;
      segmentValues = [cell.value];
      return;
    }
    if (columnIndex === segmentStart + segmentValues.length) {
      segmentValues.push(cell.value);
      return;
    }
    flushSegment();
    segmentStart = columnIndex;
    segmentValues = [cell.value];
  });
  flushSegment();
}

function buildLinkedInPreparation_(post, assets) {
  var list = Array.isArray(assets) ? assets : [];
  var primary = list[0] || null;
  var primaryMime = String(primary && primary.mimeType || "").trim().toLowerCase();
  var hasDocument = !!primaryMime && (primaryMime === "application/pdf" || /officedocument|msword|presentation|spreadsheet/.test(primaryMime));
  var hasImage = !!primaryMime && primaryMime.indexOf("image/") === 0;
  var mode = !list.length ? "text" : list.length > 1 ? "carousel_experimental" : hasDocument ? "document" : hasImage ? "image" : "media_unsupported";
  var warnings = [];
  if (mode === "document") warnings.push("LinkedIn document publishing depends on the connected account and current app permissions.");
  if (mode === "carousel_experimental") warnings.push("LinkedIn carousel/document-style posting remains future or experimental until API constraints are confirmed.");
  if (mode === "media_unsupported") warnings.push("LinkedIn currently supports text, image, and document preparation here. This asset type needs manual review.");

  var authorUrn = getScriptProp_("LINKEDIN_SELECTED_AUTHOR_URN");
  var hasAuthor = !!authorUrn;

  return {
    platform: "linkedin",
    mode: mode,
    assetCount: list.length,
    primaryAsset: primary ? {
      assetId: primary.assetId,
      fileUrl: primary.fileUrl,
      mimeType: primary.mimeType,
      assetType: primary.assetType,
      title: primary.assetName || primary.title || ""
    } : null,
    authorUrn: authorUrn || "",
    hasAuthorUrn: hasAuthor,
    warnings: warnings,
    payload: {
      author: authorUrn || "",
      commentary: String(post.platformCaptionOverride || post.description || "").trim(),
      visibility: "PUBLIC",
      landingPageUrl: String(post.sourceUrl || "").trim(),
      mediaCategory: mode
    }
  };
}

function buildPlatformAdapterPayload_(post, platform, assets) {
  var normalized = detectSourcePlatform_(platform) || String(platform || "").trim().toLowerCase();
  if (normalized === "linkedin") return buildLinkedInPreparation_(post, assets);
  return {
    platform: normalized,
    mode: "scaffold_only",
    assetCount: Array.isArray(assets) ? assets.length : 0,
    warnings: [String(normalized || "platform").replace(/\b\w/g, function(ch) { return ch.toUpperCase(); }) + " publishing adapter is not implemented yet."],
    payload: {
      commentary: String(post.platformCaptionOverride || post.description || "").trim()
    }
  };
}

function getLinkedInAuthorContextData_() {
  tryAutoRefreshIfNeeded_("linkedin");
  var config = PLATFORM_OAUTH_CONFIG.linkedin;
  var accessToken = getScriptProp_(config.accessTokenKey);
  var personId = getScriptProp_(config.userIdKey);
  var personUrn = toLinkedInPersonUrn_(personId);
  var selectedAuthorUrn = getScriptProp_("LINKEDIN_SELECTED_AUTHOR_URN");
  var cachedOrgs = parseJsonSafe_(getScriptProp_("LINKEDIN_ORG_URNS") || "[]");
  var orgUrns = Array.isArray(cachedOrgs) ? cachedOrgs : [];
  var displayName = getScriptProp_(config.displayNameKey);
  var hasToken = !!accessToken;
  var hasPersonUrn = !!personUrn;
  var hasWMemberSocial = hasToken && config.scopes.indexOf("w_member_social") !== -1;

  return {
    ok: true,
    hasToken: hasToken,
    hasPersonUrn: hasPersonUrn,
    personUrn: personUrn,
    displayName: displayName,
    hasWMemberSocial: hasWMemberSocial,
    selectedAuthorUrn: selectedAuthorUrn,
    orgUrns: orgUrns,
    orgCount: orgUrns.length
  };
}

function getLinkedInAuthorContext(payload) {
  tryAutoRefreshIfNeeded_("linkedin");
  var status = getPlatformStatus_("linkedin");
  var context = getLinkedInAuthorContextData_();
  var token = getScriptProp_(PLATFORM_OAUTH_CONFIG.linkedin.accessTokenKey);

  if (token && context.hasPersonUrn) {
    var freshOrgs = fetchLinkedInOrganizationUrns_(token);
    if (Array.isArray(freshOrgs) && freshOrgs.length) {
      setScriptProp_("LINKEDIN_ORG_URNS", JSON.stringify(freshOrgs));
      context.orgUrns = freshOrgs;
      context.orgCount = freshOrgs.length;
    }
  }

  var isPublishReady = context.hasToken && context.hasPersonUrn && context.hasWMemberSocial && !!context.selectedAuthorUrn;

  return Object.assign({}, context, {
    publishReady: isPublishReady,
    publishReadyReason: !context.hasToken ? "token_missing"
      : !context.hasPersonUrn ? "person_urn_missing"
      : !context.hasWMemberSocial ? "missing_w_member_social"
      : !context.selectedAuthorUrn ? "no_author_selected"
      : "ready",
    account: status
  });
}

function fetchLinkedInOrganizationUrns_(accessToken) {
  if (!accessToken) return [];
  try {
    var headers = buildLinkedInRestHeaders_(accessToken);
    var response = fetchJson_("https://api.linkedin.com/rest/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR", {
      method: "get",
      metaLabel: "LinkedIn org fetch",
      headers: headers,
      muteHttpExceptions: true
    });
    var elements = Array.isArray(response && response.elements) ? response.elements : [];
    return elements.map(function(el) {
      var target = el && el.organizationalTarget || "";
      return String(target || "").trim();
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function setLinkedInAuthorUrn(payload) {
  var urn = String(payload && payload.authorUrn || "").trim();
  if (!urn) throw new Error("authorUrn is required");
  if (urn.indexOf("urn:li:person:") !== 0 && urn.indexOf("urn:li:organization:") !== 0) {
    throw new Error("authorUrn must start with urn:li:person: or urn:li:organization:");
  }
  setScriptProp_("LINKEDIN_SELECTED_AUTHOR_URN", urn);
  return { ok: true, selectedAuthorUrn: urn };
}

function validatePlatformPost_(post, platform) {
  const target = detectSourcePlatform_(platform) || platform;
  const issues = [];
  const warnings = [];
  const assets = getAssetsForPost_(post, getMedia());
  const hasMedia = !!String(post.assetId || "").trim() || assets.length > 0;
  const caption = String(post.platformCaptionOverride || post.description || "").trim();
  const publishedUrl = String(post.publishedUrl || "").trim();

  if (!post.title) issues.push("Missing title.");
  if (!post.scheduledAt) warnings.push("Missing scheduled_at.");

  if (target === "instagram") {
    if (!hasMedia) issues.push("Instagram requires media.");
    if (!caption) issues.push("Instagram requires a caption.");
    warnings.push("Instagram publishing will require a connected professional account and media container flow.");
  } else if (target === "linkedin") {
    if (!caption && !String(post.sourceUrl || "").trim()) issues.push("LinkedIn requires caption or source URL.");
    var linkedInAuthor = getLinkedInAuthorContextData_();
    if (!linkedInAuthor.hasPersonUrn) issues.push("LinkedIn person URN is missing. Reconnect LinkedIn to resolve author context.");
    if (linkedInAuthor.hasToken && !linkedInAuthor.selectedAuthorUrn) {
      warnings.push("No author URN selected. Choose 'Publish as me' or 'Publish as organization' before publishing.");
    }
    if (!linkedInAuthor.hasToken) warnings.push("LinkedIn OAuth token is missing. Connect LinkedIn first.");
    if (linkedInAuthor.hasToken && !linkedInAuthor.hasWMemberSocial) warnings.push("LinkedIn token is missing w_member_social scope. Reconnect with publish scope.");
    var linkedInPrep = buildLinkedInPreparation_(post, assets);
    linkedInPrep.warnings.forEach(function(message) { warnings.push(message); });
    if (linkedInPrep.mode === "media_unsupported") issues.push("LinkedIn media must be text-only, image, or document for current preparation support.");
  } else if (target === "threads") {
    if (!caption) issues.push("Threads requires a caption.");
    warnings.push("Threads publishing will require the Meta/Threads publishing flow.");
  } else if (target === "bluesky") {
    if (!caption) issues.push("Bluesky requires text.");
    warnings.push("Bluesky publishing will require a handle/app password session and blob uploads.");
  }

  if (post.postType === "carousel" || (post.carouselAssetIds || []).length > 1) {
    if ((post.carouselAssetIds || []).length < 2) issues.push("Carousel posts require multiple asset IDs.");
    if (assets.length < (post.carouselAssetIds || []).length) issues.push("One or more carousel assets could not be resolved.");
  }

  if (post.publishStatus === "published" && !publishedUrl) {
    warnings.push("Published post is missing published_url.");
  }

  return {
    platform: target,
    valid: issues.length === 0,
    issues: issues,
    warnings: warnings,
    requiresManualReview: warnings.length > 0 || normalizeBoolean_(post.requiresManualReview)
  };
}

function buildPlatformPayload_(post, platform) {
  const validation = validatePlatformPost_(post, platform);
  const assets = getAssetsForPost_(post, getMedia());
  const adapterPayload = buildPlatformAdapterPayload_(post, platform, assets);
  const payload = {
    platform: platform,
    title: post.title,
    caption: String(post.platformCaptionOverride || post.description || "").trim(),
    sourceUrl: String(post.sourceUrl || "").trim(),
    publishedUrl: String(post.publishedUrl || "").trim(),
    assetId: String(post.assetId || "").trim(),
    carouselAssetIds: parseAssetIdList_(post.carouselAssetIds || []),
    assets: assets.map(function(asset) {
      return {
        assetId: asset.assetId,
        fileUrl: asset.fileUrl,
        sourceUrl: asset.sourceUrl,
        assetType: asset.assetType
      };
    }),
    scheduledAt: String(post.scheduledAt || "").trim(),
    metadata: parseJsonSafe_(post.sourceMetadata) || {},
    adapterPayload: adapterPayload
  };

  // TODO: add per-platform live API payload transforms once OAuth credentials and app review are complete.
  return {
    postId: post.postId,
    platform: platform,
    valid: validation.valid,
    requiresManualReview: validation.requiresManualReview,
    issues: validation.issues,
    warnings: validation.warnings,
    adapterPayload: adapterPayload,
    payload: payload
  };
}

function parseJsonSafe_(value) {
  if (!value || typeof value !== "string") return value || null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function updatePublishStatus_(postId, updates) {
  const sheet = getPostsSheet_();
  const existingRow = findPostObjectById_(postId);
  const existing = existingRow ? normalizePostSchemaAliases_(existingRow) : null;
  if (!existing) throw new Error("Post not found");

  Object.keys(updates || {}).forEach(function(key) {
    existing[key] = updates[key];
  });
  existing.updated_at = new Date().toISOString();
  upsertPostObjectById_(sheet, existing);
  return getPosts().find(function(post) { return post.postId === postId; }) || null;
}

function getPublishingReadiness(payload) {
  const targetPostId = String(payload && payload.postId || "").trim();
  const posts = getPosts().filter(function(post) {
    return !targetPostId || post.postId === targetPostId;
  });

  const items = posts.map(function(post) {
    const targets = post.platformTargets && post.platformTargets.length
      ? post.platformTargets
      : parsePlatformTargets_(post.platform);
    const validations = targets.length ? targets.map(function(platform) {
      return validatePlatformPost_(post, platform);
    }) : [];
    return {
      postId: post.postId,
      title: post.title,
      publishStatus: post.publishStatus,
      platformTargets: targets,
      validations: validations
    };
  });

  return {
    totalPosts: items.length,
    readyCount: items.filter(function(item) {
      return item.validations.length && item.validations.every(function(validation) { return validation.valid; });
    }).length,
    items: items
  };
}

function buildFlowIntegrityDiagnostics_(posts, notes, inspo, campaigns, importJobs) {
  var postsById = {};
  posts.forEach(function(post) {
    postsById[String(post.postId || "").trim()] = post;
  });
  var stateCounts = {
    notes: { active: 0, converted_to_inspo: 0, converted_to_post: 0, archived: 0 },
    inspo: { active: 0, drafted: 0, converted_to_post: 0, archived: 0 },
    posts: { draft: 0, scheduled: 0, published: 0, archived: 0 }
  };
  notes.forEach(function(note) {
    stateCounts.notes[normalizeFlowState_("note", note.flowState || note.status, "active")] += 1;
  });
  inspo.forEach(function(item) {
    stateCounts.inspo[normalizeFlowState_("inspo", item.flowState || item.status, "active")] += 1;
  });
  posts.forEach(function(post) {
    stateCounts.posts[normalizeFlowState_("post", post.flowState || post.status, "draft")] += 1;
  });

  var postsMissingSourceReferences = posts.filter(function(post) {
    return !!String(post.createdFromFlow || "").trim() &&
      ["note_to_post", "inspo_to_post", "ai_draft_to_post", "linkedin_import", "idea_to_post"].indexOf(String(post.createdFromFlow || "").trim()) !== -1 &&
      !String(post.sourceNoteId || post.createdFromNoteId || post.sourceInspoId || post.createdFromInspoId || post.sourceAiDraftId || post.sourceImportJobId || "").trim();
  }).map(function(post) {
    return { postId: post.postId, createdFromFlow: post.createdFromFlow, title: post.title };
  });

  var inspoConvertedWithoutPosts = inspo.filter(function(item) {
    var converted = normalizeFlowState_("inspo", item.flowState || item.status, "active") === "converted_to_post";
    return converted && !postsById[String(item.convertedPostId || "").trim()];
  }).map(function(item) {
    return { inspoId: item.inspoId, convertedPostId: item.convertedPostId, title: item.title };
  });

  var noteSourceCounts = {};
  posts.forEach(function(post) {
    var key = String(post.sourceNoteId || post.createdFromNoteId || "").trim();
    if (key) noteSourceCounts[key] = (noteSourceCounts[key] || 0) + 1;
  });
  var notesDuplicatedIntoPosts = Object.keys(noteSourceCounts).filter(function(key) {
    return noteSourceCounts[key] > 1;
  }).map(function(key) {
    return { noteId: key, duplicatePostCount: noteSourceCounts[key] };
  });

  var orphanConstellationCampaignRefs = posts.filter(function(post) {
    return String(post.campaignId || "").trim() && !campaigns.some(function(campaign) {
      return String(campaign.campaignId || "").trim() === String(post.campaignId || "").trim();
    });
  }).map(function(post) {
    return { postId: post.postId, campaignId: post.campaignId, campaignName: post.campaignName };
  });

  var postsNotAppearingInLedger = posts.filter(function(post) {
    return normalizeFlowState_("post", post.flowState || post.status, "draft") !== "archived" && !String(post.ledgerExcerpt || "").trim();
  }).map(function(post) {
    return { postId: post.postId, title: post.title };
  });

  var scheduledPostsMissingCalendarEntries = posts.filter(function(post) {
    return normalizeFlowState_("post", post.flowState || post.status, "draft") === "scheduled" && (!String(post.calendarMonth || "").trim() || !String(post.calendarYear || "").trim() || !String(post.calendarDay || "").trim());
  }).map(function(post) {
    return { postId: post.postId, queueDateLabel: post.queueDateLabel, scheduledAt: post.scheduledAt };
  });

  var campaignRowsWithZeroPosts = campaigns.filter(function(campaign) {
    return !campaign.isArchived && !posts.some(function(post) {
      return String(post.campaignId || "").trim() === String(campaign.campaignId || "").trim();
    });
  }).map(function(campaign) {
    return { campaignId: campaign.campaignId, campaignName: campaign.campaignName };
  });

  var postsMissingQueuePlacement = posts.filter(function(post) {
    var flowState = normalizeFlowState_("post", post.flowState || post.status, "draft");
    return flowState !== "archived" && (!String(post.queueDateLabel || "").trim() || !String(post.scheduledDateKey || "").trim());
  }).map(function(post) {
    return { postId: post.postId, flowState: post.flowState || post.status };
  });

  var duplicateImportedPosts = [];
  var importGroups = {};
  posts.forEach(function(post) {
    var sourceKey = String(post.linkedinPostId || post.normalizedTextHash || "").trim();
    if (!sourceKey || !String(post.sourceImportJobId || post.importJobId || "").trim()) return;
    if (!importGroups[sourceKey]) importGroups[sourceKey] = [];
    importGroups[sourceKey].push(post);
  });
  Object.keys(importGroups).forEach(function(key) {
    if (importGroups[key].length > 1) {
      duplicateImportedPosts.push({
        sourceKey: key,
        postIds: importGroups[key].map(function(post) { return post.postId; })
      });
    }
  });

  var campaignKeyIssues = [];
  var normalizedKeyMap = {};
  campaigns.forEach(function(campaign) {
    var cid = String(campaign.campaignId || "").trim();
    var cname = normalizeCampaignDisplayName_(campaign.campaignName || "");
    var nkey = normalizeCampaignLookup_(cname);
    if (/[|\n]/.test(cname)) {
      campaignKeyIssues.push({ campaignId: cid, campaignName: cname, issue: "explicit multi-value campaign name", normalizedKey: nkey });
    }
    if (!cid) {
      campaignKeyIssues.push({ campaignId: cid, campaignName: cname, issue: "empty campaign id", normalizedKey: nkey });
    }
    if (normalizedKeyMap[nkey]) {
      campaignKeyIssues.push({ campaignId: cid, campaignName: cname, issue: "duplicate normalized key", normalizedKey: nkey, conflictsWith: normalizedKeyMap[nkey] });
    }
    normalizedKeyMap[nkey] = (normalizedKeyMap[nkey] || []).concat(cname);
    if (normalizedKeyMap[nkey].length > 1) {
      campaignKeyIssues.push({ campaignId: cid, campaignName: cname, issue: "multiple campaigns share normalized key", normalizedKey: nkey, allNames: normalizedKeyMap[nkey] });
    }
  });
  var uniqueKeyIssues = [];
  var seen = {};
  campaignKeyIssues.forEach(function(issue) {
    var key = issue.campaignId + ":" + issue.issue;
    if (seen[key]) return;
    seen[key] = true;
    uniqueKeyIssues.push(issue);
  });

  return {
    stateCounts: stateCounts,
    postsMissingSourceReferences: postsMissingSourceReferences,
    inspoConvertedWithoutPosts: inspoConvertedWithoutPosts,
    notesDuplicatedIntoPosts: notesDuplicatedIntoPosts,
    orphanConstellationCampaignRefs: orphanConstellationCampaignRefs,
    postsNotAppearingInLedger: postsNotAppearingInLedger,
    scheduledPostsMissingCalendarEntries: scheduledPostsMissingCalendarEntries,
    campaignRowsWithZeroPosts: campaignRowsWithZeroPosts,
    postsMissingQueuePlacement: postsMissingQueuePlacement,
    duplicateImportedPosts: duplicateImportedPosts,
    campaignKeyIssues: uniqueKeyIssues,
    lastRebuildTimestamps: getLastRebuildTimestamps_(),
    flowEventLog: getFlowEventLog_(20)
  };
}

function repairFlowIntegrity(payload) {
  payload = payload || {};
  var repairAction = String(payload.repairAction || payload.action || "audit").trim();
  var posts = getPosts();
  var notes = getNotes();
  var inspo = getInspo(true);
  var campaigns = getCampaigns();
  var jobs = getImportJobs({ includeCompleted: true });
  var result = { repairAction: repairAction, repairedCount: 0, timestamps: getLastRebuildTimestamps_() };

  if (repairAction === "relink_source_post") {
    notes.forEach(function(note) {
      var linked = posts.find(function(post) {
        return String(post.sourceNoteId || post.createdFromNoteId || "").trim() === String(note.noteId || "").trim();
      });
      if (linked && String(note.convertedPostId || "").trim() !== String(linked.postId || "").trim()) {
        saveNote(Object.assign({}, note, {
          noteId: note.noteId,
          convertedPostId: linked.postId,
          status: "converted_to_post",
          flowState: "converted_to_post",
          movedToPostAt: linked.movedToPostAt || new Date().toISOString()
        }));
        result.repairedCount += 1;
      }
    });
    inspo.forEach(function(item) {
      var linked = posts.find(function(post) {
        return String(post.sourceInspoId || post.createdFromInspoId || "").trim() === String(item.inspoId || "").trim();
      });
      if (linked && String(item.convertedPostId || "").trim() !== String(linked.postId || "").trim()) {
        saveInspo(Object.assign({}, item, {
          inspoId: item.inspoId,
          convertedPostId: linked.postId,
          status: "converted_to_post",
          flowState: "converted_to_post",
          movedToPostAt: linked.movedToPostAt || new Date().toISOString()
        }));
        result.repairedCount += 1;
      }
    });
  } else if (repairAction === "archive_duplicate_source_rows") {
    var seenNotes = {};
    posts.forEach(function(post) {
      var noteId = String(post.sourceNoteId || post.createdFromNoteId || "").trim();
      if (!noteId) return;
      if (!seenNotes[noteId]) seenNotes[noteId] = [];
      seenNotes[noteId].push(post.postId);
    });
    Object.keys(seenNotes).forEach(function(noteId) {
      if (seenNotes[noteId].length <= 1) return;
      saveNote({
        noteId: noteId,
        status: "archived",
        flowState: "archived",
        archivedAt: new Date().toISOString(),
        convertedPostId: seenNotes[noteId][0]
      });
      result.repairedCount += 1;
    });
    var seenInspo = {};
    posts.forEach(function(post) {
      var inspoId = String(post.sourceInspoId || post.createdFromInspoId || "").trim();
      if (!inspoId) return;
      if (!seenInspo[inspoId]) seenInspo[inspoId] = [];
      seenInspo[inspoId].push(post.postId);
    });
    Object.keys(seenInspo).forEach(function(inspoId) {
      if (seenInspo[inspoId].length <= 1) return;
      saveInspo({
        inspoId: inspoId,
        status: "archived",
        flowState: "archived",
        archivedAt: new Date().toISOString(),
        convertedPostId: seenInspo[inspoId][0]
      });
      result.repairedCount += 1;
    });
  } else if (repairAction === "rebuild_ledger_index") {
    setLastRebuildTimestamp_("ledger");
  } else if (repairAction === "rebuild_calendar_index") {
    setLastRebuildTimestamp_("calendar");
  } else if (repairAction === "rebuild_constellation_graph") {
    setLastRebuildTimestamp_("constellation");
  } else if (repairAction === "rebuild_queue_cache") {
    setLastRebuildTimestamp_("queue");
  }

  result.timestamps = getLastRebuildTimestamps_();
  logFlowEvent_("repair_flow_integrity", "system", "", "", "ok", "", result);
  result.diagnostics = buildFlowIntegrityDiagnostics_(getPosts(), getNotes(), getInspo(true), getCampaigns(), getImportJobs({ includeCompleted: true }));
  return result;
}

function auditFlowIntegrity() {
  var posts = getPosts();
  var notes = getNotes();
  var inspo = getInspo();
  var media = getMedia();
  var campaigns = getCampaigns();
  var aiDrafts = getAIDrafts();
  var postsById = {};
  var aiDraftsById = {};
  posts.forEach(function(post) { postsById[String(post.postId || post.post_id || "").trim()] = post; });
  aiDrafts.forEach(function(draft) { aiDraftsById[String(draft.aiDraftId || draft.ai_draft_id || "").trim()] = draft; });

  var notesConvertedButActive = notes.filter(function(note) {
    var flow = normalizeFlowState_("note", note.flowState || note.status, "active");
    return flow === "converted_to_post" && String(note.status || "").trim().toLowerCase() === "active";
  }).map(function(note) { return { noteId: note.noteId, title: note.title, convertedPostId: note.convertedPostId }; });

  var inspoConvertedButActive = inspo.filter(function(item) {
    var flow = normalizeFlowState_("inspo", item.flowState || item.status, "active");
    return flow === "converted_to_post" && String(item.status || "").trim().toLowerCase() === "active";
  }).map(function(item) { return { inspoId: item.inspoId, title: item.title, convertedPostId: item.convertedPostId }; });

  var postsMissingSourceRefs = posts.filter(function(post) {
    return !!String(post.createdFromFlow || "").trim() && !String(post.sourceNoteId || post.createdFromNoteId || post.sourceInspoId || post.createdFromInspoId || post.sourceAiDraftId || post.sourceImportJobId || "").trim();
  }).map(function(post) { return { postId: post.postId, title: post.title, createdFromFlow: post.createdFromFlow }; });

  var duplicateConversions = [];
  var noteDupes = {};
  var inspoDupes = {};
  posts.forEach(function(post) {
    var noteId = String(post.sourceNoteId || post.createdFromNoteId || "").trim();
    if (noteId) { noteDupes[noteId] = (noteDupes[noteId] || 0) + 1; }
    var inspoId = String(post.sourceInspoId || post.createdFromInspoId || "").trim();
    if (inspoId) { inspoDupes[inspoId] = (inspoDupes[inspoId] || 0) + 1; }
  });
  Object.keys(noteDupes).forEach(function(key) {
    if (noteDupes[key] > 1) duplicateConversions.push({ sourceType: "note", sourceId: key, postCount: noteDupes[key] });
  });
  Object.keys(inspoDupes).forEach(function(key) {
    if (inspoDupes[key] > 1) duplicateConversions.push({ sourceType: "inspo", sourceId: key, postCount: inspoDupes[key] });
  });

  var aiDraftsNotVisible = aiDrafts.filter(function(draft) {
    var hasIdea = String(draft.draftStatus || "").trim() === "idea_captured" || String(draft.draftStatus || "").trim() === "scaffold_only";
    var hasRelatedPost = posts.some(function(post) {
      var sourceId = String(draft.aiDraftId || draft.ideaId || "").trim();
      return sourceId && (String(post.sourceAiDraftId || post.aiSourceId || "").trim() === sourceId);
    });
    return hasIdea && !hasRelatedPost;
  }).map(function(draft) { return { aiDraftId: draft.aiDraftId, title: draft.title, draftStatus: draft.draftStatus }; });

  var carouselOutlinesNotSurfaced = aiDrafts.filter(function(draft) {
    return String(draft.draftStatus || "").trim() === "reviewed" && String(draft.carouselOutline || "").trim();
  }).slice(0, 20).map(function(draft) { return { aiDraftId: draft.aiDraftId, title: draft.title }; });

  var postsNotInLedger = posts.filter(function(post) {
    return normalizeFlowState_("post", post.flowState || post.status, "draft") !== "archived" && !String(post.ledgerExcerpt || "").trim();
  }).map(function(post) { return { postId: post.postId, title: post.title }; });

  var postsMissingConstellationPlacement = posts.filter(function(post) {
    return normalizeFlowState_("post", post.flowState || post.status, "draft") !== "archived" && !String(post.campaignId || "").trim() && !normalizeLookupValue(post.campaignName || "");
  }).map(function(post) { return { postId: post.postId, title: post.title }; });

  var postsMissingCampaign = posts.filter(function(post) {
    return !String(post.campaignId || post.campaign_id || post.campaignName || post.campaign_name || "").trim();
  }).map(function(post) { return { postId: post.postId || post.post_id, title: post.title }; });

  var postsMissingPillar = posts.filter(function(post) {
    return !String(post.pillar || "").trim();
  }).map(function(post) { return { postId: post.postId || post.post_id, title: post.title }; });

  var notesMissingLinkedDraftOrPost = notes.filter(function(note) {
    return !String(note.linkedPostId || note.linked_post_id || note.convertedPostId || note.converted_post_id || note.linkedAiDraftId || note.linked_ai_draft_id || note.sourceAiDraftId || note.source_ai_draft_id || "").trim();
  }).map(function(note) { return { noteId: note.noteId || note.note_id, title: note.title }; });

  var aiDraftsMissingLineage = aiDrafts.filter(function(draft) {
    return !String(draft.parentArtifactId || draft.parent_artifact_id || "").trim()
      || !String(draft.rootArtifactId || draft.root_artifact_id || "").trim()
      || !String(draft.sourceId || draft.source_id || draft.sourceType || draft.source_type || "").trim();
  }).map(function(draft) {
    return {
      aiDraftId: draft.aiDraftId || draft.ai_draft_id,
      title: draft.title,
      missingParent: !String(draft.parentArtifactId || draft.parent_artifact_id || "").trim(),
      missingRoot: !String(draft.rootArtifactId || draft.root_artifact_id || "").trim(),
      missingSource: !String(draft.sourceId || draft.source_id || draft.sourceType || draft.source_type || "").trim()
    };
  });

  var mediaMissingTitle = media.filter(function(asset) {
    return !String(deriveMediaTitle_(asset) || "").trim() || deriveMediaTitle_(asset) === "Untitled media";
  }).map(function(asset) { return { assetId: asset.assetId || asset.asset_id, title: asset.title }; });

  var mediaNotLinked = media.filter(function(asset) {
    return !String(asset.linkedPostId || asset.linked_post_id || asset.postId || asset.post_id || asset.linkedAiDraftId || asset.linked_ai_draft_id || "").trim();
  }).map(function(asset) { return { assetId: asset.assetId || asset.asset_id, title: asset.title }; });

  var inspoNotConverted = inspo.filter(function(item) {
    return !String(item.convertedPostId || item.converted_post_id || item.linkedPostId || item.linked_post_id || item.linkedAiDraftId || item.linked_ai_draft_id || "").trim();
  }).map(function(item) { return { inspoId: item.inspoId || item.inspo_id, title: item.title }; });

  var schemaDiagnostics = validateSchemaFlow();

  return {
    ok: true,
    notesConvertedButActive: notesConvertedButActive,
    inspoConvertedButActive: inspoConvertedButActive,
    postsMissingSourceRefs: postsMissingSourceRefs,
    duplicateConversions: duplicateConversions,
    aiDraftsNotVisible: aiDraftsNotVisible,
    carouselOutlinesNotSurfaced: carouselOutlinesNotSurfaced,
    postsNotInLedger: postsNotInLedger,
    postsMissingConstellationPlacement: postsMissingConstellationPlacement,
    auditCards: {
      postsMissingCampaign: postsMissingCampaign,
      postsMissingPillar: postsMissingPillar,
      notesMissingLinkedDraftOrPost: notesMissingLinkedDraftOrPost,
      aiDraftsMissingParentRootSource: aiDraftsMissingLineage,
      mediaMissingTitle: mediaMissingTitle,
      mediaNotLinkedToPostOrDraft: mediaNotLinked,
      inspoNotConvertedToDraftOrPost: inspoNotConverted,
      formulaErrors: schemaDiagnostics.formulaErrors || [],
      hardCodedIndexRisks: schemaDiagnostics.hardCodedIndexRisks || []
    },
    counts: {
      notes: notes.length,
      inspo: inspo.length,
      posts: posts.length,
      campaigns: campaigns.length,
      aiDrafts: aiDrafts.length,
      media: media.length
    }
  };
}

function getDiagnostics(payload) {
  payload = payload || {};
  var diagnosticsWarnings = [];
  function addDiagnosticsWarning_(section, err) {
    diagnosticsWarnings.push(section + ": " + sanitizeErrorMessage_(err && err.message || err || "Unknown diagnostics warning"));
  }
  function safeDiagnosticsValue_(section, fallback, producer) {
    try {
      return producer();
    } catch (err) {
      addDiagnosticsWarning_(section, err);
      return fallback;
    }
  }
  var payloadContext = getWorkspaceRequestContext_(null, { payload: payload });
  if (payloadContext.spreadsheetId || payloadContext.workspace_slug || payloadContext.workspace_id || payloadContext.postsSheetName) {
    setWorkspaceRequestContext_(Object.assign({}, getCurrentWorkspaceRequestContext_(), payloadContext));
  }
  var receivedWorkspaceContext = getCurrentWorkspaceRequestContext_();
  var spreadsheet = null;
  var spreadsheetId = "";
  var spreadsheetName = "";
  var spreadsheetResolution = {};
  try {
    spreadsheet = getSpreadsheet_();
    spreadsheetId = spreadsheet.getId();
    spreadsheetName = spreadsheet.getName();
    spreadsheetResolution = Object.assign({}, LAST_SPREADSHEET_RESOLUTION_ || {});
  } catch (spreadsheetErr) {
    spreadsheetResolution = {
      source: "",
      spreadsheetId: "",
      spreadsheetName: "",
      legacyScriptPropertiesUsed: false,
      error: sanitizeErrorMessage_(spreadsheetErr && spreadsheetErr.message || spreadsheetErr)
    };
  }
  function safeFindExistingSheet_(sheetKey) {
    return safeDiagnosticsValue_("findExistingSheet_(" + sheetKey + ")", null, function() {
      return findExistingSheet_(sheetKey);
    });
  }
  var postsSheet = null;
  var values = [];
  var headers = [];
  var rowCount = 0;
  var missingPostIdCount = 0;
  var rawPostRows = [];
  var posts = [];
  try {
    postsSheet = typeof getPostsSheet_ === "function"
      ? getPostsSheet_()
      : SpreadsheetApp.getActiveSpreadsheet().getSheetByName("POSTS");
    values = postsSheet ? postsSheet.getDataRange().getValues() : [];
    headers = values.length ? values[0].map(String) : [];
    rowCount = Math.max(0, values.length - 1);
    var postIdIndex = headers.map(normalizeHeader_).indexOf("post_id");
    if (postIdIndex !== -1) {
      missingPostIdCount = values.slice(1).filter(function(row) {
        return !String(row[postIdIndex] || "").trim();
      }).length;
    }
  } catch (postsSheetErr) {
    addDiagnosticsWarning_("posts sheet snapshot", postsSheetErr);
    postsSheet = safeFindExistingSheet_("posts");
  }
  try {
    rawPostRows = getPostsData_().map(normalizePostSchemaAliases_);
    posts = rawPostRows;
  } catch (postsErr) {
    addDiagnosticsWarning_("getPostsData_", postsErr);
    rawPostRows = [];
    posts = [];
  }
  var mediaSheet = safeFindExistingSheet_("media");
  var inspoSheet = safeFindExistingSheet_("inspo");
  var notesSheet = safeFindExistingSheet_("notes");
  var aiDraftsSheet = safeFindExistingSheet_("aiDrafts");
  var brandFrameworkSheet = safeFindExistingSheet_("brandFramework");
  var campaignSheet = safeFindExistingSheet_("campaign");
  var settingsSheet = safeFindExistingSheet_("settings");
  var sheetChecks = [
    { key: "posts", sheet: postsSheet, requiredHeaders: REQUIRED_POST_HEADERS },
    { key: "media", sheet: mediaSheet, requiredHeaders: MEDIA_HEADERS },
    { key: "inspo", sheet: inspoSheet, requiredHeaders: INSPO_HEADERS },
    { key: "notes", sheet: notesSheet, requiredHeaders: NOTE_HEADERS },
    { key: "aiDrafts", sheet: aiDraftsSheet, requiredHeaders: AI_DRAFT_HEADERS },
    { key: "brandFramework", sheet: brandFrameworkSheet, requiredHeaders: BRAND_FRAMEWORK_HEADERS },
    { key: "campaign", sheet: campaignSheet, requiredHeaders: CAMPAIGN_HEADERS.concat(CAMPAIGN_COMPAT_HEADERS) },
    { key: "settings", sheet: settingsSheet, requiredHeaders: [] }
  ];
  var missingHeaders = {};
  var missingSheets = [];
  var rowCounts = {};

  sheetChecks.forEach(function(check) {
    try {
      if (!check.sheet) {
        missingSheets.push(check.key);
        rowCounts[check.key] = 0;
        return;
      }
      rowCounts[check.key] = Math.max(check.sheet.getLastRow() - 1, 0);
      var currentHeaders = getHeaders_(check.sheet).map(normalizeHeader_);
      missingHeaders[check.key] = (check.requiredHeaders || []).filter(function(header) {
        return currentHeaders.indexOf(normalizeHeader_(header)) === -1;
      });
    } catch (sheetCheckErr) {
      addDiagnosticsWarning_("sheet check " + check.key, sheetCheckErr);
      rowCounts[check.key] = rowCounts[check.key] || 0;
      missingHeaders[check.key] = [];
    }
  });

  posts = safeDiagnosticsValue_("getPosts", posts, function() { return getPosts(); });
  var notes = safeDiagnosticsValue_("getNotes", [], function() { return getNotes(); });
  var media = safeDiagnosticsValue_("getMedia", [], function() { return getMedia(); });
  var campaigns = safeDiagnosticsValue_("getCampaigns", [], function() { return getCampaigns(); });
  var inspo = safeDiagnosticsValue_("getInspo", [], function() { return getInspo(true); });
  var aiDrafts = safeDiagnosticsValue_("getAIDrafts", [], function() { return getAIDrafts(); });
  var brandFramework = safeDiagnosticsValue_("getBrandFramework", [], function() { return getBrandFramework(); });
  var importJobs = safeDiagnosticsValue_("getImportJobs", [], function() { return getImportJobs({ includeCompleted: true }); });
  var semanticMemory = safeDiagnosticsValue_("getSemanticMemory", {}, function() { return getSemanticMemory(payload); });
  var socialCapabilities = safeDiagnosticsValue_("getSocialImportCapabilities", {}, function() { return getSocialImportCapabilities(payload); });
  var connectedAccounts = safeDiagnosticsValue_("getConnectedAccounts", [], function() { return getConnectedAccounts(); });
  var deploymentDiagnostics = safeDiagnosticsValue_("getDeploymentDiagnostics", {}, function() { return getDeploymentDiagnostics(); });
  var schemaFlowValidation = safeDiagnosticsValue_("validateSchemaFlow", {}, function() { return validateSchemaFlow(); });
  posts = Array.isArray(posts) ? posts : [];
  notes = Array.isArray(notes) ? notes : [];
  media = Array.isArray(media) ? media : [];
  campaigns = Array.isArray(campaigns) ? campaigns : [];
  inspo = Array.isArray(inspo) ? inspo : [];
  aiDrafts = Array.isArray(aiDrafts) ? aiDrafts : [];
  brandFramework = Array.isArray(brandFramework) ? brandFramework : [];
  importJobs = Array.isArray(importJobs) ? importJobs : [];
  semanticMemory = semanticMemory && typeof semanticMemory === "object" ? semanticMemory : {};
  socialCapabilities = socialCapabilities && typeof socialCapabilities === "object" ? socialCapabilities : {};
  connectedAccounts = Array.isArray(connectedAccounts) ? connectedAccounts : [];
  var openGraphStatus = socialCapabilities.openGraph || {};
  var malformedScheduledRows = posts.filter(function(post) {
    var parsed = parseSheetDate_(post.scheduledAt);
    return post.scheduledAt && (!parsed || isNaN(parsed.getTime()));
  }).map(function(post) {
    return { postId: post.postId, scheduledAt: post.scheduledAt };
  });
  var missingCampaignRows = posts.filter(function(post) {
    return !String(post.campaignId || "").trim() || !String(post.campaignName || "").trim();
  }).map(function(post) {
    var missingId = !String(post.campaignId || "").trim();
    var missingName = !String(post.campaignName || "").trim();
    return {
      postId: post.postId,
      title: post.title,
      issue: missingId && missingName ? "missing campaign_id and campaign_name" : missingId ? "missing campaign_id" : "missing campaign_name"
    };
  });
  var carouselMissingAssets = posts.filter(function(post) {
    return (post.carouselAssetIds || []).length > 0 && getAssetsForPost_(post, media).length < (post.carouselAssetIds || []).length;
  }).map(function(post) {
    return { postId: post.postId, carouselAssetIds: post.carouselAssetIds };
  });
  var noteFieldIssues = notes.filter(function(note) {
    return !String(note.noteId || "").trim() || !String(note.title || "").trim();
  }).map(function(note) {
    return { noteId: note.noteId, title: note.title };
  });
  var publishingStateIssues = posts.filter(function(post) {
    var invalidTarget = (post.platformTargets || []).some(function(target) {
      return ["instagram", "linkedin", "threads", "bluesky", "tiktok"].indexOf(String(target || "").toLowerCase()) === -1;
    });
    var blankTargets = !(post.platformTargets || []).length;
    var publishedMissingUrl = post.publishStatus === "published" && !post.publishedUrl;
    var failedMissingError = String(post.publishStatus || "").indexOf("failed") !== -1 && !post.apiError;
    return invalidTarget || blankTargets || publishedMissingUrl || failedMissingError;
  }).map(function(post) {
    return {
      postId: post.postId,
      publishStatus: post.publishStatus,
      platformTargets: post.platformTargets,
      blankPlatformTargets: !(post.platformTargets || []).length,
      publishedUrl: post.publishedUrl,
      apiError: post.apiError
    };
  });
  var invalidPlatformTargetRows = rawPostRows.map(function(row, index) {
    var rawTargets = String(pickFirstDefined_(row.platform_targets, row.platformTargets, row.platform, "") || "").split(/[|,\n]/).map(function(value) {
      return String(value || "").trim();
    }).filter(Boolean);
    var invalid = rawTargets.filter(function(value) {
      return !detectSourcePlatform_(value) || ["instagram", "linkedin", "threads", "bluesky", "tiktok"].indexOf(detectSourcePlatform_(value)) === -1;
    });
    return invalid.length ? {
      rowNumber: index + 2,
      postId: String(pickFirstDefined_(row.post_id, row.postId, "")).trim(),
      platformTargetsRaw: String(pickFirstDefined_(row.platform_targets, row.platformTargets, "") || "").trim(),
      invalidTargets: invalid
    } : null;
  }).filter(Boolean);
  var blankPlatformTargetRows = rawPostRows.map(function(row, index) {
    return !String(pickFirstDefined_(row.platform_targets, row.platformTargets, "") || "").trim() ? {
      rowNumber: index + 2,
      postId: String(pickFirstDefined_(row.post_id, row.postId, "")).trim(),
      fallbackPlatform: String(row.platform || "").trim()
    } : null;
  }).filter(Boolean);
  var importIssues = posts.filter(function(post) {
    return post.sourceImportStatus && !post.sourceUrl;
  }).map(function(post) {
    return {
      postId: post.postId,
      sourceImportStatus: post.sourceImportStatus
    };
  });
  var importFailuresByPlatform = {};
  posts.forEach(function(post) {
    var status = String(post.sourceImportStatus || "").toLowerCase();
    if (["failed", "limited"].indexOf(status) === -1) return;
    var key = String(post.sourcePlatform || "unknown").toLowerCase();
    importFailuresByPlatform[key] = (importFailuresByPlatform[key] || 0) + 1;
  });
  var dateMismatchRows = posts.filter(function(post) {
    return post.dateDiagnostics && post.dateDiagnostics.length;
  }).map(function(post) {
    return {
      postId: post.postId,
      scheduledAt: post.scheduledAt,
      queueDateLabel: post.queueDateLabel,
      normalizedDisplayDate: normalizeQueueDateLabel(post.queueDateLabel) || formatQueueDateLabel(post.scheduledAt),
      diagnostics: post.dateDiagnostics.map(function(item) { return item.message || item; }),
      severities: post.dateDiagnostics.map(function(item) { return item.severity || "warning"; }),
      severity: post.dateDiagnostics.some(function(item) { return (item.severity || "warning") === "error"; }) ? "error" : "warning"
    };
  });
  var invalidQueueDateLabelRows = posts.filter(function(post) {
    return (post.dateDiagnostics || []).some(function(item) { return item.code === "invalid_queue_date_label" || item.code === "queue_date_label_gmt_string"; });
  }).map(function(post) {
    return { postId: post.postId, queueDateLabel: post.queueDateLabel, scheduledAt: post.scheduledAt };
  });
  var missingScheduledAtRows = posts.filter(function(post) {
    return (post.dateDiagnostics || []).some(function(item) { return item.code === "date_without_scheduled_at"; });
  }).map(function(post) {
    return { postId: post.postId, queueDateLabel: post.queueDateLabel };
  });
  var scheduledWithoutQueueDateRows = posts.filter(function(post) {
    return (post.dateDiagnostics || []).some(function(item) { return item.code === "scheduled_without_queue_date"; });
  }).map(function(post) {
    return { postId: post.postId, scheduledAt: post.scheduledAt };
  });
  var defaultInternalTimeRows = posts.filter(function(post) {
    return (post.dateDiagnostics || []).some(function(item) { return item.code === "default_internal_time"; });
  }).map(function(post) {
    return { postId: post.postId, scheduledAt: post.scheduledAt, queueTimeLabel: post.queueTimeLabel };
  });
  var dateRepairPreview = safeDiagnosticsValue_("buildDateRepairPreview", [], function() {
    return buildDateRepairPreview_(postsSheet ? rawPostRows : []);
  });
  var campaignLayoutIssues = campaigns.filter(function(campaign) {
    var rawShape = String(campaign.iconShape || "").trim().toLowerCase();
    var missingX = !normalizeNumber_(campaign.x);
    var missingY = !normalizeNumber_(campaign.y);
    var invalidShape = !!rawShape && !normalizeIconShape_(rawShape);
    var compressedRisk = normalizeNumber_(campaign.x) && normalizeNumber_(campaign.y) && Number(campaign.x) < 420 && Number(campaign.y) < 320;
    return !String(campaign.campaignName || "").trim() || missingX || missingY || invalidShape || compressedRisk;
  }).map(function(campaign) {
    var rawShape = String(campaign.iconShape || "").trim().toLowerCase();
    var issue = !String(campaign.campaignName || "").trim()
      ? "missing campaign label"
      : !normalizeNumber_(campaign.x) && !normalizeNumber_(campaign.y)
      ? "missing campaign layout"
      : !normalizeNumber_(campaign.x)
      ? "missing x"
      : !normalizeNumber_(campaign.y)
      ? "missing y"
      : (!!rawShape && !normalizeIconShape_(rawShape))
      ? "invalid icon_shape"
      : "compressed layout risk";
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      x: campaign.x,
      y: campaign.y,
      iconShape: campaign.iconShape,
      issue: issue,
      severity: issue === "compressed layout risk" ? "warning" : "error"
    };
  });
  var aiCreationOptions = safeDiagnosticsValue_("getAICreationOptions", { generationModes: [] }, function() {
    return getAICreationOptions();
  });
  var supportedGenerationModes = (aiCreationOptions.generationModes || []).concat([
    "LinkedIn post",
    "carousel outline",
    "short video script",
    "job board promo",
    "campaign recap",
    "platform analysis",
    "local infrastructure post",
    "alternate realities / solarpunk history"
  ]);
  var aiDraftIssues = aiDrafts.filter(function(draft) {
    return !draft.sourceType || !draft.draftStatus || (draft.generationMode && supportedGenerationModes.indexOf(draft.generationMode) === -1);
  }).map(function(draft) {
    return {
      aiDraftId: draft.aiDraftId,
      sourceType: draft.sourceType,
      draftStatus: draft.draftStatus,
      generationMode: draft.generationMode
    };
  });
  var aiPostIssues = posts.filter(function(post) {
    return (post.aiGenerationMode || post.aiSourceType || post.aiSourceId) && (!post.aiSourceType || !post.aiGenerationMode || (post.postType === "carousel" && post.platformCaptionOverride && post.platformCaptionOverride.length > 400));
  }).map(function(post) {
    return {
      postId: post.postId,
      aiSourceType: post.aiSourceType,
      aiGenerationMode: post.aiGenerationMode,
      postType: post.postType
    };
  });
  var brandFrameworkIssues = [];
  var overusedHookPatterns = (semanticMemory.overusedPatterns || []).filter(function(item) { return String(item.pattern || "").split("/").length >= 1; }).slice(0, 5);
  var campaignOverlapIssues = (semanticMemory.constellation && semanticMemory.constellation.bridges || []).filter(function(item) { return item.strength >= 0.42; }).map(function(item) {
    return { campaigns: item.fromCampaign + " ↔ " + item.toCampaign, issue: "campaign overlap/confusion", strength: item.strength };
  });
  var campaignCleanupDiagnostics = safeDiagnosticsValue_("getCampaignCleanupDiagnostics_", {}, function() {
    return getCampaignCleanupDiagnostics_(posts, campaigns);
  });
  var linkedInRewriteRouteDiagnostics = safeDiagnosticsValue_("testRewriteImportedLinkedInRowsRoute", {}, function() {
    return testRewriteImportedLinkedInRowsRoute();
  });
  var weakClassificationSignals = (semanticMemory.platformSignals || []).filter(function(item) { return item.weak; });
  var isolatedCampaigns = (semanticMemory.campaignClusters || []).filter(function(item) { return item.count <= 1; }).map(function(item) {
    return { campaignKey: item.campaignKey, issue: "isolated campaign" };
  });
  var orphanedRecords = notes.filter(function(note) { return !note.convertedPostId && !note.sourceUrl && !parseSemanticList_(note.semanticTags).length; }).map(function(note) {
    return { recordType: "note", recordId: note.noteId, issue: "orphaned note" };
  }).concat(inspo.filter(function(item) {
    return !item.convertedPostId && !item.sourceLabel && !parseSemanticList_(item.semanticTags).length;
  }).map(function(item) {
    return { recordType: "inspo", recordId: item.inspoId, issue: "orphaned inspo" };
  }));
  var flowIntegrityDiagnostics = safeDiagnosticsValue_("buildFlowIntegrityDiagnostics_", {}, function() {
    return buildFlowIntegrityDiagnostics_(posts, notes, inspo, campaigns, importJobs);
  });
  var sectionCounts = {};
  var antiPatternSeen = {};
  brandFramework.forEach(function(item) {
    sectionCounts[item.section] = (sectionCounts[item.section] || 0) + 1;
    if (item.antiPattern) {
      var key = normalizeCampaignLookup_(item.title || item.content);
      if (key && antiPatternSeen[key]) {
        brandFrameworkIssues.push({ frameworkKey: item.frameworkKey, issue: "duplicate anti-pattern", title: item.title });
      }
      antiPatternSeen[key] = true;
    }
  });
  [
    "Core Identity",
    "System Philosophy",
    "Participation Architecture",
    "Orientation",
    "Spatial / Geographic Systems",
    "Interpreter of Systems",
    "Classification Before Distribution",
    "Community-Led Systems",
    "Language Carries Structure",
    "Embedded Builder Perspective",
    "Legibility",
    "Platform-Specific Strategy",
    "CTA Philosophy",
    "Hook Patterns",
    "Emotional Entry Points",
    "Carousel Philosophy",
    "AI Anti-Patterns",
    "Grammar Rules",
    "Preferred Vocabulary",
    "Avoid Vocabulary"
  ].forEach(function(section) {
    if (!sectionCounts[section]) brandFrameworkIssues.push({ frameworkKey: section, issue: "missing framework section", title: section });
  });

  var frontendBackendMismatchNotes = [
    "Frontend reads posts/media/inspo/notes/campaigns/settings; backend exposes matching get actions.",
    "Frontend renders publishing readiness locally; backend also exposes publishing validation actions for future use.",
    "Calendar, ledger, queue, and constellation still read POSTS; Notes reads NOTES.",
    "Semantic Memory currently uses lightweight overlap heuristics, campaign proximity, and recurring pattern detection. Embeddings/vector search are future integration points.",
    "When StellarSync is hosted on GitHub Pages, the service worker controls only the app shell origin. Cross-origin Apps Script responses stay network-only and are intentionally not cached.",
    "Scheduling organizes posts inside StellarSync. Live platform posting is not connected yet."
  ];
  var sheetNames = safeDiagnosticsValue_("spreadsheet.getSheets", [], function() {
    return spreadsheet ? spreadsheet.getSheets().map(function(sheet) { return sheet.getName(); }) : [];
  });
  var legacySpreadsheetIdConfigured = safeDiagnosticsValue_("getScriptProp_(SPREADSHEET_ID)", false, function() {
    return !!getScriptProp_("SPREADSHEET_ID");
  });
  var legacySheetIdConfigured = safeDiagnosticsValue_("getScriptProp_(SHEET_ID)", false, function() {
    return !!getScriptProp_("SHEET_ID");
  });

  return {
    ok: true,
    backendReachable: true,
    backendVersion: APP_BACKEND_VERSION,
    warning: diagnosticsWarnings.join(" | "),
    warnings: diagnosticsWarnings,
    source: "google_sheets",
    workspace_slug: receivedWorkspaceContext.workspace_slug || "",
    receivedWorkspaceContext: receivedWorkspaceContext,
    spreadsheetId: spreadsheetId,
    spreadsheetName: spreadsheetName,
    spreadsheetResolutionSource: spreadsheetResolution.source || "",
    legacyScriptPropertiesUsed: !!spreadsheetResolution.legacyScriptPropertiesUsed,
    legacyFallback: {
      scriptPropertiesSpreadsheetIdConfigured: legacySpreadsheetIdConfigured,
      scriptPropertiesSheetIdConfigured: legacySheetIdConfigured
    },
    sheetNames: sheetNames,
    postsSheetName: postsSheet ? postsSheet.getName() : (receivedWorkspaceContext.postsSheetName || SHEETS.POSTS),
    postsHeaderNames: headers,
    headerNames: headers,
    headerCount: headers.length,
    rowCount: rowCount,
    missingPostIdCount: missingPostIdCount,
    rowCounts: rowCounts,
    missingRequiredPostHeaders: missingHeaders.posts || [],
    missingSheets: missingSheets,
    missingHeaders: missingHeaders,
    malformedScheduledRows: malformedScheduledRows,
    invalidQueueDateLabelRows: invalidQueueDateLabelRows,
    missingScheduledAtRows: missingScheduledAtRows,
    scheduledWithoutQueueDateRows: scheduledWithoutQueueDateRows,
    defaultInternalTimeRows: defaultInternalTimeRows,
    dateRepairPreview: dateRepairPreview,
    missingCampaignRows: missingCampaignRows,
    carouselMissingAssets: carouselMissingAssets,
    noteFieldIssues: noteFieldIssues,
    publishingStateIssues: publishingStateIssues,
    invalidPlatformTargetRows: invalidPlatformTargetRows,
    blankPlatformTargetRows: blankPlatformTargetRows,
    importIssues: importIssues,
    dateMismatchRows: dateMismatchRows,
    campaignLayoutIssues: campaignLayoutIssues,
    campaignCleanupDiagnostics: campaignCleanupDiagnostics,
    linkedInRewriteRouteDiagnostics: linkedInRewriteRouteDiagnostics,
    aiDraftIssues: aiDraftIssues,
    aiPostIssues: aiPostIssues,
    brandFrameworkIssues: brandFrameworkIssues,
    campaignCount: campaigns.length,
    mediaCount: media.length,
    postCount: posts.length || rowCount,
    noteCount: notes.length,
    inspoCount: inspo.length,
    aiDraftCount: aiDrafts.length,
    importJobCount: importJobs.length,
    flowIntegrityDiagnostics: flowIntegrityDiagnostics,
    schemaFlowValidation: schemaFlowValidation,
    semanticDiagnostics: {
      overusedHookPatterns: overusedHookPatterns,
      campaignOverlapIssues: campaignOverlapIssues,
      weakClassificationSignals: weakClassificationSignals,
      isolatedCampaigns: isolatedCampaigns,
      orphanedRecords: orphanedRecords,
      semanticDrift: semanticMemory.semanticDrift || []
    },
    socialImportDiagnostics: {
      instagramOEmbedConfigured: !!(socialCapabilities.instagramOEmbed && socialCapabilities.instagramOEmbed.configured),
      openGraphFetchWorks: !!openGraphStatus.works,
      openGraphStatusCode: openGraphStatus.statusCode || "",
      openGraphError: openGraphStatus.error || "",
      connectedPlatforms: connectedAccounts.filter(function(item) { return item.accessStatus === "connected"; }).map(function(item) { return item.platform; }),
      oauthConfigured: connectedAccounts.filter(function(item) { return item.oauthConfigured; }).map(function(item) { return item.platform; }),
      tokensPresent: connectedAccounts.filter(function(item) { return item.tokenStatus === "active"; }).map(function(item) { return item.platform; }),
      expiredTokens: connectedAccounts.filter(function(item) { return item.accessStatus === "expired"; }).map(function(item) { return item.platform; }),
      missingPermissions: connectedAccounts.filter(function(item) { return item.accessStatus === "missing_permissions"; }).map(function(item) { return item.platform; }),
      unsupportedImportModes: connectedAccounts.filter(function(item) { return !item.importSupported; }).map(function(item) { return item.platform; }),
      scaffoldOnlyPublishModes: connectedAccounts.filter(function(item) { return !item.publishSupported; }).map(function(item) { return item.platform; }),
      lastImportErrors: connectedAccounts.filter(function(item) { return item.lastError; }).map(function(item) { return { platform: item.platform, error: item.lastError }; }),
      importFailuresByPlatform: importFailuresByPlatform,
      platformSupport: connectedAccounts.map(function(item) {
        return {
          platform: item.platform,
          captions: !!(item.capabilities && item.capabilities.captions),
          images: !!(item.capabilities && item.capabilities.images),
          importSupported: !!item.importSupported,
          publishSupported: !!item.publishSupported,
          requiredScopes: item.requiredScopes || [],
          accessStatus: item.accessStatus || "not_connected"
        };
      })
    },
    deploymentDiagnostics: deploymentDiagnostics,
    sheetFormulaGuidance: {
      note: "Formula columns are optional. If row-level formulas already exist, StellarSync preserves them during updates. If formulas are absent, the backend writes derived planning fields itself.",
      recommendedFields: ["queue_date_label", "queue_time_label", "calendar_month", "calendar_year", "calendar_day"]
    },
    frontendBackendMismatchNotes: frontendBackendMismatchNotes,
    actionCoverage: {
      get: [
        "getPosts",
        "getMedia",
        "getInspo",
        "getNotes",
        "getQueue",
        "getDashboard",
        "getSettings",
        "getCampaigns",
        "getAIDrafts",
          "getBrandFramework",
          "getAICreationOptions",
          "prepareAIGenerationContext",
          "generateAIDraft",
          "saveIdeaPrompt",
        "prepareIdeaGenerationContext",
        "generateIdeaDraftScaffold",
        "createPostFromIdea",
        "createCampaignFromIdea",
        "createCalendarPlanFromIdea",
        "createCarouselOutlineFromIdea",
        "getSocialImportCapabilities",
        "fetchOpenGraphMetadata",
        "fetchInstagramOEmbed",
        "getConnectedAccounts",
        "getSocialAuthUrl",
        "handleSocialOAuthCallback",
        "importSocialPostByUrl",
        "importSocialPostById",
        "importRecentSocialPosts",
        "getSemanticMemory",
        "getDiagnostics",
        "getPublishingReadiness",
        "validatePostForPublishing",
        "preparePublishPayload",
        "repairDateFields",
        "testRewriteImportedLinkedInRowsRoute",
        "rewriteImportedLinkedInRows",
        "archiveInspo",
        "testMediaSync",
        "cleanTaxonomyValues"
      ],
      post: [
        "savePost",
        "deletePost",
        "duplicatePost",
        "uploadMedia",
        "saveMediaLink",
        "saveInspo",
        "saveNote",
        "deleteNote",
        "createPostFromNote",
        "archiveInspo",
        "saveCampaign",
        "saveBrandFramework",
        "importPostFromUrl",
        "getSocialImportCapabilities",
        "fetchOpenGraphMetadata",
        "fetchInstagramOEmbed",
        "getConnectedAccounts",
        "getSocialAuthUrl",
        "handleSocialOAuthCallback",
        "refreshSocialToken",
        "disconnectSocialAccount",
        "importSocialPostByUrl",
        "importSocialPostById",
        "importRecentSocialPosts",
        "saveImportedSocialPostCard",
        "createImportJob",
        "runImportJobBatch",
        "cancelImportJob",
        "retryImportJobFailures",
        "runStellarAssistant",
        "saveAIDraft",
        "saveAiDraft",
        "createPostFromAIDraft",
        "promoteAiDraftToPost",
        "approveAiDraft",
        "sendAiDraftToLedger",
        "saveIdeaPrompt",
        "prepareIdeaGenerationContext",
        "generateIdeaDraftScaffold",
        "createPostFromIdea",
        "createCampaignFromIdea",
        "createCalendarPlanFromIdea",
        "createCarouselOutlineFromIdea",
        "getDiagnostics",
        "getAICreationOptions",
        "prepareAIGenerationContext",
        "generateAIDraft",
        "getPublishingReadiness",
        "validatePostForPublishing",
        "preparePublishPayload",
        "repairDateFields",
        "cleanupImportedLinkedInPosts",
        "testRewriteImportedLinkedInRowsRoute",
        "rewriteImportedLinkedInRows",
        "updateCampaignColor",
        "queuePublishPost",
        "markPostPublished",
        "markPostFailed",
        "updateCampaignPosition",
        "testMediaSync",
        "cleanTaxonomyValues"
      ]
    }
  };
}

function validateRequiredHeaders_(sheetKey, requiredHeaders) {
  var sheet = findExistingSheet_(sheetKey);
  if (!sheet) return false;
  var currentHeaders = getHeaders_(sheet).map(normalizeHeader_);
  return (requiredHeaders || []).every(function(header) {
    return currentHeaders.indexOf(normalizeHeader_(header)) !== -1;
  });
}

function validatePostForPublishing(payload) {
  const postId = String(payload && payload.postId || "").trim();
  const platform = String(payload && payload.platform || "").trim();
  if (!postId) throw new Error("Missing postId");
  if (!platform) throw new Error("Missing platform");
  const post = getPosts().find(function(item) { return item.postId === postId; });
  if (!post) throw new Error("Post not found");
  return validatePlatformPost_(post, platform);
}

function preparePublishPayload(payload) {
  const postId = String(payload && payload.postId || "").trim();
  const platform = String(payload && payload.platform || "").trim();
  if (!postId) throw new Error("Missing postId");
  if (!platform) throw new Error("Missing platform");
  const post = getPosts().find(function(item) { return item.postId === postId; });
  if (!post) throw new Error("Post not found");
  return buildPlatformPayload_(post, platform);
}

function queuePublishPost(payload) {
  const postId = String(payload && payload.postId || "").trim();
  if (!postId) throw new Error("Missing postId");
  const post = getPosts().find(function(item) { return item.postId === postId; });
  if (!post) throw new Error("Post not found");

  const targets = post.platformTargets && post.platformTargets.length
    ? post.platformTargets
    : parsePlatformTargets_(post.platform);
  const validations = targets.map(function(platform) {
    return validatePlatformPost_(post, platform);
  });
  const hasBlockingIssue = validations.some(function(validation) {
    return !validation.valid;
  });

  const updated = updatePublishStatus_(postId, {
    publish_status: hasBlockingIssue ? "failed_validation" : "queued",
    api_error: hasBlockingIssue ? validations.map(function(validation) {
      return validation.platform + ": " + validation.issues.join(" ");
    }).join(" | ") : "",
    requires_manual_review: validations.some(function(validation) {
      return validation.requiresManualReview;
    })
  });

  return {
    post: updated,
    validations: validations,
    queued: !hasBlockingIssue
  };
}

function markPostPublished(payload) {
  const postId = String(payload && payload.postId || "").trim();
  if (!postId) throw new Error("Missing postId");
  return updatePublishStatus_(postId, {
    publish_status: "published",
    published_url: String(payload.publishedUrl || payload.published_url || "").trim(),
    published_at: String(payload.publishedAt || payload.published_at || new Date().toISOString()).trim(),
    api_post_id: String(payload.apiPostId || payload.api_post_id || "").trim(),
    api_error: ""
  });
}

function markPostFailed(payload) {
  const postId = String(payload && payload.postId || "").trim();
  if (!postId) throw new Error("Missing postId");
  return updatePublishStatus_(postId, {
    publish_status: "failed",
    api_error: String(payload.apiError || payload.api_error || "Publishing failed").trim(),
    requires_manual_review: true
  });
}

function testMediaSync_() {
  var sheet = getCoreSheet_("media");
  var rows = getRowsByNormalizedHeaders_(sheet, REQUIRED_MEDIA_HEADERS);
  var mediaFolderId = String(
    PropertiesService.getScriptProperties().getProperty("MEDIA_FOLDER_ID") || getSetting_("media_folder_id") || ""
  ).trim();
  var latest = rows.length ? rows[rows.length - 1] : null;

  return {
    mediaRowCount: rows.length,
    latestAsset: latest ? {
      assetId: String(latest.asset_id || "").trim(),
      assetName: String(latest.asset_name || "").trim(),
      linkedPostId: String(latest.linked_post_id || "").trim(),
      campaign: String(latest.campaign || "").trim(),
      hasFileUrl: !!String(latest.file_url || "").trim(),
      hasSourceUrl: !!String(latest.source_url || "").trim(),
      driveFileId: String(latest.drive_file_id || "").trim(),
      updatedAt: String(latest.updated_at || latest.created_at || "").trim()
    } : null,
    latestHasFileUrl: !!(latest && String(latest.file_url || "").trim()),
    latestHasSourceUrl: !!(latest && String(latest.source_url || "").trim()),
    mediaFolderConfigured: !!mediaFolderId,
    mediaFolderId: mediaFolderId
  };
}

function cleanTaxonomyValues() {
  var postsSheet = getPostsSheet_();
  var campaignsSheet = getCoreSheet_("campaign");
  var postRows = getPostsData_().map(normalizePostSchemaAliases_);
  var campaignRows = getRowsByNormalizedHeaders_(campaignsSheet, REQUIRED_CAMPAIGN_HEADERS);
  var postUpdates = 0;
  var campaignUpdates = 0;
  var campaignMap = {};

  campaignRows.forEach(function(row) {
    var campaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID, row.campaignid));
    var nextPillar = normalizePillar_(pickFirstDefined_(row.pillar, row.hub_pillar_label, row.hubPillarLabel), "");
    var changed = false;

    if (String(row.pillar || "").trim() !== nextPillar) {
      row.pillar = nextPillar;
      changed = true;
    }

    if (campaignId) {
      row.campaign_id = campaignId;
      row.campaignID = campaignId;
      campaignMap[String(campaignId)] = {
        campaignId: campaignId,
        campaignName: String(pickFirstDefined_(row.campaign_name, row.campaignName, row.campaignname)).trim(),
        pillar: nextPillar
      };
    }

    if (changed) {
      row.updated_at = new Date().toISOString();
      upsertObjectByHeader_(campaignsSheet, ["campaign_id", "campaignID", "campaignid"], row, REQUIRED_CAMPAIGN_HEADERS, CAMPAIGN_FORMULA_HEADERS);
      campaignUpdates += 1;
    }
  });

  postRows.forEach(function(row) {
    var campaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID));
    var matchedCampaign = campaignMap[String(campaignId || "")] || null;
    var nextPillar = normalizePillar_(
      pickFirstDefined_(row.pillar, row.hub_pillar_label, row.hubPillarLabel, matchedCampaign && matchedCampaign.pillar),
      matchedCampaign && matchedCampaign.pillar || SETTINGS_DEFAULTS.pillars[0]
    ) || SETTINGS_DEFAULTS.pillars[0];
    var nextHubPillarLabel = pillarDisplayLabel_(
      pickFirstDefined_(row.hub_pillar_label, row.hubPillarLabel, nextPillar),
      nextPillar
    );
    var changed = false;

    if (String(row.pillar || "").trim() !== nextPillar) {
      row.pillar = nextPillar;
      changed = true;
    }
    if (String(row.hub_pillar_label || "").trim() !== nextHubPillarLabel) {
      row.hub_pillar_label = nextHubPillarLabel;
      changed = true;
    }

    if (changed) {
      row.updated_at = new Date().toISOString();
      upsertPostObjectById_(postsSheet, row);
      postUpdates += 1;
    }
  });

  return {
    ok: true,
    postsUpdated: postUpdates,
    campaignsUpdated: campaignUpdates
  };
}

// ===== AI PROVIDER CONFIG =====

function getAIProviderConfig(payload) {
  var providerId = String(payload && payload.provider || "").trim().toLowerCase();
  var config = AI_PROVIDERS.filter(function(p) { return p.id === providerId; })[0] || null;
  if (!config) {
    if (providerId) return { ok: false, error: "Unknown AI provider: " + providerId };
    return {
      ok: true,
      providers: AI_PROVIDERS.map(function(p) {
        return {
          id: p.id,
          label: p.label,
          defaultApiUrl: p.defaultApiUrl,
          keyConfigured: p.apiKeyConfigured || (p.apiKeyKey ? !!getScriptProp_(p.apiKeyKey) : false),
          hasApiUrl: !!p.defaultApiUrl || !!getScriptProp_(p.id.toUpperCase() + "_API_URL")
        };
      })
    };
  }
  return {
    ok: true,
    provider: {
      id: config.id,
      label: config.label,
      defaultApiUrl: config.defaultApiUrl,
      keyConfigured: config.apiKeyConfigured || (config.apiKeyKey ? !!getScriptProp_(config.apiKeyKey) : false),
      hasApiUrl: !!config.defaultApiUrl || !!getScriptProp_(config.id.toUpperCase() + "_API_URL")
    }
  };
}

function saveAIProviderConfig(payload) {
  var providerId = String(payload && payload.provider || "").trim().toLowerCase();
  var apiKey = String(payload && payload.apiKey || "").trim();
  var apiUrl = String(payload && payload.apiUrl || "").trim();

  var config = AI_PROVIDERS.filter(function(p) { return p.id === providerId; })[0] || null;
  if (!config) throw new Error("Unknown AI provider: " + providerId);

  if (providerId === "local_creator_engine") {
    return { ok: true, provider: providerId, keyConfigured: true, warning: "Local Creator Engine does not require an API key." };
  }

  return {
    ok: true,
    provider: providerId,
    deprecated: true,
    ignoredRequestSecrets: !!apiKey,
    keyConfigured: config.apiKeyKey ? !!getScriptProp_(config.apiKeyKey) : false,
    hasApiUrl: !!getScriptProp_(providerId.toUpperCase() + "_API_URL") || !!config.defaultApiUrl,
    message: "User-facing AI provider setup is managed outside this Apps Script backend. Request-supplied API keys are not stored."
  };
}

function testAIProviderConnection(payload) {
  var providerId = String(payload && payload.provider || "").trim().toLowerCase();
  if (providerId === "local_creator_engine") {
    return { ok: true, connected: true, provider: providerId, diagnostics: ["Local Creator Engine is always available."] };
  }
  var config = AI_PROVIDERS.filter(function(p) { return p.id === providerId; })[0] || null;
  if (!config) throw new Error("Unknown AI provider: " + providerId);
  if (!config.apiKeyKey) {
    return { ok: true, connected: false, provider: providerId, diagnostics: ["This provider does not use an API key. Check local configuration."] };
  }
  var apiKey = getScriptProp_(config.apiKeyKey);
  if (!apiKey) {
    return { ok: true, connected: false, provider: providerId, diagnostics: ["No API key configured for " + config.label + "."] };
  }
  try {
    var apiUrl = getScriptProp_(providerId.toUpperCase() + "_API_URL") || config.defaultApiUrl;
    if (providerId === "openai") {
      var resp = fetchJson_(apiUrl + "/models", {
        method: "get",
        metaLabel: config.label + " test",
        headers: { Authorization: "Bearer " + apiKey }
      });
      return { ok: true, connected: !!resp, provider: providerId, diagnostics: ["API key valid. Models endpoint reachable."] };
    }
    if (providerId === "claude") {
      var resp = fetchJson_(apiUrl + "/messages", {
        method: "post",
        metaLabel: config.label + " test",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        payload: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "ping" }] })
      });
      return { ok: true, connected: !!resp, provider: providerId, diagnostics: ["API key valid."] };
    }
    if (providerId === "gemini") {
      var resp = fetchJson_(apiUrl + "/models?key=" + encodeURIComponent(apiKey), {
        method: "get",
        metaLabel: config.label + " test"
      });
      return { ok: true, connected: !!resp, provider: providerId, diagnostics: ["API key valid."] };
    }
    var resp = fetchJson_(apiUrl + "/models", {
      method: "get",
      metaLabel: config.label + " test",
      headers: { Authorization: "Bearer " + apiKey }
    });
    return { ok: true, connected: !!resp, provider: providerId, diagnostics: ["API key valid."] };
  } catch (err) {
    return { ok: true, connected: false, provider: providerId, diagnostics: ["Connection test failed: " + sanitizeErrorMessage_(err && err.message || err)] };
  }
}

function disconnectAIProvider(payload) {
  var providerId = String(payload && payload.provider || "").trim().toLowerCase();
  var config = AI_PROVIDERS.filter(function(p) { return p.id === providerId; })[0] || null;
  if (!config) throw new Error("Unknown AI provider: " + providerId);
  if (config.apiKeyKey) deleteScriptProps_([config.apiKeyKey]);
  deleteScriptProps_([providerId.toUpperCase() + "_API_URL"]);
  return { ok: true, provider: providerId, disconnected: true };
}

function getOptionalCoreSheet_(sheetKey) {
  try {
    return getCoreSheet_(sheetKey);
  } catch (_) {
    return null;
  }
}

function collectFormulaDiagnostics_(sheet, sheetKey, formulaHeaders) {
  var diagnostics = {
    missingFormulas: [],
    errors: []
  };
  if (!sheet) return diagnostics;
  var headerMap = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return diagnostics;
  (formulaHeaders || []).forEach(function(header) {
    var key = normalizeHeader_(header);
    var col = headerMap[key];
    if (!col) return;
    var range = sheet.getRange(2, col, lastRow - 1, 1);
    var formulas = range.getFormulas();
    var values = range.getDisplayValues();
    var missingRows = [];
    for (var r = 0; r < values.length; r += 1) {
      var display = String(values[r][0] || "").trim();
      var formula = String(formulas[r][0] || "").trim();
      if (display && display.charAt(0) === "#") {
        diagnostics.errors.push({
          sheet: sheetKey,
          header: key,
          row: r + 2,
          error: display
        });
      }
      if (!formula) missingRows.push(r + 2);
    }
    if (missingRows.length) {
      diagnostics.missingFormulas.push({
        sheet: sheetKey,
        header: key,
        rows: missingRows.slice(0, 25),
        count: missingRows.length
      });
    }
  });
  return diagnostics;
}

function validateSheetHeaders_(sheet, requiredHeaders) {
  if (!sheet) return (requiredHeaders || []).slice();
  var currentHeaders = getHeaders_(sheet).map(normalizeHeader_);
  return (requiredHeaders || []).filter(function(header) {
    return currentHeaders.indexOf(normalizeHeader_(header)) === -1;
  });
}

function validateSchemaFlow() {
  var ss = SpreadsheetApp.getActive();
  var result = {
    sheetsFound: [],
    missingRequiredHeadersBySheet: {},
    missingHeaders: {},
    formulaColumnsMissingFormulas: [],
    formulaErrors: [],
    rowsWithMissingTitles: {
      posts: [],
      notes: [],
      aiDrafts: [],
      media: [],
      inspo: []
    },
    rowsMissingTitles: {
      posts: 0,
      notes: 0,
      aiDrafts: 0,
      media: 0,
      inspo: 0
    },
    rowsWithMissingCampaignIds: {
      posts: [],
      notes: [],
      aiDrafts: [],
      media: [],
      inspo: []
    },
    rowsMissingCampaignIds: {
      posts: 0,
      notes: 0,
      aiDrafts: 0,
      media: 0,
      inspo: 0
    },
    orphanAiDrafts: [],
    orphanMedia: [],
    notesNotLinkedToDraftsOrPosts: [],
    frontendAliasCoverageCheck: {},
    hardCodedIndexRisks: [],
    allowedCampaignsFromSettings: [],
    postsWithUnknownCampaign: [],
    constellationLaneNames: [],
    pillarValuesIncorrectlyUsedAsCampaigns: [],
    campaignDropdownSource: "SETTINGS!L:L",
    pillarDropdownSource: "SETTINGS pillars",
    recordCounts: {
      posts: 0,
      notes: 0,
      aiDrafts: 0,
      media: 0,
      inspo: 0
    },
    performanceMetricHeadersFound: [],
    postsWithImpressions: 0,
    postsWithEngagementTotal: 0,
    postsWithEngagementRate: 0,
    postsWithValidPerformanceDate: 0,
    performancePostsReturned: 0,
    firstFivePerformancePosts: [],
    warnings: []
  };

  var sheetConfigs = {
    posts: { key: "posts", required: REQUIRED_POST_HEADERS, formulas: POST_FORMULA_HEADERS, normalizer: normalizePostRow_ },
    notes: { key: "notes", required: REQUIRED_NOTE_HEADERS, formulas: NOTE_FORMULA_HEADERS, normalizer: normalizeNoteRow_ },
    aiDrafts: { key: "aiDrafts", required: REQUIRED_AI_DRAFT_HEADERS, formulas: AI_DRAFT_FORMULA_HEADERS, normalizer: normalizeAiDraftRow_ },
    media: { key: "media", required: REQUIRED_MEDIA_HEADERS, formulas: MEDIA_FORMULA_HEADERS, normalizer: normalizeMediaRow_ },
    inspo: { key: "inspo", required: REQUIRED_INSPO_HEADERS, formulas: INSPO_FORMULA_HEADERS, normalizer: normalizeInspoRow_ }
  };

  ["POSTS", "notes", "ai_drafts", "MEDIA", "INSPO", "CAMPAIGN", "CALENDAR_VIEW", "QUEUE_VIEW", "CONSTELLATION_VIEW", "LEDGER_VIEW", "DASHBOARD"].forEach(function(name) {
    if (ss.getSheetByName(name)) result.sheetsFound.push(name);
  });

  var normalizedRows = {};
  Object.keys(sheetConfigs).forEach(function(label) {
    var config = sheetConfigs[label];
    var sheet = label === "posts" ? findExistingSheet_("posts") : getOptionalCoreSheet_(config.key);
    result.missingRequiredHeadersBySheet[label] = validateSheetHeaders_(sheet, config.required);
    result.missingHeaders[label] = result.missingRequiredHeadersBySheet[label];
    if (!sheet) {
      result.missingHeaders[label] = (config.required || []).slice();
      normalizedRows[label] = [];
      return;
    }
    var rows = getRowsByNormalizedHeaders_(sheet, []);
    normalizedRows[label] = rows.map(function(row) {
      return config.normalizer(row);
    });
    result.recordCounts[label] = normalizedRows[label].length;

    var formulaDiagnostics = collectFormulaDiagnostics_(sheet, label, config.formulas);
    result.formulaColumnsMissingFormulas = result.formulaColumnsMissingFormulas.concat(formulaDiagnostics.missingFormulas);
    result.formulaErrors = result.formulaErrors.concat(formulaDiagnostics.errors);
  });

  var posts = normalizedRows.posts || [];
  var notes = normalizedRows.notes || [];
  var aiDrafts = normalizedRows.aiDrafts || [];
  var media = normalizedRows.media || [];
  var inspo = normalizedRows.inspo || [];
  var postIds = {};
  var aiDraftIds = {};
  var allowedCampaigns = getAllowedCampaignNames_();
  var allowedCampaignKeys = {};
  var settings = getSettingsRegistry();
  var pillarValues = (settings.pillars || []).map(function(value) { return String(value || "").trim(); }).filter(Boolean);
  var pillarKeys = {};
  allowedCampaigns.forEach(function(name) { allowedCampaignKeys[normalizeKey_(name)] = name; });
  pillarValues.forEach(function(name) { pillarKeys[normalizeKey_(name)] = name; });
  var postsSheet = findExistingSheet_("posts");
  var performanceHeaderAliases = [
    "impressions", "impression_count", "views", "view_count", "reach",
    "likes", "like_count", "reactions", "reaction_count",
    "comments", "comment_count", "shares", "share_count", "reposts", "repost_count",
    "saves", "save_count", "clicks", "click_count", "link_clicks",
    "engagement_total", "total_engagement", "engagements", "engagement_rate", "save_rate", "click_rate",
    "publish_date", "scheduled_at", "posted_at", "created_at"
  ];
  if (postsSheet) {
    var currentPostHeaders = getHeaders_(postsSheet).map(normalizeHeader_);
    result.performanceMetricHeadersFound = performanceHeaderAliases.filter(function(header) {
      return currentPostHeaders.indexOf(normalizeHeader_(header)) !== -1;
    });
  }
  result.performancePostsReturned = posts.length;
  result.postsWithImpressions = posts.filter(function(post) { return normalizeNumber_(post.impressions) > 0; }).length;
  result.postsWithEngagementTotal = posts.filter(function(post) { return normalizeNumber_(post.engagement_total || post.total_engagement || post.engagementTotal) > 0; }).length;
  result.postsWithEngagementRate = posts.filter(function(post) { return normalizeNumber_(post.engagement_rate || post.engagementRate) > 0; }).length;
  result.postsWithValidPerformanceDate = posts.filter(function(post) {
    return String(pickFirstDefined_(post.scheduled_at, post.publish_date, post.posted_at, post.created_at, "")).trim() !== "";
  }).length;
  result.firstFivePerformancePosts = posts.slice(0, 5).map(function(post) {
    return {
      title: post.title || "",
      date: String(pickFirstDefined_(post.scheduled_at, post.publish_date, post.posted_at, post.created_at, "")).trim(),
      impressions: normalizeNumber_(post.impressions),
      engagement_total: normalizeNumber_(post.engagement_total || post.total_engagement || post.engagementTotal),
      engagement_rate: normalizeNumber_(post.engagement_rate || post.engagementRate)
    };
  });
  if (posts.length && !result.postsWithImpressions) result.warnings.push("All post impressions are zero or blank.");
  if (posts.length && !result.postsWithEngagementTotal) result.warnings.push("All post engagement totals are zero or blank.");
  if (posts.length && !result.postsWithEngagementRate) result.warnings.push("All post engagement rates are zero or blank.");
  if (posts.length && !result.postsWithValidPerformanceDate) result.warnings.push("No posts have scheduled_at, publish_date, posted_at, or created_at for performance charts.");
  result.allowedCampaignsFromSettings = allowedCampaigns;
  posts.forEach(function(post) { if (post.post_id) postIds[post.post_id] = true; });
  aiDrafts.forEach(function(draft) { if (draft.ai_draft_id) aiDraftIds[draft.ai_draft_id] = true; });

  posts.forEach(function(post) {
    var rawCampaign = String(pickFirstDefined_(post.campaign_name, post.campaignName, post.campaign, "")).trim();
    var key = normalizeKey_(rawCampaign);
    if (rawCampaign && !allowedCampaignKeys[key]) {
      result.postsWithUnknownCampaign.push({
        row: post.row_number,
        postId: post.post_id || "",
        title: post.title || "",
        campaignName: rawCampaign
      });
    }
  });
  result.constellationLaneNames = allowedCampaigns.concat(["Uncategorized"]);
  result.pillarValuesIncorrectlyUsedAsCampaigns = result.constellationLaneNames.filter(function(name) {
    return name !== "Uncategorized" && !!pillarKeys[normalizeKey_(name)];
  });
  result.hardCodedIndexRisks = [
    {
      file: "gpe_code.gs",
      detail: "Static scan should be run on source for numeric getRange/array indexes near sheet mapping; runtime schema paths use getHeaderMap_().",
      severity: "info"
    }
  ];

  function trackMissingTitle(label, rows, idKey, fallbackValue) {
    rows.forEach(function(row) {
      var title = String(row.title || "").trim();
      if (!title || title === fallbackValue) {
        result.rowsWithMissingTitles[label].push({ row: row.row_number, id: row[idKey] || "", title: title });
      }
    });
    result.rowsMissingTitles[label] = result.rowsWithMissingTitles[label].length;
  }

  trackMissingTitle("posts", posts, "post_id", "Untitled post");
  trackMissingTitle("notes", notes, "note_id", "Untitled note");
  trackMissingTitle("aiDrafts", aiDrafts, "ai_draft_id", "Untitled draft");
  trackMissingTitle("media", media, "asset_id", "Untitled media");
  trackMissingTitle("inspo", inspo, "inspo_id", "Untitled inspiration");

  function trackMissingCampaign(label, rows, idKey) {
    rows.forEach(function(row) {
      if (!String(row.campaign_id || row.campaignId || row.campaign_name || row.campaignName || "").trim()) {
        result.rowsWithMissingCampaignIds[label].push({ row: row.row_number, id: row[idKey] || "", title: row.title || "" });
      }
    });
    result.rowsMissingCampaignIds[label] = result.rowsWithMissingCampaignIds[label].length;
  }

  trackMissingCampaign("posts", posts, "post_id");
  trackMissingCampaign("notes", notes, "note_id");
  trackMissingCampaign("aiDrafts", aiDrafts, "ai_draft_id");
  trackMissingCampaign("media", media, "asset_id");
  trackMissingCampaign("inspo", inspo, "inspo_id");

  result.orphanAiDrafts = aiDrafts.filter(function(draft) {
    return !String(draft.parent_artifact_id || draft.root_artifact_id || draft.source_id || draft.source_type || "").trim()
      && !String(draft.created_post_id || "").trim();
  }).map(function(draft) {
    return { row: draft.row_number, aiDraftId: draft.ai_draft_id, title: draft.title };
  });

  result.orphanMedia = media.filter(function(asset) {
    var linkedPost = String(asset.linked_post_id || "").trim();
    var linkedDraft = String(asset.linked_ai_draft_id || "").trim();
    return (!linkedPost || !postIds[linkedPost]) && (!linkedDraft || !aiDraftIds[linkedDraft]);
  }).map(function(asset) {
    return { row: asset.row_number, assetId: asset.asset_id, title: asset.title, linkedPostId: asset.linked_post_id, linkedAiDraftId: asset.linked_ai_draft_id };
  });

  result.notesNotLinkedToDraftsOrPosts = notes.filter(function(note) {
    return !String(note.linked_post_id || note.converted_post_id || note.linked_ai_draft_id || note.source_ai_draft_id || "").trim();
  }).map(function(note) {
    return { row: note.row_number, noteId: note.note_id, title: note.title };
  });

  result.frontendAliasCoverageCheck = {
    posts: ["post_id", "title", "status", "publish_date", "publish_time", "scheduled_at", "posted_at", "platform", "campaign_name", "campaign_id", "pillar", "format", "description", "impressions", "impression_count", "views", "view_count", "reach", "likes", "like_count", "reactions", "reaction_count", "comments", "comment_count", "shares", "share_count", "reposts", "repost_count", "saves", "save_count", "clicks", "click_count", "link_clicks", "engagement_total", "total_engagement", "engagements", "engagement_rate", "save_rate", "click_rate"],
    notes: ["note_id", "title", "note_title", "body", "note_body", "summary", "campaign_name", "pillar", "source_type", "created_at", "updated_at", "linked_post_id", "linked_ai_draft_id"],
    aiDrafts: ["ai_draft_id", "title", "draft_title", "draft_text", "campaign_name", "campaign_id", "source_id", "source_type", "parent_artifact_id", "root_artifact_id", "derived_from_ids", "media_ids", "performance_context", "analysis_mode", "created_post_id", "status"],
    media: ["asset_id", "title", "media_title", "asset_title", "type", "media_type", "url", "source_url", "thumbnail_url", "campaign_name", "linked_post_id", "linked_ai_draft_id", "alt_text", "status"],
    inspo: ["inspo_id", "title", "summary", "campaign_name", "linked_post_id", "linked_ai_draft_id"]
  };

  return result;
}
