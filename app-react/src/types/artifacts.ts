export type Campaign = {
  id: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  pillar: string | null;
  status: string | null;
  color: string | null;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  platformTargets: string[];
  archived: boolean;
};

export type InspoItem = {
  id: string;
  workspaceId: string;
  inspoId: string;
  title: string;
  summary: string | null;
  body: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceLabel: string | null;
  campaignId: string | null;
  campaignName: string | null;
  pillar: string | null;
  linkedPostId: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Note = {
  id: string;
  workspaceId: string;
  noteId: string;
  title: string;
  body: string | null;
  summary: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  campaignId: string | null;
  campaignName: string | null;
  pillar: string | null;
  linkedPostId: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AIDraft = {
  id: string;
  workspaceId: string;
  aiDraftId: string;
  title: string;
  draftText: string | null;
  generatedOutput: string | null;
  sourceType: string | null;
  sourceId: string | null;
  draftStatus: string;
  campaignId: string | null;
  campaignName: string | null;
  pillar: string | null;
  createdPostId: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
