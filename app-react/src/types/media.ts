export type MediaType = "image" | "video" | "document" | "unknown";

export type MediaAsset = {
  id: string;
  assetId: string | null;
  workspaceId: string;
  bucket: string;
  storagePath: string;
  mediaUrl: string | null;
  previewUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  mediaType: MediaType;
  altText: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  isPrivate: boolean;
  linkedPostId: string | null;
  linkedNoteId: string | null;
  linkedInspoId: string | null;
  metadata: Record<string, unknown>;
};

export type PostMediaRelationship = {
  id: string;
  workspaceId: string;
  postId: string;
  mediaAssetId: string;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MediaHydrationState = {
  assetsLoaded: boolean;
  relationshipsLoaded: boolean;
  loading: boolean;
  error: Error | null;
};

export type MediaFilters = {
  mediaType?: MediaType | "all";
  search?: string;
  limit?: number;
  offset?: number;
};
