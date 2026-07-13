import { create } from "zustand";
import type { WorkspaceMembership } from "@/types/workspace";

type WorkspaceState = {
  memberships: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership | null;
  setMemberships(memberships: WorkspaceMembership[]): void;
  setActiveWorkspace(workspace: WorkspaceMembership | null): void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  memberships: [],
  activeWorkspace: null,
  setMemberships: (memberships) => set({ memberships }),
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
}));

