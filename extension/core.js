/* Pure detection logic shared by the extension and tests. No network access. */
(() => {
  "use strict";
  const labels = /^(intro|introduction|opening|opening credits|title sequence|sigla|sigla iniziale|introduzione|générique|generique|introducción|introduccion|abertura|vorspann)$/i;

  function segment(start, end, duration, source = "chapters") {
    const numeric = value => typeof value === "number" || (typeof value === "string" && value.trim() !== "");
    if (!numeric(start) || !numeric(end)) return null;
    start = Number(start);
    end = Number(end);
    if (![start, end, duration].every(Number.isFinite) || duration <= 0 ||
        start < 0 || end - start < 2 || end - start > 300 || end > duration) return null;
    return { start, end, source };
  }

  function fromCues(cues, kind, duration) {
    if (kind !== "chapters" && kind !== "metadata") return null;
    for (const cue of cues || []) {
      const text = String(cue.text || "").trim();
      if (labels.test(text)) {
        const found = segment(cue.startTime, cue.endTime, duration, "chapters");
        if (found) return found;
      }
      if (kind === "metadata") {
        try {
          const data = JSON.parse(text);
          if (data?.type === "intro") {
            const found = segment(data.start ?? cue.startTime, data.end ?? cue.endTime, duration, "metadata");
            if (found) return found;
          }
        } catch { /* Non-intro metadata is expected. */ }
      }
    }
    return null;
  }

  function active(intro, time) {
    return Boolean(intro && Number.isFinite(time) && time >= intro.start && time < intro.end);
  }

  function seekTarget(intro, time, duration, ranges) {
    if (!intro || !segment(intro.start, intro.end, duration) || !active(intro, time)) return null;
    // Never jump to a different part of a live/DVR window or an unavailable range.
    for (const [start, end] of ranges) {
      if (intro.end >= start && intro.end <= end) return intro.end;
    }
    return null;
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(value || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function mediaIdentity(page, src, duration, index) {
    if (!Number.isFinite(duration) || duration <= 0) return null;
    // Object URLs are session-specific; the page, duration and player index identify those streams.
    const media = !src || src.startsWith("blob:") ? "stream" : src;
    return JSON.stringify([page, media, Math.round(duration * 10), index]);
  }

  globalThis.SkipIntroCore = Object.freeze({ segment, fromCues, active, seekTarget, formatTime, mediaIdentity });
})();
