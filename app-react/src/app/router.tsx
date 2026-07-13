import { Suspense, lazy } from "react";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { App } from "@/app/App";
import { AppBootstrapGate } from "@/features/auth/AppBootstrapGate";
import { LoadingState } from "@/components/LoadingState/LoadingState";

const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage"));
const ConnectedAccountsPage = lazy(() => import("@/features/connected-accounts/ConnectedAccountsPage"));

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
          element: (
            <Suspense fallback={<LoadingState label="Loading calendar" />}>
              <CalendarPage />
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

