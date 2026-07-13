import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkspacePath,
  createConnectedAccountsReturnUrl,
  getLegacyWorkspaceUrl,
  getWorkspaceSwitchTarget,
  isWorkspaceScopedQueryKey,
  resolveWorkspaceMembershipBySlug,
} from "./routing.ts";

type TestWorkspaceMembership = {
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

const memberships: TestWorkspaceMembership[] = [
  {
    workspaceId: "wid-gpe",
    role: "owner",
    slug: "gpe",
    name: "GPE",
    timezone: "America/Chicago",
    backendType: "google_sheets_hybrid",
    planSlug: "managed",
    subscriptionTier: "managed",
    featureFlags: {},
    features: {
      sheetsEnabled: true,
      mondayEnabled: true,
    },
  },
  {
    workspaceId: "wid-algo",
    role: "member",
    slug: "algorithmwitch",
    name: "Algorithm Witch",
    timezone: "America/Chicago",
    backendType: "supabase_native",
    planSlug: "growth",
    subscriptionTier: "growth",
    featureFlags: {},
    features: {
      sheetsEnabled: false,
      mondayEnabled: false,
    },
  },
];

test("resolveWorkspaceMembershipBySlug matches real accessible workspace slugs", () => {
  assert.equal(resolveWorkspaceMembershipBySlug(memberships, "gpe")?.workspaceId, "wid-gpe");
  assert.equal(resolveWorkspaceMembershipBySlug(memberships, "GPE")?.workspaceId, "wid-gpe");
  assert.equal(resolveWorkspaceMembershipBySlug(memberships, "missing"), null);
});

test("buildWorkspacePath creates workspace-scoped calendar routes", () => {
  assert.equal(buildWorkspacePath("gpe"), "/w/gpe/calendar");
  assert.equal(buildWorkspacePath("gpe", "media"), "/w/gpe/media");
});

test("getWorkspaceSwitchTarget preserves compatible child routes", () => {
  assert.equal(getWorkspaceSwitchTarget("/w/gpe/media", "algorithmwitch"), "/w/algorithmwitch/media");
  assert.equal(getWorkspaceSwitchTarget("/w/gpe", "algorithmwitch"), "/w/algorithmwitch/calendar");
});

test("getLegacyWorkspaceUrl preserves workspace context for legacy views", () => {
  assert.equal(getLegacyWorkspaceUrl("gpe"), "/app/?workspace=gpe");
  assert.equal(getLegacyWorkspaceUrl("gpe", "audit"), "/app/?workspace=gpe&view=audit");
});

test("isWorkspaceScopedQueryKey isolates workspace-scoped query caches", () => {
  assert.equal(isWorkspaceScopedQueryKey(["calendar", "wid-gpe", "2026-07-01"], "wid-gpe"), true);
  assert.equal(isWorkspaceScopedQueryKey(["calendar", "wid-algo", "2026-07-01"], "wid-gpe"), false);
});

test("createConnectedAccountsReturnUrl stays workspace-scoped", () => {
  assert.equal(
    createConnectedAccountsReturnUrl("https://stellarsync.example", "gpe"),
    "https://stellarsync.example/w/gpe/settings/connected-accounts",
  );
});
