export const queueKeys = {
  list: (workspaceId: string) => ["queue", workspaceId] as const,
};
