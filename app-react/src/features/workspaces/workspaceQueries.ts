import { supabase } from "@/services/supabase/client";
import type { WorkspaceMembership } from "@/types/workspace";

type WorkspaceRow = {
  workspace_id: string;
  role: string;
  workspaces: {
    id: string;
    slug: string;
    name: string | null;
    plan_slug?: string | null;
    subscription_tier?: string | null;
    feature_flags?: Record<string, unknown> | null;
  }[] | null;
};

type WorkspaceSettingsRow = {
  workspace_id: string;
  backend_type: string | null;
  timezone: string | null;
  plan_slug: string | null;
  subscription_tier: string | null;
  feature_flags: Record<string, unknown> | null;
  sheet_sync_enabled: boolean | null;
  monday_sync_enabled: boolean | null;
};

export async function fetchWorkspaceMemberships(userId: string): Promise<WorkspaceMembership[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, slug, name, plan_slug, subscription_tier, feature_flags)")
    .eq("user_id", userId);

  if (error) throw error;

  const membershipRows = ((data || []) as unknown as WorkspaceRow[]).filter(
    (row) => row.workspaces?.[0]?.id && row.workspaces?.[0]?.slug,
  );
  const workspaceIds = membershipRows.map((row) => row.workspaces![0].id);

  let settingsByWorkspaceId = new Map<string, WorkspaceSettingsRow>();
  if (workspaceIds.length) {
    const { data: settingsData, error: settingsError } = await supabase
      .from("workspace_settings")
      .select(
        "workspace_id, backend_type, timezone, plan_slug, subscription_tier, feature_flags, sheet_sync_enabled, monday_sync_enabled",
      )
      .in("workspace_id", workspaceIds);

    if (settingsError) throw settingsError;

    settingsByWorkspaceId = new Map(
      (((settingsData || []) as WorkspaceSettingsRow[]) || []).map((row) => [row.workspace_id, row]),
    );
  }

  return membershipRows.map((row) => {
    const workspace = row.workspaces![0];
    const settings = settingsByWorkspaceId.get(workspace.id);
    const featureFlags = {
      ...(workspace.feature_flags && typeof workspace.feature_flags === "object" ? workspace.feature_flags : {}),
      ...(settings?.feature_flags && typeof settings.feature_flags === "object" ? settings.feature_flags : {}),
    };

    return {
      workspaceId: workspace.id,
      role: row.role,
      slug: workspace.slug,
      name: workspace.name || workspace.slug,
      timezone: settings?.timezone || null,
      backendType: settings?.backend_type || null,
      planSlug: settings?.plan_slug || workspace.plan_slug || null,
      subscriptionTier:
        settings?.subscription_tier || workspace.subscription_tier || settings?.plan_slug || workspace.plan_slug || null,
      featureFlags,
      features: {
        sheetsEnabled: Boolean(settings?.sheet_sync_enabled),
        mondayEnabled: Boolean(settings?.monday_sync_enabled),
      },
    };
  });
}
