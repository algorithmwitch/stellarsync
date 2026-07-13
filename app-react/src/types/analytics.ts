export type AnalyticsSummary = {
  scheduledCount: number;
  publishedCount: number;
  draftCount: number;
  failedCount: number;
  platformBreakdown: Record<string, number>;
  pillarBreakdown: Record<string, number>;
  campaignBreakdown: Record<string, number>;
};

export type AuditResult = {
  label: string;
  severity: "info" | "warning" | "error";
  detail: string;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};
