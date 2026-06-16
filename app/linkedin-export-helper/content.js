(function() {
  "use strict";
  const SOURCE_ID = "stellarsync-linkedin-export-helper";
  const HELPER_VERSION = "0.1.1";

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

  const ACTION_CLUSTER_PATTERNS = [
    /like/i, /comment/i, /repost/i, /send/i,
    /view analytics/i, /promote/i, /impression/i
  ];

  const FALLBACK_SIGNAL_PATTERNS = [
    /like/i, /comment/i, /repost/i, /send/i,
    /view analytics/i, /impressions?/i,
    /reposted/i, /followers?/i,
    /edited/i, /\bago\b/i,
    /\b\d+[hdwmy]\b/i, /just now/i
  ];

  const DATE_LABEL_PATTERN = /\b(\d+\s*(h|hr|hrs|d|day|days|w|wk|wks|week|weeks|mo|mon|month|months|y|yr|yrs|year|years)\s*ago|just now|now)\b/i;

  function detectPageType() {
    var path = window.location.pathname;
    if (/^\/feed\//.test(path)) return "feed";
    if (/\/details\/activity/.test(path) || /\/details\/posts?/.test(path) || /\/recent-activity\//.test(path)) return "profile_activity";
    if (/^\/in\//.test(path)) return "profile";
    return "unknown";
  }

  function isNowLabel(label) {
    if (!label) return false;
    var s = String(label).trim().toLowerCase();
    return s === "just now" || s === "now" || s === "a few seconds ago";
  }

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
      return { timestamp: refDate.toISOString(), confidence: "relative_now", relativeLabel: str };
    }
    var match = str.match(/^(\d+)\s*(h|hr|hrs|d|day|days|w|wk|wks|week|weeks|mo|mon|month|months|y|yr|yrs|year|years)?\s*ago$/i);
    if (match) {
      var num = parseInt(match[1], 10);
      var unit = (match[2] || "h").toLowerCase();
      var ms = 0;
      if (/^h/.test(unit)) ms = num * 3600000;
      else if (/^d/.test(unit)) ms = num * 86400000;
      else if (/^w/.test(unit)) ms = num * 604800000;
      else if (/^m/.test(unit)) ms = num * 2592000000;
      else if (/^y/.test(unit)) ms = num * 31536000000;
      if (ms) {
        return { timestamp: new Date(refDate.getTime() - ms).toISOString(), confidence: "relative_estimate", relativeLabel: str };
      }
    }
    var shortMatch = str.match(/^(\d+)([hdwmy])$/i);
    if (shortMatch) {
      var snum = parseInt(shortMatch[1], 10);
      var sunit = shortMatch[2].toLowerCase();
      var sms = 0;
      if (sunit === "h") sms = snum * 3600000;
      else if (sunit === "d") sms = snum * 86400000;
      else if (sunit === "w") sms = snum * 604800000;
      else if (sunit === "m" || sunit === "mo") sms = snum * 2592000000;
      else if (sunit === "y") sms = snum * 31536000000;
      if (sms) {
        return { timestamp: new Date(refDate.getTime() - sms).toISOString(), confidence: "relative_estimate", relativeLabel: str };
      }
    }
    return null;
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

  function countSignalMatches(text) {
    if (!text) return 0;
    return FALLBACK_SIGNAL_PATTERNS.reduce(function(count, p) {
      return count + (p.test(text) ? 1 : 0);
    }, 0);
  }

  function expandToParentCard(node, maxClimb) {
    if (!node) return null;
    maxClimb = maxClimb || 6;
    var best = null;
    var bestScore = 0;
    var current = node.parentElement || node;
    for (var i = 0; i < maxClimb && current; i++) {
      var t = textOf(current);
      if (t.length > 100) {
        var score = t.length + countSignalMatches(t) * 200;
        if (score > bestScore) {
          bestScore = score;
          best = current;
        }
      }
      current = current.parentElement;
    }
    return best;
  }

  function findFallbackCandidates(root) {
    var candidates = [];
    var seen = new Set();
    var allElements = root ? Array.from(root.querySelectorAll("div, section, li, article, span, p")) : [];
    allElements.forEach(function(el) {
      var raw = textOf(el);
      if (!raw || raw.length < 120) return;
      var signalCount = countSignalMatches(raw);
      if (signalCount < 2) return;
      var expanded = expandToParentCard(el, 6);
      if (!expanded) return;
      var expandedText = textOf(expanded);
      var key = expandedText.slice(0, 300);
      if (seen.has(key)) return;
      seen.add(key);
      var expandScore = expandedText.length + countSignalMatches(expandedText) * 200;
      candidates.push({ node: expanded, text: expandedText, score: expandScore, signalCount: signalCount });
    });
    candidates.sort(function(a, b) { return b.score - a.score; });
    var deduped = [];
    var dedupSeen = new Set();
    candidates.forEach(function(c) {
      var k = c.text.slice(0, 300);
      if (dedupSeen.has(k)) return;
      dedupSeen.add(k);
      deduped.push(c.node);
    });
    return deduped;
  }

  function detectMediaType(el) {
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "video") return "video";
    if (tag === "img") {
      var src = String(el.src || el.currentSrc || "").toLowerCase();
      if (/\.(mp4|mov|avi|webm|m4v)/.test(src)) return "video";
      if (/document|thumbnail|doc|pdf|slide/i.test(src) || /document/i.test(attrOf(el, "alt") || "")) return "document_thumbnail";
      return "image";
    }
    return "unknown";
  }

  function captureCardMedia(card) {
    var results = [];
    var seenUrls = new Set();
    var imgElements = Array.from(card.querySelectorAll("img[src*=\"media\"], img[src*=\"cloudfront\"], img[src*=\"licdn\"], img[src*=\"linkedin\"]"));
    imgElements.forEach(function(img) {
      var url = String(img.currentSrc || img.src || "").trim();
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      var alt = attrOf(img, "alt");
      var w = img.naturalWidth || img.width || 0;
      var h = img.naturalHeight || img.height || 0;
      results.push({
        url: url,
        alt: alt,
        type: detectMediaType(img),
        width: w,
        height: h,
        source: "linkedin_dom"
      });
    });
    var videoElements = Array.from(card.querySelectorAll("video"));
    videoElements.forEach(function(video) {
      var url = String(video.currentSrc || video.src || "").trim();
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      var poster = String(video.poster || "").trim();
      var w = video.videoWidth || 0;
      var h = video.videoHeight || 0;
      var alt = attrOf(video, "aria-label") || attrOf(video, "alt") || "";
      results.push({
        url: url,
        alt: alt,
        type: "video",
        width: w,
        height: h,
        source: "linkedin_dom",
        posterUrl: poster || undefined
      });
    });
    var docThumbnails = Array.from(card.querySelectorAll("a[href*=\"/document/\"], a[href*=\"/documents/\"], [data-document-id]"));
    docThumbnails.forEach(function(docLink) {
      var thumbnail = docLink.querySelector("img[src]");
      var url = thumbnail ? String(thumbnail.currentSrc || thumbnail.src || "").trim() : "";
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        var alt = attrOf(thumbnail, "alt") || "Document preview";
        var w = thumbnail ? thumbnail.naturalWidth || thumbnail.width || 0 : 0;
        var h = thumbnail ? thumbnail.naturalHeight || thumbnail.height || 0 : 0;
        results.push({
          url: url,
          alt: alt,
          type: "document_thumbnail",
          width: w,
          height: h,
          source: "linkedin_dom"
        });
      }
    });
    return results;
  }

  function buildPostItem(card, index, generatedAt, pageType) {
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
    if (!dateLabel && rawText) {
      var dateMatch = rawText.match(DATE_LABEL_PATTERN);
      if (dateMatch) dateLabel = dateMatch[0];
    }
    var authorNode = card.querySelector(".update-components-actor__title, .feed-shared-actor__name, .update-components-actor__meta, [data-test-id=\"actor-name\"], .feed-shared-actor__title");
    var author = authorNode ? textOf(authorNode) : "";
    var actionNode = card.querySelector(".update-components-actor__sub-description, .feed-shared-actor__sub-description, .update-components-header__text-view");
    var actionText = actionNode ? textOf(actionNode) : "";
    var media = captureCardMedia(card);
    var metrics = extractMetricsFromText(rawText);
    var decodedActivity = decodeLinkedInActivityId(url);
    var relativeDate = dateLabel ? parseRelativeDateLabel(dateLabel, generatedAt) : null;
    var repostMeta = detectRepostMeta(rawText, description, actionText);
    var postType = repostMeta.postType || detectPostType(media, description);

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
      text: description || rawText,
      rawText: rawText,
      url: url,
      date_label: dateLabel,
      timestamp: timestamp || "",
      relative_date_label: relativeDate ? relativeDate.relativeLabel : "",
      decoded_post_date: decodedActivity ? decodedActivity.timestamp : (relativeDate ? relativeDate.timestamp : ""),
      decoded_post_date_confidence: decodedActivity ? decodedActivity.confidence : (relativeDate ? relativeDate.confidence : ""),
      date_confidence: decodedActivity ? "activity_id" : relativeDate ? "relative_estimate" : "",
      metrics: metrics,
      media: media,
      media_urls: media.map(function(m) { return m.url; }),
      media_alt_texts: media.map(function(m) { return m.alt; }),
      source_url: window.location.href,
      exported_at: generatedAt
    };
  }

  function collectPayload() {
    var generatedAt = new Date().toISOString();
    var selectorsTried = [];
    var selectorCounts = {};
    var seen = new Set();
    var cards = [];
    var pageType = detectPageType();
    var useFallback = false;

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

    if (cards.length === 0) {
      useFallback = true;
      var rootEl = document.querySelector("main") || document.body;
      if (rootEl) {
        var fallbackCandidates = findFallbackCandidates(rootEl);
        fallbackCandidates.forEach(function(node) {
          var raw = textOf(node);
          var key = raw.slice(0, 300);
          if (seen.has(key)) return;
          seen.add(key);
          cards.push(node);
        });
      }
    }

    var items = cards.map(function(card, index) {
      return buildPostItem(card, index, generatedAt, pageType);
    }).filter(function(item) {
      return item.rawText || item.text || item.url;
    });

    var bodyText = document.body ? textOf(document.body) : "";
    var mainText = document.querySelector("main") ? textOf(document.querySelector("main")) : "";
    var rootForCandidates = document.querySelector("main") || document.body;
    var allVisibleElements = rootForCandidates ? Array.from(rootForCandidates.querySelectorAll("div, section, li, article, span, p")) : [];
    var visibleTextCandidates = allVisibleElements.filter(function(el) {
      var t = textOf(el);
      return t.length > 80 && countSignalMatches(t) >= 1;
    });
    var autoPageTextFallbackUsed = false;
    if (!items.length) {
      var pageTextPayload = capturePageText();
      items = Array.isArray(pageTextPayload.items) ? pageTextPayload.items : [];
      useFallback = true;
      autoPageTextFallbackUsed = true;
    }

    var allMedia = items.reduce(function(acc, item) {
      return acc.concat(item.media || []);
    }, []);

    return {
      source: SOURCE_ID,
      helper_version: HELPER_VERSION,
      generated_at: generatedAt,
      source_url: window.location.href,
      page_type: pageType,
      used_fallback: useFallback,
      media_manifest: {
        total_items_with_media: items.filter(function(i) { return (i.media || []).length > 0; }).length,
        total_media_count: allMedia.length,
        media_types: allMedia.reduce(function(types, m) {
          types[m.type] = (types[m.type] || 0) + 1;
          return types;
        }, {}),
        items: items.filter(function(i) { return (i.media || []).length > 0; }).map(function(i) {
          return { capture_index: i.capture_index, media: i.media, linkedin_url: i.url };
        })
      },
      diagnostics: {
        pageUrl: window.location.href,
        pageType: pageType,
        selectorsTried: selectorsTried,
        selectorCounts: selectorCounts,
        cardsDetected: cards.length,
        itemsDetected: items.length,
        itemsWithRawText: items.filter(function(i) { return i.rawText; }).length,
        bodyTextLength: bodyText.length,
        mainTextLength: mainText.length,
        visibleTextCandidateCount: visibleTextCandidates.length,
        fallbackCandidatesDetected: autoPageTextFallbackUsed ? items.length : useFallback ? cards.length : 0,
        selectionTextLength: 0,
        sampleRawTextFirst300: items.slice(0, 3).map(function(i) { return (i.rawText || i.text || "").slice(0, 300); }),
        skippedReasons: autoPageTextFallbackUsed ? ["Selector and text-cluster detection found 0 posts; used page-text capture fallback"] : useFallback ? ["Selector-based detection found 0 cards; used text-cluster fallback"] : []
      },
      items: items
    };
  }

  function capturePageText() {
    var generatedAt = new Date().toISOString();
    var pageType = detectPageType();
    var root = document.querySelector("main") || document.body;
    if (!root) {
      return { source: SOURCE_ID, helper_version: HELPER_VERSION, generated_at: generatedAt, source_url: window.location.href, page_type: pageType, used_fallback: true, diagnostics: { error: "No page body found" }, items: [] };
    }
    var candidates = findFallbackCandidates(root);
    if (!candidates.length) {
      var allText = textOf(root);
      var blocks = allText.split(/\n{3,}/).filter(function(b) { return b.trim().length > 120; });
      blocks.forEach(function(block, idx) {
        var tempDiv = document.createElement("div");
        tempDiv.textContent = block;
        candidates.push(tempDiv);
      });
    }
    var seen = new Set();
    var items = [];
    candidates.forEach(function(node, index) {
      var rawText = textOf(node);
      var key = rawText.slice(0, 300);
      if (seen.has(key)) return;
      seen.add(key);
      var repostMeta = detectRepostMeta(rawText, "", "");
      var metrics = extractMetricsFromText(rawText);
      var dateLabel = "";
      var dateMatch = rawText.match(DATE_LABEL_PATTERN);
      if (dateMatch) dateLabel = dateMatch[0];
      var relativeDate = dateLabel ? parseRelativeDateLabel(dateLabel, generatedAt) : null;
      items.push({
        capture_index: index,
        platform: "linkedin",
        page_type: pageType,
        post_type: repostMeta.postType || "text",
        is_repost: repostMeta.isRepost,
        author: "",
        repost_author: repostMeta.repostAuthor,
        original_author: repostMeta.originalAuthor,
        repost_commentary: repostMeta.repostCommentary,
        original_post_excerpt: repostMeta.originalPostExcerpt,
        text: rawText,
        rawText: rawText,
        url: "",
        date_label: dateLabel,
        timestamp: "",
        relative_date_label: relativeDate ? relativeDate.relativeLabel : "",
        decoded_post_date: relativeDate ? relativeDate.timestamp : "",
        decoded_post_date_confidence: relativeDate ? relativeDate.confidence : "",
        date_confidence: relativeDate ? "relative_estimate" : "",
        source_type: "linkedin_page_text_capture",
        source_type_label: "Page text capture",
        metrics: metrics,
        media: [],
        media_urls: [],
        media_alt_texts: [],
        source_url: window.location.href,
        exported_at: generatedAt,
        warning: "Review before import. This post was extracted from visible page text, not from a detected post card."
      });
    });
    return {
      source: SOURCE_ID,
      helper_version: HELPER_VERSION,
      generated_at: generatedAt,
      source_url: window.location.href,
      page_type: pageType,
      used_fallback: true,
      capture_mode: "page_text",
      diagnostics: {
        pageUrl: window.location.href,
        pageType: pageType,
        bodyTextLength: document.body ? textOf(document.body).length : 0,
        mainTextLength: document.querySelector("main") ? textOf(document.querySelector("main")).length : 0,
        fallbackCandidatesDetected: items.length,
        sampleRawTextFirst300: items.slice(0, 3).map(function(i) { return (i.rawText || "").slice(0, 300); })
      },
      items: items
    };
  }

  function captureSelectedText() {
    var generatedAt = new Date().toISOString();
    var pageType = detectPageType();
    var sel = window.getSelection();
    var selText = sel ? String(sel.toString()).trim() : "";
    if (!selText) {
      return { source: SOURCE_ID, helper_version: HELPER_VERSION, generated_at: generatedAt, source_url: window.location.href, page_type: pageType, capture_mode: "selected_text", diagnostics: { selectionTextLength: 0, error: "No text selected. Highlight posts on the LinkedIn page first." }, items: [] };
    }
    var blocks = selText.split(/\n{3,}/).filter(function(b) { return b.trim().length > 50; });
    if (!blocks.length) blocks = [selText];
    var seen = new Set();
    var items = [];
    blocks.forEach(function(block, index) {
      var rawText = block.trim();
      var key = rawText.slice(0, 300);
      if (seen.has(key)) return;
      seen.add(key);
      var repostMeta = detectRepostMeta(rawText, "", "");
      var metrics = extractMetricsFromText(rawText);
      var dateLabel = "";
      var dateMatch = rawText.match(DATE_LABEL_PATTERN);
      if (dateMatch) dateLabel = dateMatch[0];
      var relativeDate = dateLabel ? parseRelativeDateLabel(dateLabel, generatedAt) : null;
      items.push({
        capture_index: index,
        platform: "linkedin",
        page_type: pageType,
        post_type: repostMeta.postType || "text",
        is_repost: repostMeta.isRepost,
        author: "",
        repost_author: repostMeta.repostAuthor,
        original_author: repostMeta.originalAuthor,
        repost_commentary: repostMeta.repostCommentary,
        original_post_excerpt: repostMeta.originalPostExcerpt,
        text: rawText,
        rawText: rawText,
        url: "",
        date_label: dateLabel,
        timestamp: "",
        relative_date_label: relativeDate ? relativeDate.relativeLabel : "",
        decoded_post_date: relativeDate ? relativeDate.timestamp : "",
        decoded_post_date_confidence: relativeDate ? relativeDate.confidence : "",
        date_confidence: relativeDate ? "relative_estimate" : "",
        source_type: "linkedin_selected_text",
        source_type_label: "Selected text capture",
        metrics: metrics,
        media: [],
        media_urls: [],
        media_alt_texts: [],
        source_url: window.location.href,
        exported_at: generatedAt,
        warning: "Review before import. This post was extracted from user-selected text."
      });
    });
    return {
      source: SOURCE_ID,
      helper_version: HELPER_VERSION,
      generated_at: generatedAt,
      source_url: window.location.href,
      page_type: pageType,
      used_fallback: true,
      capture_mode: "selected_text",
      diagnostics: {
        pageUrl: window.location.href,
        pageType: pageType,
        selectionTextLength: selText.length,
        fallbackCandidatesDetected: items.length,
        sampleRawTextFirst300: items.slice(0, 3).map(function(i) { return (i.rawText || "").slice(0, 300); })
      },
      items: items
    };
  }

  function captureMediaManifest() {
    var full = collectPayload();
    return {
      source: SOURCE_ID,
      helper_version: HELPER_VERSION,
      generated_at: full.generated_at,
      source_url: full.source_url,
      page_type: full.page_type,
      media_manifest: full.media_manifest,
      items: full.items,
      diagnostics: full.diagnostics
    };
  }

  function getDiagnostics() {
    var diag = collectPayload().diagnostics;
    diag.selectionTextLength = window.getSelection() ? String(window.getSelection().toString()).trim().length : 0;
    return {
      ready: true,
      helperVersion: HELPER_VERSION,
      pageUrl: diag.pageUrl,
      pageType: diag.pageType,
      selectorsTried: diag.selectorsTried,
      selectorCounts: diag.selectorCounts,
      cardsDetected: diag.cardsDetected,
      itemsDetected: diag.itemsDetected,
      itemsWithRawText: diag.itemsWithRawText,
      bodyTextLength: diag.bodyTextLength,
      mainTextLength: diag.mainTextLength,
      visibleTextCandidateCount: diag.visibleTextCandidateCount,
      fallbackCandidatesDetected: diag.fallbackCandidatesDetected,
      selectionTextLength: diag.selectionTextLength,
      sampleRawTextFirst300: diag.sampleRawTextFirst300
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
    if (message === "capturePageText" || (message && message.type === "capturePageText")) {
      sendResponse(capturePageText());
      return true;
    }
    if (message === "captureSelectedText" || (message && message.type === "captureSelectedText")) {
      sendResponse(captureSelectedText());
      return true;
    }
    if (message === "captureMediaManifest" || (message && message.type === "captureMediaManifest")) {
      sendResponse(captureMediaManifest());
      return true;
    }
    sendResponse({ error: "Unknown message: " + JSON.stringify(message) });
    return true;
  });
})();
