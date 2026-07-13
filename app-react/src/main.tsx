import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import "@/styles/index.css";

const pendingRedirect = sessionStorage.getItem("stellarsync_app_react_redirect");
if (pendingRedirect && window.location.pathname === "/app-react/") {
  sessionStorage.removeItem("stellarsync_app_react_redirect");
  window.history.replaceState(null, "", pendingRedirect);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
