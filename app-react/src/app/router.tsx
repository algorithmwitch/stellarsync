import { Suspense, lazy } from "react";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { App } from "@/app/App";
import { AppBootstrapGate } from "@/features/auth/AppBootstrapGate";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { RootWorkspaceRedirect } from "@/features/workspaces/RootWorkspaceRedirect";
import { WorkspaceRouteGate } from "@/features/workspaces/WorkspaceRouteGate";

const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage"));
const QueuePage = lazy(() => import("@/features/queue/QueuePage"));
const MediaVaultPage = lazy(() => import("@/features/media/MediaVaultPage"));
const ConnectedAccountsPage = lazy(() => import("@/features/connected-accounts/ConnectedAccountsPage"));
const WorkspacePickerPage = lazy(() => import("@/features/workspaces/WorkspacePickerPage"));

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: (
        <AppBootstrapGate>
          <App />
        </AppBootstrapGate>
      ),
      children: [
        {
          index: true,
          element: <RootWorkspaceRedirect />,
        },
        {
          path: "workspaces",
          element: (
            <Suspense fallback={<LoadingState label="Loading workspaces" />}>
              <WorkspacePickerPage />
            </Suspense>
          ),
        },
        {
          path: "w/:workspaceSlug",
          element: <WorkspaceRouteGate />,
          children: [
            {
              index: true,
              element: <Navigate to="calendar" replace />,
            },
            {
              path: "calendar",
              element: (
                <Suspense fallback={<LoadingState label="Loading calendar" />}>
                  <CalendarPage />
                </Suspense>
              ),
            },
            {
              path: "queue",
              element: (
                <Suspense fallback={<LoadingState label="Loading queue" />}>
                  <QueuePage />
                </Suspense>
              ),
            },
            {
              path: "media",
              element: (
                <Suspense fallback={<LoadingState label="Loading media vault" />}>
                  <MediaVaultPage />
                </Suspense>
              ),
            },
            {
              path: "settings/connected-accounts",
              element: (
                <Suspense fallback={<LoadingState label="Loading connected accounts" />}>
                  <ConnectedAccountsPage />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: "legacy",
          element: <Navigate to="/app/legacy/" replace />,
        },
      ],
    },
  ],
  {
    basename: "/app-react",
  },
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
