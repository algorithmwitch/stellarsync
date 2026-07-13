export type ConnectedAccountStatus =
  | "connected"
  | "expired"
  | "revoked"
  | "error"
  | "pending"
  | "disconnected";

export type ConnectedAccount = {
  id: string;
  workspaceId: string;
  userId: string | null;
  provider: "linkedin" | "facebook" | "instagram" | "threads" | "tiktok" | "bluesky" | "youtube";
  accountType: "personal" | "organization" | "page" | "business" | "creator" | "unknown";
  providerAccountId: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: ConnectedAccountStatus;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  capabilities: {
    canPublishPersonal: boolean;
    canPublishOrganization: boolean;
    canReadProfile: boolean;
    canRefresh: boolean;
  };
  rawProviderType?: string | null;
};

