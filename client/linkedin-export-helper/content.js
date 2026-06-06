(function() {
  "use strict";
  const SOURCE_ID = "stellarsync-linkedin-export-helper";

  const CARD_SELECTORS = [
    "main article",
    "main [data-urn]",
    "main .feed-shared-update-v2",
    "main div[data-id]",
    "main .occludable-update",
    "main li[data-urn]",
    "main div[data-urn]",
    "main .profile-activity__card",
    "main .profile-activity__list-item",
    "main .activity-card",
    "main .activity-card-main",
    "main .update-components--activity",
    "article",
    "[data-urn]",
    ".feed-shared-update-v2",
    ".occludable-update",
    ".profile-activity__card",
    ".activity-card"
  ];

  function detectPageType() {
    var path = window.location.pathname;
    if (/^\/feed\//.test(path)) return "feed";
    if (/\/details\/activity/.test(path) || /\/details\/posts?/.test(path)) return "profile_activity";
    if (/^\/in\//.test(path)) return "profile";
    return "unknown";
  }

  function isNowLabel(label) {
    if (!label) return false;
    var s = String(label).trim().toLowerCase();
    return s === "just now" || s === "now" || s === "a few seconds ago";
  }

  const ACTION_CLUSTER_PATTERNS = [
    /like/i, /comment/i, /repost/i, /send/i,
    /view analytics/i, /promote/i, /impression/i
  ];

  function textOf(node) {
    return node && node.innerText ? node.innerText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() : "";
  }

  function attrOf(node, key) {
    return node && node.getAttribute ? String(node.getAttribute(key) || "").trim() : "";
  }

  function normalizeUrl(value) {
    return String(value || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter(function(item) {
      var key = String(item && item.key || (typeof item === "string" ? item : JSON.stringify(item)) || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseMetricNumber(value) {
    if (value == null) return 0;
    var str = String(value).replace(/[^0-9.kKmMbB]/g, "").trim();
    if (!str) return 0;
    var mult = 1;
    if (/[kK]$/.test(str)) { mult = 1000; str = str.slice(0, -1); }
    else if (/[mM]$/.test(str)) { mult = 1000000; str = str.slice(0, -1); }
    else if (/[bB]$/.test(str)) { mult = 1000000000; str = str.slice(0, -1); }
    str = str.replace(/,/g, "");
    var num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * mult);
  }

  function extractMetricsFromText(rawText) {
    var text = String(rawText || "");
    return {
      impressions: parseMetricNumber((text.match(/([\d,.kKmMbB]+)\s*impression/i) || [])[1]),
      reactions: parseMetricNumber((text.match(/([\d,.kKmMbB]+)\s*reactions?/i) || [])[1] || (text.match(/([\d,.kKmMbB]+)\s*likes?/i) || [])[1]),
      comments: parseMetricNumber((text.match(/([\d,.kKmMbB]+)\s*comments?/i) || [])[1]),
      reposts: parseMetricNumber((text.match(/([\d,.kKmMbB]+)\s*reposts?/i) || [])[1] || (text.match(/([\d,.kKmMbB]+)\s*shares?/i) || [])[1])
    };
  }

  function decodeLinkedInActivityId(str) {
    var match = String(str || "").match(/(?:activity[:\/-]|urn:li:activity:)(\d+)/i);
    if (!match) return null;
    var activityIdStr = match[1];
    if (!activityIdStr || activityIdStr.length < 12) return null;
    try {
      var activityId = typeof BigInt !== "undefined" ? BigInt(activityIdStr) : null;
      if (!activityId) return null;
      var timestampMs = Number(activityId >> BigInt(22));
      if (timestampMs < 1e9 || timestampMs > 2e12) {
        timestampMs = Number(activityId >> BigInt(16));
      }
      if (timestampMs < 1e9 || timestampMs > 2e12) return null;
      return { timestamp: new Date(timestampMs).toISOString(), confidence: "activity_id", activityId: activityIdStr };
    } catch (e) {
      return null;
    }
  }

  function parseRelativeDateLabel(label, generatedAt) {
    if (!label) return null;
    var str = String(label).trim();
    var refDate = generatedAt ? new Date(generatedAt) : new Date();
    if (isNowLabel(str)) {
      return {
        timestamp: refDate.toISOString(),
        confidence: "relative_now",
        relativeLabel: str
      };
    }
    var match = str.match(/^(\d+)\s*(h|hr|hrs|d|day|days|w|wk|wks|week|weeks|mo|mon|month|months|y|yr|yrs|year|years)?\s*ago$/i);
    if (!match) return null;
    var num = parseInt(match[1], 10);
    var unit = (match[2] || "h").toLowerCase();
    var ms = 0;
    if (/^h/.test(unit)) ms = num * 3600000;
    else if (/^d/.test(unit)) ms = num * 86400000;
    else if (/^w/.test(unit)) ms = num * 604800000;
    else if (/^m/.test(unit)) ms = num * 2592000000;
    else if (/^y/.test(unit)) ms = num * 31536000000;
    if (!ms) return null;
    return {
      timestamp: new Date(refDate.getTime() - ms).toISOString(),
      confidence: "relative_estimate",
      relativeLabel: str
    };
  }

  function detectPostType(mediaUrls, description) {
    if (Array.isArray(mediaUrls) && mediaUrls.length > 1) return "carousel";
    if (Array.isArray(mediaUrls) && mediaUrls.length === 1) {
      var url = String(mediaUrls[0] || "").toLowerCase();
      if (/\.(mp4|mov|avi|webm)/.test(url)) return "video";
      return "image";
    }
    if (Array.isArray(mediaUrls) && mediaUrls.length) return "image";
    return "text";
  }

  function detectRepostMeta(rawText, description, actionText) {
    var combined = [actionText, rawText, description].filter(Boolean).join("\n");
    var isRepost = /reposted\s*this|reposted\b/i.test(combined);
    var isReshare = !isRepost && /shared\s*this/i.test(combined);
    var postType = isRepost ? "repost" : isReshare ? "reshare" : "";
    var authorMatch = combined.match(/(?:reposted this|shared this|original post)\s+(.{2,80}?)(?:\n|$|\.\s)/i);
    if (!authorMatch) {
      authorMatch = combined.match(/(.{2,40}?)\s*(?:reposted this|shared this)/i);
    }
    var commentary = "";
    if (rawText && description && rawText !== description && rawText.indexOf(description) !== -1) {
      commentary = rawText.replace(description, "").trim();
    } else if (rawText && description && rawText !== description) {
      commentary = rawText.slice(0, 500);
    }
    return {
      postType: postType,
      isRepost: !!postType,
      repostAuthor: authorMatch ? String(authorMatch[1]).trim() : "",
      repostCommentary: commentary.slice(0, 500),
      originalAuthor: authorMatch ? String(authorMatch[1]).trim() : "",
      originalPostExcerpt: description ? description.slice(0, 240) : ""
    };
  }

  function collectPayload() {
    var generatedAt = new Date().toISOString();
    var selectorsTried = [];
    var selectorCounts = {};
    var seen = new Set();
    var cards = [];
    var pageType = detectPageType();

    if (pageType === "profile_activity") {
      var activityScroller = document.querySelector(".profile-activity__scroller, .profile-activity__list, [data-view-name=\"profile-activity\"]");
      if (activityScroller) {
        CARD_SELECTORS.unshift(".profile-activity__card", ".profile-activity__list-item", ".activity-card", ".activity-card-main");
      }
    }

    CARD_SELECTORS.forEach(function(selector) {
      var found = Array.from(document.querySelectorAll(selector));
      selectorsTried.push(selector);
      selectorCounts[selector] = found.length;
      found.forEach(function(node) {
        var raw = textOf(node);
        if (!raw || raw.length < 30) return;
        var hasActions = ACTION_CLUSTER_PATTERNS.some(function(p) { return p.test(raw); });
        if (!hasActions) return;
        var key = attrOf(node, "data-urn") || attrOf(node, "data-id") || raw.slice(0, 300);
        if (!key || seen.has(key)) return;
        seen.add(key);
        cards.push(node);
      });
    });

    if (cards.length < 2) {
      var main = document.querySelector("main");
      if (main) {
        var children = Array.from(main.querySelectorAll("div, section, li, article"));
        children.forEach(function(node) {
          var raw = textOf(node);
          if (!raw || raw.length < 50) return;
          var actionCount = ACTION_CLUSTER_PATTERNS.filter(function(p) { return p.test(raw); }).length;
          if (actionCount < 3) return;
          var key = raw.slice(0, 300);
          if (seen.has(key)) return;
          seen.add(key);
          cards.push(node);
        });
      }
      if (cards.length < 2 && pageType === "profile_activity") {
        var allSections = Array.from(document.querySelectorAll("section"));
        allSections.forEach(function(node) {
          var raw = textOf(node);
          if (!raw || raw.length < 100) return;
          var actionCount = ACTION_CLUSTER_PATTERNS.filter(function(p) { return p.test(raw); }).length;
          if (actionCount < 3) return;
          var key = raw.slice(0, 300);
          if (seen.has(key)) return;
          seen.add(key);
          cards.push(node);
        });
      }
    }

    var items = cards.map(function(card, index) {
      var rawText = textOf(card);
      var rawLines = rawText.split(/\n+/).map(function(line) { return String(line || "").trim(); }).filter(Boolean);

      var links = Array.from(card.querySelectorAll('a[href*="/feed/update/"], a[href*="/posts/"], a[href*="/activity-"], a[href*="lnkd.in"]'));
      var url = normalizeUrl(links.map(function(link) { return String(link.href || "").trim(); }).find(Boolean) || "");

      var textNode = card.querySelector(".update-components-text, .feed-shared-update-v2__description, span.break-words, div[dir=\"ltr\"], [data-test-id=\"main-feed-activity-card__commentary\"]");
      var description = textNode ? textOf(textNode) : "";

      var dateNode = card.querySelector("time");
      var timestamp = dateNode ? attrOf(dateNode, "datetime") : "";
      var dateLabel = dateNode ? textOf(dateNode) : "";
      if (!dateLabel) {
        var dateSpan = Array.from(card.querySelectorAll("a, span")).find(function(n) {
          return /ago|just now|\d+\s*[hdwmy]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i.test(textOf(n));
        });
        if (dateSpan) dateLabel = textOf(dateSpan);
      }

      var authorNode = card.querySelector(".update-components-actor__title, .feed-shared-actor__name, .update-components-actor__meta, [data-test-id=\"actor-name\"], .feed-shared-actor__title");
      var author = authorNode ? textOf(authorNode) : "";

      var actionNode = card.querySelector(".update-components-actor__sub-description, .feed-shared-actor__sub-description, .update-components-header__text-view");
      var actionText = actionNode ? textOf(actionNode) : "";

      var media = Array.from(card.querySelectorAll("img[src*=\"media\"], img[src*=\"cloudfront\"]")).map(function(img) {
        return { url: String(img.currentSrc || img.src || "").trim(), alt: attrOf(img, "alt") };
      }).filter(function(m) { return m.url; });

      var metricsText = rawText;
      var metrics = extractMetricsFromText(metricsText);

      var decodedActivity = decodeLinkedInActivityId(url);
      var relativeDate = dateLabel ? parseRelativeDateLabel(dateLabel, generatedAt) : null;

      var repostMeta = detectRepostMeta(rawText, description, actionText);
      var postType = repostMeta.postType || detectPostType(media, description);

      var skippedReasons = [];
      if (!rawText && !description && !url) skippedReasons.push("empty card");

      return {
        capture_index: index,
        platform: "linkedin",
        page_type: pageType,
        post_type: postType,
        is_repost: repostMeta.isRepost,
        author: author,
        repost_author: repostMeta.repostAuthor,
        original_author: repostMeta.originalAuthor,
        repost_commentary: repostMeta.repostCommentary,
        original_post_excerpt: repostMeta.originalPostExcerpt,
        text: description,
        rawText: rawText,
        url: url,
        date_label: dateLabel,
        timestamp: timestamp || "",
        relative_date_label: relativeDate ? relativeDate.relativeLabel : "",
        decoded_post_date: decodedActivity ? decodedActivity.timestamp : "",
        decoded_post_date_confidence: decodedActivity ? decodedActivity.confidence : "",
        date_confidence: decodedActivity ? "activity_id" : relativeDate ? "relative_estimate" : "",
        metrics: metrics,
        media: media,
        media_urls: media.map(function(m) { return m.url; }),
        media_alt_texts: media.map(function(m) { return m.alt; }),
        source_url: window.location.href,
        exported_at: generatedAt
      };
    }).filter(function(item) {
      return item.rawText || item.text || item.url;
    });

    return {
      source: SOURCE_ID,
      generated_at: generatedAt,
      source_url: window.location.href,
      page_type: pageType,
      diagnostics: {
        pageUrl: window.location.href,
        pageType: pageType,
        selectorsTried: selectorsTried,
        selectorCounts: selectorCounts,
        cardsDetected: cards.length,
        itemsDetected: items.length,
        itemsWithRawText: items.filter(function(i) { return i.rawText; }).length,
        skippedReasons: [],
        sampleRawTextFirst300: items.slice(0, 3).map(function(i) { return (i.rawText || i.text || "").slice(0, 300); })
      },
      items: items
    };
  }

  function getDiagnostics() {
    var payload = collectPayload();
    return {
      ready: true,
      pageUrl: window.location.href,
      selectorsTried: payload.diagnostics.selectorsTried,
      selectorCounts: payload.diagnostics.selectorCounts,
      cardsDetected: payload.diagnostics.cardsDetected,
      itemsDetected: payload.diagnostics.itemsDetected,
      itemsWithRawText: payload.diagnostics.itemsWithRawText,
      sampleRawTextFirst300: payload.diagnostics.sampleRawTextFirst300,
      items: payload.items.length
    };
  }

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message === "ping" || (message && message.type === "ping")) {
      sendResponse({ ready: true, source: SOURCE_ID });
      return true;
    }
    if (message === "getDiagnostics" || (message && message.type === "getDiagnostics")) {
      sendResponse(getDiagnostics());
      return true;
    }
    if (message === "exportVisiblePosts" || message === "EXPORT_VISIBLE_POSTS" || (message && (message.type === "exportVisiblePosts" || message.type === "EXPORT_VISIBLE_POSTS"))) {
      var result = collectPayload();
      sendResponse(result);
      return true;
    }
    sendResponse({ error: "Unknown message: " + JSON.stringify(message) });
    return true;
  });
})();
