import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { fetchWorkspaceMemberships } from "@/features/workspaces/workspaceQueries";
import { LoadingState } from "@/components/LoadingState/LoadingState";

const ACTIVE_WORKSPACE_KEY = "STELLARSYNC_ACTIVE_WORKSPACE";

export function AppBootstrapGate({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authResolved, setAuth, setAuthResolved } = useAuthStore();
  const { activeWorkspace, setActiveWorkspace, setMemberships } = useWorkspaceStore();

  useEffect(() => {
    performance.mark("stellarsync-start");
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuth(data.session ?? null, data.session?.user ?? null);
      setAuthResolved(true);
      performance.mark("auth-resolved");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ?? null, session?.user ?? null);
      setAuthResolved(true);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [setAuth, setAuthResolved]);

  const membershipsQuery = useQuery({
    queryKey: ["workspace-memberships", user?.id],
    queryFn: () => fetchWorkspaceMemberships(user!.id),
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (!membershipsQuery.data) return;
    setMemberships(membershipsQuery.data);
    const persistedSlug = (() => {
      try {
        const raw = sessionStorage.getItem(ACTIVE_WORKSPACE_KEY);
        if (!raw) return "";
        const parsed = JSON.parse(raw) as { workspace_slug?: string; slug?: string };
        return String(parsed.workspace_slug || parsed.slug || "").trim();
      } catch {
        return "";
      }
    })();

    const nextWorkspace =
      membershipsQuery.data.find((entry) => entry.slug === persistedSlug) ||
      membershipsQuery.data[0] ||
      null;

    setActiveWorkspace(nextWorkspace);
    if (nextWorkspace) {
      sessionStorage.setItem(
        ACTIVE_WORKSPACE_KEY,
        JSON.stringify({
          workspace_id: nextWorkspace.workspaceId,
          workspace_slug: nextWorkspace.slug,
        }),
      );
      performance.mark("workspace-resolved");
    }
  }, [membershipsQuery.data, setActiveWorkspace, setMemberships]);

  useEffect(() => {
    if (!activeWorkspace) return;
    if (location.pathname === "/") {
      performance.mark("calendar-rendered");
      performance.measure("auth_boot", "stellarsync-start", "auth-resolved");
      performance.measure("workspace_boot", "auth-resolved", "workspace-resolved");
    }
  }, [activeWorkspace, location.pathname]);

  if (!authResolved) return <LoadingState label="Restoring session" />;
  if (!user) {
    window.location.replace("/login/");
    return <LoadingState label="Redirecting to login" />;
  }
  if (membershipsQuery.isLoading) return <LoadingState label="Loading workspaces" />;
  if (membershipsQuery.isError) {
    return <LoadingState label={membershipsQuery.error instanceof Error ? membershipsQuery.error.message : "Workspace load failed"} />;
  }
  if (!membershipsQuery.data?.length) {
    window.location.replace("/onboarding/");
    return <LoadingState label="Redirecting to onboarding" />;
  }
  if (!activeWorkspace) {
    navigate("/", { replace: true });
    return <LoadingState label="Preparing workspace" />;
  }
  return <>{children}</>;
}

