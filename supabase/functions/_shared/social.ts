import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const socialProviders = ["linkedin", "instagram", "threads", "bluesky"] as const;
export const connectionProviders = ["linkedin", "instagram", "threads", "bluesky", "monday"] as const;

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

export function getSupabaseServiceClient() {
  const url = getEnv("SUPABASE_URL", true);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", true);
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
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
    .or(`user_id.eq.${userId},auth_user_id.eq.${userId}`)
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
  return { ...account, metadata };
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
