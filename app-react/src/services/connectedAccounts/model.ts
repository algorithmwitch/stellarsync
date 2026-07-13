import type { ConnectedAccount, ConnectedAccountStatus } from "@/types/connectedAccounts";

function normalizeStatus(input: string, expiresAt?: string | null): ConnectedAccountStatus {
  const status = String(input || "").trim().toLowerCase();
  if (status === "connected" && expiresAt) {
    const expiry = new Date(expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) return "expired";
  }
  if (["connected", "expired", "revoked", "error", "pending", "disconnected"].includes(status)) {
    return status as ConnectedAccountStatus;
  }
  return "disconnected";
}

function normalizeAccountType(value: string) {
  const type = String(value || "").trim().toLowerCase();
  if (["personal", "member", "linkedin_personal", "linkedin_member"].includes(type)) return "personal";
  if (["organization", "page"].includes(type)) return "organization";
  if (["business", "creator"].includes(type)) return type;
  return "unknown";
}

export function normalizeConnectedAccount(input: Record<string, unknown>): ConnectedAccount {
  const expiresAt = String(input.expires_at || input.expiresAt || "").trim() || null;
  const rawAccountType = String(input.account_type || input.accountType || "").trim();
  const normalizedType = normalizeAccountType(rawAccountType) as ConnectedAccount["accountType"];
  const rawCapabilities = ((input.capabilities as Record<string, unknown> | undefined) || {});

  return {
    id: String(input.id || `${input.provider || "provider"}:${input.provider_account_id || input.providerAccountId || normalizedType}`).trim(),
    workspaceId: String(input.workspace_id || input.workspaceId || "").trim(),
    userId: String(input.user_id || input.userId || "").trim() || null,
    provider: String(input.provider || "linkedin").trim().toLowerCase() as ConnectedAccount["provider"],
    accountType: normalizedType,
    providerAccountId: String(input.provider_account_id || input.providerAccountId || input.provider_user_id || "").trim() || null,
    displayName: String(input.display_name || input.displayName || "").trim() || null,
    username: String(input.username || input.provider_username || "").trim() || null,
    avatarUrl: String(input.avatar_url || input.avatarUrl || "").trim() || null,
    status: normalizeStatus(String(input.status || input.access_status || input.accessStatus || ""), expiresAt),
    connectedAt: String(input.connected_at || input.connectedAt || input.last_connected_at || "").trim() || null,
    lastVerifiedAt: String(input.last_verified_at || input.lastVerifiedAt || input.last_sync_at || "").trim() || null,
    expiresAt,
    capabilities: {
      canPublishPersonal: Boolean(rawCapabilities.can_publish_personal ?? rawCapabilities.personal_profile_publishing),
      canPublishOrganization: Boolean(rawCapabilities.can_publish_organization ?? rawCapabilities.company_page_publishing),
      canReadProfile: Boolean(rawCapabilities.can_read_profile ?? true),
      canRefresh: Boolean(rawCapabilities.can_refresh ?? false),
    },
    rawProviderType: rawAccountType || null,
  };
}
