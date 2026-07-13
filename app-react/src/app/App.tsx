import { Outlet } from "react-router-dom";
import { AppShell } from "@/components/AppShell/AppShell";

export function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

