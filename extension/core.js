/* Deterministic intro signals only. No media analysis, downloads, or inference. */
(() => {
  "use strict";
  const introLabel = /^(intro|introduction|opening|opening credits|title sequence)$/i;
  const skipLabel = /^skip (intro|introduction|opening|opening credits)$/i;
  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const hasType = (value, type) => list(value?.["@type"]).includes(type);

  function segment(start, end, duration, source = "chapters") {
    const numeric = value => typeof value === "number" || (typeof value === "string" && value.trim() !== "");
    if (!numeric(start) || !numeric(end)) return null;
    start = Number(start); end = Number(end);
    if (![start, end, duration].every(Number.isFinite) || duration <= 0 ||
        start < 0 || end - start < 2 || end - start > 300 || end > duration) return null;
    return { start, end, source };
  }

  function fromCues(cues, kind, duration) {
    if (kind !== "chapters" && kind !== "metadata") return [];
    const result = [];
    for (const cue of cues || []) {
      const text = String(cue.text || "").trim();
      if (introLabel.test(text)) {
        const found = segment(cue.startTime, cue.endTime, duration, kind);
        if (found) result.push(found);
      } else if (kind === "metadata") {
        try {
          const data = JSON.parse(text);
          if (data?.type === "intro") {
            const found = segment(data.start ?? cue.startTime, data.end ?? cue.endTime, duration, "metadata");
            if (found) result.push(found);
          }
        } catch { /* Unrelated metadata is expected. */ }
      }
    }
    return result;
  }

  function fromStructuredData(data, mediaURL, pageURL, duration) {
    const nodes = list(data).flatMap(node => node?.["@graph"] ? list(node["@graph"]) : [node]);
    const absolute = value => {
      if (typeof value !== "string" || !value) return null;
      try { return new URL(value, pageURL).href; } catch { return null; }
    };
    const result = [];
    for (const node of nodes) {
      // Require an exact media match; page-wide chapters could describe a different video.
      if (!hasType(node, "VideoObject") || !mediaURL || absolute(node.contentUrl) !== mediaURL) continue;
      for (const part of list(node.hasPart)) {
        if (!hasType(part, "Clip") || !introLabel.test(String(part.name || "").trim())) continue;
        const found = segment(part.startOffset, part.endOffset, duration, "structured-data");
        if (found) result.push(found);
      }
    }
    return result;
  }

  function active(intro, time) {
    return Boolean(intro && Number.isFinite(time) && time >= intro.start && time < intro.end);
  }

  function seekTarget(intro, time, duration, ranges) {
    if (!intro || !segment(intro.start, intro.end, duration) || !active(intro, time)) return null;
    for (const [start, end] of ranges) {
      if (intro.end >= start && intro.end <= end) return intro.end;
    }
    return null;
  }

  function isSkipLabel(text) {
    return skipLabel.test(String(text || "").replace(/\s+/g, " ").trim());
  }

  globalThis.SkipIntroCore = Object.freeze({ segment, fromCues, fromStructuredData, active, seekTarget, isSkipLabel });
})();
