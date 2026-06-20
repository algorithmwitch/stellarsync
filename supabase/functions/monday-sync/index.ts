import { corsHeaders, getAuthUser, getEnv, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, upsertWorkspaceConnection } from "../_shared/social.ts";

type MondayColumn = { id: string; title: string; type: string; settings_str?: string };
type MondayGroup = { id: string; title: string };
type MondayGroupResolution = {
  groupId: string;
  groupTitle: string;
  matchStrategy: "exact_match" | "created" | "uncategorized" | "first_group" | "no_groups";
  groupCreated: boolean;
  groupCreateError: string;
};

const COLUMN_MAP: Record<string, { id: string; label: string }> = {
  campaign: { id: "campaign", label: "Campaign" },
  publishTime: { id: "publish_time", label: "Publish Time" },
  publishDate: { id: "publish_date", label: "Publish Date" },
  platform: { id: "platform", label: "Platform" },
  description: { id: "description", label: "Description" },
  campaignColor: { id: "campaign_color", label: "Campaign color" },
  pillar: { id: "pillar", label: "Pillar" },
  impressions: { id: "impressions", label: "Impressions" },
  status: { id: "status", label: "Status" },
  supabaseMediaLink: { id: "supabase_media_link", label: "Supabase_Media_Link" },
  scheduledFlag: { id: "scheduled_flag", label: "Scheduled Flag" },
  publishedFlag: { id: "published_flag", label: "Published Flag" },
  postId: { id: "post_id", label: "Post ID" },
};

const MONDAY_ONLY_COLUMNS = new Set([
  "approval", "assignee", "priority", "brief_link",
]);

const GPE_MONDAY_COLUMN_IDS: Record<string, string> = {
  campaign: "color_mm48zxqq",
  publishTime: "hour_mm48mp3",
  publishDate: "date_mm4c565j",
  platform: "dropdown_mm4cpa3h",
  description: "text_mm4ca2yx",
  campaignColor: "color_mm48zxqq",
  pillar: "color_mm48yxkg",
  impressions: "numeric_mm4catzd",
  status: "color_mm4ce54j",
  supabaseMediaLink: "link_mm4ebncg",
  scheduledFlag: "boolean_mm48k6d4",
  publishedFlag: "boolean_mm4810yy",
  postId: "text_mm487ddg",
  approval: "boolean_mm48ef4r",
  assignee: "multiple_person_mm487430",
  priority: "color_mm48n8sm",
  brief_link: "link_mm484n6h",
  briefLink: "link_mm484n6h",
};

const MONDAY_ONLY_COLUMN_IDS = new Set(Array.from(MONDAY_ONLY_COLUMNS).map((key) => GPE_MONDAY_COLUMN_IDS[key]).filter(Boolean));

async function getWorkspaceMondayBoardId(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, fallback = "") {
  if (fallback) return fallback;
  const { data, error } = await supabase.from("workspaces").select("monday_board_id").eq("id", workspaceId).maybeSingle();
  if (error) throw error;
  return String(data?.monday_board_id || "").trim();
}

async function fetchMondayBoard(token: string, boardId: string) {
  const mondayResp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($ids: [ID!]) { boards(ids: $ids) { id name state groups { id title } columns { id title type settings_str } } }",
      variables: { ids: [boardId] },
    }),
  });
  const mondayData = await mondayResp.json();
  if (!mondayResp.ok || mondayData.errors) throw new Error(mondayData.errors?.[0]?.message || "Monday board access failed");
  const board = mondayData.data?.boards?.[0] || null;
  if (!board) throw new Error("Monday board not found");
  return board;
}

async function getBoardGroups(token: string, boardId: string): Promise<MondayGroup[]> {
  try {
    const mondayResp = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query ($boardId: ID!) { boards(ids: [$boardId]) { id groups { id title } } }",
        variables: { boardId },
      }),
    });
    const mondayData = await mondayResp.json();
    if (!mondayResp.ok || mondayData.errors) throw new Error(mondayData.errors?.[0]?.message || "Monday groups fetch failed");
    const groups = mondayData.data?.boards?.[0]?.groups || [];
    console.log("[monday] board groups", { boardId, count: groups.length, groups: groups.map((g: { id: string; title: string }) => ({ id: g.id, title: g.title })) });
    return groups;
  } catch (err) {
    console.warn("[monday] groups fetch failed, proceeding without groups", err instanceof Error ? err.message : String(err));
    return [];
  }
}

function normalizeMondayGroupName(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getPostCampaignName(post: Record<string, unknown>) {
  return String(post.campaign_name || post.campaignName || post.campaign || "").trim();
}

function getFallbackMondayGroup(groups: MondayGroup[], campaignName = ""): MondayGroupResolution {
  if (!groups || !groups.length) {
    console.log("[monday] group fallback used", { strategy: "no_groups", group_id: "", group_title: "" });
    return { groupId: "", groupTitle: "", matchStrategy: "no_groups", groupCreated: false, groupCreateError: "" };
  }

  const uncategorized = groups.find((group) => normalizeMondayGroupName(group.title) === "uncategorized");
  if (uncategorized) {
    const selected: MondayGroupResolution = { groupId: uncategorized.id, groupTitle: uncategorized.title, matchStrategy: "uncategorized", groupCreated: false, groupCreateError: "" };
    console.log("[monday] group fallback used", { campaign: campaignName, group_id: selected.groupId, group_title: selected.groupTitle, strategy: selected.matchStrategy });
    console.log("[monday] group_id selected", selected);
    return selected;
  }

  const firstGroup = groups[0];
  const selected: MondayGroupResolution = { groupId: firstGroup.id, groupTitle: firstGroup.title, matchStrategy: "first_group", groupCreated: false, groupCreateError: "" };
  console.log("[monday] group fallback used", { campaign: campaignName, group_id: selected.groupId, group_title: selected.groupTitle, strategy: selected.matchStrategy });
  console.log("[monday] group_id selected", selected);
  return selected;
}

function selectMondayGroupForPost(post: Record<string, unknown>, groups: MondayGroup[]): MondayGroupResolution {
  const campaignName = getPostCampaignName(post);
  const campaignKey = normalizeMondayGroupName(campaignName);
  if (campaignKey) {
    const campaignMatch = groups.find((group) => normalizeMondayGroupName(group.title) === campaignKey);
    if (campaignMatch) {
      const selected: MondayGroupResolution = { groupId: campaignMatch.id, groupTitle: campaignMatch.title, matchStrategy: "exact_match", groupCreated: false, groupCreateError: "" };
      console.log("[monday] campaign group match", { campaign: campaignName, group_id: selected.groupId, group_title: selected.groupTitle, strategy: selected.matchStrategy });
      console.log("[monday] group_id selected", selected);
      return selected;
    }
  }
  return getFallbackMondayGroup(groups, campaignName);
}

async function createMondayCampaignGroup(token: string, boardId: string, campaignName: string): Promise<{ group: MondayGroup | null; error: string }> {
  const groupName = String(campaignName || "").trim();
  if (!groupName) return { group: null, error: "Missing campaign name" };
  try {
    console.log("[monday] creating campaign group", { boardId, campaign_name: groupName });
    const data = await mondayGraphql(token, "CreateGroup", `mutation CreateGroup($boardId: ID!, $groupName: String!) { create_group(board_id: $boardId, group_name: $groupName) { id title } }`, { boardId, groupName });
    const group = data?.data?.create_group || null;
    if (!group?.id) throw new Error("Monday group creation returned no group id");
    console.log("[monday] campaign group created", { boardId, group_id: group.id, group_title: group.title });
    return { group: { id: String(group.id), title: String(group.title || groupName) }, error: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[monday] campaign group create failed", { boardId, campaign_name: groupName, error: message });
    return { group: null, error: message };
  }
}

async function resolveMondayGroupId(token: string, boardId: string, post: Record<string, unknown>, existingGroups?: MondayGroup[]): Promise<MondayGroupResolution> {
  const groups = existingGroups || await getBoardGroups(token, boardId);
  console.log("[monday] board groups", { boardId, count: groups.length, groups: groups.map((g) => ({ id: g.id, title: g.title })) });
  const campaignName = getPostCampaignName(post);
  const campaignKey = normalizeMondayGroupName(campaignName);
  const selected = selectMondayGroupForPost(post, groups);
  if (!campaignKey || selected.matchStrategy === "exact_match") return selected;

  console.log("[monday] campaign group missing", { boardId, campaign_name: campaignName });
  const created = await createMondayCampaignGroup(token, boardId, campaignName);
  if (created.group) {
    groups.push(created.group);
    const resolved: MondayGroupResolution = {
      groupId: created.group.id,
      groupTitle: created.group.title,
      matchStrategy: "created",
      groupCreated: true,
      groupCreateError: "",
    };
    console.log("[monday] group_id selected", resolved);
    return resolved;
  }

  const fallback = getFallbackMondayGroup(groups, campaignName);
  fallback.groupCreateError = created.error;
  return fallback;
}

async function mondayGraphql(token: string, queryName: string, query: string, variables: Record<string, unknown>) {
  console.log("[monday] graphql query name", queryName);
  console.log("[monday] graphql variables", variables);
  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await resp.json();
  console.log("[monday] graphql raw response", data);
  if (!resp.ok || data.errors) {
    throw new Error(data.errors?.[0]?.message || `${queryName} failed`);
  }
  return data;
}

async function moveMondayItemToGroup(token: string, itemId: string, groupId: string) {
  return await mondayGraphql(token, "MoveItemToGroup", `mutation MoveItemToGroup($itemId: ID!, $groupId: String!) { move_item_to_group(item_id: $itemId, group_id: $groupId) { id } }`, { itemId, groupId });
}

function normalizeLabel(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveColumn(columns: MondayColumn[], targetId: string, aliases: string[], allowedTypes: string[]) {
  const byId = columns.find((c) => c.id === targetId);
  if (byId) return byId;
  const normalizedAliases = aliases.map(normalizeLabel);
  return columns.find((c) => {
    const title = normalizeLabel(c.title);
    const typeOk = !allowedTypes.length || allowedTypes.includes(String(c.type || "").toLowerCase());
    return typeOk && normalizedAliases.some((a) => title === a || title.includes(a));
  }) || null;
}

function buildMondayColumnMapping(columns: MondayColumn[]) {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const c of columns) {
    if (seen.has(c.id)) dupes.push(c.id);
    seen.add(c.id);
  }
  if (dupes.length) console.warn("[monday] duplicate column id configured", dupes);

  const mapping: Record<string, MondayColumn | null> = {};
  for (const [key, info] of Object.entries(COLUMN_MAP)) {
    const gpeId = GPE_MONDAY_COLUMN_IDS[key];
    mapping[key] = resolveColumn(columns, gpeId, [info.label, info.id, ...key.split("_")], []);
  }
  const mondayOnly: Record<string, MondayColumn | null> = {};
  for (const key of MONDAY_ONLY_COLUMNS) {
    const gpeId = GPE_MONDAY_COLUMN_IDS[key] || key;
    mondayOnly[key] = resolveColumn(columns, gpeId, [key.replace(/_/g, " ")], []);
  }
  const missing = Object.entries(mapping).filter(([, col]) => !col).map(([k]) => k);
  const used = Object.fromEntries(Object.entries(mapping).filter(([, col]) => !!col).map(([k, col]) => [k, { id: col!.id, title: col!.title, type: col!.type }]));
  return { mapping, mondayOnly, missing, used, duplicateColumnWarnings: dupes };
}

function normalizeStatusLabel(raw: string) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "draft") return "Draft";
  if (v === "review" || v === "needs_review") return "Review";
  if (v === "scheduled") return "Scheduled";
  if (v === "published") return "Published";
  if (v === "archive" || v === "archived") return "Archive";
  return raw || "Draft";
}

function normalizePillarLabel(raw: string) {
  const v = normalizeLabel(raw);
  if (["advocacy", "advocate", "policy", "justice"].includes(v)) return "Advocacy";
  if (["community", "communal", "audience", "engagement"].includes(v)) return "Community";
  if (["leadership", "leader", "thought leadership", "authority"].includes(v)) return "Leadership";
  if (["wellness", "wellbeing", "well being", "healing", "health"].includes(v)) return "Wellness";
  return "";
}

function normalizePlatformLabel(raw: string) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "instagram") return "Instagram";
  if (v === "linkedin") return "Linkedin";
  if (v === "threads") return "Threads";
  if (v === "tiktok") return "TikTok";
  if (v === "youtube") return "YouTube";
  return "";
}

function parseMondayDropdownLabels(column: MondayColumn): string[] {
  const raw = String(column.settings_str || "").trim();
  if (!raw) return [];
  try {
    const settings = JSON.parse(raw);
    const labels = settings?.labels;
    if (Array.isArray(labels)) {
      return labels.map((label) => String(label?.name || label?.label || label || "").trim()).filter(Boolean);
    }
    if (labels && typeof labels === "object") {
      return Object.values(labels).map((label) => {
        if (label && typeof label === "object") return String((label as Record<string, unknown>).name || (label as Record<string, unknown>).label || "").trim();
        return String(label || "").trim();
      }).filter(Boolean);
    }
  } catch (err) {
    console.warn("[monday] dropdown labels parse failed", { column_id: column.id, error: err instanceof Error ? err.message : String(err) });
  }
  return [];
}

function isPillarColumn(column: MondayColumn) {
  const title = normalizeLabel(column.title);
  return column.id === GPE_MONDAY_COLUMN_IDS.pillar || title === "pillar" || title.includes("pillar");
}

function normalizePillarStatusValue(column: MondayColumn, rawValue: unknown) {
  const raw = String(rawValue || "").trim();
  console.log("[monday] pillar raw", raw);
  const boardLabels = parseMondayDropdownLabels(column);
  console.log("[monday] board pillar labels", boardLabels);
  const boardLabelsByKey = new Map(boardLabels.map((label) => [normalizeLabel(label), label]));
  const fallback = normalizePillarLabel(raw);
  const label = boardLabelsByKey.get(normalizeLabel(raw)) || boardLabelsByKey.get(normalizeLabel(fallback)) || fallback;
  console.log("[monday] pillar normalized", fallback || "");
  if (!label || (boardLabels.length && !boardLabelsByKey.has(normalizeLabel(label)))) {
    console.warn("[monday] pillar label skipped", { raw, normalized: fallback || "", board_labels: boardLabels });
    return undefined;
  }
  console.log("[monday] pillar label used", label);
  return { label };
}

function isPlatformColumn(column: MondayColumn) {
  const title = normalizeLabel(column.title);
  return column.id === GPE_MONDAY_COLUMN_IDS.platform || title === "platform" || title.includes("platform");
}

function splitDropdownRawValues(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) return rawValue.flatMap((value) => splitDropdownRawValues(value));
  return String(rawValue || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean);
}

function normalizePlatformDropdownLabels(column: MondayColumn, rawValue: unknown) {
  const rawLabels = splitDropdownRawValues(rawValue);
  console.log("[monday] platform raw", rawLabels);
  const boardLabels = parseMondayDropdownLabels(column);
  const boardLabelsByKey = new Map(boardLabels.map((label) => [normalizeLabel(label), label]));
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawLabel of rawLabels) {
    const fallback = normalizePlatformLabel(rawLabel);
    const boardLabel = boardLabelsByKey.get(normalizeLabel(rawLabel)) || boardLabelsByKey.get(normalizeLabel(fallback)) || "";
    const label = boardLabel || fallback;
    if (!label) continue;
    if (!boardLabel && fallback !== rawLabel) console.log("[monday] dropdown label fallback", { raw: rawLabel, label });
    const key = normalizeLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(label);
  }
  console.log("[monday] platform normalized", normalized);
  console.log("[monday] dropdown labels used", normalized);
  return normalized;
}

function mondayValueForColumn(column: MondayColumn, rawValue: unknown) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return undefined;
  const type = String(column.type || "").toLowerCase();
  if (type === "date") return { date: String(rawValue).slice(0, 10) };
  if (type === "hour" || type === "time") {
    const t = String(rawValue || "").trim();
    const parts = t.match(/^(\d{1,2}):?(\d{2})?(?:\s*(am|pm))?$/i);
    if (parts) {
      let h = parseInt(parts[1], 10);
      const m = parseInt(parts[2] || "0", 10);
      const suf = (parts[3] || "").toLowerCase();
      if (suf === "pm" && h < 12) h += 12;
      if (suf === "am" && h === 12) h = 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { hour: h, minute: m };
    }
    return { hour: 13, minute: 30 };
  }
  if ((type === "status" || type === "color") && isPillarColumn(column)) return normalizePillarStatusValue(column, rawValue);
  if (type === "status" || type === "color") return { label: String(rawValue) };
  if (type === "dropdown") {
    const labels = isPlatformColumn(column) ? normalizePlatformDropdownLabels(column, rawValue) : splitDropdownRawValues(rawValue);
    return { labels };
  }
  if (type === "boolean" || type === "checkbox") return { checked: String(rawValue) === "true" || rawValue === true ? "true" : "false" };
  if (type === "numeric" || type === "numbers") return String(rawValue);
  if (type === "link") {
    const url = typeof rawValue === "object" ? (rawValue as Record<string, unknown>).url || "" : String(rawValue);
    return { url: String(url), text: "Open" };
  }
  return String(rawValue);
}

function buildColumnValues(post: Record<string, unknown>, mapping: Record<string, MondayColumn | null>, mediaUrl: string) {
  const cv: Record<string, unknown> = {};
  const assign: Array<[string, unknown]> = [
    ["description", post.description || post.caption || post.body || ""],
    ["publishDate", post.scheduled_at || post.publish_date || post.publishDate || post.date || ""],
    ["publishTime", post.publish_time || post.publishTime || post.queueTimeLabel || ""],
    ["platform", post.platform_targets || post.platforms || post.platform || ""],
    ["impressions", post.impressions || post.impression_count || post.views || 0],
    ["pillar", post.pillar || post.content_pillar || post.contentPillar || ""],
    ["campaignColor", post.campaign_name || post.campaignName || ""],
    ["postId", post.post_id || post.postId || post.id || ""],
  ];
  const status = normalizeStatusLabel(String(post.status || post.publish_status || post.flowState || "draft"));
  assign.push(["status", status]);
  const statusLower = String(status).toLowerCase();
  if (statusLower === "scheduled" || String(post.status || "").toLowerCase() === "scheduled") {
    assign.push(["scheduledFlag", true]);
  }
  if (statusLower === "published" || String(post.status || "").toLowerCase() === "published") {
    assign.push(["publishedFlag", true]);
  }
  if (mediaUrl) {
    assign.push(["supabaseMediaLink", { url: mediaUrl, text: "Open media" }]);
  }
  for (const [key, value] of assign) {
    const column = mapping[key];
    if (!column) continue;
    const mv = mondayValueForColumn(column, value);
    if (mv !== undefined) cv[column.id] = mv;
  }
  return cv;
}

async function buildMediaUrl(supabase: ReturnType<typeof getSupabaseServiceClient>, post: Record<string, unknown>, workspaceId: string) {
  const postId = String(post.post_id || post.postId || post.id || "").trim();
  if (!postId) return "";
  const { data: rows, error } = await supabase
    .from("post_media")
    .select("media_asset_id")
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId)
    .order("sort_order", { ascending: true })
    .limit(1);
  if (error || !rows?.length) return "";
  const assetId = rows[0].media_asset_id;
  if (!assetId) return "";
  const { data: asset } = await supabase.from("media_assets").select("media_url").eq("id", assetId).maybeSingle();
  return String(asset?.media_url || "").trim();
}

async function findExistingItem(token: string, boardId: string, postId: string) {
  console.log("[monday] item lookup by post id", { boardId, postId });
  const query = `query ItemsByPostId($boardId: ID!, $columnId: String!, $columnValue: String!) {
    items_by_column_values(board_id: $boardId, column_id: $columnId, column_value: $columnValue) {
      id
      name
      column_values(ids: ["text_mm487ddg"]) { id text value }
    }
  }`;
  const data = await mondayGraphql(token, "ItemsByPostId", query, {
    boardId,
    columnId: GPE_MONDAY_COLUMN_IDS.postId,
    columnValue: postId,
  });
  const items = data?.data?.items_by_column_values || [];
  for (const item of items) {
    for (const cv of (item.column_values || [])) {
      if (cv.id === GPE_MONDAY_COLUMN_IDS.postId && String(cv.text || "").trim() === postId) return item;
    }
  }
  for (const item of items) {
    if (String(item.name || "").trim() === postId) return item;
  }
  return null;
}

function findItemByTitle(items: Record<string, unknown>[], title: string) {
  const normalized = normalizeLabel(title);
  if (!normalized) return null;
  for (const item of items || []) {
    if (normalizeLabel(String(item.name || "")) === normalized) return item;
  }
  return null;
}

async function fetchMondayBoardItems(token: string, boardId: string, limit = 500) {
  const pageLimit = Math.min(100, Math.max(1, Number(limit || 100)));
  const items: Record<string, unknown>[] = [];
  const firstQuery = `query BoardItemsPage($boardId: ID!, $limit: Int!) {
    boards(ids: [$boardId]) {
      items_page(limit: $limit) {
        cursor
        items { id name group { id title } column_values { id text value } }
      }
    }
  }`;
  const nextQuery = `query NextItemsPage($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items { id name group { id title } column_values { id text value } }
    }
  }`;
  let data = await mondayGraphql(token, "BoardItemsPage", firstQuery, { boardId, limit: pageLimit });
  let page = data?.data?.boards?.[0]?.items_page || {};
  let cursor = String(page.cursor || "").trim();
  items.push(...(Array.isArray(page.items) ? page.items : []));
  console.log("[monday] items_page cursor", cursor || "(none)");
  while (cursor && items.length < limit) {
    data = await mondayGraphql(token, "NextItemsPage", nextQuery, { cursor, limit: pageLimit });
    page = data?.data?.next_items_page || {};
    cursor = String(page.cursor || "").trim();
    items.push(...(Array.isArray(page.items) ? page.items : []));
    console.log("[monday] items_page cursor", cursor || "(none)");
  }
  return items.slice(0, limit);
}

function preserveMondayOnlyColumns(existingColumnValues: Array<{ id: string; text?: string }>) {
  const preserved: Record<string, unknown> = {};
  for (const cv of existingColumnValues || []) {
    if (MONDAY_ONLY_COLUMN_IDS.has(cv.id) || Object.values(GPE_MONDAY_COLUMN_IDS).includes(cv.id) === false) {
      if (cv.text && cv.text !== "{}") preserved[cv.id] = cv.text;
    }
  }
  return preserved;
}

async function backfillMondayBoard(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  boardId: string,
  token: string,
) {
  const startedAt = new Date().toISOString();
  const suppliedPosts = Array.isArray(body.posts) ? body.posts : [];
  let frontendPostsCount = suppliedPosts.length;
  let supabasePostsCount = 0;
  let posts: Record<string, unknown>[] = [];
  let sourceUsed = "supabase_posts";
  if (suppliedPosts.length) {
    posts = suppliedPosts.map((post) => ({ ...post }));
    sourceUsed = "frontend_posts";
    console.log("[monday-backfill] using frontend posts", { count: posts.length, sample_post_ids: posts.slice(0, 5).map((post) => String(post.post_id || post.postId || post.id || "").trim()) });
  } else {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    posts = (data || []) as Record<string, unknown>[];
    supabasePostsCount = posts.length;
    console.log("[monday-backfill] using supabase posts", { count: posts.length });
  }

  if (!posts.length) {
    return {
      ok: false,
      total_posts_seen: 0,
      frontend_posts_count: frontendPostsCount,
      supabase_posts_count: supabasePostsCount,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      error: "No posts were sent to Monday. Calendar/Ledger may be using a different source than Monday backfill.",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }

  const board = await fetchMondayBoard(token, boardId);
  const boardItems = await fetchMondayBoardItems(token, boardId, Math.max(500, posts.length + 50));
  const itemByPostId = new Map<string, Record<string, unknown>>();
  const itemById = new Map<string, Record<string, unknown>>();
  for (const item of boardItems || []) {
    const itemId = String(item.id || "").trim();
    if (itemId) itemById.set(itemId, item);
    const postIdCv = (item.column_values || []).find((cv: Record<string, unknown>) => String(cv.id || "").trim() === GPE_MONDAY_COLUMN_IDS.postId);
    const postId = String(postIdCv?.text || item.name || "").trim();
    if (postId) itemByPostId.set(postId, item);
  }

  const total = posts.length;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Record<string, unknown>[] = [];
  const mondayItemIdsByPostId: Record<string, string> = {};
  let lastGroupInfo: MondayGroupResolution = { groupId: "", groupTitle: "", matchStrategy: "no_groups", groupCreated: false, groupCreateError: "" };
  let groupsCreated = 0;
  let movedGroups = 0;
  let groupMoveFailed = 0;
  let lastPreviousGroupId = "";
  let lastTargetGroupId = "";
  let lastGroupMoved = false;
  let lastGroupMoveError = "";

  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index] || {};
    const postId = String(post.post_id || post.postId || post.id || "").trim();
    if (!postId) {
      skipped += 1;
      continue;
    }

    try {
      const existingItemId = String(post.monday_item_id || post.mondayItemId || "").trim();
      const title = String(post.title || post.post_title || postId || "StellarSync Post").trim();
      const matchedItem = existingItemId ? itemById.get(existingItemId) || itemByPostId.get(postId) || findItemByTitle(boardItems, title) || null : itemByPostId.get(postId) || findItemByTitle(boardItems, title) || null;
      let itemId = String(matchedItem?.id || existingItemId || "").trim();
      const columns = (board.columns || []) as MondayColumn[];
      const mapped = buildMondayColumnMapping(columns);
      let columnValues = buildColumnValues(post, mapped.mapping, String(post.media_url || post.mediaUrl || "").trim());
      const groupInfo = await resolveMondayGroupId(token, boardId, post, (board as any).groups);
      lastGroupInfo = groupInfo;
      if (groupInfo.groupCreated) groupsCreated += 1;
      const matchedGroup = ((matchedItem as Record<string, unknown> | null)?.group || null) as Record<string, unknown> | null;
      let previousGroupId = String(matchedGroup?.id || "").trim();
      let targetGroupId = String(groupInfo.groupId || "").trim();
      let groupMoved = false;
      let groupMoveError = "";
      if (itemId) {
        const existingData = await mondayGraphql(token, "ReadItemColumnValues", `query ReadItemColumnValues($itemId: ID!) { items(ids: [$itemId]) { group { id title } column_values { id text value } } }`, { itemId });
        const existingItem = existingData?.data?.items?.[0] || {};
        if (!previousGroupId) previousGroupId = String(existingItem?.group?.id || "").trim();
        const existingCVs = existingItem?.column_values || [];
        columnValues = { ...columnValues, ...preserveMondayOnlyColumns(existingCVs) };
      }

      console.log("[monday-backfill] progress", { index: index + 1, total, postId, matched: !!itemId, title });
      if (itemId) {
        if (targetGroupId && previousGroupId && previousGroupId !== targetGroupId) {
          try {
            await moveMondayItemToGroup(token, itemId, targetGroupId);
            groupMoved = true;
            movedGroups += 1;
          } catch (moveErr) {
            groupMoveFailed += 1;
            groupMoveError = moveErr instanceof Error ? moveErr.message : String(moveErr);
            console.warn("[monday] group move failed", { postId, itemId, previous_group_id: previousGroupId, target_group_id: targetGroupId, error: groupMoveError });
          }
        }
        lastPreviousGroupId = previousGroupId;
        lastTargetGroupId = targetGroupId;
        lastGroupMoved = groupMoved;
        lastGroupMoveError = groupMoveError;
        await mondayGraphql(token, "ChangeMultipleColumnValues", `mutation ChangeMultipleColumnValues($boardId: ID!, $itemId: ID!, $columnValues: JSON!) { change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id } }`, { boardId, itemId, columnValues: JSON.stringify(columnValues) });
        updated += 1;
      } else {
        const createVars: Record<string, unknown> = { boardId, itemName: String(post.title || post.post_title || postId || "StellarSync Post").trim(), columnValues: JSON.stringify(columnValues), groupId: groupInfo.groupId };
        const createData = await mondayGraphql(token, "CreateItem", `mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) { create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) { id } }`, createVars);
        itemId = String(createData.data?.create_item?.id || "").trim();
        if (!itemId) throw new Error("Monday create returned no item id");
        created += 1;
        lastPreviousGroupId = "";
        lastTargetGroupId = targetGroupId;
        lastGroupMoved = false;
        lastGroupMoveError = "";
        console.log("[monday-backfill] group match", { postId, campaign: String(post.campaign_name || post.campaignName || post.campaign || "").trim(), group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, match_strategy: groupInfo.matchStrategy });
      }

      mondayItemIdsByPostId[postId] = itemId;
      try {
        const { error: writebackError } = await supabase.from("posts").update({
          monday_item_id: itemId,
          mondayItemId: itemId,
          monday_sync_status: "synced",
          mondaySyncStatus: "synced",
          monday_last_pushed_at: startedAt,
          updated_at: new Date().toISOString(),
        }).eq("workspace_id", workspaceId).eq("post_id", postId);
        if (writebackError) {
          console.warn("[monday] post metadata update skipped", writebackError.message || writebackError);
          console.warn("[monday] monday_item_id writeback skipped", writebackError.message || writebackError);
        }
      } catch (writebackErr) {
        const message = writebackErr instanceof Error ? writebackErr.message : String(writebackErr);
        console.warn("[monday] post metadata update skipped", message);
        console.warn("[monday] monday_item_id writeback skipped", message);
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ post_id: postId, error: message });
      console.log("[monday-backfill] progress", { index: index + 1, total, postId, failed: true, error: message });
      console.error("[monday] error full object", err);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const groups = (board as any).groups || [];
  const fallbackGroup = groups.find((group: { id: string; title: string }) => normalizeMondayGroupName(group.title) === "uncategorized") || groups[0] || null;
  await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
    board_id: boardId,
    board_name: board.name,
    groups_found: groups.length,
    board_groups: groups,
    default_group_id: fallbackGroup?.id || "",
    default_group_title: fallbackGroup?.title || "",
    group_id: lastGroupInfo.groupId,
    group_title: lastGroupInfo.groupTitle,
    group_match_strategy: lastGroupInfo.matchStrategy,
    group_created: lastGroupInfo.groupCreated,
    group_create_error: lastGroupInfo.groupCreateError,
    groups_created: groupsCreated,
    moved_groups: movedGroups,
    group_move_failed: groupMoveFailed,
    last_sync_at: new Date().toISOString(),
    monday_last_pushed_at: new Date().toISOString(),
    monday_sync_enabled: body.monday_sync_enabled !== undefined ? Boolean(body.monday_sync_enabled) : undefined,
    monday_sync_direction: String(body.monday_sync_direction || "").trim() || undefined,
  });

  return {
    ok: true,
    total,
    total_posts_seen: total,
    frontend_posts_count: frontendPostsCount,
    supabase_posts_count: supabasePostsCount,
    created,
    updated,
    skipped,
    failed,
    errors: errors.slice(0, 20),
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    source: sourceUsed,
    source_used: sourceUsed,
    monday_item_ids_by_post_id: mondayItemIdsByPostId,
    group_id: lastGroupInfo.groupId,
    group_title: lastGroupInfo.groupTitle,
    group_match_strategy: lastGroupInfo.matchStrategy,
    group_created: lastGroupInfo.groupCreated,
    group_create_error: lastGroupInfo.groupCreateError,
    previous_group_id: lastPreviousGroupId,
    target_group_id: lastTargetGroupId,
    group_moved: lastGroupMoved,
    group_move_error: lastGroupMoveError,
    groups_created: groupsCreated,
    moved_groups: movedGroups,
    group_move_failed: groupMoveFailed,
    groups_found: groups.length,
    default_group_id: fallbackGroup?.id || "",
    default_group_title: fallbackGroup?.title || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await readBody(req);
    const action = String(body.action || "").trim();
    const workspaceId = String(body.workspace_id || "").trim();
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);
    console.log("[monday] request payload", body);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);
    const token = getEnv("MONDAY_API_TOKEN", true);

    const { data: connection } = await supabase.from("workspace_connections").select("*").eq("workspace_id", workspaceId).eq("provider", "monday").maybeSingle();

    const boardId = await getWorkspaceMondayBoardId(supabase, workspaceId, String(body.board_id || connection?.config?.board_id || connection?.config?.monday_board_id || connection?.metadata?.board_id || "").trim());
    if (!boardId) throw new Error("Missing monday board_id");
    console.log("[monday] board id", boardId);

    if (action === "test" || action === "inspect_columns") {
      console.log("[monday] board test/inspect started");
      const board = await fetchMondayBoard(token, boardId);
      const columns = (board.columns || []) as MondayColumn[];
      const groups = (board as any).groups || [];
      const fallbackGroup = groups.find((group: { id: string; title: string }) => normalizeMondayGroupName(group.title) === "uncategorized") || groups[0] || null;
      const mapped = buildMondayColumnMapping(columns);
      console.log("[monday] board groups found", groups.length, groups.map((g: {id:string;title:string}) => g.title));
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: board.id, board_name: board.name, state: board.state,
        columns_found: columns, columns_used: mapped.used, missing_columns: mapped.missing,
        groups_found: groups.length,
        board_groups: groups,
        default_group_id: fallbackGroup?.id || "",
        default_group_title: fallbackGroup?.title || "",
        last_sync_at: new Date().toISOString(),
      });
      console.log("[monday] board test success", { workspace_id: workspaceId, board_id: board.id });
      return json({ ok: true, board: { id: board.id, name: board.name, state: board.state, groups }, board_id: board.id, board_name: board.name, columns, columns_found: columns, columns_used: mapped.used, missing_columns: mapped.missing, duplicate_column_warnings: mapped.duplicateColumnWarnings, groups_found: groups.length, board_groups: groups, default_group_id: fallbackGroup?.id || "", default_group_title: fallbackGroup?.title || "" });

    } else if (action === "sync_post") {
      console.log("[monday] sync_post started");
      const board = await fetchMondayBoard(token, boardId);
      const columns = (board.columns || []) as MondayColumn[];
      const mapped = buildMondayColumnMapping(columns);
      console.log("[monday] column map used", mapped.used);
      console.log("[monday] column map missing", mapped.missing);

      const post: Record<string, unknown> = {};
      for (const k of Object.keys(body)) post[k] = body[k];
      const postId = String(post.post_id || post.postId || post.id || "").trim();
      const postTitle = String(post.post_title || post.title || postId || "StellarSync Post").trim();
      const mediaUrl = String(body.media_url || "").trim() || await buildMediaUrl(supabase, post, workspaceId);
      const columnValues = buildColumnValues(post, mapped.mapping, mediaUrl);
      console.log("[monday] column values", columnValues);

      let existingItemId = String(body.monday_item_id || "").trim();
      let itemId = existingItemId;
      let matchStrategy = existingItemId ? "provided_item_id" : "";

      if (!itemId && postId) {
        const found = await findExistingItem(token, boardId, postId);
        if (found) {
          itemId = String(found.id);
          matchStrategy = "post_id_column";
          console.log("[monday] item match strategy post_id_column", { itemId, postId });
        }
      }
      console.log("[monday] item match strategy", matchStrategy || "create_new");

      const mondayOnlyColumns: Record<string, unknown> = {};
      if (itemId) {
        const mondayData = await mondayGraphql(token, "ReadItemColumnValues", `query ReadItemColumnValues($itemId: ID!) { items(ids: [$itemId]) { column_values { id text value } } }`, { itemId });
        const existingCVs = mondayData?.data?.items?.[0]?.column_values || [];
        for (const cv of existingCVs) {
          if (MONDAY_ONLY_COLUMN_IDS.has(cv.id) || Object.values(GPE_MONDAY_COLUMN_IDS).includes(cv.id) === false) {
            if (cv.text && cv.text !== "{}") mondayOnlyColumns[cv.id] = cv.text;
          }
        }
      }
      for (const [key, col] of Object.entries(mapped.mondayOnly)) {
        if (col && mondayOnlyColumns[col.id]) columnValues[col.id] = mondayOnlyColumns[col.id];
      }

      let groupInfo: MondayGroupResolution = { groupId: "", groupTitle: "", matchStrategy: "no_groups", groupCreated: false, groupCreateError: "" };
      if (!itemId) {
        groupInfo = await resolveMondayGroupId(token, boardId, post, (board as any).groups);
        console.log("[monday] resolved group", groupInfo);
      }

      if (itemId) {
        try {
          const mondayData = await mondayGraphql(token, "ChangeMultipleColumnValues", `mutation ChangeMultipleColumnValues($boardId: ID!, $itemId: ID!, $columnValues: JSON!) { change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id } }`, { boardId, itemId, columnValues: JSON.stringify(columnValues) });
          console.log("[monday] update response", mondayData);
        } catch (err) {
          const mondayError = err instanceof Error ? err.message : "Monday item update failed";
          const groups = (board as any).groups || [];
          const fallbackGroup = groups.find((group: { id: string; title: string }) => normalizeMondayGroupName(group.title) === "uncategorized") || groups[0] || null;
          return json({ ok: false, error: mondayError, monday_error: mondayError, diagnostics: { board_id: boardId, board_name: board.name, groups_found: groups.length, default_group_id: fallbackGroup?.id || "", default_group_title: fallbackGroup?.title || "", group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, group_match_strategy: groupInfo.matchStrategy, columns_used: mapped.used, missing_columns: mapped.missing, monday_error: mondayError }, board_id: boardId, board_name: board.name, columns_used: mapped.used, missing_columns: mapped.missing }, 400);
        }
      } else {
        let mondayData;
        try {
          const createVars: Record<string, unknown> = { boardId, itemName: postTitle, columnValues: JSON.stringify(columnValues), groupId: groupInfo.groupId };
          mondayData = await mondayGraphql(token, "CreateItem", `mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) { create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) { id } }`, createVars);
        } catch (err) {
          const mondayError = err instanceof Error ? err.message : "Monday item creation failed";
          const groups = (board as any).groups || [];
          const fallbackGroup = groups.find((group: { id: string; title: string }) => normalizeMondayGroupName(group.title) === "uncategorized") || groups[0] || null;
          return json({ ok: false, error: mondayError, monday_error: mondayError, diagnostics: { board_id: boardId, board_name: board.name, groups_found: groups.length, default_group_id: fallbackGroup?.id || "", default_group_title: fallbackGroup?.title || "", group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, group_match_strategy: groupInfo.matchStrategy, columns_used: mapped.used, missing_columns: mapped.missing, monday_error: mondayError }, board_id: boardId, board_name: board.name, columns_used: mapped.used, missing_columns: mapped.missing }, 400);
        }
        itemId = mondayData.data?.create_item?.id || "";
        if (!itemId) throw new Error("Monday item created but no ID returned");
        console.log("[monday] create response", mondayData);
      }

      const now = new Date().toISOString();
      const groups = (board as any).groups || [];
      const fallbackGroup = groups.find((group: { id: string; title: string }) => normalizeMondayGroupName(group.title) === "uncategorized") || groups[0] || null;
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: boardId,
        board_name: board.name,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing,
        groups_found: groups.length,
        board_groups: groups,
        default_group_id: fallbackGroup?.id || "",
        default_group_title: fallbackGroup?.title || "",
        group_id: groupInfo.groupId,
        group_title: groupInfo.groupTitle,
        group_match_strategy: groupInfo.matchStrategy,
        group_created: groupInfo.groupCreated,
        group_create_error: groupInfo.groupCreateError,
        last_sync_at: now,
        monday_sync_enabled: body.monday_sync_enabled !== undefined ? Boolean(body.monday_sync_enabled) : undefined,
        monday_sync_direction: String(body.monday_sync_direction || "").trim() || undefined,
        monday_last_pushed_at: now,
        monday_last_pulled_at: body.monday_last_pulled_at || null
      });
      console.log("[monday] saveback response", { ok: true, item_id: itemId, board_id: boardId });

      console.log("[monday] sync_post success", { workspace_id: workspaceId, board_id: boardId, item_id: itemId, group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, match_strategy: groupInfo.matchStrategy });
      return json({
        ok: true, monday_item_id: itemId, synced_at: now, item_url: `https://${board.name?.toLowerCase().replace(/\s+/g, "-") || "board"}.monday.com/boards/${boardId}/pulses/${itemId}`,
        columns_used: mapped.used, missing_columns: mapped.missing, duplicate_column_warnings: mapped.duplicateColumnWarnings, monday_only_preserved: Object.keys(mondayOnlyColumns).length,
        monday_sync_status: "synced",
        monday_last_pushed_at: now,
        group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, group_match_strategy: groupInfo.matchStrategy, groups_found: groups.length, default_group_id: fallbackGroup?.id || "", default_group_title: fallbackGroup?.title || "",
        group_created: groupInfo.groupCreated, group_create_error: groupInfo.groupCreateError,
        diagnostics: { board_id: boardId, board_name: board.name, groups_found: groups.length, default_group_id: fallbackGroup?.id || "", default_group_title: fallbackGroup?.title || "", group_id: groupInfo.groupId, group_title: groupInfo.groupTitle, group_match_strategy: groupInfo.matchStrategy, columns_used: mapped.used, missing_columns: mapped.missing },
        board_id: boardId, board_name: board.name, columns_found: columns, columns_used: mapped.used, missing_columns: mapped.missing,
      });

    } else if (action === "backfill_posts") {
      console.log("[monday-backfill] started");
      const result = await backfillMondayBoard(supabase, workspaceId, body, boardId, token);
      console.log("[monday-backfill] complete", result);
      return json(result);

    } else if (action === "pull_monday_fields") {
      console.log("[monday] pull_monday_fields started");
      const board = await fetchMondayBoard(token, boardId);
      const itemId = String(body.monday_item_id || "").trim();
      if (!itemId) throw new Error("Missing monday_item_id");
      const mondayResp = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query ($itemId: ID!) { items(ids: [$itemId]) { id name group { id title } column_values { id text } } }`, variables: { itemId } }),
      });
      const mondayData = await mondayResp.json();
      if (!mondayResp.ok || mondayData.errors) throw new Error(mondayData.errors?.[0]?.message || "Monday item read failed");
      const mondayItem = mondayData?.data?.items?.[0] || {};
      const mondayGroup = mondayItem?.group || {};
      const mondayGroupTitle = String(mondayGroup?.title || "").trim();
      const mondayGroupId = String(mondayGroup?.id || "").trim();
      const columnValues = mondayItem?.column_values || [];
      const fields: Record<string, string> = {};
      const fieldMap: Record<string, string> = {
        boolean_mm48ef4r: "monday_approval",
        multiple_person_mm487430: "monday_assignee",
        color_mm48n8sm: "monday_priority",
        link_mm484n6h: "monday_brief_link",
      };
      for (const cv of columnValues) {
        const mappedKey = fieldMap[cv.id];
        if (mappedKey && cv.text) fields[mappedKey] = cv.text;
        if (MONDAY_ONLY_COLUMNS.has(cv.id) && cv.text) fields[`monday_${cv.id}`] = cv.text;
      }
      const postId = String(body.post_id || body.postId || "").trim();
      if (postId) {
        const supabaseTable = "posts";
        await supabase.from(supabaseTable).update({ ...fields, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("post_id", postId);
      }
      const groups = (board as any).groups || [];
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: boardId,
        board_name: board.name,
        groups_found: groups.length,
        last_sync_at: new Date().toISOString(),
        monday_last_pulled_at: new Date().toISOString(),
        monday_sync_enabled: body.monday_sync_enabled !== undefined ? Boolean(body.monday_sync_enabled) : undefined,
        monday_sync_direction: String(body.monday_sync_direction || "").trim() || undefined,
      });
      console.log("[monday] monday-only pull response", fields);
      const pulledAt = new Date().toISOString();
      return json({ ok: true, monday_item_id: itemId, fields, board_id: boardId, board_name: board.name, monday_last_pulled_at: pulledAt, monday_sync_status: "pulled" });

    } else if (action === "pull_monday_updates") {
      console.log("[monday] pull_monday_updates started");
      const board = await fetchMondayBoard(token, boardId);
      const columns = (board.columns || []) as MondayColumn[];
      const mapped = buildMondayColumnMapping(columns);
      const itemId = String(body.monday_item_id || "").trim();
      if (!itemId) throw new Error("Missing monday_item_id");
      const mondayResp = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query ($itemId: ID!) { items(ids: [$itemId]) { id name group { id title } column_values { id text } } }`, variables: { itemId } }),
      });
      const mondayData = await mondayResp.json();
      if (!mondayResp.ok || mondayData.errors) throw new Error(mondayData.errors?.[0]?.message || "Monday item read failed");
      const mondayItem = mondayData?.data?.items?.[0] || {};
      const mondayGroup = mondayItem?.group || {};
      const mondayGroupTitle = String(mondayGroup?.title || "").trim();
      const mondayGroupId = String(mondayGroup?.id || "").trim();
      const columnValues = mondayItem?.column_values || [];

      const columnValueByColumnId = new Map<string, { id: string; text: string }>();
      for (const cv of columnValues) columnValueByColumnId.set(cv.id, cv);

      const pullFieldMap: Record<string, { mondayColumnId: string; stellarField: string }> = {
        description: { mondayColumnId: "text_mm4ca2yx", stellarField: "description" },
        platform: { mondayColumnId: "dropdown_mm4cpa3h", stellarField: "platform" },
        impressions: { mondayColumnId: "numeric_mm4catzd", stellarField: "impressions" },
        pillar: { mondayColumnId: "color_mm48yxkg", stellarField: "pillar" },
        status: { mondayColumnId: "color_mm4ce54j", stellarField: "status" },
        campaign: { mondayColumnId: "color_mm48zxqq", stellarField: "campaign_name" },
        publishDate: { mondayColumnId: "date_mm4c565j", stellarField: "publish_date" },
        publishTime: { mondayColumnId: "hour_mm48mp3", stellarField: "publish_time" },
        scheduledFlag: { mondayColumnId: "boolean_mm48k6d4", stellarField: "scheduled_flag" },
        publishedFlag: { mondayColumnId: "boolean_mm4810yy", stellarField: "published_flag" },
      };

      const updates: Record<string, string | number | boolean> = {};
      for (const [, mapping] of Object.entries(pullFieldMap)) {
        const cv = columnValueByColumnId.get(mapping.mondayColumnId);
        if (!cv || !cv.text) continue;
        updates[mapping.stellarField] = cv.text;
      }

      const mondayOnlyFieldMap: Record<string, string> = {
        boolean_mm48ef4r: "monday_approval",
        multiple_person_mm487430: "monday_assignee",
        color_mm48n8sm: "monday_priority",
        link_mm484n6h: "monday_brief_link",
      };
      for (const cv of columnValues) {
        const mappedKey = mondayOnlyFieldMap[cv.id];
        if (mappedKey && cv.text) updates[mappedKey] = cv.text;
        if (MONDAY_ONLY_COLUMNS.has(cv.id) && cv.text) updates[`monday_${cv.id}`] = cv.text;
      }

      delete updates.post_id;

      const postId = String(body.post_id || body.postId || "").trim();
      if (postId) {
        const { data: existingPost } = await supabase
          .from("posts")
          .select("updated_at,status,description,campaign_name")
          .eq("workspace_id", workspaceId)
          .eq("post_id", postId)
          .maybeSingle();
        updates.updated_at = new Date().toISOString();
        if (existingPost) {
          if (mondayGroupTitle && normalizeMondayGroupName(mondayGroupTitle) !== "uncategorized") {
            updates.monday_group_id = mondayGroupId;
            updates.monday_group_title = mondayGroupTitle;
            const existingCampaignName = String(existingPost.campaign_name || "").trim();
            const pulledCampaignName = String(updates.campaign_name || "").trim();
            if (!existingCampaignName || normalizeMondayGroupName(existingCampaignName) === normalizeMondayGroupName(pulledCampaignName)) {
              updates.campaign_name = mondayGroupTitle;
            } else if (normalizeMondayGroupName(existingCampaignName) !== normalizeMondayGroupName(mondayGroupTitle)) {
              updates._conflict = true;
              updates._conflict_message = "Monday group title differs from the StellarSync campaign. Choose which campaign name to keep.";
              updates.monday_campaign_name = mondayGroupTitle;
              delete updates.campaign_name;
            }
          }
          const lastSyncAt = String(body.last_synced_at || "").trim();
          if (lastSyncAt && existingPost.updated_at && String(existingPost.updated_at) > lastSyncAt) {
            updates._conflict = true;
            updates._conflict_message = String(updates._conflict_message || "Post was modified in StellarSync after last Monday sync. Overwrote with Monday values.");
          }
        }
        const dbUpdates: Record<string, string | number | boolean> = { ...updates };
        delete dbUpdates._conflict;
        delete dbUpdates._conflict_message;
        delete dbUpdates.monday_campaign_name;
        delete dbUpdates.monday_group_id;
        delete dbUpdates.monday_group_title;
        if (updates._conflict) {
          for (const [, mapping] of Object.entries(pullFieldMap)) {
            delete dbUpdates[mapping.stellarField];
          }
        }
        await supabase.from("posts").update(dbUpdates).eq("workspace_id", workspaceId).eq("post_id", postId);
      }
      const groups = (board as any).groups || [];
      const pulledAt = new Date().toISOString();
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: boardId,
        board_name: board.name,
        groups_found: groups.length,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing,
        last_sync_at: pulledAt,
        monday_last_pulled_at: pulledAt,
        monday_sync_enabled: body.monday_sync_enabled !== undefined ? Boolean(body.monday_sync_enabled) : undefined,
        monday_sync_direction: String(body.monday_sync_direction || "").trim() || undefined
      });

      console.log("[monday] pull_monday_updates response", updates);
      return json({ ok: true, monday_item_id: itemId, updates, fields: updates, board_id: boardId, board_name: board.name, columns_used: mapped.used, missing_columns: mapped.missing, monday_last_pulled_at: pulledAt, monday_sync_status: "pulled" });

    } else {
      return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[monday] error full object", err);
    const message = err instanceof Error ? err.message : "Monday sync failed";
    return json({ ok: false, error: message, monday_error: message }, 400);
  }
});
