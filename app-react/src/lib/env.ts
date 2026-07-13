type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  publicWebappBaseUrl: string;
};

function required(name: string, value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimmed;
}

export const env: AppEnv = {
  supabaseUrl: required("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
  publicWebappBaseUrl: required("VITE_PUBLIC_WEBAPP_BASE_URL", import.meta.env.VITE_PUBLIC_WEBAPP_BASE_URL),
};

