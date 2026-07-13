import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import { fetchWorkspaceMemberships } from "@/features/workspaces/workspaceQueries";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppBootstrapGate({ children }: PropsWithChildren) {
  const { user, authResolved, setAuth, setAuthResolved } = useAuthStore();
  const setMemberships = useWorkspaceStore((state) => state.setMemberships);

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
  }, [membershipsQuery.data, setMemberships]);

  if (!authResolved) return <LoadingState label="Restoring session" />;
  if (!user) {
    window.location.replace("/login/");
    return <LoadingState label="Redirecting to login" />;
  }
  if (membershipsQuery.isLoading) return <LoadingState label="Loading workspaces" />;
  if (membershipsQuery.isError) {
    return (
      <LoadingState
        label={
          membershipsQuery.error instanceof Error
            ? membershipsQuery.error.message
            : "Workspace load failed"
        }
      />
    );
  }
  if (!membershipsQuery.data?.length) {
    window.location.replace("/onboarding/");
    return <LoadingState label="Redirecting to onboarding" />;
  }
  return <>{children}</>;
}
