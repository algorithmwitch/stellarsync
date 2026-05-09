(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function normalizeMedia(asset) {
    const assetId = String(asset?.assetId || asset?.asset_id || asset?.id || "").trim();
    const linkedPostId = String(asset?.linkedPostId || asset?.linked_post_id || asset?.postId || "").trim();
    const assetName = String(asset?.assetName || asset?.asset_name || asset?.title || "").trim();
    const assetType = String(asset?.assetType || asset?.asset_type || asset?.type || "image").trim().toLowerCase() || "image";

    return {
      id: assetId,
      assetId,
      title: assetName,
      assetName,
      type: assetType,
      assetType,
      postId: linkedPostId,
      linkedPostId,
      fileUrl: String(asset?.fileUrl || asset?.file_url || "").trim(),
      sourceUrl: String(asset?.sourceUrl || asset?.source_url || "").trim(),
      sourceType: String(asset?.sourceType || asset?.source_type || "").trim(),
      campaign: String(asset?.campaign || "").trim(),
      assetBadge: String(asset?.assetBadge || asset?.asset_badge || "").trim(),
      assetMeta: String(asset?.assetMeta || asset?.asset_meta || asset?.meta || "").trim()
    };
  }

  function normalizeQueue(item) {
    return {
      postId: String(item?.postId || item?.post_id || item?.id || "").trim(),
      title: String(item?.title || "").trim(),
      platform: String(item?.platform || "linkedin").trim(),
      pillar: String(item?.pillar || "").trim(),
      queueDateLabel: String(item?.queueDateLabel || item?.queue_date_label || "").trim(),
      queueTimeLabel: String(item?.queueTimeLabel || item?.queue_time_label || "").trim()
    };
  }

  function createApi(scriptUrl) {
    const get = async (action) => {
      const response = await fetch(`${scriptUrl}?action=${encodeURIComponent(action)}`, { method: "GET", mode: "cors" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Unknown Apps Script error");
      return result;
    };

    const post = async (action, payload = {}) => {
      const response = await fetch(scriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload })
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Unknown Apps Script error");
      return result;
    };

    return { get, post };
  }

  function renderTemplate(mode) {
    const compact = mode === "compact";
    return `
      <style>
        :host, .ss-root {
          all: initial;
          font-family: Inter, system-ui, sans-serif;
          color: #e5e7eb;
        }
        .ss-root {
          display: block;
          background: linear-gradient(180deg, #120c1d, #0a0612);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: ${compact ? "16px" : "20px"};
          box-shadow: 0 24px 60px rgba(0,0,0,0.28);
        }
        .ss-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .ss-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ss-logo {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(157,78,221,0.16);
          color: #d8b4fe;
          font-size: 18px;
        }
        .ss-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }
        .ss-subtitle {
          font-size: 11px;
          color: #9ca3af;
        }
        .ss-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .ss-tab, .ss-button {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          color: #d1d5db;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .ss-tab.is-active {
          background: rgba(157,78,221,0.24);
          color: #fff;
          border-color: rgba(199,125,255,0.45);
        }
        .ss-grid {
          display: grid;
          grid-template-columns: repeat(${compact ? 1 : 2}, minmax(0, 1fr));
          gap: 12px;
        }
        .ss-card {
          background: rgba(24,17,37,0.92);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 14px;
        }
        .ss-card h3 {
          margin: 0 0 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #a78bfa;
        }
        .ss-list {
          display: grid;
          gap: 10px;
        }
        .ss-item {
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .ss-item-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }
        .ss-meta {
          font-size: 11px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .ss-input, .ss-select, .ss-textarea {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(10,6,18,0.9);
          color: #fff;
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 12px;
          margin-bottom: 10px;
          box-sizing: border-box;
        }
        .ss-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ss-button-primary {
          background: linear-gradient(90deg, #9d4edd, #c77dff);
          color: #fff;
        }
        .ss-empty, .ss-status {
          font-size: 12px;
          color: #9ca3af;
        }
        .ss-status.is-error { color: #fecdd3; }
        .ss-status.is-success { color: #bbf7d0; }
      </style>
      <div class="ss-root">
        <div class="ss-header">
          <div class="ss-brand">
            <div class="ss-logo">✦</div>
            <div>
              <div class="ss-title">StellarSync</div>
              <div class="ss-subtitle">Embedded workspace</div>
            </div>
          </div>
        </div>
        <div class="ss-tabs">
          <button class="ss-tab" data-view="queue">Queue</button>
          <button class="ss-tab" data-view="media">Media Vault</button>
        </div>
        <div class="ss-grid">
          <section class="ss-card" data-panel="queue">
            <h3>Queue</h3>
            <div class="ss-list" id="ss-queue-list"></div>
          </section>
          <section class="ss-card" data-panel="media">
            <h3>Media Vault</h3>
            <div class="ss-list" id="ss-media-list"></div>
          </section>
          <section class="ss-card">
            <h3>Quick Add Link</h3>
            <input class="ss-input" id="ss-link-url" placeholder="Drive link, file ID, LinkedIn URL, or direct asset URL">
            <input class="ss-input" id="ss-link-name" placeholder="Asset name">
            <select class="ss-select" id="ss-link-type">
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="carousel">Carousel</option>
              <option value="article">Article</option>
            </select>
            <div class="ss-actions">
              <button class="ss-button ss-button-primary" id="ss-save-link">Save Link</button>
            </div>
          </section>
          <section class="ss-card">
            <h3>Quick Upload</h3>
            <input class="ss-input" id="ss-upload-name" placeholder="Optional badge / notes field is inferred from filename" disabled>
            <input class="ss-input" id="ss-upload-file" type="file" accept="image/*,video/*">
            <div class="ss-actions">
              <button class="ss-button ss-button-primary" id="ss-upload-btn">Upload</button>
            </div>
          </section>
        </div>
        <div class="ss-status" id="ss-status"></div>
      </div>
    `;
  }

  async function mount(options = {}) {
    const targetSelector = options.target || "#stellarsync-plugin";
    const target = typeof targetSelector === "string" ? document.querySelector(targetSelector) : targetSelector;
    if (!target) throw new Error("StellarSyncPlugin target not found.");
    if (!options.scriptUrl) throw new Error("StellarSyncPlugin requires scriptUrl.");

    const shadow = target.shadowRoot || target.attachShadow({ mode: "open" });
    shadow.innerHTML = renderTemplate(options.mode || "compact");

    const api = createApi(options.scriptUrl);
    const statusEl = shadow.getElementById("ss-status");
    const queueList = shadow.getElementById("ss-queue-list");
    const mediaList = shadow.getElementById("ss-media-list");
    const tabs = Array.from(shadow.querySelectorAll(".ss-tab"));
    const panels = Array.from(shadow.querySelectorAll("[data-panel]"));

    const setStatus = (message, type = "") => {
      statusEl.textContent = message || "";
      statusEl.className = `ss-status${type ? ` is-${type}` : ""}`;
    };

    const setView = (view) => {
      tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
      panels.forEach((panel) => {
        panel.style.display = panel.dataset.panel === view ? "block" : "none";
      });
    };

    const renderQueue = (items) => {
      if (!items.length) {
        queueList.innerHTML = `<div class="ss-empty">No queued posts found.</div>`;
        return;
      }

      queueList.innerHTML = items.slice(0, 8).map((item) => `
        <div class="ss-item">
          <div class="ss-item-title">${escapeHtml(item.title || "Untitled post")}</div>
          <div class="ss-meta">${escapeHtml(item.queueDateLabel || "")} ${escapeHtml(item.queueTimeLabel || "")}</div>
          <div class="ss-meta">${escapeHtml(item.platform || "platform")} ${item.pillar ? `• ${escapeHtml(item.pillar)}` : ""}</div>
        </div>
      `).join("");
    };

    const renderMedia = (items) => {
      if (!items.length) {
        mediaList.innerHTML = `<div class="ss-empty">No media assets found.</div>`;
        return;
      }

      mediaList.innerHTML = items.slice(0, 8).map((item) => {
        const previewUrl = item.fileUrl || item.sourceUrl || "";
        return `
          <div class="ss-item">
            <div class="ss-item-title">${escapeHtml(item.title || "Untitled asset")}</div>
            <div class="ss-meta">${escapeHtml(item.type || "asset")} ${item.campaign ? `• ${escapeHtml(item.campaign)}` : ""}</div>
            ${previewUrl ? `<div class="ss-meta">${escapeHtml(previewUrl)}</div>` : ""}
          </div>
        `;
      }).join("");
    };

    const refresh = async () => {
      setStatus("Loading…");
      try {
        const [queueResult, mediaResult] = await Promise.all([api.get("getQueue"), api.get("getMedia")]);
        renderQueue((queueResult.items || []).map(normalizeQueue));
        renderMedia((mediaResult.items || []).map(normalizeMedia));
        setStatus("Synced", "success");
      } catch (error) {
        setStatus(error.message || "Unable to load plugin data.", "error");
      }
    };

    shadow.getElementById("ss-save-link").addEventListener("click", async () => {
      const sourceUrl = shadow.getElementById("ss-link-url").value.trim();
      const assetName = shadow.getElementById("ss-link-name").value.trim();
      const assetType = shadow.getElementById("ss-link-type").value;
      if (!sourceUrl) {
        setStatus("Link URL is required.", "error");
        return;
      }

      try {
        setStatus("Saving link…");
        await api.post("saveMediaLink", { sourceUrl, assetName, assetType });
        shadow.getElementById("ss-link-url").value = "";
        shadow.getElementById("ss-link-name").value = "";
        await refresh();
      } catch (error) {
        setStatus(error.message || "Unable to save link.", "error");
      }
    });

    shadow.getElementById("ss-upload-btn").addEventListener("click", async () => {
      const fileInput = shadow.getElementById("ss-upload-file");
      const file = fileInput.files?.[0];
      if (!file) {
        setStatus("Choose a file first.", "error");
        return;
      }

      try {
        setStatus("Uploading…");
        const base64Data = await fileToBase64(file);
        await api.post("uploadMedia", {
          fileName: file.name,
          mimeType: file.type,
          base64Data,
          assetBadge: file.type.startsWith("video/") ? "Reel" : "Image",
          assetMeta: "",
          linkedPostId: "",
          campaign: ""
        });
        fileInput.value = "";
        await refresh();
      } catch (error) {
        setStatus(error.message || "Unable to upload file.", "error");
      }
    });

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => setView(tab.dataset.view));
    });

    setView(options.defaultView === "queue" ? "queue" : "media");
    await refresh();
  }

  window.StellarSyncPlugin = { mount };
})();
