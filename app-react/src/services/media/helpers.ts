import { env } from "@/lib/env";
import { callEdgeFunction } from "@/services/supabase/edge";
import type { MediaAsset } from "@/types/media";

export function encodeStoragePathSegments(value: string) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function resolveSupabasePublicMediaUrl(asset: Partial<MediaAsset> & { storagePath?: string; bucket?: string } = {}) {
  const path = String(asset.storagePath || "").replace(/^\/+/, "");
  const bucket = String(asset.bucket || "media").replace(/^\/+|\/+$/g, "");
  if (!path || !bucket || !env.supabaseUrl) return "";
  return `${String(env.supabaseUrl).replace(/\/+$/, "")}/storage/v1/object/public/${encodeStoragePathSegments(bucket)}/${encodeStoragePathSegments(path)}`;
}

export function shouldUseSignedMediaUrl(asset: Partial<MediaAsset> = {}) {
  return asset.isPrivate === true;
}

export function getRenderableMediaUrl(asset: Partial<MediaAsset> = {}) {
  return String(asset.previewUrl || asset.mediaUrl || "").trim();
}

export async function refreshSupabaseSignedMediaUrl(asset: Partial<MediaAsset>) {
  if (!asset.storagePath) {
    return getRenderableMediaUrl(asset);
  }
  if (!shouldUseSignedMediaUrl(asset)) {
    return resolveSupabasePublicMediaUrl(asset as Partial<MediaAsset> & { bucket?: string });
  }
  const result = await callEdgeFunction<{
    ok?: boolean;
    httpOk?: boolean;
    httpStatus?: number;
    error?: string;
    message?: string;
    signedUrl?: string;
    signed_url?: string;
    url?: string;
  }>("media-sign-url", {
    storage_path: asset.storagePath,
    bucket: asset.bucket || "media",
    expires_in: 3600,
  });
  if (result?.ok === false || result?.httpOk === false) {
    throw new Error(result?.error || result?.message || "media-sign-url failed");
  }
  const url = result.signedUrl || result.signed_url || result.url || "";
  if (!url) throw new Error("media-sign-url returned no URL.");
  return url;
}
