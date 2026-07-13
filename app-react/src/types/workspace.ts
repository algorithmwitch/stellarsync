export type WorkspaceMembership = {
  workspaceId: string;
  role: string;
  slug: string;
  name: string;
  timezone: string | null;
  backendType: string | null;
  planSlug: string | null;
  subscriptionTier: string | null;
  featureFlags: Record<string, unknown>;
  features: {
    sheetsEnabled: boolean;
    mondayEnabled: boolean;
  };
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  planSlug: string;
  subscriptionTier: string;
  featureFlags: Record<string, unknown>;
};

export type WorkspaceSettings = {
  workspaceId: string;
  backendType: "supabase_native" | "google_sheets_hybrid" | "managed_mirror";
  googleSheetId: string | null;
  appsScriptUrl: string | null;
  sheetSyncEnabled: boolean;
  sheetSyncDirection: string;
  sheetLastPulledAt: string | null;
  sheetLastPushedAt: string | null;
  mediaBucket: string | null;
  constellationShape: string | null;
  brandAccent: string | null;
  timezone: string | null;
  planSlug: string | null;
  subscriptionTier: string | null;
  featureFlags: Record<string, unknown>;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string | null;
  email: string | null;
  role: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MondayConnection = {
  workspaceId: string;
  boardId: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
};

export type SheetsConnection = {
  workspaceId: string;
  enabled: boolean;
  appsScriptUrl: string | null;
  googleSheetId: string | null;
  syncDirection: string;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
};
