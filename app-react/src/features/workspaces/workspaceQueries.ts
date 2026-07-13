import { supabase } from "@/services/supabase/client";
import type { WorkspaceMembership } from "@/types/workspace";

type WorkspaceRow = {
  workspace_id: string;
  role: string;
  workspaces: {
    id: string;
    slug: string;
    name: string | null;
  }[] | null;
};

export async function fetchWorkspaceMemberships(userId: string): Promise<WorkspaceMembership[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, slug, name)")
    .eq("user_id", userId);

  if (error) throw error;

  return ((data || []) as unknown as WorkspaceRow[])
    .filter((row) => row.workspaces?.[0]?.id && row.workspaces?.[0]?.slug)
    .map((row) => ({
      workspaceId: row.workspaces![0].id,
      role: row.role,
      slug: row.workspaces![0].slug,
      name: row.workspaces![0].name || row.workspaces![0].slug,
    }));
}
