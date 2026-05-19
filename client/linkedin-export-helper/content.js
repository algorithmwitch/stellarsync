(function() {
  const SOURCE_ID = "stellarsync-linkedin-export-helper";
  const CARD_SELECTORS = [
    "main article",
    "main [data-urn]",
    "main .feed-shared-update-v2",
    "main div[data-id]",
    "main .occludable-update"
  ];
  const UI_CHROME_PATTERNS = [
    /^like$/i,
    /^comment$/i,
    /^repost$/i,
    /^send$/i,
    /^follow$/i,
    /^copy link$/i,
    /^more$/i,
    /^view analytics$/i,
    /^promote this post$/i,
    /^activate to view larger image$/i,
    /^visible to anyone on or off linkedin$/i,
    /^feed post number\b/i
  ];

  function textOf(node) {
    return node && node.innerText
      ? String(node.innerText || "").replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trim()
      : "";
  }

  function attrOf(node, key) {
    return node && node.getAttribute ? String(node.getAttribute(key) || "").trim() : "";
  }

  function normalizeUrl(value) {
    return String(value || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((value) => {
      const key = String(value || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function toMetricValue(source, labelPattern) {
    const match = String(source || "").match(labelPattern);
    return match && match[1] ? String(match[1]).trim() : "";
  }

  function isChromeLine(line) {
    const text = String(line || "").trim();
    if (!text) return true;
    if (/^\d[\d,.kKmM]*\s+impressions?$/i.test(text)) return true;
    if (/^(?:like|comment|repost|send)(?:\s+(?:like|comment|repost|send))*$/i.test(text)) return true;
    return UI_CHROME_PATTERNS.some((pattern) => pattern.test(text));
  }

  function cleanLines(rawText) {
    return String(rawText || "")
      .split(/\n+/)
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .filter((line) => !isChromeLine(line));
  }

  function cleanText(rawText) {
    return cleanLines(rawText)
      .filter((line) => !/^https?:\/\//i.test(line))
      .join("\n")
      .trim();
  }

  function detectPostType(mediaUrls, description) {
    if (mediaUrls.length > 1) return "carousel";
    if (mediaUrls.length === 1) return /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(mediaUrls[0]) ? "video" : "image";
    if (/article|newsletter|read more/i.test(description)) return "article";
    return description ? "text" : "unknown";
  }

  function detectRepostMeta(rawText, description, actionText) {
    const combined = [String(actionText || ""), String(rawText || ""), String(description || "")].join("\n");
    const isRepost = /reposted this|\breposted\b|view repost/i.test(combined);
    const isReshare = !isRepost && /shared this|\bshared\b/i.test(combined);
    const originalAuthorMatch = combined.match(/(?:reposted this|shared this|original post|view repost)\s+([A-Z][^\n|]{2,80})/i);
    return {
      isRepost: isRepost || isReshare,
      postType: isRepost ? "repost" : isReshare ? "reshare" : "",
      originalAuthor: originalAuthorMatch && originalAuthorMatch[1] ? String(originalAuthorMatch[1]).trim() : ""
    };
  }

  function collectPayload() {
    const selectorsUsed = [];
    const seenCards = new Set();
    const cards = [];

    CARD_SELECTORS.forEach((selector) => {
      const found = Array.from(document.querySelectorAll(selector)).filter((node) => /like|comment|repost|send/i.test(textOf(node)));
      if (found.length) selectorsUsed.push(selector);
      found.forEach((node) => {
        const key = attrOf(node, "data-urn") || attrOf(node, "data-id") || textOf(node).slice(0, 180);
        if (!key || seenCards.has(key)) return;
        seenCards.add(key);
        cards.push(node);
      });
    });

    const items = [];
    let skippedCount = 0;

    cards.forEach((card, index) => {
      const rawText = textOf(card);
      const cleanedLines = cleanLines(rawText);
      const text = cleanText(rawText);
      const links = Array.from(card.querySelectorAll('a[href*="/feed/update/"], a[href*="/posts/"], a[href*="/activity-"], a[href*="lnkd.in"], a[href*="/pulse/"]'));
      const url = normalizeUrl(links.map((link) => String(link.href || "").trim()).find(Boolean) || "");
      const authorNode = card.querySelector(".update-components-actor__title, .feed-shared-actor__name, .update-components-actor__meta, [data-test-id='actor-name']");
      const dateNode = Array.from(card.querySelectorAll("time, a, span")).find((node) => /ago|just now|\d+\s*(?:h|hr|hrs|d|day|days|w|wk|wks|mo|month|months|yr|year|years)|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|\d{1,2}\/\d{1,2}/i.test(textOf(node)));
      const commentaryNode = card.querySelector(".update-components-text, .feed-shared-update-v2__description, span.break-words, div[dir='ltr'], [data-test-id='main-feed-activity-card__commentary']");
      const actionText = cleanedLines.slice(0, 6).join(" | ");
      const media = Array.from(card.querySelectorAll("img")).map((img) => ({
        url: String(img.currentSrc || img.src || "").trim(),
        alt: attrOf(img, "alt")
      })).filter((item) => item.url && !/data:image\//i.test(item.url));
      const mediaUrls = dedupe(media.map((item) => item.url));
      const mediaAltTexts = media.map((item) => item.alt).filter(Boolean);
      const commentary = textOf(commentaryNode) || text;
      const repostMeta = detectRepostMeta(rawText, commentary, actionText);
      const postType = repostMeta.postType || detectPostType(mediaUrls, commentary);
      const metricsText = rawText;
      const item = {
        capture_index: index,
        platform: "linkedin",
        source_type: "linkedin_browser_capture",
        author: textOf(authorNode),
        original_author: repostMeta.originalAuthor,
        date_label: textOf(dateNode),
        timestamp: attrOf(dateNode, "datetime") || "",
        text: commentary,
        rawText: rawText,
        url: url,
        source_url: window.location.href,
        post_url: url,
        impression_count: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+impressions?/i),
        reaction_count: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+(?:reactions?|likes?)/i),
        comment_count: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+comments?/i),
        repost_count: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+(?:reposts?|shares?)/i),
        metrics: {
          impressions: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+impressions?/i),
          reactions: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+(?:reactions?|likes?)/i),
          comments: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+comments?/i),
          reposts: toMetricValue(metricsText, /(\d[\d,.kKmM]*)\s+(?:reposts?|shares?)/i)
        },
        is_repost: repostMeta.isRepost,
        post_type: postType,
        action_text: actionText,
        media_urls: mediaUrls,
        media_alt_texts: mediaAltTexts,
        media_count: mediaUrls.length
      };
      if (!item.rawText && !item.text && !item.url) {
        skippedCount += 1;
        return;
      }
      items.push(item);
    });

    return {
      source: "linkedin_browser_capture",
      generated_at: new Date().toISOString(),
      source_url: window.location.href,
      diagnostics: {
        cardsDetected: cards.length,
        itemsDetected: items.length,
        itemsWithRawText: items.filter((item) => item.rawText).length,
        selectorsUsed: selectorsUsed,
        skippedCount: skippedCount,
        pageUrl: window.location.href
      },
      items: items
    };
  }

  function getDiagnostics() {
    const payload = collectPayload();
    return {
      ok: true,
      source: SOURCE_ID,
      cardsDetected: payload.diagnostics.cardsDetected,
      itemsWithRawText: payload.diagnostics.itemsWithRawText,
      selectorsUsed: payload.diagnostics.selectorsUsed,
      pageUrl: payload.diagnostics.pageUrl
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = String(message && message.type || "").trim();
    if (!type) return;
    try {
      if (type === "ping") {
        sendResponse({ ok: true, source: SOURCE_ID, ready: true });
        return true;
      }
      if (type === "getDiagnostics") {
        sendResponse(getDiagnostics());
        return true;
      }
      if (type === "exportVisiblePosts") {
        sendResponse({
          ok: true,
          source: SOURCE_ID,
          ready: true,
          payload: collectPayload()
        });
        return true;
      }
      if (type === "EXPORT_VISIBLE_POSTS") {
        sendResponse({
          ok: true,
          payload: collectPayload()
        });
        return true;
      }
    } catch (error) {
      sendResponse({
        ok: false,
        source: SOURCE_ID,
        error: error && error.message ? error.message : "Failed to inspect visible LinkedIn posts."
      });
      return true;
    }
    return false;
  });
})();
