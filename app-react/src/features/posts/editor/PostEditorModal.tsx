import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal/Modal";
import { MediaPickerDialog } from "@/features/media/MediaPickerDialog";
import { createPost, updatePost, deletePost, duplicatePost } from "@/services/posts/mutations";
import { postKeys } from "@/services/posts/keys";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { MediaAsset } from "@/types/media";
import type { Post, PostMutationPayload, PostPlatform, PostStatus, PostType } from "@/types/posts";

type PostEditorModalProps = {
  open: boolean;
  post: Post | null;
  initialDate?: string | null;
  onClose(): void;
};

type EditorState = {
  title: string;
  description: string;
  platform: PostPlatform;
  status: PostStatus;
  postType: PostType;
  publishDate: string | null;
  publishTime: string | null;
  scheduledAt: string | null;
  campaignName: string | null;
  pillar: string | null;
  notes: string | null;
  selectedMedia: MediaAsset[];
  selectedMediaIds: string[];
  mediaTouched: boolean;
};

function buildState(post: Post | null, initialDate?: string | null): EditorState {
  return {
    title: post?.title || "",
    description: post?.description || "",
    platform: post?.platform || "unknown",
    status: post?.status || "draft",
    postType: post?.postType || "unknown",
    publishDate: post?.publishDate || initialDate || null,
    publishTime: post?.publishTime || null,
    scheduledAt: post?.scheduledAt || null,
    campaignName: post?.campaignName || null,
    pillar: post?.pillar || null,
    notes: post?.notes || null,
    selectedMedia: [],
    selectedMediaIds: post?.mediaIds || [],
    mediaTouched: false,
  };
}

export function PostEditorModal({ open, post, initialDate = null, onClose }: PostEditorModalProps) {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [state, setState] = useState<EditorState>(() => buildState(post, initialDate));

  useEffect(() => {
    if (!open) return;
    setState(buildState(post, initialDate));
  }, [initialDate, open, post]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not resolved.");
      const resolvedMediaIds = state.mediaTouched ? state.selectedMediaIds : (post?.mediaIds || state.selectedMediaIds);
      const resolvedPrimaryMedia = state.mediaTouched
        ? state.selectedMedia[0] || null
        : state.selectedMedia[0] || null;
      const payload: PostMutationPayload = {
        title: state.title,
        description: state.description,
        platform: state.platform,
        platformTargets: state.platform === "unknown" ? [] : [state.platform],
        status: state.status,
        postType: state.postType,
        publishDate: state.publishDate,
        publishTime: state.publishTime,
        scheduledAt: state.scheduledAt,
        campaignId: null,
        campaignName: state.campaignName,
        pillar: state.pillar,
        mediaId: resolvedPrimaryMedia?.id || post?.mediaId || resolvedMediaIds[0] || null,
        mediaIds: resolvedMediaIds,
        mediaUrl: resolvedPrimaryMedia?.mediaUrl || resolvedPrimaryMedia?.previewUrl || post?.mediaUrl || null,
        mediaUrls: state.mediaTouched
          ? state.selectedMedia.map((asset) => asset.mediaUrl || asset.previewUrl || "").filter(Boolean)
          : post?.mediaUrls || [],
        storagePath: resolvedPrimaryMedia?.storagePath || post?.storagePath || null,
        mediaType: resolvedPrimaryMedia?.mediaType || post?.mediaType || null,
        mediaFilename: resolvedPrimaryMedia?.fileName || post?.mediaFilename || null,
        mediaAltText: resolvedPrimaryMedia?.altText || post?.mediaAltText || null,
        notes: state.notes,
        metadata: post?.metadata || {},
      };
      if (post) return updatePost(workspace.workspaceId, workspace.slug, post.postId, payload);
      return createPost(workspace.workspaceId, workspace.slug, payload);
    },
    onSuccess: async () => {
      if (!workspace) return;
      await queryClient.invalidateQueries({ queryKey: postKeys.all(workspace.workspaceId) });
      await queryClient.invalidateQueries({ queryKey: ["queue", workspace.workspaceId] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workspace || !post) throw new Error("Post not loaded.");
      await deletePost(workspace.workspaceId, post.postId);
    },
    onSuccess: async () => {
      if (!workspace) return;
      await queryClient.invalidateQueries({ queryKey: postKeys.all(workspace.workspaceId) });
      onClose();
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!workspace || !post) throw new Error("Post not loaded.");
      return duplicatePost(workspace.workspaceId, workspace.slug, post);
    },
    onSuccess: async () => {
      if (!workspace) return;
      await queryClient.invalidateQueries({ queryKey: postKeys.all(workspace.workspaceId) });
    },
  });

  const hasUnsavedChanges = useMemo(() => {
    if (!post) return Boolean(state.title || state.description || state.selectedMedia.length);
    return (
      state.title !== post.title ||
      state.description !== post.description ||
      state.publishDate !== post.publishDate ||
      state.publishTime !== post.publishTime ||
      state.platform !== post.platform ||
      state.status !== post.status ||
      state.selectedMediaIds.join(",") !== post.mediaIds.join(",")
    );
  }, [post, state]);

  const displayedMediaRows = state.mediaTouched
    ? state.selectedMedia.map((asset) => ({
        key: asset.id,
        label: asset.fileName || asset.storagePath,
        detail: asset.mediaType,
        assetId: asset.id,
      }))
    : (post?.mediaIds || state.selectedMediaIds).map((mediaId, index) => ({
        key: mediaId || `placeholder-${index}`,
        label: mediaId === post?.mediaId ? post?.mediaFilename || post?.storagePath || mediaId : mediaId,
        detail: mediaId === post?.mediaId ? post?.mediaType || "attached" : "attached",
        assetId: mediaId,
      }));

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          if (hasUnsavedChanges && !window.confirm("Discard unsaved post changes?")) return;
          onClose();
        }}
        title={post ? "Edit post" : "Create post"}
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-stellar-muted">Title</span>
            <input
              value={state.title}
              onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
              className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-stellar-muted">Caption</span>
            <textarea
              rows={5}
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 text-sm">
              <span className="text-stellar-muted">Platform</span>
              <select
                value={state.platform}
                onChange={(event) => setState((current) => ({ ...current, platform: event.target.value as PostPlatform }))}
                className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
              >
                <option value="unknown">Select</option>
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="threads">Threads</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-stellar-muted">Status</span>
              <select
                value={state.status}
                onChange={(event) => setState((current) => ({ ...current, status: event.target.value as PostStatus }))}
                className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-stellar-muted">Publish date</span>
              <input
                type="date"
                value={state.publishDate || ""}
                onChange={(event) => setState((current) => ({ ...current, publishDate: event.target.value || null }))}
                className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-stellar-muted">Publish time</span>
              <input
                type="time"
                value={state.publishTime || ""}
                onChange={(event) => setState((current) => ({ ...current, publishTime: event.target.value || null }))}
                className="rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-stellar-text-strong"
              />
            </label>
          </div>

          <div className="stellar-card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-stellar-text-strong">Media</div>
                <div className="text-xs text-stellar-muted">
                  Attach existing assets. Preview failures do not remove attachment identity.
                </div>
              </div>
              <button
                type="button"
                className="stellar-button-base stellar-button-secondary"
                onClick={() => setShowMediaPicker(true)}
              >
                Select media
              </button>
            </div>
            {displayedMediaRows.length ? (
              <div className="grid gap-3">
                {displayedMediaRows.map((asset, index) => (
                  <div key={asset.key} className="flex items-center justify-between gap-3 rounded-2xl border border-stellar-border bg-black/10 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-stellar-text-strong">
                        {asset.label}
                      </div>
                      <div className="text-xs text-stellar-muted">{asset.detail}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="stellar-nav-link px-3 py-2"
                        disabled={index === 0}
                        onClick={() =>
                          setState((current) => {
                            const ids = [...current.selectedMediaIds];
                            if (index > 0) {
                              const tempId = ids[index - 1];
                              ids[index - 1] = ids[index];
                              ids[index] = tempId;
                            }
                            const next = [...current.selectedMedia];
                            if (index > 0 && next[index] && next[index - 1]) {
                              const temp = next[index - 1];
                              next[index - 1] = next[index];
                              next[index] = temp;
                            }
                            return { ...current, selectedMedia: next, selectedMediaIds: ids, mediaTouched: true };
                          })
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="stellar-nav-link px-3 py-2"
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            selectedMedia: current.selectedMedia.filter((item) => item.id !== asset.assetId),
                            selectedMediaIds: current.selectedMediaIds.filter((item) => item !== asset.assetId),
                            mediaTouched: true,
                          }))
                        }
                      >
                        Detach
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-stellar-muted">No media attached.</div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="stellar-button-base stellar-button-primary"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving..." : "Save post"}
            </button>
            {post ? (
              <>
                <button
                  type="button"
                  className="stellar-button-base stellar-button-secondary"
                  disabled={duplicateMutation.isPending}
                  onClick={() => duplicateMutation.mutate()}
                >
                  {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
                </button>
                <button
                  type="button"
                  className="stellar-button-base stellar-button-secondary"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (!window.confirm("Delete this post?")) return;
                    deleteMutation.mutate();
                  }}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </Modal>

      <MediaPickerDialog
        open={showMediaPicker}
        selectedAssets={state.selectedMedia}
        onClose={() => setShowMediaPicker(false)}
        onSave={(assets) => {
          setState((current) => ({
            ...current,
            selectedMedia: assets,
            selectedMediaIds: assets.map((asset) => asset.id),
            mediaTouched: true,
          }));
          setShowMediaPicker(false);
        }}
      />
    </>
  );
}
