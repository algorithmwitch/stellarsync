export type MediaAssetRow = {
  id: string;
  asset_id: string | null;
  workspace_id: string;
  bucket: string | null;
  storage_path: string;
  media_url: string | null;
  thumbnail_url: string | null;
  filename: string | null;
  mime_type: string | null;
  media_type: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  linked_post_id: string | null;
  linked_note_id: string | null;
  linked_inspo_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PostMediaRow = {
  id: string;
  workspace_id: string;
  post_id: string;
  media_asset_id: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};
