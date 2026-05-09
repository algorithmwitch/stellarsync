function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse_(obj) {
  return jsonResponse(obj);
}

const APP_BACKEND_VERSION = "2026.05.09.8";

const SHEET_NAMES = {
  posts: ["posts", "POSTS"],
  media: ["media", "MEDIA"],
  inspo: ["inspo", "INSPO"],
  notes: ["notes", "NOTES"],
  aiDrafts: ["ai_drafts", "AI_DRAFTS"],
  brandFramework: ["brand_framework", "BRAND_FRAMEWORK"],
  dashboard: ["dashboard", "DASHBOARD"],
  settings: ["settings", "SETTINGS"],
  campaign: ["campaigns", "CAMPAIGN", "campaign"]
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
  "ledger_excerpt",
  "constellation_meta",
  "media_label",
  "created_from_inspo_id",
  "created_from_note_id",
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
  "source_platform",
  "source_title",
  "source_metadata",
  "source_import_status",
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

const INSPO_HEADERS = [
  "inspo_id",
  "title",
  "inspo_type",
  "source_label",
  "summary",
  "domain_or_meta",
  "suggested_platform",
  "suggested_pillar",
  "create_post_title",
  "create_post_description",
  "create_post_type",
  "notes",
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
  "title",
  "platform",
  "post_type",
  "generation_mode",
  "source_type",
  "source_id",
  "campaign_id",
  "campaign_name",
  "prompt",
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
const SOCIAL_PLATFORMS = ["linkedin", "instagram", "threads", "bluesky"];

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
  platforms: ["linkedin", "instagram", "both"],
  pillars: ["authority", "distribution", "identity", "application"],
  statuses: ["draft", "scheduled", "published"],
  postTypes: ["image", "carousel", "video", "article", "text", "poll"],
  campaigns: [
    "Alternate Realities",
    "Job Posts",
    "Community Shout Outs",
    "Algorithm Best Practices",
    "Offerings",
    "Long-Form Content Loop",
    "Messaging"
  ],
  campaignColors: {
    "Alternate Realities": "#c77dff",
    "Job Posts": "#00ffaa",
    "Community Shout Outs": "#ffd700",
    "Algorithm Best Practices": "#00f0ff",
    "Offerings": "#b25fff",
    "Long-Form Content Loop": "#f472b6",
    "Messaging": "#fb923c"
  },
  months: [],
  queueLimit: "",
  currentMonth: "",
  currentYear: "",
  mediaFolderId: ""
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "").trim();

  try {
    if (!action) {
      return jsonResponse({
        ok: true,
        backendVersion: APP_BACKEND_VERSION,
        actions: [
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
          "archiveInspo",
          "testMediaSync",
          "cleanTaxonomyValues",
          "uploadMedia",
          "saveMediaLink"
        ]
      });
    }

    if (action === "getPosts") return jsonResponse({ ok: true, items: getPosts() });
    if (action === "getMedia") return jsonResponse({ ok: true, items: getMedia() });
    if (action === "getInspo") return jsonResponse({ ok: true, items: getInspo() });
    if (action === "getNotes") return jsonResponse({ ok: true, items: getNotes() });
    if (action === "getQueue") return jsonResponse({ ok: true, items: getQueue() });
    if (action === "getDashboard") return jsonResponse({ ok: true, summary: getDashboardSummary() });
    if (action === "getSettings") return jsonResponse({ ok: true, settings: getSettingsRegistry() });
    if (action === "getCampaigns") return jsonResponse({ ok: true, items: getCampaigns() });
    if (action === "getAIDrafts") return jsonResponse({ ok: true, items: getAIDrafts() });
    if (action === "getBrandFramework") return jsonResponse({ ok: true, items: getBrandFramework() });
    if (action === "getAICreationOptions") return jsonResponse({ ok: true, options: getAICreationOptions(payloadOrParams_(e)) });
    if (action === "prepareAIGenerationContext") return jsonResponse({ ok: true, context: prepareAIGenerationContext(payloadOrParams_(e)) });
    if (action === "getSocialImportCapabilities") return jsonResponse({ ok: true, capabilities: getSocialImportCapabilities(payloadOrParams_(e)) });
    if (action === "fetchOpenGraphMetadata") return jsonResponse({ ok: true, result: fetchOpenGraphMetadata(payloadOrParams_(e)) });
    if (action === "fetchInstagramOEmbed") return jsonResponse({ ok: true, result: fetchInstagramOEmbed(payloadOrParams_(e)) });
    if (action === "getConnectedAccounts") return jsonResponse({ ok: true, accounts: getConnectedAccounts() });
    if (action === "getSocialAuthUrl") return jsonResponse({ ok: true, auth: getSocialAuthUrl(payloadOrParams_(e)) });
    if (action === "handleSocialOAuthCallback") return jsonResponse({ ok: true, result: handleSocialOAuthCallback(payloadOrParams_(e)) });
    if (action === "importSocialPostByUrl") return jsonResponse({ ok: true, imported: importSocialPostByUrl(payloadOrParams_(e)) });
    if (action === "importSocialPostById") return jsonResponse({ ok: true, imported: importSocialPostById(payloadOrParams_(e)) });
    if (action === "importRecentSocialPosts") return jsonResponse({ ok: true, items: importRecentSocialPosts(payloadOrParams_(e)) });
    if (action === "getSemanticMemory") return jsonResponse({ ok: true, semanticMemory: getSemanticMemory(payloadOrParams_(e)) });
    if (action === "getDiagnostics") return jsonResponse({ ok: true, backendVersion: APP_BACKEND_VERSION, diagnostics: getDiagnostics(payloadOrParams_(e)) });
    if (action === "getPublishingReadiness") return jsonResponse({ ok: true, readiness: getPublishingReadiness(payloadOrParams_(e)) });
    if (action === "validatePostForPublishing") return jsonResponse({ ok: true, validation: validatePostForPublishing(payloadOrParams_(e)) });
    if (action === "preparePublishPayload") return jsonResponse({ ok: true, payload: preparePublishPayload(payloadOrParams_(e)) });
    if (action === "archiveInspo") return jsonResponse({ ok: true, inspo: archiveInspo({ inspoId: (e && e.parameter && e.parameter.inspoId) || "", convertedPostId: (e && e.parameter && e.parameter.convertedPostId) || "" }) });
    if (action === "testMediaSync") return jsonResponse({ ok: true, diagnostics: testMediaSync_() });
    if (action === "cleanTaxonomyValues") return jsonResponse({ ok: true, results: cleanTaxonomyValues() });

    return jsonResponse({ ok: false, error: "Invalid action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "").trim();
    const payload = body.payload || {};

    if (action === "savePost") {
      const savedPost = savePost(payload);
      return jsonResponse({ ok: true, post: savedPost, postId: savedPost.postId });
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

    if (action === "saveMediaLink") {
      return jsonResponse({ ok: true, asset: saveMediaLink(payload) });
    }

    if (action === "saveInspo") {
      const savedInspo = saveInspo(payload);
      return jsonResponse({ ok: true, inspo: savedInspo, inspoId: savedInspo.inspoId });
    }

    if (action === "saveNote") {
      const savedNote = saveNote(payload);
      return jsonResponse({ ok: true, note: savedNote, noteId: savedNote.noteId });
    }

    if (action === "deleteNote") {
      deleteNote(payload.noteId);
      return jsonResponse({ ok: true, deleted: true, noteId: String(payload.noteId || "").trim() });
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

    if (action === "saveBrandFramework") {
      return jsonResponse({ ok: true, items: saveBrandFramework(payload) });
    }

    if (action === "saveAIDraft") {
      return jsonResponse({ ok: true, draft: saveAIDraft(payload) });
    }

    if (action === "createPostFromAIDraft") {
      return jsonResponse({ ok: true, post: createPostFromAIDraft(payload) });
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

    if (action === "getSocialAuthUrl") {
      return jsonResponse({ ok: true, auth: getSocialAuthUrl(payload) });
    }

    if (action === "handleSocialOAuthCallback") {
      return jsonResponse({ ok: true, result: handleSocialOAuthCallback(payload) });
    }

    if (action === "refreshSocialToken") {
      return jsonResponse({ ok: true, account: refreshSocialToken(payload) });
    }

    if (action === "disconnectSocialAccount") {
      return jsonResponse({ ok: true, disconnected: disconnectSocialAccount(payload) });
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

    if (action === "saveImportedSocialPostCard") {
      return jsonResponse({ ok: true, card: saveImportedSocialPostCard(payload) });
    }

    if (action === "getDiagnostics") {
      return jsonResponse({ ok: true, backendVersion: APP_BACKEND_VERSION, diagnostics: getDiagnostics(payload) });
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

    if (action === "getAICreationOptions") {
      return jsonResponse({ ok: true, options: getAICreationOptions(payload) });
    }

    if (action === "prepareAIGenerationContext") {
      return jsonResponse({ ok: true, context: prepareAIGenerationContext(payload) });
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

    return jsonResponse({ ok: false, error: "Invalid action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
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

function getHeaderMap_(sheet) {
  const map = {};
  getHeaders_(sheet).forEach(function(header, index) {
    if (header) map[header] = index + 1;
  });
  return map;
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

  if (!arrayAssignments.platforms || !settings.platforms.length) settings.platforms = cloneSettingsDefaults_().platforms;
  if (!arrayAssignments.pillars || !settings.pillars.length) settings.pillars = cloneSettingsDefaults_().pillars;
  if (!arrayAssignments.statuses || !settings.statuses.length) settings.statuses = cloneSettingsDefaults_().statuses;
  if (!arrayAssignments.postTypes || !settings.postTypes.length) settings.postTypes = cloneSettingsDefaults_().postTypes;
  if (!arrayAssignments.campaigns || !settings.campaigns.length) settings.campaigns = cloneSettingsDefaults_().campaigns;
  settings.campaignColors = buildCampaignColorMap_(settings.campaignColors);

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
  sheet.appendRow(row);
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
  const values = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : "";
  });
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
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
  return "POST-" + Utilities.getUuid().slice(0, 8).toUpperCase();
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

function createCampaignId_() {
  return "CMP-" + Utilities.getUuid().slice(0, 8).toUpperCase();
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

function normalizeCampaignName_(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCampaignLookup_(value) {
  return normalizeSettingKey_(normalizeCampaignName_(value));
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

function normalizePillar_(value, fallback) {
  var normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return fallback === undefined ? "" : normalizePillar_(fallback);
  }

  var canonicalMap = {
    iden: "identity",
    ident: "identity",
    identity: "identity",
    authority: "authority",
    distribution: "distribution",
    application: "application"
  };

  if (canonicalMap[normalized]) return canonicalMap[normalized];
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
      Session.getScriptTimeZone(),
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
      Session.getScriptTimeZone(),
      "yyyy-MM-dd'T'HH:mm"
    );
  }

  return text;
}

function parseSheetDate_(value) {
  if (!value) return new Date(0);

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value;
  }

  const parsedLocal = parseLocalDateTime_(value);
  if (parsedLocal) return parsedLocal;

  const str = String(value).trim().replace(" ", "T");
  const parsed = new Date(str);

  if (!isNaN(parsed)) return parsed;
  return new Date(0);
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
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
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
  const d = parseSheetDate_(value);
  if (isNaN(d)) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMM d");
}

function formatQueueTime_(value) {
  const d = parseSheetDate_(value);
  if (isNaN(d)) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "h:mm a");
}

function detectAssetType_(mimeType, fileName) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();

  if (mime.indexOf("video") !== -1) return "video";
  if (name.indexOf("carousel") !== -1) return "carousel";
  return "image";
}

function normalizeNumber_(value) {
  const num = Number(value || 0);
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

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActive();
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
  const sheet = ensureSheet_("posts", POST_HEADERS);
  const settings = getSettingsRegistry();
  const defaultPillar = settings.pillars[0] || "authority";
  const campaignMap = buildCampaignMap_();
  const campaignNameMap = buildCampaignNameMap_();
  const mediaItems = getMedia();

  return getObjectsFromSheet_(sheet).map(function(row) {
    const rawCampaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID));
    const rawCampaignName = normalizeCampaignName_(pickFirstDefined_(row.campaign_name, row.campaignName));
    const matchedCampaign = campaignMap[String(rawCampaignId || "")] || campaignNameMap[normalizeCampaignLookup_(rawCampaignName)] || null;
    const campaignId = rawCampaignId || (matchedCampaign && matchedCampaign.campaignId) || "";
    const scheduledAt = normalizeDateTime_(pickFirstDefined_(row.scheduled_at, row.scheduledAt));
    const hubPillarLabel = pillarDisplayLabel_(
      pickFirstDefined_(row.hub_pillar_label, row.hubPillarLabel, row.pillar, matchedCampaign && matchedCampaign.pillar),
      matchedCampaign && matchedCampaign.pillar
    );
    const postId = String(pickFirstDefined_(row.post_id, row.postId, row.id)).trim();
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
    const queueDateLabel = String(row.queue_date_label || "").trim() || formatQueueDate_(scheduledAt);
    const scheduledDateKey = parseDisplayDateKey_(queueDateLabel) || getLocalDateKey_(scheduledAt);

    return Object.assign({
      postId: postId,
      title: String(pickFirstDefined_(row.title, row.post_title, row.postTitle)).trim(),
      platform: String(row.platform || "linkedin").trim() || "linkedin",
      postType: String(pickFirstDefined_(row.post_type, row.postType, "text")).trim() || "text",
      pillar: canonicalPillar,
      scheduledAt: scheduledAt,
      status: normalizeStatus_(pickFirstDefined_(row.status, row.post_status, row.postStatus, "draft")),
      description: String(pickFirstDefined_(row.description, row.caption, row.body)).trim(),
      assetId: String(pickFirstDefined_(row.asset_id, row.assetId)).trim(),
      hubTitle: String(pickFirstDefined_(row.hub_title, row.hubTitle, row.title)).trim(),
      hubPillarLabel: hubPillarLabel,
      queueDateLabel: queueDateLabel,
      queueTimeLabel: String(row.queue_time_label || "").trim() || formatQueueTime_(scheduledAt),
      ledgerExcerpt: String(pickFirstDefined_(row.ledger_excerpt, row.ledgerExcerpt)).trim(),
      constellationMeta: String(pickFirstDefined_(row.constellation_meta, row.constellationMeta)).trim(),
      mediaLabel: String(pickFirstDefined_(row.media_label, row.mediaLabel)).trim(),
      createdFromInspoId: String(pickFirstDefined_(row.created_from_inspo_id, row.createdFromInspoId)).trim(),
      createdFromNoteId: String(pickFirstDefined_(row.created_from_note_id, row.createdFromNoteId)).trim(),
      campaignId: campaignId,
      campaignName: normalizeCampaignName_(pickFirstDefined_(row.campaign_name, row.campaignName, matchedCampaign && matchedCampaign.campaignName)),
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
      sourcePlatform: String(pickFirstDefined_(row.source_platform, row.sourcePlatform)).trim(),
      sourceTitle: String(pickFirstDefined_(row.source_title, row.sourceTitle)).trim(),
      sourceMetadata: String(pickFirstDefined_(row.source_metadata, row.sourceMetadata)).trim(),
      sourceImportStatus: String(pickFirstDefined_(row.source_import_status, row.sourceImportStatus)).trim(),
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
      dateDiagnostics: buildDateDiagnostics_(scheduledAt, scheduledDateKey, queueDateLabel)
    }, semanticFieldsFromRow_(row));
  }).filter(function(post) {
    return post.postId || post.title;
  }).sort(function(a, b) {
    return parseSheetDate_(b.scheduledAt) - parseSheetDate_(a.scheduledAt);
  });
}

function getMedia() {
  const sheet = ensureSheet_("media", MEDIA_HEADERS);
  return getObjectsFromSheet_(sheet).map(function(row) {
    return Object.assign({
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
      createdAt: String(row.created_at || "").trim(),
      updatedAt: String(row.updated_at || "").trim()
    }, semanticFieldsFromRow_(row));
  }).filter(function(asset) {
    return asset.assetId || asset.assetName;
  });
}

function getInspo() {
  const sheet = ensureSheet_("inspo", INSPO_HEADERS);
  return getObjectsFromSheet_(sheet).map(function(row) {
    return Object.assign({
      inspoId: String(row.inspo_id || "").trim(),
      inspoType: String(row.inspo_type || "").trim(),
      title: String(row.title || "").trim(),
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
      convertedPostId: String(row.converted_post_id || "").trim()
    }, semanticFieldsFromRow_(row));
  }).filter(function(item) {
    return (item.inspoId || item.title) && item.status !== "converted" && item.status !== "archived";
  });
}

function getNotes() {
  const sheet = ensureSheet_("notes", NOTE_HEADERS);
  return getObjectsFromSheet_(sheet).map(function(row) {
    return Object.assign({
      noteId: String(pickFirstDefined_(row.note_id, row.noteId)).trim(),
      title: String(pickFirstDefined_(row.title)).trim(),
      body: String(pickFirstDefined_(row.body, row.summary, row.description)).trim(),
      bullets: parseBulletLines_(pickFirstDefined_(row.bullets)),
      suggestedPlatform: String(pickFirstDefined_(row.suggested_platform, row.suggestedPlatform)).trim() || "linkedin",
      suggestedPillar: normalizePillar_(pickFirstDefined_(row.suggested_pillar, row.suggestedPillar), SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
      status: String(pickFirstDefined_(row.status, "active")).trim() || "active",
      convertedPostId: String(pickFirstDefined_(row.converted_post_id, row.convertedPostId)).trim(),
      sourceUrl: String(pickFirstDefined_(row.source_url, row.sourceUrl)).trim(),
      sourcePlatform: String(pickFirstDefined_(row.source_platform, row.sourcePlatform)).trim(),
      sourceLabel: String(pickFirstDefined_(row.source_label, row.sourceLabel)).trim(),
      createdAt: String(pickFirstDefined_(row.created_at, row.createdAt)).trim(),
      updatedAt: String(pickFirstDefined_(row.updated_at, row.updatedAt)).trim()
    }, semanticFieldsFromRow_(row));
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
  const sheet = ensureSheet_("campaign", CAMPAIGN_HEADERS, CAMPAIGN_COMPAT_HEADERS);
  const rows = getObjectsFromSheet_(sheet)
    .map(function(row) {
      const campaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID));
      return Object.assign({
        campaignId: campaignId,
        campaignName: normalizeCampaignName_(pickFirstDefined_(row.campaign_name, row.campaignName)),
        pillar: normalizePillar_(row.pillar, ""),
        color: String(row.color || getCampaignColorFromSettings_(pickFirstDefined_(row.campaign_name, row.campaignName), settings) || "").trim(),
        x: normalizeNumber_(row.x),
        y: normalizeNumber_(row.y),
        iconShape: normalizeIconShape_(row.icon_shape),
        sortOrder: normalizeNumber_(pickFirstDefined_(row.sort_order, row.y)),
        isArchived: normalizeBoolean_(pickFirstDefined_(row.is_archived, row.isArchived)),
        createdAt: String(pickFirstDefined_(row.created_at, row.createdat)).trim()
      }, semanticFieldsFromRow_(row));
    })
    .filter(function(campaign) {
      return !campaign.isArchived && (campaign.campaignId || campaign.campaignName);
    })
    .sort(function(a, b) {
      return normalizeNumber_(a.sortOrder) - normalizeNumber_(b.sortOrder);
    });

  const byName = {};
  rows.forEach(function(campaign) {
    byName[normalizeCampaignLookup_(campaign.campaignName)] = campaign;
  });

  const merged = (settings.campaigns || []).map(function(campaignName, index) {
    const matched = byName[normalizeCampaignLookup_(campaignName)];
    return matched || {
      campaignId: createDeterministicCampaignId_(campaignName),
      campaignName: normalizeCampaignName_(campaignName),
      pillar: "",
      color: getCampaignColorFromSettings_(campaignName, settings),
      x: 0,
      y: 0,
      iconShape: "",
      sortOrder: index,
      isArchived: false,
      createdAt: ""
    };
  });

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
  const sheet = ensureSheet_("campaign", CAMPAIGN_HEADERS, CAMPAIGN_COMPAT_HEADERS);
  const settings = getSettingsRegistry();
  const existing = findObjectByHeaders_(sheet, ["campaign_id", "campaignID"], payload.campaignId);
  const createdAt = pickFirstDefined_(payload.createdAt, existing && existing.created_at, existing && existing.createdat, new Date().toISOString());
  const sortOrder = normalizeNumber_(pickFirstDefined_(payload.sortOrder, existing && existing.sort_order, payload.y, existing && existing.y));
  const campaignId = normalizeScalar_(pickFirstDefined_(payload.campaignId, existing && (existing.campaign_id || existing.campaignID), createCampaignId_()));
  const isArchived = payload.isArchived === undefined
    ? normalizeBoolean_(pickFirstDefined_(existing && existing.is_archived, existing && existing.isArchived))
    : normalizeBoolean_(payload.isArchived);

  const normalized = {
    campaign_id: campaignId,
    campaignID: campaignId,
    campaign_name: normalizeCampaignName_(payload.campaignName || existing && (existing.campaign_name || existing.campaignName) || "Untitled Campaign"),
    campaignName: normalizeCampaignName_(payload.campaignName || existing && (existing.campaignName || existing.campaign_name) || "Untitled Campaign"),
    pillar: normalizePillar_(pickFirstDefined_(payload.pillar, existing && existing.pillar), ""),
    color: String(payload.color || existing && existing.color || getCampaignColorFromSettings_(payload.campaignName || existing && (existing.campaign_name || existing.campaignName), settings) || "#c77dff").trim(),
    x: normalizeNumber_(pickFirstDefined_(payload.x, existing && existing.x, 240)),
    y: normalizeNumber_(pickFirstDefined_(payload.y, existing && existing.y, 240)),
    icon_shape: normalizeIconShape_(pickFirstDefined_(payload.iconShape, payload.icon_shape, existing && existing.icon_shape)),
    sort_order: sortOrder,
    is_archived: isArchived,
    isArchived: isArchived,
    created_at: String(createdAt).trim(),
    createdat: String(createdAt).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectRowByAliases_(sheet, ["campaign_id", "campaignID"], normalized, ["campaign_name", "campaignName"]);

  return Object.assign({
    campaignId: normalized.campaign_id,
    campaignName: normalized.campaign_name,
    pillar: normalized.pillar,
    color: normalized.color,
    x: normalized.x,
    y: normalized.y,
    iconShape: normalized.icon_shape,
    sortOrder: normalized.sort_order,
    isArchived: normalized.is_archived,
    createdAt: normalized.created_at
  }, semanticFieldsFromRow_(normalized));
}

function updateCampaignPosition(payload) {
  if (!payload.campaignId) throw new Error("Missing campaignId");

  const sheet = ensureSheet_("campaign", CAMPAIGN_HEADERS, CAMPAIGN_COMPAT_HEADERS);
  const existing = findObjectByHeaders_(sheet, ["campaign_id", "campaignID"], payload.campaignId);
  if (!existing) throw new Error("Campaign not found");

  existing.campaign_id = normalizeScalar_(pickFirstDefined_(existing.campaign_id, existing.campaignID, payload.campaignId));
  existing.campaignID = existing.campaign_id;
  existing.x = normalizeNumber_(payload.x);
  existing.y = normalizeNumber_(payload.y);
  existing.sort_order = normalizeNumber_(pickFirstDefined_(existing.sort_order, payload.y));
  existing.updated_at = new Date().toISOString();

  upsertObjectRowByAliases_(sheet, ["campaign_id", "campaignID"], existing, ["campaign_name", "campaignName"]);
  return true;
}

function savePost(payload) {
  const sheet = ensureSheet_("posts", POST_HEADERS);
  const settings = getSettingsRegistry();
  const defaultPillar = settings.pillars[0] || "authority";
  const existing = findObjectByHeaders_(sheet, ["post_id", "postId"], pickFirstDefined_(payload.postId, payload.id));
  const campaignMap = buildCampaignMap_();
  const campaignNameMap = buildCampaignNameMap_();
  let campaignId = normalizeScalar_(pickFirstDefined_(payload.campaignId, payload.campaign_id, existing && existing.campaign_id));
  let inputCampaignName = normalizeCampaignName_(pickFirstDefined_(payload.campaignName, payload.campaign_name, existing && existing.campaign_name, existing && existing.campaignName));
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
  const scheduledAt = normalizeDateTime_(pickFirstDefined_(payload.scheduledAt, payload.date, existing && existing.scheduled_at, existing && existing.scheduledAt));
  const canonicalPillar = normalizePillar_(
    pickFirstDefined_(payload.pillar, payload.hubPillarLabel, payload.hub_pillar_label, existing && existing.pillar, existing && existing.hub_pillar_label, matchedCampaign && matchedCampaign.pillar),
    defaultPillar
  ) || defaultPillar;
  const hubPillarLabel = pillarDisplayLabel_(
    pickFirstDefined_(payload.hubPillarLabel, payload.hub_pillar_label, existing && existing.hub_pillar_label, canonicalPillar, matchedCampaign && matchedCampaign.pillar),
    canonicalPillar
  );
  const campaignName = normalizeCampaignName_(
    pickFirstDefined_(matchedCampaign && matchedCampaign.campaignName, inputCampaignName, existing && existing.campaign_name, existing && existing.campaignName, "")
  );
  const carouselAssetIds = parseAssetIdList_(pickFirstDefined_(payload.carouselAssetIds, payload.carousel_asset_ids, existing && existing.carousel_asset_ids));
  const platformTargets = parsePlatformTargets_(pickFirstDefined_(payload.platformTargets, payload.platform_targets, existing && existing.platform_targets, payload.platform));
  const sourceMetadataValue = normalizeMetadataString_(pickFirstDefined_(payload.sourceMetadata, payload.source_metadata, existing && existing.source_metadata));
  const aiPrompt = String(pickFirstDefined_(payload.aiPrompt, payload.ai_prompt, existing && existing.ai_prompt, "")).trim();
  const aiGenerationMode = String(pickFirstDefined_(payload.aiGenerationMode, payload.ai_generation_mode, existing && existing.ai_generation_mode, "")).trim();
  const aiDraftStatus = String(pickFirstDefined_(payload.aiDraftStatus, payload.ai_draft_status, existing && existing.ai_draft_status, "")).trim();

  const normalized = {
    post_id: String(pickFirstDefined_(payload.postId, payload.id, existing && existing.post_id, existing && existing.postId, createPostId_())).trim(),
    title: String(pickFirstDefined_(payload.title, payload.postTitle, existing && existing.title, "")).trim(),
    platform: String(pickFirstDefined_(payload.platform, payload.channel, existing && existing.platform, "linkedin")).trim() || "linkedin",
    post_type: String(pickFirstDefined_(payload.postType, payload.post_type, existing && existing.post_type, existing && existing.postType, "text")).trim() || "text",
    pillar: canonicalPillar,
    scheduled_at: scheduledAt,
    status: normalizeStatus_(pickFirstDefined_(payload.status, payload.postStatus, existing && existing.status, "draft")),
    description: String(pickFirstDefined_(payload.description, payload.caption, existing && existing.description, "")).trim(),
    asset_id: String(pickFirstDefined_(payload.assetId, payload.asset_id, existing && existing.asset_id, existing && existing.assetId, "")).trim(),
    hub_title: String(pickFirstDefined_(payload.hubTitle, payload.hub_title, existing && existing.hub_title, payload.title, "")).trim(),
    hub_pillar_label: hubPillarLabel,
    queue_date_label: String(pickFirstDefined_(payload.queueDateLabel, payload.queue_date_label, existing && existing.queue_date_label, formatQueueDate_(scheduledAt))).trim(),
    queue_time_label: String(pickFirstDefined_(payload.queueTimeLabel, payload.queue_time_label, existing && existing.queue_time_label, formatQueueTime_(scheduledAt))).trim(),
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
    source_platform: String(pickFirstDefined_(payload.sourcePlatform, payload.source_platform, existing && existing.source_platform, "")).trim(),
    source_title: String(pickFirstDefined_(payload.sourceTitle, payload.source_title, existing && existing.source_title, "")).trim(),
    source_metadata: sourceMetadataValue,
    source_import_status: String(pickFirstDefined_(payload.sourceImportStatus, payload.source_import_status, existing && existing.source_import_status, "")).trim(),
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
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectRowByAliases_(sheet, ["post_id"], normalized, ["postId"]);
  syncMediaLinkForPost_(normalized.post_id, normalized.asset_id, normalized.campaign_name, normalized.media_label);

  return Object.assign({
    postId: normalized.post_id,
    title: normalized.title,
    platform: normalized.platform,
    postType: normalized.post_type,
    pillar: normalized.pillar,
    scheduledAt: normalized.scheduled_at,
    status: normalized.status,
    description: normalized.description,
    assetId: normalized.asset_id,
    hubTitle: normalized.hub_title,
    hubPillarLabel: normalized.hub_pillar_label,
    queueDateLabel: normalized.queue_date_label,
    queueTimeLabel: normalized.queue_time_label,
    ledgerExcerpt: normalized.ledger_excerpt,
    constellationMeta: normalized.constellation_meta,
    mediaLabel: normalized.media_label,
    createdFromInspoId: normalized.created_from_inspo_id,
    createdFromNoteId: normalized.created_from_note_id,
    campaignId: normalized.campaign_id,
    campaignName: normalized.campaign_name,
    notes: normalized.notes,
    impressions: normalized.impressions,
    reach: normalized.reach,
    likes: normalized.likes,
    comments: normalized.comments,
    shares: normalized.shares,
    saves: normalized.saves,
    clicks: normalized.clicks,
    engagementRate: normalized.engagement_rate,
    sourceUrl: normalized.source_url,
    sourcePlatform: normalized.source_platform,
    sourceTitle: normalized.source_title,
    sourceMetadata: normalized.source_metadata,
    sourceImportStatus: normalized.source_import_status,
    platformTargets: platformTargets,
    publishStatus: normalized.publish_status,
    publishedUrl: normalized.published_url,
    publishedAt: normalized.published_at,
    apiPostId: normalized.api_post_id,
    apiError: normalized.api_error,
    platformCaptionOverride: normalized.platform_caption_override,
    platformCharacterCount: normalized.platform_character_count,
    requiresManualReview: normalized.requires_manual_review,
    carouselAssetIds: carouselAssetIds,
    aiSourceType: normalized.ai_source_type,
    aiSourceId: normalized.ai_source_id,
    aiPrompt: normalized.ai_prompt,
    aiGenerationMode: normalized.ai_generation_mode,
    aiBrandFrameworkVersion: normalized.ai_brand_framework_version,
    aiDraftStatus: normalized.ai_draft_status,
    aiReviewNotes: normalized.ai_review_notes,
    carouselAssets: getAssetsForPost_({
      postId: normalized.post_id,
      assetId: normalized.asset_id,
      carouselAssetIds: carouselAssetIds
    }, getMedia()),
      scheduledDateKey: parseDisplayDateKey_(normalized.queue_date_label) || getLocalDateKey_(normalized.scheduled_at),
      dateDiagnostics: buildDateDiagnostics_(normalized.scheduled_at, parseDisplayDateKey_(normalized.queue_date_label) || getLocalDateKey_(normalized.scheduled_at), normalized.queue_date_label)
  }, semanticFieldsFromRow_(normalized));
}

function deletePost(postId) {
  if (!postId) throw new Error("Missing postId");

  const sheet = ensureSheet_("posts", POST_HEADERS);
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
  duplicate.status = normalizeStatus_(duplicate.status || "draft");
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
  const sheet = ensureSheet_("media", MEDIA_HEADERS);
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, null);

  appendObjectRowByHeaders_(sheet, normalized);

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
    sourceType: normalized.source_type
  }, semanticFieldsFromRow_(normalized));
}

function saveMediaLink(payload) {
  if (!payload) throw new Error("Missing media link payload");

  const sheet = ensureSheet_("media", MEDIA_HEADERS);
  const resolved = resolveMediaSource_(payload);
  const assetType = normalizeLinkedAssetType_(payload.assetType || resolved.assetType || "image");
  const assetName = String(payload.assetName || resolved.assetName || "").trim()
    || inferAssetNameFromUrl_(resolved.fileUrl || resolved.sourceUrl || "")
    || "Linked Asset";
  const linkedPostId = String(payload.linkedPostId || "").trim();

  const normalized = {
    asset_id: createAssetId_(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, null);

  appendObjectRowByHeaders_(sheet, normalized);

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
    sourceType: normalized.source_type
  }, semanticFieldsFromRow_(normalized));
}

function saveInspo(payload) {
  const sheet = ensureSheet_("inspo", INSPO_HEADERS);
  const existing = findObjectByHeaders_(sheet, ["inspo_id"], payload.inspoId);
  const normalized = {
    inspo_id: String(payload.inspoId || existing && existing.inspo_id || createInspoId_()).trim(),
    inspo_type: String(payload.inspoType || existing && existing.inspo_type || "article").trim(),
    title: String(payload.title || existing && existing.title || "").trim(),
    source_label: String(payload.sourceLabel || existing && existing.source_label || "Added manually").trim(),
    summary: String(payload.summary || existing && existing.summary || "").trim(),
    domain_or_meta: String(payload.domainOrMeta || existing && existing.domain_or_meta || "").trim(),
    suggested_platform: String(payload.suggestedPlatform || existing && existing.suggested_platform || "linkedin").trim(),
    suggested_pillar: normalizePillar_(pickFirstDefined_(payload.suggestedPillar, existing && existing.suggested_pillar), SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
    create_post_title: String(payload.createPostTitle || existing && existing.create_post_title || payload.title || "").trim(),
    create_post_description: String(payload.createPostDescription || existing && existing.create_post_description || payload.summary || "").trim(),
    create_post_type: String(payload.createPostType || existing && existing.create_post_type || "article").trim(),
    notes: String(payload.notes || existing && existing.notes || "").trim(),
    status: String(payload.status || existing && existing.status || "active").trim() || "active",
    converted_post_id: String(payload.convertedPostId || existing && existing.converted_post_id || "").trim(),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectRowByAliases_(sheet, ["inspo_id"], normalized);

  return Object.assign({
    inspoId: normalized.inspo_id,
    inspoType: normalized.inspo_type,
    title: normalized.title,
    sourceLabel: normalized.source_label,
    summary: normalized.summary,
    domainOrMeta: normalized.domain_or_meta,
    suggestedPlatform: normalized.suggested_platform,
    suggestedPillar: normalizePillar_(normalized.suggested_pillar, SETTINGS_DEFAULTS.pillars[0]) || SETTINGS_DEFAULTS.pillars[0],
    createPostTitle: normalized.create_post_title,
    createPostDescription: normalized.create_post_description,
    createPostType: normalized.create_post_type,
    notes: normalized.notes,
    status: normalized.status,
    convertedPostId: normalized.converted_post_id
  }, semanticFieldsFromRow_(normalized));
}

function saveNote(payload) {
  const sheet = ensureSheet_("notes", NOTE_HEADERS);
  const existing = findObjectByHeaders_(sheet, ["note_id", "noteId"], pickFirstDefined_(payload.noteId, payload.id));
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
    source_url: sourceUrl,
    source_platform: sourcePlatform,
    source_label: String(pickFirstDefined_(payload.sourceLabel, payload.source_label, existing && existing.source_label, deriveSourceLabelFromPlatform_(sourcePlatform))).trim(),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectRowByAliases_(sheet, ["note_id"], normalized, ["noteId"]);

  return Object.assign({
    noteId: normalized.note_id,
    title: normalized.title,
    body: normalized.body,
    bullets: parseBulletLines_(normalized.bullets),
    suggestedPlatform: normalized.suggested_platform,
    suggestedPillar: normalized.suggested_pillar,
    status: normalized.status,
    convertedPostId: normalized.converted_post_id,
    sourceUrl: normalized.source_url,
    sourcePlatform: normalized.source_platform,
    sourceLabel: normalized.source_label,
    createdAt: normalized.created_at,
    updatedAt: normalized.updated_at
  }, semanticFieldsFromRow_(normalized));
}

function deleteNote(noteId) {
  if (!noteId) throw new Error("Missing noteId");
  const sheet = ensureSheet_("notes", NOTE_HEADERS);
  deleteRowByAliases_(sheet, ["note_id", "noteId"], noteId);
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
    status: "converted",
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

function getAICreationOptions() {
  return {
    backendConnected: false,
    frameworkVersion: getBrandFrameworkVersion_(),
    generationModes: [
      "LinkedIn post",
      "Instagram caption",
      "carousel outline",
      "short video script",
      "job board promo",
      "campaign recap",
      "platform analysis",
      "local infrastructure post",
      "alternate realities / solarpunk history"
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
      "avoid captions that are too long for carousels"
    ],
    diversityControls: [
      "vary hook style",
      "vary structure",
      "vary CTA",
      "vary post length",
      "vary emotional entry point",
      "vary platform-specific formatting"
    ],
    guidance: "AI posting is not connected yet. Use this workspace to prepare context, evaluate alignment, and save reviewed drafts."
  };
}

function prepareAIGenerationContext(payload) {
  var sourceType = String(payload && payload.sourceType || payload && payload.aiSourceType || "manual").trim();
  var sourceId = String(payload && payload.sourceId || payload && payload.aiSourceId || "").trim();
  var sourceRecord = {};

  if (sourceType === "note" && sourceId) {
    sourceRecord = getNotes().find(function(item) { return item.noteId === sourceId; }) || {};
  } else if (sourceType === "inspo" && sourceId) {
    sourceRecord = getInspo().find(function(item) { return item.inspoId === sourceId; }) || {};
  } else if (sourceType === "post" && sourceId) {
    sourceRecord = getPosts().find(function(item) { return item.postId === sourceId; }) || {};
  } else if (sourceType === "campaign" && sourceId) {
    sourceRecord = getCampaigns().find(function(item) { return item.campaignId === sourceId; }) || {};
  } else if (sourceType === "media" && sourceId) {
    sourceRecord = getMedia().find(function(item) { return item.assetId === sourceId; }) || {};
  }

  return {
    sourceType: sourceType,
    sourceId: sourceId,
    sourceRecord: sourceRecord,
    frameworkVersion: getBrandFrameworkVersion_(),
    brandFramework: getBrandFramework(),
    options: getAICreationOptions(),
    guidance: "No live AI generation is connected. This context is safe scaffolding for future generation and review."
  };
}

function saveAIDraft(payload) {
  var sheet = ensureSheet_("aiDrafts", AI_DRAFT_HEADERS);
  var existing = findObjectByHeaders_(sheet, ["ai_draft_id"], pickFirstDefined_(payload.aiDraftId, payload.ai_draft_id));
  var normalized = {
    ai_draft_id: String(pickFirstDefined_(payload.aiDraftId, payload.ai_draft_id, existing && existing.ai_draft_id, createAIDraftId_())).trim(),
    title: String(pickFirstDefined_(payload.title, existing && existing.title, "")).trim(),
    platform: String(pickFirstDefined_(payload.platform, existing && existing.platform, "linkedin")).trim() || "linkedin",
    post_type: String(pickFirstDefined_(payload.postType, payload.post_type, existing && existing.post_type, "text")).trim() || "text",
    generation_mode: String(pickFirstDefined_(payload.generationMode, payload.generation_mode, existing && existing.generation_mode, "")).trim(),
    source_type: String(pickFirstDefined_(payload.sourceType, payload.source_type, existing && existing.source_type, "")).trim(),
    source_id: String(pickFirstDefined_(payload.sourceId, payload.source_id, existing && existing.source_id, "")).trim(),
    campaign_id: String(pickFirstDefined_(payload.campaignId, payload.campaign_id, existing && existing.campaign_id, "")).trim(),
    campaign_name: String(pickFirstDefined_(payload.campaignName, payload.campaign_name, existing && existing.campaign_name, "")).trim(),
    prompt: String(pickFirstDefined_(payload.prompt, existing && existing.prompt, "")).trim(),
    draft_text: String(pickFirstDefined_(payload.draftText, payload.draft_text, existing && existing.draft_text, "")).trim(),
    hook_text: String(pickFirstDefined_(payload.hookText, payload.hook_text, existing && existing.hook_text, "")).trim(),
    cta_text: String(pickFirstDefined_(payload.ctaText, payload.cta_text, existing && existing.cta_text, "")).trim(),
    carousel_outline: normalizeMetadataString_(pickFirstDefined_(payload.carouselOutline, payload.carousel_outline, existing && existing.carousel_outline, "")),
    brand_framework_version: String(pickFirstDefined_(payload.brandFrameworkVersion, payload.brand_framework_version, existing && existing.brand_framework_version, getBrandFrameworkVersion_())).trim(),
    draft_status: String(pickFirstDefined_(payload.draftStatus, payload.draft_status, existing && existing.draft_status, "needs_review")).trim() || "needs_review",
    review_notes: String(pickFirstDefined_(payload.reviewNotes, payload.review_notes, existing && existing.review_notes, "")).trim(),
    alignment_score: normalizeNumber_(pickFirstDefined_(payload.alignmentScore, payload.alignment_score, existing && existing.alignment_score)),
    diversity_controls: normalizeMetadataString_(pickFirstDefined_(payload.diversityControls, payload.diversity_controls, existing && existing.diversity_controls, "")),
    anti_pattern_flags: normalizeMetadataString_(pickFirstDefined_(payload.antiPatternFlags, payload.anti_pattern_flags, existing && existing.anti_pattern_flags, "")),
    created_post_id: String(pickFirstDefined_(payload.createdPostId, payload.created_post_id, existing && existing.created_post_id, "")).trim(),
    created_at: String(existing && existing.created_at || new Date().toISOString()).trim(),
    updated_at: new Date().toISOString()
  };
  applySemanticFieldsToRow_(normalized, payload, existing);

  upsertObjectRowByAliases_(sheet, ["ai_draft_id"], normalized);
  return aiDraftRowToObject_(normalized);
}

function createPostFromAIDraft(payload) {
  var aiDraftId = String(payload && (payload.aiDraftId || payload.ai_draft_id) || "").trim();
  if (!aiDraftId) throw new Error("Missing aiDraftId");
  var draft = getAIDrafts().find(function(item) { return item.aiDraftId === aiDraftId; });
  if (!draft) throw new Error("AI draft not found");

  var post = savePost(Object.assign({}, payload.post || {}, {
    title: pickFirstDefined_(payload.title, payload.post && payload.post.title, draft.title),
    platform: pickFirstDefined_(payload.platform, payload.post && payload.post.platform, draft.platform),
    postType: pickFirstDefined_(payload.postType, payload.post && payload.post.postType, draft.postType),
    description: pickFirstDefined_(payload.description, payload.post && payload.post.description, draft.draftText),
    campaignId: pickFirstDefined_(payload.campaignId, payload.post && payload.post.campaignId, draft.campaignId),
    campaignName: pickFirstDefined_(payload.campaignName, payload.post && payload.post.campaignName, draft.campaignName),
    aiSourceType: pickFirstDefined_(payload.aiSourceType, payload.post && payload.post.aiSourceType, draft.sourceType || "ai_draft"),
    aiSourceId: pickFirstDefined_(payload.aiSourceId, payload.post && payload.post.aiSourceId, draft.sourceId || draft.aiDraftId),
    aiPrompt: pickFirstDefined_(payload.aiPrompt, payload.post && payload.post.aiPrompt, draft.prompt),
    aiGenerationMode: pickFirstDefined_(payload.aiGenerationMode, payload.post && payload.post.aiGenerationMode, draft.generationMode),
    aiBrandFrameworkVersion: pickFirstDefined_(payload.aiBrandFrameworkVersion, payload.post && payload.post.aiBrandFrameworkVersion, draft.brandFrameworkVersion),
    aiDraftStatus: pickFirstDefined_(payload.aiDraftStatus, payload.post && payload.post.aiDraftStatus, draft.draftStatus),
    aiReviewNotes: pickFirstDefined_(payload.aiReviewNotes, payload.post && payload.post.aiReviewNotes, draft.reviewNotes),
    semanticTags: pickFirstDefined_(payload.semanticTags, payload.post && payload.post.semanticTags, draft.semanticTags),
    semanticClusters: pickFirstDefined_(payload.semanticClusters, payload.post && payload.post.semanticClusters, draft.semanticClusters),
    semanticOrigin: pickFirstDefined_(payload.semanticOrigin, payload.post && payload.post.semanticOrigin, draft.semanticOrigin || "ai_draft"),
    semanticSummary: pickFirstDefined_(payload.semanticSummary, payload.post && payload.post.semanticSummary, draft.semanticSummary || draft.draftText),
    recurringPatternFlags: pickFirstDefined_(payload.recurringPatternFlags, payload.post && payload.post.recurringPatternFlags, draft.recurringPatternFlags)
  }));

  saveAIDraft({
    aiDraftId: draft.aiDraftId,
    title: draft.title,
    platform: draft.platform,
    postType: draft.postType,
    generationMode: draft.generationMode,
    sourceType: draft.sourceType,
    sourceId: draft.sourceId,
    campaignId: draft.campaignId,
    campaignName: draft.campaignName,
    prompt: draft.prompt,
    draftText: draft.draftText,
    hookText: draft.hookText,
    ctaText: draft.ctaText,
    carouselOutline: draft.carouselOutline,
    brandFrameworkVersion: draft.brandFrameworkVersion,
    draftStatus: draft.draftStatus || "reviewed",
    reviewNotes: draft.reviewNotes,
    alignmentScore: draft.alignmentScore,
    diversityControls: draft.diversityControls,
    antiPatternFlags: draft.antiPatternFlags,
    createdPostId: post.postId
  });

  return post;
}

function getAIDrafts() {
  var sheet = ensureSheet_("aiDrafts", AI_DRAFT_HEADERS);
  return getObjectsFromSheet_(sheet).map(function(row) {
    return aiDraftRowToObject_(row);
  }).filter(function(item) {
    return item.aiDraftId || item.title;
  }).sort(function(a, b) {
    return parseSheetDate_(b.updatedAt || b.createdAt) - parseSheetDate_(a.updatedAt || a.createdAt);
  });
}

function archiveInspo(payload) {
  var sheet = ensureSheet_("inspo", INSPO_HEADERS);
  var inspoId = String(payload && payload.inspoId || "").trim();
  if (!inspoId) throw new Error("Missing inspoId");

  var existing = findObjectByHeaders_(sheet, ["inspo_id"], inspoId);
  if (!existing) throw new Error("Inspo item not found");

  existing.inspo_id = inspoId;
  existing.status = "converted";
  existing.converted_post_id = String(payload && payload.convertedPostId || "").trim();
  existing.updated_at = new Date().toISOString();
  upsertObjectRowByAliases_(sheet, ["inspo_id"], existing);

  return {
    inspoId: String(existing.inspo_id || "").trim(),
    status: String(existing.status || "").trim(),
    convertedPostId: String(existing.converted_post_id || "").trim()
  };
}

function payloadOrParams_(e) {
  return (e && e.parameter) || {};
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

  const sheet = ensureSheet_("media", MEDIA_HEADERS);
  const mediaRows = getObjectsFromSheet_(sheet);
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
  upsertObjectRowByAliases_(sheet, ["asset_id"], matched);
}

function unlinkMediaForPost_(postId) {
  const sheet = ensureSheet_("media", MEDIA_HEADERS);
  const rows = getObjectsFromSheet_(sheet);
  rows.forEach(function(row) {
    if (String(row.linked_post_id || "").trim() !== String(postId || "").trim()) return;
    row.linked_post_id = "";
    row.updated_at = new Date().toISOString();
    upsertObjectRowByAliases_(sheet, ["asset_id"], row);
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

function parsePlatformTargets_(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[|,\n]/);
  const allowed = ["instagram", "linkedin", "threads", "bluesky"];
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
  return Object.assign({
    aiDraftId: String(row.ai_draft_id || "").trim(),
    title: String(row.title || "").trim(),
    platform: String(row.platform || "linkedin").trim() || "linkedin",
    postType: String(row.post_type || "text").trim() || "text",
    generationMode: String(row.generation_mode || "").trim(),
    sourceType: String(row.source_type || "").trim(),
    sourceId: String(row.source_id || "").trim(),
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
    createdPostId: String(row.created_post_id || "").trim(),
    createdAt: String(row.created_at || "").trim(),
    updatedAt: String(row.updated_at || "").trim()
  }, semanticFieldsFromRow_(row));
}

function createAIDraftId_() {
  return "AID-" + Utilities.getUuid().slice(0, 8).toUpperCase();
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
  if (text.indexOf("linkedin") !== -1) return "linkedin";
  if (text.indexOf("threads") !== -1) return "threads";
  if (text.indexOf("bsky") !== -1 || text.indexOf("bluesky") !== -1) return "bluesky";
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
  var raw = PropertiesService.getScriptProperties().getProperty(getSocialAccountPropertyKey_(platform));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function getInstagramOEmbedToken_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("INSTAGRAM_OEMBED_ACCESS_TOKEN") ||
    PropertiesService.getScriptProperties().getProperty("META_APP_ACCESS_TOKEN") ||
    ""
  ).trim();
}

function buildDefaultConnectedAccount_(platform) {
  var normalized = detectSourcePlatform_(platform);
  return {
    platform: normalized,
    accountId: "",
    accountLabel: "",
    accessStatus: normalized === "bluesky" ? "unsupported" : "not_connected",
    scopesGranted: [],
    tokenExpiresAt: "",
    lastSyncAt: "",
    lastError: "",
    importSupported: normalized === "instagram" ? false : normalized !== "",
    publishSupported: false,
    capabilities: {
      captions: normalized !== "",
      images: normalized !== ""
    }
  };
}

function getConnectedAccounts() {
  return SOCIAL_PLATFORMS.map(function(platform) {
    var account = buildDefaultConnectedAccount_(platform);
    var stored = getSocialAccountConfig_(platform);
    if (stored) {
      account.accountId = String(stored.account_id || stored.accountId || "").trim();
      account.accountLabel = String(stored.account_label || stored.accountLabel || "").trim();
      account.accessStatus = String(stored.access_status || stored.accessStatus || "connected").trim() || "connected";
      account.scopesGranted = parseSemanticList_(stored.scopes_granted || stored.scopesGranted || []);
      account.tokenExpiresAt = String(stored.token_expires_at || stored.tokenExpiresAt || "").trim();
      account.lastSyncAt = String(stored.last_sync_at || stored.lastSyncAt || "").trim();
      account.lastError = String(stored.last_error || stored.lastError || "").trim();
      account.importSupported = stored.import_supported != null ? normalizeBoolean_(stored.import_supported) : account.importSupported;
      account.publishSupported = stored.publish_supported != null ? normalizeBoolean_(stored.publish_supported) : false;
      if (stored.capabilities && typeof stored.capabilities === "object") account.capabilities = stored.capabilities;
    }
    if (account.accessStatus === "connected" && account.tokenExpiresAt) {
      var expires = parseSheetDate_(account.tokenExpiresAt);
      if (expires && expires.getTime() < Date.now()) account.accessStatus = "expired";
    }
    if (platform === "instagram" && getInstagramOEmbedToken_()) account.importSupported = true;
    return account;
  });
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
  var clientId = String(PropertiesService.getScriptProperties().getProperty(String(platform || "").toUpperCase() + "_CLIENT_ID") || "").trim();
  if (!platform || SOCIAL_PLATFORMS.indexOf(platform) === -1) {
    return { platform: platform, supported: false, status: "unsupported", diagnostics: ["Unknown platform."] };
  }
  if (!clientId) {
    return {
      platform: platform,
      supported: false,
      status: platform === "instagram" ? "app_review_required" : "unsupported",
      diagnostics: ["OAuth is scaffolded only. Configure client credentials and callback handling before connecting this account."],
      url: ""
    };
  }
  return {
    platform: platform,
    supported: true,
    status: "configured",
    diagnostics: ["OAuth URL scaffold generated. Complete callback handling before enabling production use."],
    url: ""
  };
}

function handleSocialOAuthCallback(payload) {
  return {
    connected: false,
    status: "scaffold_only",
    diagnostics: ["OAuth callback handling is scaffolded but not finalized. Store tokens only in PropertiesService or another secure backend store."]
  };
}

function refreshSocialToken(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  var account = getSocialAccountConfig_(platform);
  if (!account) return { platform: platform, accessStatus: "not_connected", diagnostics: ["No connected account found for refresh."] };
  account.last_error = "Token refresh scaffolded only.";
  PropertiesService.getScriptProperties().setProperty(getSocialAccountPropertyKey_(platform), JSON.stringify(account));
  return buildDefaultConnectedAccount_(platform);
}

function disconnectSocialAccount(payload) {
  var platform = detectSourcePlatform_(payload && payload.platform || "");
  if (!platform) throw new Error("Missing platform");
  PropertiesService.getScriptProperties().deleteProperty(getSocialAccountPropertyKey_(platform));
  return { platform: platform, disconnected: true };
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
        ? "LinkedIn caption/image auto-import remains manual unless official authenticated access is configured."
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
  if (!scheduledAt && !queueDateLabel) return [];
  const diagnostics = [];
  const normalized = normalizeDateTime_(scheduledAt);
  var queueDateKey = parseDisplayDateKey_(queueDateLabel);
  if (normalized && scheduledDateKey && normalized.slice(0, 10) !== scheduledDateKey) {
    diagnostics.push("Scheduled timestamp date differs from stored calendar date key.");
  }
  if (queueDateKey && normalized && normalized.slice(0, 10) !== queueDateKey) {
    diagnostics.push("queue_date_label differs from scheduled_at. Calendar uses queue_date_label first.");
  }
  return diagnostics;
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
    warnings.push("LinkedIn publishing will require OAuth plus person or organization author context.");
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
    metadata: parseJsonSafe_(post.sourceMetadata) || {}
  };

  // TODO: add per-platform live API payload transforms once OAuth credentials and app review are complete.
  return {
    postId: post.postId,
    platform: platform,
    valid: validation.valid,
    requiresManualReview: validation.requiresManualReview,
    issues: validation.issues,
    warnings: validation.warnings,
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
  const sheet = ensureSheet_("posts", POST_HEADERS);
  const existing = findObjectByHeaders_(sheet, ["post_id", "postId"], postId);
  if (!existing) throw new Error("Post not found");

  Object.keys(updates || {}).forEach(function(key) {
    existing[key] = updates[key];
  });
  existing.updated_at = new Date().toISOString();
  upsertObjectRowByAliases_(sheet, ["post_id"], existing, ["postId"]);
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

function getDiagnostics(payload) {
  var postsSheet = findExistingSheet_("posts");
  var mediaSheet = findExistingSheet_("media");
  var inspoSheet = findExistingSheet_("inspo");
  var notesSheet = findExistingSheet_("notes");
  var aiDraftsSheet = findExistingSheet_("aiDrafts");
  var brandFrameworkSheet = findExistingSheet_("brandFramework");
  var campaignSheet = findExistingSheet_("campaign");
  var settingsSheet = findExistingSheet_("settings");
  var sheetChecks = [
    { key: "posts", sheet: postsSheet, requiredHeaders: POST_HEADERS },
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

  sheetChecks.forEach(function(check) {
    if (!check.sheet) {
      missingSheets.push(check.key);
      return;
    }
    var currentHeaders = getHeaders_(check.sheet);
    missingHeaders[check.key] = (check.requiredHeaders || []).filter(function(header) {
      return currentHeaders.indexOf(header) === -1;
    });
  });

  var posts = getPosts();
  var notes = getNotes();
  var media = getMedia();
  var campaigns = getCampaigns();
  var aiDrafts = getAIDrafts();
  var brandFramework = getBrandFramework();
  var semanticMemory = getSemanticMemory(payload);
  var socialCapabilities = getSocialImportCapabilities(payload);
  var connectedAccounts = getConnectedAccounts();
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
      return ["instagram", "linkedin", "threads", "bluesky"].indexOf(String(target || "").toLowerCase()) === -1;
    });
    var publishedMissingUrl = post.publishStatus === "published" && !post.publishedUrl;
    var failedMissingError = String(post.publishStatus || "").indexOf("failed") !== -1 && !post.apiError;
    return invalidTarget || publishedMissingUrl || failedMissingError;
  }).map(function(post) {
    return {
      postId: post.postId,
      publishStatus: post.publishStatus,
      platformTargets: post.platformTargets,
      publishedUrl: post.publishedUrl,
      apiError: post.apiError
    };
  });
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
      diagnostics: post.dateDiagnostics,
      severity: "warning"
    };
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
  var aiDraftIssues = aiDrafts.filter(function(draft) {
    return !draft.sourceType || !draft.draftStatus || (draft.generationMode && getAICreationOptions().generationModes.indexOf(draft.generationMode) === -1);
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
  var overusedHookPatterns = semanticMemory.overusedPatterns.filter(function(item) { return item.pattern.split("/").length >= 1; }).slice(0, 5);
  var campaignOverlapIssues = (semanticMemory.constellation && semanticMemory.constellation.bridges || []).filter(function(item) { return item.strength >= 0.42; }).map(function(item) {
    return { campaigns: item.fromCampaign + " ↔ " + item.toCampaign, issue: "campaign overlap/confusion", strength: item.strength };
  });
  var weakClassificationSignals = (semanticMemory.platformSignals || []).filter(function(item) { return item.weak; });
  var isolatedCampaigns = (semanticMemory.campaignClusters || []).filter(function(item) { return item.count <= 1; }).map(function(item) {
    return { campaignKey: item.campaignKey, issue: "isolated campaign" };
  });
  var orphanedRecords = getNotes().filter(function(note) { return !note.convertedPostId && !note.sourceUrl && !parseSemanticList_(note.semanticTags).length; }).map(function(note) {
    return { recordType: "note", recordId: note.noteId, issue: "orphaned note" };
  }).concat(getInspo().filter(function(item) {
    return !item.convertedPostId && !item.sourceLabel && !parseSemanticList_(item.semanticTags).length;
  }).map(function(item) {
    return { recordType: "inspo", recordId: item.inspoId, issue: "orphaned inspo" };
  }));
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

  return {
    ok: true,
    backendReachable: true,
    backendVersion: APP_BACKEND_VERSION,
    missingSheets: missingSheets,
    missingHeaders: missingHeaders,
    malformedScheduledRows: malformedScheduledRows,
    missingCampaignRows: missingCampaignRows,
    carouselMissingAssets: carouselMissingAssets,
    noteFieldIssues: noteFieldIssues,
    publishingStateIssues: publishingStateIssues,
    importIssues: importIssues,
    dateMismatchRows: dateMismatchRows,
    campaignLayoutIssues: campaignLayoutIssues,
    aiDraftIssues: aiDraftIssues,
    aiPostIssues: aiPostIssues,
    brandFrameworkIssues: brandFrameworkIssues,
    campaignCount: campaigns.length,
    mediaCount: media.length,
    postCount: posts.length,
    noteCount: notes.length,
    aiDraftCount: aiDrafts.length,
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
      expiredTokens: connectedAccounts.filter(function(item) { return item.accessStatus === "expired"; }).map(function(item) { return item.platform; }),
      missingPermissions: connectedAccounts.filter(function(item) { return item.accessStatus === "missing_permissions"; }).map(function(item) { return item.platform; }),
      unsupportedImportModes: connectedAccounts.filter(function(item) { return !item.importSupported; }).map(function(item) { return item.platform; }),
      lastImportErrors: connectedAccounts.filter(function(item) { return item.lastError; }).map(function(item) { return { platform: item.platform, error: item.lastError }; }),
      importFailuresByPlatform: importFailuresByPlatform,
      platformSupport: connectedAccounts.map(function(item) {
        return {
          platform: item.platform,
          captions: !!(item.capabilities && item.capabilities.captions),
          images: !!(item.capabilities && item.capabilities.images),
          importSupported: !!item.importSupported,
          publishSupported: !!item.publishSupported
        };
      })
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
        "saveAIDraft",
        "createPostFromAIDraft",
        "getDiagnostics",
        "getAICreationOptions",
        "prepareAIGenerationContext",
        "getPublishingReadiness",
        "validatePostForPublishing",
        "preparePublishPayload",
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
  var sheet = ensureSheet_("media", MEDIA_HEADERS);
  var rows = getObjectsFromSheet_(sheet);
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
  var postsSheet = ensureSheet_("posts", POST_HEADERS);
  var campaignsSheet = ensureSheet_("campaign", CAMPAIGN_HEADERS, CAMPAIGN_COMPAT_HEADERS);
  var postRows = getObjectsFromSheet_(postsSheet);
  var campaignRows = getObjectsFromSheet_(campaignsSheet);
  var postUpdates = 0;
  var campaignUpdates = 0;
  var campaignMap = {};

  campaignRows.forEach(function(row) {
    var campaignId = normalizeScalar_(pickFirstDefined_(row.campaign_id, row.campaignID));
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
        campaignName: String(pickFirstDefined_(row.campaign_name, row.campaignName)).trim(),
        pillar: nextPillar
      };
    }

    if (changed) {
      row.updated_at = new Date().toISOString();
      upsertObjectRowByAliases_(campaignsSheet, ["campaign_id", "campaignID"], row, ["campaign_name", "campaignName"]);
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
      upsertObjectRowByAliases_(postsSheet, ["post_id"], row, ["postId"]);
      postUpdates += 1;
    }
  });

  return {
    ok: true,
    postsUpdated: postUpdates,
    campaignsUpdated: campaignUpdates
  };
}
