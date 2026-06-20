import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, getSupabaseServiceClient, json, readBody } from "../_shared/social.ts";

function isWorkspaceAdmin(role: string) {
  return ["owner", "admin"].includes(role.toLowerCase());
}

function isContentLead(role: string) {
  return ["owner", "admin", "content_lead"].includes(role.toLowerCase());
}

const VALID_ROLES = ["owner", "admin", "content_lead", "reviewer", "viewer"];

const PLAN_CAPABILITIES: Record<string, Record<string, unknown>> = {
  starter: { workspace_limit: 1, team_members: false, media_storage: "basic", csv_import_export: false, plugin: true, monday: false, google_sheets: false, drive_setup: false, advanced_integrations: false },
  growth: { workspace_limit: 1, team_members: true, media_storage: true, csv_import_export: true, linkedin_import_tools: true, plugin_exports: true, publishing_readiness: true, advanced_reporting: true, diagnostics: true, monday: false, google_sheets: false, drive_setup: false, advanced_integrations: false },
  agency: { workspace_limit: "multiple", team_members: true, media_storage: true, csv_import_export: true, linkedin_import_tools: true, plugin_exports: true, multiple_workspaces: true, client_management: true, templates: true, advanced_permissions: true, priority_support: true, workspace_migration_tools: true, monday: false, google_sheets: false, drive_setup: false, advanced_integrations: false },
  managed: { workspace_limit: "multiple", managed_onboarding: true, google_sheets: true, monday: true, drive_setup: true, apps_script: true, migration_support: true, workflow_design: true, team_training: true, strategic_support: true, ongoing_admin: true, advanced_integrations: true },
  admin_master: { internal_only: true, hidden: true, all_features: true, admin_workspaces: true, advanced_integrations: true },
};

function normalizePlan(plan: unknown) {
  const value = String(plan || "").trim().toLowerCase().replace(/[-\s]/g, "_");
  if (value === "free" || value === "trial" || value === "free_trial" || value === "starter") return "starter";
  if (value === "pro" || value === "growth") return "growth";
  if (value === "agency") return "agency";
  if (value === "managed") return "managed";
  if (value === "admin_master") return "admin_master";
  return "starter";
}

function getDefaultFeatureFlagsForPlan(plan: string) {
  const caps = { ...(PLAN_CAPABILITIES[plan] || PLAN_CAPABILITIES.starter) };
  if (caps.all_features) Object.assign(caps, PLAN_CAPABILITIES.managed);
  return {
    show_advanced_integrations: !!caps.advanced_integrations,
    managed_integrations: plan === "managed" || plan === "admin_master",
    google_sheets_enabled: !!caps.google_sheets,
    monday_enabled: !!caps.monday,
    drive_setup_enabled: !!caps.drive_setup,
    plugin_exports_enabled: true,
    csv_import_export_enabled: !!caps.csv_import_export,
  };
}

const _columnCache = new Map<string, Set<string>>();

async function getTableColumns(supabase: ReturnType<typeof createClient>, tableName: string): Promise<Set<string>> {
  if (!_columnCache.has(tableName)) {
    const { data, error } = await supabase
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);
    if (error) {
      console.warn("[workspace-members] column inspection failed", { table: tableName, error: error.message });
      const fallbackColumns = new Set<string>();
      for (const columnName of ["created_at", "updated_at", "name", "role", "email"]) {
        const probe = await supabase
          .from(tableName)
          .select(columnName)
          .limit(1);
        if (!probe.error) fallbackColumns.add(columnName);
      }
      _columnCache.set(tableName, fallbackColumns);
    } else {
      _columnCache.set(tableName, new Set((data || []).map(r => String(r.column_name))));
    }
  }
  return _columnCache.get(tableName)!;
}

async function hasColumn(supabase: ReturnType<typeof createClient>, tableName: string, columnName: string): Promise<boolean> {
  return (await getTableColumns(supabase, tableName)).has(columnName);
}

function maybeNow(): Record<string, string> {
  return { updated_at: new Date().toISOString() };
}

async function maybeUpdatedAt(supabase: ReturnType<typeof createClient>, table: string): Promise<Record<string, string>> {
  const has = await hasColumn(supabase, table, "updated_at");
  return has ? maybeNow() : {};
}

async function maybeInsertTimestamps(supabase: ReturnType<typeof createClient>, table: string): Promise<Record<string, string>> {
  const now = new Date().toISOString();
  const columns = await getTableColumns(supabase, table);
  return {
    ...(columns.has("created_at") ? { created_at: now } : {}),
    ...(columns.has("updated_at") ? { updated_at: now } : {}),
  };
}

async function filterPayloadForTable(supabase: ReturnType<typeof createClient>, table: string, payload: Record<string, unknown>) {
  const columns = await getTableColumns(supabase, table);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => columns.has(key)));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getSupabaseServiceClient();
    const body = await readBody(req);
    const action = String(body.action || "").trim();
    const workspaceId = String(body.workspace_id || "").trim();

    if (!action) return json({ error: "Missing action" }, 400);

    // Get auth user
    const authHeader = req.headers.get("Authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authClient = createClient(Deno.env.get("SUPABASE_URL") || "", anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // create_workspace does not need an existing workspace_id
    if (action === "create_workspace") {
      return handleCreateWorkspace(supabase, body, user.id, user.email || "");
    }

    if (!workspaceId) return json({ error: "Missing workspace_id" }, 400);

    // Get caller's membership
    const { data: callerMember } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    switch (action) {
      case "list_members":
        return handleListMembers(supabase, workspaceId, callerMember);
      case "list_invites":
        return handleListInvites(supabase, workspaceId, callerMember);
      case "create_invite":
        return handleCreateInvite(supabase, workspaceId, callerMember, body, user.id);
      case "cancel_invite":
        return handleCancelInvite(supabase, workspaceId, callerMember, body);
      case "accept_invite":
        return handleAcceptInvite(supabase, workspaceId, body, user.id, user.email || "");
      case "change_role":
        return handleChangeRole(supabase, workspaceId, callerMember, body);
      case "remove_member":
        return handleRemoveMember(supabase, workspaceId, callerMember, body);
      default:
        return json({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function handleListMembers(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null) {
  if (!callerMember) return json({ error: "Access denied" }, 403);

  const memberColumns = await getTableColumns(supabase, "workspace_members");
  const hasCreatedAt = memberColumns.has("created_at");
  const hasUpdatedAt = memberColumns.has("updated_at");

  let selectFields = "id, workspace_id, user_id, email, role";
  if (memberColumns.has("name")) selectFields += ", name";
  if (hasCreatedAt) selectFields += ", created_at";
  if (hasUpdatedAt) selectFields += ", updated_at";

  let query = supabase
    .from("workspace_members")
    .select(selectFields)
    .eq("workspace_id", workspaceId);

  if (hasCreatedAt) {
    query = query.order("created_at", { ascending: true });
  } else {
    if (memberColumns.has("role")) query = query.order("role", { ascending: true });
    if (memberColumns.has("email")) query = query.order("email", { ascending: true });
    if (memberColumns.has("name")) query = query.order("name", { ascending: true });
  }

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 500);

  // Enrich with user profile if user_id is set
  const enriched = await Promise.all((data || []).map(async (member) => {
    if (member.user_id) {
      const { data: profile } = await supabase
        .from("profile_settings")
        .select("display_name, avatar_mode, icon, avatar_initials")
        .eq("user_id", member.user_id)
        .maybeSingle();
      return { ...member, profile };
    }
    return member;
  }));

  return json({ ok: true, members: enriched });
}

async function handleListInvites(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null) {
  if (!callerMember || !isContentLead(callerMember.role)) return json({ error: "Access denied" }, 403);

  const hasCreatedAt = await hasColumn(supabase, "workspace_invites", "created_at");

  let query = supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (hasCreatedAt) {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("email", { ascending: true });
  }

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, invites: data || [] });
}

async function handleCreateInvite(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null, body: Record<string, unknown>, invitedByUserId: string) {
  if (!callerMember || !isWorkspaceAdmin(callerMember.role)) return json({ error: "Only owners and admins can invite" }, 403);

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);

  const role = String(body.role || "viewer").trim().toLowerCase();
  if (!VALID_ROLES.includes(role)) return json({ error: "Invalid role: " + role }, 400);

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .maybeSingle();

  if (existingMember) return json({ error: "User is already a member of this workspace" }, 409);

  // Check for pending invite
  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) return json({ error: "An invite is already pending for this email" }, 409);

  const token = crypto.randomUUID();

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      status: "pending",
      invited_by: invitedByUserId,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select("*")
    .single();

  if (error) return json({ error: error.message }, 500);

  // Build invite link
  const origin = Deno.env.get("APP_ORIGIN") || "https://stellarsync.app";
  const inviteLink = `${origin}/invite?token=${token}`;

  return json({ ok: true, invite, invite_link: inviteLink });
}

async function handleCancelInvite(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null, body: Record<string, unknown>) {
  if (!callerMember || !isWorkspaceAdmin(callerMember.role)) return json({ error: "Only owners and admins can cancel invites" }, 403);

  const inviteId = String(body.invite_id || "").trim();
  if (!inviteId) return json({ error: "Missing invite_id" }, 400);

  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("id, status")
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!invite) return json({ error: "Invite not found" }, 404);
  if (invite.status !== "pending") return json({ error: "Invite is no longer pending" }, 400);

  const cancelPayload = { status: "cancelled", ...(await maybeUpdatedAt(supabase, "workspace_invites")) };
  const { error } = await supabase
    .from("workspace_invites")
    .update(cancelPayload)
    .eq("id", inviteId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function handleAcceptInvite(supabase: ReturnType<typeof createClient>, workspaceId: string, body: Record<string, unknown>, userId: string, userEmail: string) {
  const token = String(body.token || "").trim();

  let invite;

  if (token) {
    const { data } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();
    invite = data;
  } else {
    const email = String(userEmail || "").trim().toLowerCase();
    if (!email) return json({ error: "Could not determine user email" }, 400);

    const { data } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    invite = data;
  }

  if (!invite) return json({ error: "No pending invite found" }, 404);

  // Check if invite expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await supabase.from("workspace_invites").update({ status: "expired", ...(await maybeUpdatedAt(supabase, "workspace_invites")) }).eq("id", invite.id);
    return json({ error: "Invite has expired" }, 410);
  }

  // Check if user already a member by email or user_id
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .or(`email.eq.${invite.email},user_id.eq.${userId}`)
    .maybeSingle();

  if (existing) {
    // Revoke invite, already a member
    await supabase.from("workspace_invites").update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString(), ...(await maybeUpdatedAt(supabase, "workspace_invites")) }).eq("id", invite.id);
    return json({ ok: true, message: "Already a member" });
  }

  // Add to workspace_members
  const { data: member, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      email: invite.email,
      role: invite.role,
      ...(await maybeInsertTimestamps(supabase, "workspace_members")),
    })
    .select("*")
    .single();

  if (error) return json({ error: error.message }, 500);

  // Mark invite as accepted
  await supabase.from("workspace_invites").update({
    status: "accepted",
    accepted_by: userId,
    accepted_at: new Date().toISOString(),
    ...(await maybeUpdatedAt(supabase, "workspace_invites")),
  }).eq("id", invite.id);

  return json({ ok: true, member });
}

async function handleChangeRole(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null, body: Record<string, unknown>) {
  if (!callerMember || !isWorkspaceAdmin(callerMember.role)) return json({ error: "Only owners and admins can change roles" }, 403);

  const memberId = String(body.member_id || "").trim();
  const newRole = String(body.role || "").trim().toLowerCase();

  if (!memberId) return json({ error: "Missing member_id" }, 400);
  if (!VALID_ROLES.includes(newRole)) return json({ error: "Invalid role: " + newRole }, 400);

  const { data: target } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!target) return json({ error: "Member not found" }, 404);

  // Cannot demote the final owner
  if (target.role === "owner" && newRole !== "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner");

    if (count !== null && count <= 1) {
      return json({ error: "Cannot demote the final owner" }, 400);
    }
  }

  // Only owner can change another owner's role
  if (target.role === "owner" && callerMember.role !== "owner") {
    return json({ error: "Only owners can change another owner's role" }, 403);
  }

  const updatePayload = { role: newRole, ...(await maybeUpdatedAt(supabase, "workspace_members")) };
  const { error } = await supabase
    .from("workspace_members")
    .update(updatePayload)
    .eq("id", memberId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function handleRemoveMember(supabase: ReturnType<typeof createClient>, workspaceId: string, callerMember: { role: string } | null, body: Record<string, unknown>) {
  if (!callerMember || !isWorkspaceAdmin(callerMember.role)) return json({ error: "Only owners and admins can remove members" }, 403);

  const memberId = String(body.member_id || "").trim();
  if (!memberId) return json({ error: "Missing member_id" }, 400);

  const { data: target } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!target) return json({ error: "Member not found" }, 404);

  // Cannot remove the final owner
  if (target.role === "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner");

    if (count !== null && count <= 1) {
      return json({ error: "Cannot remove the final owner" }, 400);
    }
  }

  // Only owner can remove an owner
  if (target.role === "owner" && callerMember.role !== "owner") {
    return json({ error: "Only owners can remove another owner" }, 403);
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId);

  if (error) return json({ error: error.message }, 500);

  // Clean up their post_media associations? Not doing that here for safety.

  return json({ ok: true });
}

async function handleCreateWorkspace(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string, userEmail: string) {
  const name = String(body.name || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  const requestedPlan = normalizePlan(body.plan_slug || body.subscription_tier || body.plan || "starter");
  const managedAccount = requestedPlan === "managed";
  const featureFlags = getDefaultFeatureFlagsForPlan(requestedPlan);
  if (!name) return json({ error: "Workspace name is required" }, 400);
  if (!slug) return json({ error: "Workspace slug is required" }, 400);

  // Check slug uniqueness
  const { data: existingWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingWorkspace) return json({ error: "A workspace with this slug already exists" }, 409);

  // 1. Insert workspace
  const workspacePayload = await filterPayloadForTable(supabase, "workspaces", {
    slug,
    name,
    plan: requestedPlan,
    plan_slug: requestedPlan,
    subscription_tier: requestedPlan,
    subscription_status: "active",
    backend_type: "supabase_native",
    managed_account: managedAccount,
    is_admin_workspace: false,
    feature_flags: featureFlags,
    supabase_media_enabled: true,
    media_bucket: "media",
  });
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert(workspacePayload)
    .select("*")
    .single();
  if (wsError) return json({ error: wsError.message }, 500);

  const workspaceId = workspace.id;

  // 2. Insert workspace_settings
  const settingsPayload = await filterPayloadForTable(supabase, "workspace_settings", {
    workspace_id: workspaceId,
    workspace_slug: slug,
    display_name: name,
    short_name: slug.substring(0, 8).toUpperCase(),
    avatar_mode: "initials",
    constellation_shape: "star",
    media_bucket: "media",
    media_prefix: slug + "/",
    backend_type: "supabase_native",
    plan: requestedPlan,
    plan_slug: requestedPlan,
    subscription_tier: requestedPlan,
    managed_account: managedAccount,
    is_admin_workspace: false,
    feature_flags: featureFlags,
    sheet_sync_enabled: false,
    monday_sync_enabled: false,
  });
  const { error: settingsError } = await supabase
    .from("workspace_settings")
    .insert(settingsPayload);
  if (settingsError) return json({ error: "Failed to create workspace settings: " + settingsError.message }, 500);

  // 3. Insert workspace_members as owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      email: userEmail,
      role: "owner",
      ...(await maybeInsertTimestamps(supabase, "workspace_members")),
    });
  if (memberError) return json({ error: "Failed to create owner membership: " + memberError.message }, 500);

  // 4. Optional: create starter schema_notes row
  await supabase.from("schema_notes").insert({
    workspace_id: workspaceId,
    schema_key: "welcome",
    content: "Welcome to your new workspace! This is where you can keep schema notes and documentation for your team.",
  }).catch(() => {});

  // 5. Optional: create starter brand_framework row
  await supabase.from("brand_framework").insert({
    workspace_id: workspaceId,
    framework_key: "starter_brand",
    content: JSON.stringify({
      mission: "",
      vision: "",
      values: [],
      brand_voice: "",
      tone: "",
      audience: "",
    }),
  }).catch(() => {});

  // 6. Optional: create starter ai_chain_settings row
  await supabase.from("ai_chain_settings").insert({
    workspace_id: workspaceId,
    settings_key: "default",
    settings_json: {},
  }).catch(() => {});

  return json({ ok: true, workspace });
}
