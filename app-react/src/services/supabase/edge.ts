import { supabase } from "@/services/supabase/client";
import { env } from "@/lib/env";

export async function callEdgeFunction<T>(functionName: string, payload: Record<string, unknown>): Promise<T> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error("Please sign in again.");
  }

  const response = await fetch(`${env.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Edge function ${functionName} failed with HTTP ${response.status}`);
  }
  return data;
}

