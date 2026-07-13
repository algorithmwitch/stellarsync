import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  authResolved: boolean;
  setAuth(session: Session | null, user: User | null): void;
  setAuthResolved(authResolved: boolean): void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  authResolved: false,
  setAuth: (session, user) => set({ session, user }),
  setAuthResolved: (authResolved) => set({ authResolved }),
}));

