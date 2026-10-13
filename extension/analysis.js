/* Live, bounded browser analysis. Raw frames/audio exist only in temporary memory. */
(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const { Matcher } = globalThis.SkipIntroFingerprint;
  const MAX_TIME = 600;
  let video = null, identity = "", libraryKey = null, matcher = null, version = 0;
  let stream = null, context = null, source = null, analyser = null;
  let lastSecond = -1, lastSave = 0, acquiring = false, audioUnavailable = false, visualUnavailable = false;
  let canvas = null, canvasContext = null, frequency = null;
  let tabTitle = "", lastContextRead = 0, contextPending = false;
  let sampleTimer = null;
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, "0")).join("");

  function releaseCapture() {
    // These are clones owned by captureStream(), not the player's source tracks.
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    source?.disconnect(); source = analyser = frequency = null;
    if (context) void context.close().catch(() => {});
    context = null; canvas = canvasContext = null;
  }
  function persist() {
    if (!libraryKey || !matcher || matcher.samples.length < 8) return;
    const key = libraryKey;
    const value = { ...matcher.snapshot(), updatedAt: Date.now() };
    void api.storage.local.set({ [key]: value }).catch(() => {});
    lastSave = Date.now();
  }
  function stop() {
    clearInterval(sampleTimer); sampleTimer = null;
    document.removeEventListener("pointerdown", resumeAudio);
    document.removeEventListener("keydown", resumeAudio);
    persist(); version++; releaseCapture();
    video = null; identity = ""; libraryKey = matcher = null;
    lastSecond = -1; audioUnavailable = visualUnavailable = false; acquiring = false;
  }
  function seriesIdentity(next) {
    // Only explicit series metadata or recognizable episode-style titles are grouped.
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (script.textContent.length > 250000) continue;
      try {
        const value = JSON.parse(script.textContent);
        const nodes = Array.isArray(value) ? value : value["@graph"] || [value];
        for (const node of nodes) {
          const name = node?.partOfSeries?.name;
          if (typeof name === "string" && name.trim() && typeof node.contentUrl === "string" && new URL(node.contentUrl, location.href).href === next.currentSrc) return `${location.hostname}|${name.trim().toLowerCase()}`;
        }
      } catch { /* Ignore unrelated or malformed metadata. */ }
    }
    const titles = [document.title, next.getAttribute("aria-label") || "", next.title || "", tabTitle];
    try { if (window.parent !== window) titles.push(window.parent.document.title); } catch { /* Cross-origin parent. */ }
    for (const value of titles) {
      const title = value.replace(/^watch\s+/i, "");
      const match = title.match(/^(.+?)\s+(?:s\d+\s*[:.\-]?\s*e\d+|season\s+\d+\s*[,.:\-]?\s*episode\s+\d+)\b/i);
      if (match) return `${location.hostname}|${match[1].trim().toLowerCase()}`;
    }
    return null;
  }
  function refreshContext(next) {
    if (!api.runtime?.sendMessage || contextPending || Date.now() - lastContextRead < 5000) return;
    contextPending = true; lastContextRead = Date.now();
    api.runtime.sendMessage({ type: "skip-intro:tab-context" }).then(value => {
      if (video === next && typeof value?.title === "string") tabTitle = value.title;
    }).catch(() => {}).finally(() => { contextPending = false; });
  }
  async function select(next) {
    if (!next) { if (video) stop(); return; }
    refreshContext(next);
    const series = seriesIdentity(next);
    let mediaPath = "stream";
    try { if (!next.currentSrc.startsWith("blob:")) { const url = new URL(next.currentSrc); mediaPath = `${url.origin}${url.pathname}`; } } catch { /* No stable source path. */ }
    const id = `${series}|${tabTitle || document.title}|${mediaPath}|${Math.round(next.duration)}`;
    if (video === next && identity === id) return;
    stop(); video = next; identity = id;
    const current = version;
    if (!series || !globalThis.crypto?.subtle) return;
    try {
      const [groupHash, episodeHash] = await Promise.all([digest(series), digest(id)]);
      const key = `fingerprints:v1:${groupHash}`;
      const values = await api.storage.local.get(key);
      if (current !== version) return;
      libraryKey = key; matcher = new Matcher(values[key], episodeHash);
      sampleTimer = setInterval(sample, 250);
      document.addEventListener("pointerdown", resumeAudio, { passive: true });
      document.addEventListener("keydown", resumeAudio, { passive: true });
      // Keep at most twelve series, with at most four sampled episodes/templates each.
      const all = await api.storage.local.get(null);
      if (current !== version) return;
      const stale = Object.keys(all).filter(k => k.startsWith("fingerprints:v1:") && k !== key)
        .sort((a, b) => (all[b]?.updatedAt || 0) - (all[a]?.updatedAt || 0)).slice(11);
      if (stale.length) await api.storage.local.remove(stale);
    } catch { /* Playback and metadata detection remain available. */ }
  }
  async function acquireAudio() {
    if (acquiring || stream || audioUnavailable || !video) return;
    acquiring = true;
    const current = version;
    try {
      const capture = video.captureStream || video.mozCaptureStream;
      if (!capture) { audioUnavailable = true; return; }
      stream = capture.call(video);
      // Video descriptors come from a tiny canvas, not a captured recording.
      stream.getVideoTracks().forEach(track => { stream.removeTrack(track); track.stop(); });
      if (!stream.getAudioTracks().length) { releaseCapture(); audioUnavailable = true; return; }
      context = new AudioContext();
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser); // Never route audio to output or replace the player's audio source.
      frequency = new Float32Array(analyser.frequencyBinCount);
      await context.resume();
      if (current !== version) return;
    } catch { if (current === version) { releaseCapture(); audioUnavailable = true; } }
    finally { if (current === version) acquiring = false; }
  }
  function visualDescriptor() {
    if (visualUnavailable) return null;
    try {
      if (!canvas) { canvas = document.createElement("canvas"); canvas.width = 9; canvas.height = 8; canvasContext = canvas.getContext("2d", { willReadFrequently: true }); }
      canvasContext.drawImage(video, 0, 0, 9, 8);
      const pixels = canvasContext.getImageData(0, 0, 9, 8).data;
      const luminance = Array.from({ length: 72 }, (_, i) => pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114);
      const mean = luminance.reduce((a, b) => a + b, 0) / 72;
      const variance = luminance.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 72;
      if (mean < 8 || mean > 247 || variance < 150) return null;
      let hash = "", nibble = 0, count = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        nibble = (nibble << 1) | Number(luminance[y * 9 + x] > luminance[y * 9 + x + 1]);
        if (++count % 4 === 0) { hash += nibble.toString(16); nibble = 0; }
      }
      return hash;
    } catch { visualUnavailable = true; canvas = canvasContext = null; return null; }
  }
  function audioDescriptor() {
    if (!analyser || context?.state !== "running") return null;
    analyser.getFloatFrequencyData(frequency);
    const bands = [];
    const nyquist = context.sampleRate / 2;
    for (let i = 0; i < 32; i++) {
      const low = Math.max(1, Math.floor(60 * (Math.min(10000, nyquist) / 60) ** (i / 32) / nyquist * frequency.length));
      const high = Math.max(low + 1, Math.floor(60 * (Math.min(10000, nyquist) / 60) ** ((i + 1) / 32) / nyquist * frequency.length));
      let sum = 0;
      for (let bin = low; bin < Math.min(high, frequency.length); bin++) sum += Number.isFinite(frequency[bin]) ? frequency[bin] : -100;
      bands.push(sum / Math.max(1, Math.min(high, frequency.length) - low));
    }
    const peak = Math.max(...bands);
    if (peak < -65 || !Number.isFinite(peak)) return null;
    return bands.map(value => Math.round(Math.max(0, Math.min(15, (value - peak + 60) / 4))).toString(16)).join("");
  }
  function sample() {
    if (!video || !matcher || document.hidden || video.paused || video.seeking || video.readyState < 2) {
      if (video?.paused || document.hidden || video?.seeking) { releaseCapture(); matcher?.interrupt(); lastSecond = -1; }
      return;
    }
    if (video.currentTime > MAX_TIME) { if (lastSecond !== -2) persist(); lastSecond = -2; releaseCapture(); return; }
    const second = Math.floor(video.currentTime);
    if (second === lastSecond) return;
    lastSecond = second;
    void acquireAudio();
    const v = visualDescriptor(), a = audioDescriptor();
    matcher.add({ t: video.currentTime, v, a });
    if (matcher.dirty || Date.now() - lastSave > 15000) { matcher.dirty = false; persist(); }
  }
  function getCandidate() {
    const candidate = matcher?.candidate;
    if (!video || video.paused || !candidate || Math.abs(video.currentTime - candidate.observedAt) > 1.8) return null;
    return candidate;
  }
  function resumeAudio() { if (context?.state === "suspended") void context.resume().catch(() => {}); }
  window.addEventListener("pagehide", stop);
  globalThis.SkipIntroAnalysis = Object.freeze({ select, stop, getCandidate });
})();
