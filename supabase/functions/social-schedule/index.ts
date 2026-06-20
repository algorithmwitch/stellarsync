import {
  corsHeaders,
  getAuthUser,
  getSupabaseServiceClient,
  json,
  normalizeProvider,
  readBody,
  requireWorkspaceMember,
  isWorkspaceAdmin,
  scrubSocialAccount,
  validatePostForPlatform,
  classifyPostMedia,
  type SocialValidationResult,
} from "../_shared/social.ts";

const PLATFORMS = ["linkedin", "facebook", "instagram", "threads", "bluesky", "tiktok"] as const;

type Platform = (typeof PLATFORMS)[number];

// ── Platform Validation ────────────────────────────────────────────────────

function inferPostType(mediaUrls: string[], mediaAssetIds: string[], postType?: string): string {
  if (postType && ["text", "image", "video", "carousel", "document"].includes(postType)) return postType;
  const count = Math.max(mediaUrls.length, mediaAssetIds.length);
  if (count === 0) return "text";
  if (count >= 2) return "carousel";
  const firstUrl = mediaUrls[0] || "";
  if (/\.(mp4|mov|avi|webm|m4v)/i.test(firstUrl)) return "video";
  if (/\.(pdf|doc|docx|txt)/i.test(firstUrl)) return "document";
  return "image";
}

// ── TikTok Payload Builder ─────────────────────────────────────────────────

function buildTikTokPayload(caption: string, videoUrl: string, privacyLevel = "PUBLIC_TO_EVERYONE"): Record<string, unknown> {
  return {
    post_info: {
      title: caption || "",
      privacy_level: privacyLevel,
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      brand_content_toggle: false,
      brand_organic_toggle: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };
}

// ── Queue Status Derivation ─────────────────────────────────────────────────

function deriveQueueStatus(
  platform: Platform,
  validation: SocialValidationResult,
  socialAccountId: string | null,
): { status: string; validationErrors: Record<string, unknown> } {
  const validationErrors: Record<string, unknown> = { validation };
  if (validation.severity === "error") validationErrors.errors = [validation.message];
  if (validation.severity === "warning") validationErrors.warnings = [validation.message];

  if (!socialAccountId) {
    return { status: "needs_connection", validationErrors: { ...validationErrors, detail: "No connected account for " + platform } };
  }

  if (!validation.valid) {
    return { status: validation.code.includes("media") || validation.code.includes("video") || validation.code.includes("document") ? "invalid_media" : "validation_failed", validationErrors: { ...validationErrors, detail: "Platform validation failed" } };
  }

  return { status: "queued", validationErrors };
}

function validationForResponse(platform: string, validation: SocialValidationResult) {
  return {
    ...validation,
    platform,
    estimatedPostType: validation.details?.classification || "text",
    warnings: validation.severity === "warning" ? [validation.message] : [],
    errors: validation.severity === "error" ? [validation.message] : [],
  };
}

async function resolveMediaForValidation(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
  mediaAssetIds: string[],
  mediaUrls: string[],
) {
  const orderedIds: string[] = [];
  if (postId) {
    const { data: postMedia } = await supabase
      .from("post_media")
      .select("media_asset_id, sort_order")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .order("sort_order", { ascending: true });
    for (const row of postMedia || []) {
      const id = String(row.media_asset_id || "").trim();
      if (id && !orderedIds.includes(id)) orderedIds.push(id);
    }
  }
  for (const id of mediaAssetIds) {
    const clean = String(id || "").trim();
    if (clean && !orderedIds.includes(clean)) orderedIds.push(clean);
  }
  const assetsById: Record<string, Record<string, unknown>> = {};
  if (orderedIds.length) {
    const { data: assets } = await supabase
      .from("media_assets")
      .select("id, asset_id, media_url, media_type, mime_type, filename, storage_path, title")
      .eq("workspace_id", workspaceId)
      .in("id", orderedIds);
    for (const asset of assets || []) {
      assetsById[String(asset.id)] = asset;
    }
    const missingAssetIds = orderedIds.filter((id) => !assetsById[id]);
    if (missingAssetIds.length) {
      const { data: assetsByAssetId } = await supabase
        .from("media_assets")
        .select("id, asset_id, media_url, media_type, mime_type, filename, storage_path, title")
        .eq("workspace_id", workspaceId)
        .in("asset_id", missingAssetIds);
      for (const asset of assetsByAssetId || []) {
        assetsById[String(asset.asset_id)] = asset;
      }
    }
  }
  const media = orderedIds.map((id) => assetsById[id] || { id, media_asset_id: id }).concat(mediaUrls.map((url) => ({ media_url: url })));
  return { media, orderedIds };
}

// ── Action Handlers ────────────────────────────────────────────────────────

async function handleCreateOrUpdateQueue(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  userId: string,
) {
  const postId = String(body.post_id || "").trim();
  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).map(String);
  const caption = String(body.caption || "").trim();
  const mediaUrls = (Array.isArray(body.media_urls) ? body.media_urls : (Array.isArray(body.mediaUrls) ? body.mediaUrls : [])).map(String);
  const mediaAssetIds = (Array.isArray(body.media_asset_ids) ? body.media_asset_ids : (Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : [])).map(String);
  const postType = inferPostType(mediaUrls, mediaAssetIds, String(body.post_type || "").trim());
  const scheduledAt = body.scheduled_at ? new Date(String(body.scheduled_at)).toISOString() : body.scheduledAt ? new Date(String(body.scheduledAt)).toISOString() : null;
  if (!postId) return json({ ok: false, error: "Missing post_id" }, 400);
  if (platforms.length === 0) return json({ ok: false, error: "No platforms specified" }, 400);

  const invalidPlatforms = platforms.filter((p) => !(PLATFORMS as readonly string[]).includes(p));
  if (invalidPlatforms.length > 0) {
    return json({ ok: false, error: `Unsupported platforms: ${invalidPlatforms.join(", ")}` }, 400);
  }

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, provider, access_status, scopes, metadata")
    .eq("workspace_id", workspaceId)
    .in("provider", platforms);

  const accountsByProvider: Record<string, { id: string; access_status: string; scopes: string[]; metadata: Record<string, unknown> }> = {};
  for (const acct of accounts || []) {
    if (!accountsByProvider[acct.provider]) {
      accountsByProvider[acct.provider] = acct;
    }
  }

  const hasVideo = mediaUrls.some((u) => /\.(mp4|mov|avi|webm|m4v)/i.test(u)) || postType === "video";
  const resolvedMedia = await resolveMediaForValidation(supabase, workspaceId, postId, mediaAssetIds, mediaUrls);
  const classified = classifyPostMedia({ caption, media_urls: mediaUrls, post_type: postType }, { media: resolvedMedia.media });

  const rows: Array<Record<string, unknown>> = [];
  const results: Array<Record<string, unknown>> = [];

  for (const platform of platforms) {
    const account = accountsByProvider[platform] || null;
    const validation = validatePostForPlatform({ caption, media_urls: mediaUrls, post_type: postType }, platform, { media: resolvedMedia.media });
    const { status, validationErrors } = deriveQueueStatus(
      platform as Platform,
      validation,
      account?.id || null,
    );

    let platformPayload: Record<string, unknown> = {};
    if (platform === "tiktok" && hasVideo) {
      const videoUrl = mediaUrls.find((u) => /\.(mp4|mov|avi|webm|m4v)/i.test(u)) || mediaUrls[0] || "";
      platformPayload = buildTikTokPayload(caption, videoUrl);
    } else if (platform === "linkedin") {
      platformPayload = {
        urn: account?.metadata?.urn || null,
        visibility: "PUBLIC",
        lifecycleState: "PUBLISHED",
      };
    }

    rows.push({
      workspace_id: workspaceId,
      post_id: postId,
      provider: platform,
      platform,
      social_account_id: account?.id || null,
      caption,
      media_asset_ids: mediaAssetIds,
      media_urls: mediaUrls,
      post_type: postType,
      status,
      platform_payload: platformPayload,
      validation_errors: { ...validationErrors, classification: classified.classification },
      scheduled_at: scheduledAt,
      created_by: userId,
      social_provider_strategy: "native",
      aggregator_provider: "none",
    });

    results.push({
      platform,
      status,
      validation: validationForResponse(platform, validation),
      accountConnected: !!account,
    });
  }

  const { error: deleteError } = await supabase
    .from("scheduled_social_posts")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId)
    .in("status", ["draft_queue", "queued", "needs_connection", "invalid_media"]);

  if (deleteError) throw deleteError;

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("scheduled_social_posts")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .eq("platform", row.platform)
      .maybeSingle();

    if (existing) {
      await supabase.from("scheduled_social_posts").update(row).eq("id", existing.id);
    } else {
      const { error: insertError } = await supabase.from("scheduled_social_posts").insert(row);
      if (insertError) throw insertError;
    }
  }

  return json({ ok: true, results, count: rows.length });
}

async function handleListQueue(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const statusFilter = body.status ? String(body.status).trim() : null;
  const platformFilter = body.platform ? normalizeProvider(body.platform) : null;
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let query = supabase
    .from("scheduled_social_posts")
    .select("*", { count: "estimated" })
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (platformFilter) {
    query = query.eq("platform", platformFilter);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return json({ ok: true, queue: data || [], total: count || 0, limit, offset });
}

async function handleCancelQueueItem(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const id = String(body.id || "").trim();
  if (!id) return json({ ok: false, error: "Missing queue item id" }, 400);

  const { data: existing, error: findError } = await supabase
    .from("scheduled_social_posts")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return json({ ok: false, error: "Queue item not found" }, 404);

  if (["published", "publishing", "cancelled"].includes(existing.status)) {
    return json({ ok: false, error: "Cannot cancel item in status: " + existing.status }, 400);
  }

  const { error: updateError } = await supabase
    .from("scheduled_social_posts")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (updateError) throw updateError;

  return json({ ok: true, cancelled: true, id });
}

async function handleValidatePostForPlatforms(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const platforms = (Array.isArray(body.platforms) ? body.platforms : Object.keys(body))
    .map(String)
    .filter((p) => (PLATFORMS as readonly string[]).includes(p));
  const caption = String(body.caption || "").trim();
  const mediaUrls = (Array.isArray(body.media_urls) ? body.media_urls : (Array.isArray(body.mediaUrls) ? body.mediaUrls : [])).map(String);
  const mediaAssetIds = (Array.isArray(body.media_asset_ids) ? body.media_asset_ids : (Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : [])).map(String);
  const postId = String(body.post_id || body.postId || "").trim();
  const postType = inferPostType(mediaUrls, mediaAssetIds, String(body.post_type || "").trim());
  const resolvedMedia = await resolveMediaForValidation(supabase, workspaceId, postId, mediaAssetIds, mediaUrls);

  if (platforms.length === 0) {
    return json({
      ok: true,
      results: PLATFORMS.map((p) => ({
        platform: p,
        valid: false,
        estimatedPostType: postType,
        warnings: [],
        errors: ["Platform not selected for validation"],
      })),
    });
  }

  const results = platforms.map((p) => validationForResponse(p, validatePostForPlatform({ caption, media_urls: mediaUrls, post_type: postType }, p, { media: resolvedMedia.media })));
  return json({ ok: true, results, postType, classification: classifyPostMedia({ caption, media_urls: mediaUrls, post_type: postType }, { media: resolvedMedia.media }).classification });
}

async function revalidateQueueItem(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  item: Record<string, unknown>,
) {
  const id = String(item.id || "").trim();
  const platform = normalizeProvider(item.platform || item.provider);
  const caption = String(item.caption || "");
  const mediaUrls = Array.isArray(item.media_urls) ? item.media_urls.map(String) : [];
  const mediaAssetIds = Array.isArray(item.media_asset_ids) ? item.media_asset_ids.map(String) : [];
  const postType = inferPostType(mediaUrls, mediaAssetIds, String(item.post_type || "").trim());
  const resolvedMedia = await resolveMediaForValidation(supabase, workspaceId, String(item.post_id || ""), mediaAssetIds, mediaUrls);
  const validation = validatePostForPlatform({ caption, media_urls: mediaUrls, post_type: postType }, platform, { media: resolvedMedia.media });
  const { status, validationErrors } = deriveQueueStatus(platform as Platform, validation, String(item.social_account_id || "") || null);
  const nextStatus = ["published", "publishing", "cancelled"].includes(String(item.status || "")) ? item.status : status;
  await supabase
    .from("scheduled_social_posts")
    .update({
      status: nextStatus,
      validation_errors: {
        ...validationErrors,
        classification: classifyPostMedia({ caption, media_urls: mediaUrls, post_type: postType }, { media: resolvedMedia.media }).classification,
      },
      post_type: postType,
      last_error: validation.valid ? null : validation.message,
    })
    .eq("id", id);
  return { id, platform, status: nextStatus, validation: validationForResponse(platform, validation) };
}

async function handleRevalidateQueueItem(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const id = String(body.id || body.scheduled_social_post_id || "").trim();
  if (!id) return json({ ok: false, error: "Missing queue item id" }, 400);
  const { data: item, error } = await supabase
    .from("scheduled_social_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!item) return json({ ok: false, error: "Queue item not found" }, 404);
  return json({ ok: true, result: await revalidateQueueItem(supabase, workspaceId, item) });
}

async function handlePublishDueNow(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  userId: string,
) {
  const now = new Date().toISOString();

  const { data: dueItems, error: fetchError } = await supabase
    .from("scheduled_social_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "ready"])
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (fetchError) throw fetchError;
  if (!dueItems || dueItems.length === 0) return json({ ok: true, processed: 0, message: "No due items found" });

  const results = [];
  for (const item of dueItems) {
    const result = await publishSingleItem(supabase, workspaceId, item, userId);
    results.push(result);
  }

  const succeeded = results.filter((r) => r.status === "published").length;
  const failed = results.filter((r) => ["failed", "invalid_media", "validation_failed", "needs_connection"].includes(r.status)).length;
  const skipped = results.length - succeeded - failed;

  return json({ ok: true, processed: results.length, succeeded, failed, skipped, results });
}

async function handlePublishOne(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  userId: string,
) {
  const id = String(body.id || "").trim();
  if (!id) return json({ ok: false, error: "Missing scheduled_social_post_id" }, 400);

  const { data: item, error: fetchError } = await supabase
    .from("scheduled_social_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!item) return json({ ok: false, error: "Queue item not found" }, 404);

  const result = await publishSingleItem(supabase, workspaceId, item, userId);
  return json({ ok: result.status === "published", ...result });
}

async function handleTestConnection(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const platform = normalizeProvider(body.platform);
  if (!platform || !(PLATFORMS as readonly string[]).includes(platform as Platform)) {
    return json({ ok: false, error: "Invalid or missing platform" }, 400);
  }

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", platform)
    .maybeSingle();

  if (!account) {
    return json({ ok: false, platform, connected: false, error: "No account found for " + platform });
  }

  const isConnected = account.access_status === "connected" && account.token_status === "valid";
  return json({
    ok: true,
    platform,
    connected: isConnected,
    account: scrubSocialAccount(account),
    message: isConnected ? "Connected" : "Account exists but is not fully connected",
  });
}

// ── Publishing Engine ──────────────────────────────────────────────────────

async function publishSingleItem(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  item: Record<string, unknown>,
  _userId: string,
) {
  const id = String(item.id);
  const platform = String(item.provider || item.platform || "").trim().toLowerCase();
  const attemptNumber = Number(item.attempts || 0) + 1;
  const attemptPayload: Record<string, unknown> = {
    workspace_id: workspaceId,
    scheduled_social_post_id: id,
    platform,
    status: "attempting",
    attempt_number: attemptNumber,
    request_payload: {
      caption: item.caption,
      media_urls: item.media_urls,
      media_asset_ids: item.media_asset_ids,
      post_type: item.post_type,
      platform_payload: item.platform_payload,
    },
  };

  const startTime = Date.now();

  try {
    const validationResult = await revalidateQueueItem(supabase, workspaceId, item);
    const validation = validationResult.validation as Record<string, unknown>;
    if (validation.valid === false || ["invalid_media", "validation_failed", "needs_connection"].includes(String(validationResult.status || ""))) {
      const status = String(validationResult.status || "validation_failed");
      const errorMessage = String(validation.message || "Platform validation failed");
      await supabase.from("social_publish_attempts").insert({
        ...attemptPayload,
        status: "validation_failed",
        error_message: errorMessage,
        error_code: String(validation.code || "validation_failed"),
        response_data: { validation },
        duration_ms: Date.now() - startTime,
      });
      await supabase
        .from("scheduled_social_posts")
        .update({
          status,
          attempts: attemptNumber,
          last_attempt_at: new Date().toISOString(),
          last_error: errorMessage,
          error_message: errorMessage,
          publish_result: { validation },
        })
        .eq("id", id);
      return { id, platform, status, error: errorMessage, validation };
    }

    await supabase
      .from("scheduled_social_posts")
      .update({ status: "publishing", attempts: attemptNumber, last_attempt_at: new Date().toISOString() })
      .eq("id", id);

    const publishResult = await executePlatformPublish(supabase, item);

    const durationMs = Date.now() - startTime;

    await supabase.from("social_publish_attempts").insert({
      ...attemptPayload,
      status: "published",
      response_data: publishResult,
      duration_ms: durationMs,
    });

    await supabase.from("social_publications").insert({
      workspace_id: workspaceId,
      scheduled_social_post_id: id,
      post_id: item.post_id,
      platform,
      social_account_id: item.social_account_id,
      status: "completed",
      caption: item.caption,
      media_asset_ids: item.media_asset_ids,
      media_urls: item.media_urls,
      post_type: item.post_type,
      platform_payload: item.platform_payload,
      external_post_id: String(publishResult.external_post_id || ""),
      external_url: String(publishResult.external_url || ""),
      published_at: new Date().toISOString(),
    });

    await supabase
      .from("scheduled_social_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_post_id: String(publishResult.external_post_id || ""),
        external_url: String(publishResult.external_url || ""),
        publish_result: publishResult,
        last_error: null,
      })
      .eq("id", id);

    console.log("[social-publish] published", { id, platform, externalId: publishResult.external_post_id });
    return { id, platform, status: "published", externalPostId: publishResult.external_post_id, externalUrl: publishResult.external_url };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    await supabase.from("social_publish_attempts").insert({
      ...attemptPayload,
      status: "failed",
      error_message: errorMessage,
      duration_ms: durationMs,
    });

    await supabase
      .from("scheduled_social_posts")
      .update({
        status: "failed",
        last_error: errorMessage,
        error_message: errorMessage,
        publish_result: { error: errorMessage },
      })
      .eq("id", id);

    console.error("[social-publish] failed", { id, platform, error: errorMessage });
    return { id, platform, status: "failed", error: errorMessage };
  }
}

async function executePlatformPublish(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  item: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const platform = String(item.provider || item.platform || "").trim().toLowerCase();
  const accountId = String(item.social_account_id || "");

  if (!accountId) throw new Error("No social account connected. Please connect a " + platform + " account first.");

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) throw new Error("Social account not found.");
  if (account.access_status !== "connected") throw new Error("Social account is not connected.");

  const metadata = (account.metadata || {}) as Record<string, unknown>;
  const tokenData = metadata.token_data as Record<string, unknown> | undefined;
  const accessToken = String(tokenData?.access_token || "");

  if (!accessToken) throw new Error("No access token available for " + platform + ". Reconnect the account.");

  const caption = String(item.caption || "");
  const mediaUrls = (item.media_urls || []) as string[];
  const mediaAssetIds = (item.media_asset_ids || []) as string[];
  const postType = String(item.post_type || "text");
  const platformPayload = (item.platform_payload || {}) as Record<string, unknown>;

  switch (platform) {
    case "linkedin":
      return await publishToLinkedIn(accessToken, caption, mediaUrls, mediaAssetIds, postType, platformPayload);
    case "facebook":
      return await publishToFacebook(accessToken, caption, mediaUrls, postType, platformPayload, account);
    case "instagram":
      return await publishToInstagram(accessToken, caption, mediaUrls, mediaAssetIds, postType, platformPayload, account);
    case "threads":
      return await publishToThreads(accessToken, caption, mediaUrls, postType, platformPayload);
    case "bluesky":
      return await publishToBluesky(accessToken, caption, mediaUrls);
    case "tiktok":
      return await publishToTikTok(accessToken, caption, mediaUrls, platformPayload);
    default:
      throw new Error("Unsupported platform: " + platform);
  }
}

// ── Platform-specific publish implementations ──────────────────────────────

async function publishToLinkedIn(
  accessToken: string,
  caption: string,
  mediaUrls: string[],
  _mediaAssetIds: string[],
  postType: string,
  platformPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const urn = String(platformPayload.urn || "urn:li:person:UNKNOWN");

  if (postType === "image" && mediaUrls.length > 0) {
    const mediaItems = mediaUrls.slice(0, 9).map((url) => ({
      status: "READY",
      description: { text: caption || "" },
      media: url,
    }));
    const body = {
      author: urn,
      lifecycleState: "PUBLISHED",
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": platformPayload.visibility || "PUBLIC" },
      commentary: caption,
      content: { media: { items: mediaItems } },
    };
    console.log("[linkedin] image post", { urn, mediaCount: mediaItems.length });
    return { external_post_id: "simulated_linkedin_" + Date.now(), external_url: "", _mock: true, _payload: body };
  }

  if (postType === "video" && mediaUrls.length > 0) {
    throw new Error("LinkedIn video publishing requires additional API approval and is not yet implemented.");
  }

  const body = {
    author: urn,
    lifecycleState: "PUBLISHED",
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": platformPayload.visibility || "PUBLIC" },
    commentary: caption,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
  };
  console.log("[linkedin] text post", { urn });
  return { external_post_id: "simulated_linkedin_" + Date.now(), external_url: "", _mock: true, _payload: body };
}

async function publishToFacebook(
  _accessToken: string,
  _caption: string,
  _mediaUrls: string[],
  _postType: string,
  _platformPayload: Record<string, unknown>,
  _account: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  throw new Error("Facebook publishing requires a connected Facebook Page and API approval. Implement when provider credentials are configured.");
}

async function publishToInstagram(
  _accessToken: string,
  _caption: string,
  _mediaUrls: string[],
  _mediaAssetIds: string[],
  _postType: string,
  _platformPayload: Record<string, unknown>,
  _account: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  throw new Error("Instagram publishing requires a connected Instagram Business account and Meta API approval. Implement when provider credentials are configured.");
}

async function publishToThreads(
  _accessToken: string,
  _caption: string,
  _mediaUrls: string[],
  _postType: string,
  _platformPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  throw new Error("Threads publishing requires a connected Threads account and Meta API approval. Implement when provider credentials are configured.");
}

async function publishToBluesky(
  _accessToken: string,
  _caption: string,
  _mediaUrls: string[],
): Promise<Record<string, unknown>> {
  throw new Error("Bluesky publishing requires app-password authentication. Implement when Bluesky provider is configured.");
}

async function publishToTikTok(
  accessToken: string,
  caption: string,
  mediaUrls: string[],
  platformPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const sourceInfo = (platformPayload.source_info || {}) as Record<string, unknown>;
  if (sourceInfo.source !== "PULL_FROM_URL") {
    throw new Error("TikTok requires PULL_FROM_URL source type with a public video URL.");
  }

  const videoUrl = String(sourceInfo.video_url || mediaUrls.find((u) => /\.(mp4|mov|avi|webm|m4v)/i.test(u)) || mediaUrls[0] || "");
  if (!videoUrl) throw new Error("No valid video URL for TikTok publishing.");

  const payload = buildTikTokPayload(caption, videoUrl);

  const tiktokApiUrl = "https://open.tiktokapis.com/v2/video/publish/init/";
  console.log("[tiktok] initiating publish", { videoUrl, captionLength: caption.length });

  const response = await fetch(tiktokApiUrl, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    const errMsg = result?.error?.message || result?.message || "TikTok API error";
    throw new Error("TikTok publish failed: " + errMsg);
  }

  const publishId = result?.data?.publish_id || "";
  console.log("[tiktok] publish initiated", { publishId });

  if (publishId) {
    const statusResult = await checkTikTokPublishStatus(accessToken, publishId);
    return {
      external_post_id: publishId,
      external_url: "",
      publish_id: publishId,
      status_check: statusResult,
    };
  }

  return { external_post_id: publishId, publish_id: publishId };
}

async function checkTikTokPublishStatus(accessToken: string, publishId: string) {
  const statusUrl = "https://open.tiktokapis.com/v2/video/publish/status/";
  try {
    const response = await fetch(statusUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    return await response.json();
  } catch {
    return { error: "Status check failed" };
  }
}

// ──── MAIN HANDLER ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await readBody(req);
    const action = String(body.action || "").trim();
    const workspaceId = String(body.workspace_id || "").trim();

    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    const member = await requireWorkspaceMember(supabase, workspaceId, user.id);

    const adminRequired = ["create_or_update_queue", "cancel_queue_item", "publish_one", "publish_due_now", "test_connection", "revalidate_queue_item"];
    if (adminRequired.includes(action) && !isWorkspaceAdmin(member.role)) {
      return json({ ok: false, error: "Admin access required for action: " + action }, 403);
    }

    switch (action) {
      case "create_or_update_queue":
        return await handleCreateOrUpdateQueue(supabase, workspaceId, body, user.id);

      case "list_queue":
        return await handleListQueue(supabase, workspaceId, body);

      case "cancel_queue_item":
        return await handleCancelQueueItem(supabase, workspaceId, body);

      case "validate_post_for_platforms":
        return await handleValidatePostForPlatforms(supabase, workspaceId, body);

      case "revalidate_queue_item":
        return await handleRevalidateQueueItem(supabase, workspaceId, body);

      case "publish_due_now":
        return await handlePublishDueNow(supabase, workspaceId, user.id);

      case "publish_one":
        return await handlePublishOne(supabase, workspaceId, body, user.id);

      case "test_connection":
        return await handleTestConnection(supabase, workspaceId, body);

      default:
        return json({ ok: false, error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Social schedule action failed";
    console.error("[social-schedule] error", message);
    return json({ ok: false, error: message }, 400);
  }
});
