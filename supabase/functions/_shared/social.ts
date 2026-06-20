import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const socialProviders = ["linkedin", "facebook", "instagram", "threads", "bluesky", "tiktok"] as const;
export const connectionProviders = ["linkedin", "facebook", "instagram", "threads", "bluesky", "tiktok", "monday"] as const;
export type SocialProvider = (typeof socialProviders)[number];
export type SocialMediaClassification = "empty" | "text" | "image" | "carousel" | "video" | "document" | "mixed";
export type SocialValidationSeverity = "ok" | "warning" | "error";

export const PLAN_CAPABILITIES: Record<string, Record<string, unknown>> = {
  starter: {
    max_workspaces: 1,
    team_members: false,
    csv_import_export: false,
    advanced_reporting: false,
    diagnostics: false,
    personal_profile_publishing: true,
    byo_api_credentials: true,
    company_page_publishing: false,
    managed_api_setup: false,
    exports_enabled: false,
    export_formats: [],
  },
  growth: {
    max_workspaces: 3,
    team_members: true,
    csv_import_export: true,
    advanced_reporting: true,
    diagnostics: true,
    media_library: true,
    personal_profile_publishing: true,
    byo_api_credentials: true,
    company_page_publishing: false,
    managed_api_setup: false,
    exports_enabled: true,
    export_formats: ["csv", "xlsx"],
  },
  managed: {
    max_workspaces: "multiple/custom",
    team_members: true,
    csv_import_export: true,
    advanced_reporting: true,
    diagnostics: true,
    media_library: true,
    personal_profile_publishing: true,
    byo_api_credentials: true,
    company_page_publishing: true,
    managed_api_setup: true,
    google_sheets_setup: true,
    monday_setup: true,
    drive_setup: true,
    implementation_support: true,
    exports_enabled: true,
    export_formats: ["csv", "xlsx", "json", "backup"],
  },
  admin_master: { internal_only: true, hidden: true, all_features: true, admin_workspaces: true },
};

export interface SocialValidationResult {
  valid: boolean;
  severity: SocialValidationSeverity;
  code: string;
  message: string;
  fix_hint: string;
  details: Record<string, unknown>;
}

export interface SocialMediaInput {
  id?: string;
  media_asset_id?: string;
  media_url?: string;
  mediaUrl?: string;
  url?: string;
  mime_type?: string;
  mimeType?: string;
  media_type?: string;
  mediaType?: string;
  filename?: string;
  storage_path?: string;
  storagePath?: string;
  title?: string;
  sort_order?: number;
  sortOrder?: number;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "avi", "mkv"];
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"];
const LONG_CAPTION_WARNING = 2800;
const THREADS_LONG_TEXT_WARNING = 500;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function readBody(req: Request) {
  if (req.method === "GET") {
    const url = new URL(req.url);
    return Object.fromEntries(url.searchParams.entries());
  }
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return {};
  }
}

export function getEnv(name: string, required = false) {
  const value = Deno.env.get(name) || "";
  if (required && !value) throw new Error(`Missing ${name}`);
  return value;
}

export function getEnvAny(names: string[], required = false) {
  for (const name of names) {
    const value = Deno.env.get(name) || "";
    if (value) return value;
  }
  if (required) throw new Error(`Missing Supabase Secret: ${names.join(" or ")}`);
  return "";
}

export function getPublicWebappBaseUrl(required = false) {
  return getEnv("PUBLIC_WEBAPP_BASE_URL", required).replace(/\/+$/, "");
}

export function getSocialCallbackUrl(provider: string) {
  const base = (getPublicWebappBaseUrl() || "https://stellarsync.app").replace(/\/+$/, "");
  const normalized = normalizeProvider(provider);
  return `${base}/auth/${normalized}/callback`;
}

export function getRequiredSocialSecrets(provider: string) {
  const p = normalizeProvider(provider);
  const shared = ["PUBLIC_WEBAPP_BASE_URL"];
  if (p === "linkedin") return [...shared, "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"];
  if (p === "facebook" || p === "instagram" || p === "threads") return [...shared, "META_CLIENT_ID", "META_CLIENT_SECRET"];
  if (p === "tiktok") return [...shared, "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"];
  if (p === "bluesky") return shared;
  return shared;
}

export function normalizePlanSlug(value: unknown) {
  const plan = String(value || "").trim().toLowerCase().replace(/[-\s]/g, "_");
  if (plan === "agency") return "growth";
  if (plan === "pro") return "growth";
  if (plan === "enterprise" || plan === "custom") return "managed";
  if (plan === "admin_master") return "admin_master";
  if (["starter", "growth", "managed"].includes(plan)) return plan;
  return "starter";
}

export function capabilitiesForPlan(value: unknown) {
  const plan = normalizePlanSlug(value);
  const caps = { ...(PLAN_CAPABILITIES[plan] || PLAN_CAPABILITIES.starter) };
  if (caps.all_features) Object.assign(caps, PLAN_CAPABILITIES.managed);
  return caps;
}

export function getMissingSocialSecrets(provider: string) {
  const required = getRequiredSocialSecrets(provider);
  const missing = required.filter((name) => {
    const raw = getEnv(name);
    if (raw) return false;
    if (name === "LINKEDIN_CLIENT_ID" && getEnv("LINKEDIN_APP_ID")) return false;
    if (name === "LINKEDIN_CLIENT_SECRET" && getEnv("LINKEDIN_APP_SECRET")) return false;
    return true;
  });

  // Log resolved secret presence (never values)
  if (provider === "linkedin") {
    const linkedinClientId = getEnv("LINKEDIN_CLIENT_ID") || getEnv("LINKEDIN_APP_ID") || "";
    const linkedinClientSecret = getEnv("LINKEDIN_CLIENT_SECRET") || getEnv("LINKEDIN_APP_SECRET") || "";
    console.log("[social-setup] linkedin env check", {
      public_base_url: !!getEnv("PUBLIC_WEBAPP_BASE_URL"),
      client_id: !!linkedinClientId,
      client_secret: !!linkedinClientSecret,
    });
  }

  return missing;
}

export function getSupabaseServiceClient() {
  const url = getEnv("SUPABASE_URL", true);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", true);
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function pickSecretRef(config: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const direct = String(config[name] || "").trim();
    if (direct) return direct;
  }
  return "";
}

export async function getWorkspaceSocialCredentials(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: string,
) {
  const p = normalizeProvider(provider);
  const fallbackIdNames = p === "linkedin" ? ["LINKEDIN_CLIENT_ID", "LINKEDIN_APP_ID"] : getRequiredSocialSecrets(p).filter((key) => /CLIENT_ID|APP_ID|CLIENT_KEY/.test(key));
  const fallbackSecretNames = p === "linkedin" ? ["LINKEDIN_CLIENT_SECRET", "LINKEDIN_APP_SECRET"] : getRequiredSocialSecrets(p).filter((key) => /CLIENT_SECRET|APP_SECRET|CLIENT_KEY|CLIENT_SECRET/.test(key));
  let appSource = "stellar_hosted";
  let clientId = "";
  let clientSecret = "";
  let credentialConfig: Record<string, unknown> = {};

  const { data: credentialRows } = await supabase
    .from("workspace_connections")
    .select("provider,status,config")
    .eq("workspace_id", workspaceId)
    .in("provider", [`${p}_credentials`, `${p}_managed_credentials`, `${p}_client_credentials`]);
  const row = (credentialRows || []).find((item) => {
    const status = String(item.status || "").toLowerCase();
    return status !== "disabled" && status !== "deleted";
  });

  if (row?.config && typeof row.config === "object") {
    credentialConfig = row.config as Record<string, unknown>;
    appSource = String(credentialConfig.app_source || credentialConfig.appSource || (String(row.provider || "").includes("client") ? "client_owned" : "managed_setup")).trim() || "managed_setup";
    clientId = pickSecretRef(credentialConfig, ["client_id", "clientId", "app_id", "appId"]);
    clientSecret = pickSecretRef(credentialConfig, ["client_secret", "clientSecret", "app_secret", "appSecret"]);
    const clientIdEnv = pickSecretRef(credentialConfig, ["client_id_env", "clientIdEnv", "app_id_env", "appIdEnv"]);
    const clientSecretEnv = pickSecretRef(credentialConfig, ["client_secret_env", "clientSecretEnv", "app_secret_env", "appSecretEnv"]);
    if (!clientId && clientIdEnv) clientId = getEnv(clientIdEnv);
    if (!clientSecret && clientSecretEnv) clientSecret = getEnv(clientSecretEnv);
  }

  if (!clientId) clientId = getEnvAny(fallbackIdNames);
  if (!clientSecret) clientSecret = getEnvAny(fallbackSecretNames);

  const missingSetupKeys = [
    !clientId ? `${p.toUpperCase()}_CLIENT_ID` : "",
    !clientSecret ? `${p.toUpperCase()}_CLIENT_SECRET` : "",
  ].filter(Boolean);

  return {
    provider: p,
    appSource,
    clientId,
    clientSecret,
    hasWorkspaceCredentials: !!row,
    missingSetupKeys,
    credentialMode: appSource === "client_owned" ? "client_owned_app" : appSource === "managed_setup" ? "managed_setup" : "stellar_hosted_app",
  };
}

export async function getAuthUser(req: Request) {
  const url = getEnv("SUPABASE_URL", true);
  const anonKey = getEnv("SUPABASE_ANON_KEY", true);
  const authHeader = req.headers.get("Authorization") || "";
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}

export async function requireWorkspaceMember(supabase: ReturnType<typeof createClient>, workspaceId: string, userId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Workspace access denied");
  return data;
}

export function isWorkspaceAdmin(role: string | null | undefined) {
  return ["owner", "admin"].includes(String(role || "").toLowerCase());
}

export async function requireWorkspaceAdmin(supabase: ReturnType<typeof createClient>, workspaceId: string, userId: string) {
  const member = await requireWorkspaceMember(supabase, workspaceId, userId);
  if (!isWorkspaceAdmin(member.role)) throw new Error("Workspace admin access required");
  return member;
}

export async function getWorkspaceSlug(supabase: ReturnType<typeof createClient>, workspaceId: string) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return String(data?.slug || "").trim();
}

export function normalizeProvider(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function scrubSocialAccount(account: Record<string, unknown>) {
  const metadata = { ...((account.metadata as Record<string, unknown>) || {}) };
  delete metadata.token_data;
  delete metadata.access_token;
  delete metadata.refresh_token;
  delete metadata.app_password;
  delete metadata.aggregator_profile_key;
  const scrubbed = { ...account, metadata };
  delete scrubbed.aggregator_profile_key;
  return scrubbed;
}

export function readinessForAccount(account: Record<string, unknown> | null | undefined) {
  if (!account) return "missing_account";
  const provider = normalizeProvider(account.provider);
  if (account.access_status !== "connected") return "missing_account";
  if (provider === "linkedin") {
    const scopes = Array.isArray(account.scopes) ? account.scopes.map(String) : [];
    if (!scopes.includes("w_member_social")) return "missing_permission";
    return "publishing_not_implemented";
  }
  if (provider === "instagram" || provider === "threads" || provider === "bluesky") return "publishing_not_implemented";
  return "publishing_not_implemented";
}

export async function upsertWorkspaceConnection(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: string,
  status: string,
  config: Record<string, unknown>,
  lastError = "",
) {
  const payload = {
    workspace_id: workspaceId,
    provider,
    status,
    config,
    last_error: lastError || null,
    last_connected_at: status === "connected" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: findError } = await supabase
    .from("workspace_connections")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (findError) throw findError;
  const result = existing?.id
    ? await supabase.from("workspace_connections").update(payload).eq("id", existing.id)
    : await supabase.from("workspace_connections").insert(payload);
  if (result.error) throw result.error;
}

export async function upsertSocialAccount(
  supabase: ReturnType<typeof createClient>,
  account: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .upsert(account, { onConflict: "workspace_id,provider,provider_user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function safeRedirect(url: string, fallback: string) {
  const value = String(url || "").trim();
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.origin === "http://localhost") return parsed.toString();
  } catch (_) {}
  return fallback;
}

export function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

function getFileExtension(value: string) {
  const clean = String(value || "").split(/[?#]/)[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function classifySingleMediaAsset(asset: SocialMediaInput | string) {
  const source = typeof asset === "string" ? { url: asset } : (asset || {});
  const mime = String(source.mime_type || source.mimeType || "").toLowerCase();
  const mediaType = String(source.media_type || source.mediaType || "").toLowerCase();
  const locator = String(source.media_url || source.mediaUrl || source.url || source.filename || source.storage_path || source.storagePath || source.title || "").toLowerCase();
  const ext = getFileExtension(locator);
  if (mime.startsWith("image/") || mediaType === "image" || IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (mime.startsWith("video/") || mediaType === "video" || VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (mime.includes("pdf") || mime.includes("document") || mediaType === "document" || DOCUMENT_EXTENSIONS.includes(ext)) return "document";
  if (mediaType === "file") return "document";
  return locator ? "image" : "unknown";
}

export function classifyPostMedia(post: Record<string, unknown> = {}, context: Record<string, unknown> = {}) {
  const caption = String(post.caption || post.description || post.text || "").trim();
  const contextMedia = Array.isArray(context.media) ? context.media : Array.isArray(context.mediaAssets) ? context.mediaAssets : [];
  const postMedia = Array.isArray(post.media) ? post.media : Array.isArray(post.media_assets) ? post.media_assets : [];
  const media = [...contextMedia, ...postMedia] as Array<SocialMediaInput | string>;
  const mediaUrls = [
    ...(Array.isArray(post.media_urls) ? post.media_urls : []),
    ...(Array.isArray(post.mediaUrls) ? post.mediaUrls : []),
    ...media.map((asset) => typeof asset === "string" ? asset : String(asset.media_url || asset.mediaUrl || asset.url || "")).filter(Boolean),
  ].map(String).filter(Boolean);
  if (!media.length) mediaUrls.forEach((url) => media.push(url));

  const kinds = media.map(classifySingleMediaAsset).filter((kind) => kind !== "unknown");
  const imageCount = kinds.filter((kind) => kind === "image").length;
  const videoCount = kinds.filter((kind) => kind === "video").length;
  const documentCount = kinds.filter((kind) => kind === "document").length;
  const mediaCount = kinds.length;
  let classification: SocialMediaClassification = "empty";
  if (mediaCount === 0) classification = caption ? "text" : "empty";
  else if (documentCount > 0 && (imageCount > 0 || videoCount > 0)) classification = "mixed";
  else if (imageCount > 0 && videoCount > 0) classification = mediaCount > 1 ? "carousel" : "mixed";
  else if (documentCount > 0) classification = mediaCount > 1 ? "mixed" : "document";
  else if (videoCount > 0) classification = mediaCount > 1 ? "carousel" : "video";
  else if (imageCount > 1) classification = "carousel";
  else if (imageCount === 1) classification = "image";

  return {
    classification,
    mediaCount,
    imageCount,
    videoCount,
    documentCount,
    hasText: !!caption,
    captionLength: caption.length,
    media,
    mediaUrls,
  };
}

function validationResult(
  valid: boolean,
  severity: SocialValidationSeverity,
  code: string,
  message: string,
  fix_hint: string,
  details: Record<string, unknown>,
): SocialValidationResult {
  return { valid, severity, code, message, fix_hint, details };
}

function firstError(code: string, message: string, fixHint: string, details: Record<string, unknown>) {
  return validationResult(false, "error", code, message, fixHint, details);
}

function warning(code: string, message: string, fixHint: string, details: Record<string, unknown>) {
  return validationResult(true, "warning", code, message, fixHint, details);
}

export function validatePostForPlatform(
  post: Record<string, unknown> = {},
  platform: string,
  context: Record<string, unknown> = {},
): SocialValidationResult {
  const p = normalizeProvider(platform);
  const media = classifyPostMedia(post, context);
  const details = {
    platform: p,
    classification: media.classification,
    media_count: media.mediaCount,
    image_count: media.imageCount,
    video_count: media.videoCount,
    document_count: media.documentCount,
    caption_length: media.captionLength,
  };
  const hasMedia = media.mediaCount > 0;
  const hasPublicVideoUrl = media.mediaUrls.some((url) => /^https:\/\//i.test(url) && /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url));
  const adapterSupportsThreadsVideo = context.threadsVideoSupported === true || context.adapterSupportsVideo === true;
  const adapterSupportsBlueskyVideo = context.blueskyVideoSupported === true;

  if (!p || !socialProviders.includes(p as SocialProvider)) {
    return firstError("unsupported_platform", "Unsupported social platform.", "Choose a supported platform.", details);
  }
  if (media.documentCount > 0 && p !== "linkedin") {
    return firstError("document_not_supported", `${p} does not support PDF/document posts.`, "Remove the document or schedule it for LinkedIn only.", details);
  }

  if (p === "linkedin") {
    if (media.captionLength > LONG_CAPTION_WARNING) return warning("caption_long", "LinkedIn caption is long and may be truncated.", "Shorten the caption before publishing.", details);
    return validationResult(true, "ok", "ready", "LinkedIn post is ready.", "", details);
  }

  if (p === "facebook") {
    if (!hasMedia && !media.hasText) return warning("empty_post", "Facebook post has no text or media.", "Add text, an image, or a video.", details);
    return validationResult(true, "ok", "ready", "Facebook Page post is ready.", "", details);
  }

  if (p === "instagram") {
    if (!hasMedia || media.classification === "text" || media.classification === "empty") {
      return firstError("media_required", "Instagram Business requires image, video, or carousel media.", "Attach an image, video/Reel, or 2-10 carousel assets.", details);
    }
    if (media.classification === "carousel" && (media.mediaCount < 2 || media.mediaCount > 10)) {
      return firstError("carousel_count_invalid", "Instagram carousel requires 2-10 image/video assets.", "Adjust the carousel to 2-10 assets.", details);
    }
    if (media.classification === "mixed") return firstError("mixed_media_not_supported", "Instagram cannot publish this mixed media set.", "Use only image/video carousel assets.", details);
    return validationResult(true, "ok", "ready", "Instagram Business post is ready.", "", details);
  }

  if (p === "threads") {
    if (media.documentCount > 0) return firstError("document_not_supported", "Threads does not support PDF/document posts.", "Remove the document.", details);
    if (media.videoCount > 0 && !adapterSupportsThreadsVideo) {
      return warning("video_needs_testing", "Threads video publishing needs adapter verification.", "Use text/image or verify Threads video support before publishing.", details);
    }
    if (media.captionLength > THREADS_LONG_TEXT_WARNING) return warning("text_long", "Threads text is long and may be truncated.", "Shorten the text for Threads.", details);
    return validationResult(true, "ok", "ready", "Threads post is ready.", "", details);
  }

  if (p === "bluesky") {
    if (media.captionLength > 300) {
      return firstError("text_over_limit", `Bluesky text is ${media.captionLength - 300} characters over the 300 character limit.`, "Shorten the post to 300 characters or less.", details);
    }
    if (media.imageCount > 4) return firstError("image_count_over_limit", "Bluesky supports up to 4 images.", "Remove images until 4 or fewer remain.", details);
    if (media.videoCount > 0 && !adapterSupportsBlueskyVideo) return firstError("video_not_supported", "Bluesky video publishing is not verified in this adapter.", "Use text/images only for Bluesky.", details);
    if (!media.hasText && !media.imageCount) return firstError("text_required", "Bluesky requires text content.", "Add text to the Bluesky post.", details);
    return validationResult(true, "ok", "ready", "Bluesky post is ready.", "", details);
  }

  if (p === "tiktok") {
    if (media.videoCount === 0) return firstError("video_required", "TikTok requires a video.", "Attach a compatible public video URL.", details);
    if (!hasPublicVideoUrl) {
      return firstError("public_video_url_required", "TikTok PULL_FROM_URL requires an externally accessible compatible video URL.", "Use an HTTPS MP4/MOV/M4V/WebM URL that TikTok can fetch.", details);
    }
    if (media.documentCount > 0 || media.imageCount > 0) return firstError("unsupported_media_mix", "TikTok queue item must be video-only.", "Remove non-video assets.", details);
    return validationResult(true, "ok", "ready", "TikTok video post is ready.", "", details);
  }

  return firstError("unsupported_platform", "Unsupported social platform.", "Choose a supported platform.", details);
}

export const SOCIAL_COMPATIBILITY_MATRIX: Record<string, Record<SocialProvider, string>> = {
  Text: { linkedin: "Supported", facebook: "Supported", instagram: "Not Supported", threads: "Supported", bluesky: "Supported", tiktok: "Not Supported" },
  Image: { linkedin: "Supported", facebook: "Supported", instagram: "Supported", threads: "Supported", bluesky: "Supported", tiktok: "Not Supported" },
  Carousel: { linkedin: "Limited / Needs Testing", facebook: "Limited / Needs Testing", instagram: "Supported", threads: "Limited / Needs Testing", bluesky: "Limited / Needs Testing", tiktok: "Not Supported" },
  Video: { linkedin: "Supported", facebook: "Supported", instagram: "Supported", threads: "Limited / Needs Testing", bluesky: "Limited / Needs Testing", tiktok: "Supported" },
  "PDF/Document": { linkedin: "Supported", facebook: "Not Supported", instagram: "Not Supported", threads: "Not Supported", bluesky: "Not Supported", tiktok: "Not Supported" },
  "Mixed Media": { linkedin: "Limited / Needs Testing", facebook: "Limited / Needs Testing", instagram: "Not Supported", threads: "Limited / Needs Testing", bluesky: "Not Supported", tiktok: "Not Supported" },
};
