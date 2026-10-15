(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  if (!api?.storage || globalThis.__skipIntroInstalled) return;
  globalThis.__skipIntroInstalled = true;
  const core = globalThis.SkipIntroCore;
  const analysis = globalThis.SkipIntroAnalysis;
  const catalog = globalThis.SkipIntroCatalog;
  const host = document.createElement("skip-intro-overlay");
  host.style.cssText = "all:initial;position:fixed!important;z-index:2147483647!important;display:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme:light; }
    button { box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:11px;
      width:100%; height:100%; min-height:52px; padding:12px 22px; margin:0; cursor:pointer;
      font:600 18px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:-.45px;
      color:#080808; background:linear-gradient(145deg,#fffffff5,#ffffffe8); border:1px solid #ffffffd9;
      border-radius:12px; box-shadow:inset 0 1px 0 #fff,0 4px 20px #0003,0 1px 2px #0002;
      backdrop-filter:blur(22px) saturate(120%); -webkit-backdrop-filter:blur(22px) saturate(120%);
      transition:background .18s,box-shadow .18s,transform .18s; white-space:nowrap; }
    button:hover { background:#fff; box-shadow:inset 0 1px 0 #fff,0 6px 28px #0004; transform:translateY(-1px); }
    button:active { transform:scale(.97); }
    button:focus-visible { outline:2px solid white; outline-offset:4px; }
    svg { width:24px; height:24px; flex:none; fill:currentColor; }
    @media (prefers-reduced-motion:reduce) { button { transition:none; } }
    @media (prefers-reduced-transparency:reduce) { button { background:#fff; backdrop-filter:none; } }
    @media (forced-colors:active) { button { border:1px solid ButtonText; } }
  `;
  const button = document.createElement("button");
  button.type = "button"; button.lang = "en"; button.setAttribute("aria-label", "Skip intro");
  // Constant markup only; no text or markup from the website is inserted here.
  button.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 5v18l10-9z M12 5v18l10-9z M23 5h3v18h-3z"/></svg><span>Skip intro</span>';
  shadow.append(style, button);

  let enabled = false, running = false, selected = null, candidate = null, busy = false;
  let frameRequest = null, tickTimer = null, clickTimer = null, settingsRevision = 0;
  let route = location.href, mediaSource = "", lastRootScan = 0;
  const roots = new Map();
  const changedTracks = new Map();
  const jsonCache = new WeakMap();
  const nativeHooks = '[data-uia="player-skip-intro"],[data-testid="skip-intro"],[data-testid="skip-intro-button"],[data-action="skip-intro"]';

  function schedule() {
    if (!running || frameRequest !== null) return;
    frameRequest = requestAnimationFrame(() => { frameRequest = null; tick(); });
  }

  function discover(node) {
    if (node === host || node.nodeType !== 1) return;
    if (node.shadowRoot) observe(node.shadowRoot);
    for (const element of node.querySelectorAll("*")) {
      if (element !== host && element.shadowRoot) observe(element.shadowRoot);
    }
  }

  function observe(root) {
    if (roots.has(root)) return;
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) discover(node);
      schedule();
    });
    roots.set(root, observer);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("timeupdate", schedule, true);
    root.addEventListener("loadedmetadata", schedule, true);
    root.addEventListener("emptied", schedule, true);
    root.addEventListener("fullscreenchange", schedule);
    for (const element of root.querySelectorAll("*")) {
      if (element !== host && element.shadowRoot) observe(element.shadowRoot);
    }
  }

  function unobserve(root, observer) {
    observer.disconnect();
    root.removeEventListener("timeupdate", schedule, true);
    root.removeEventListener("loadedmetadata", schedule, true);
    root.removeEventListener("emptied", schedule, true);
    root.removeEventListener("fullscreenchange", schedule);
    roots.delete(root);
  }

  function suspend() {
    running = false;
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    clearInterval(tickTimer); clearTimeout(clickTimer);
    frameRequest = tickTimer = clickTimer = null;
    for (const [root, observer] of roots) unobserve(root, observer);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    restoreTracks(); analysis?.stop(); catalog?.stop();
    selected = candidate = null; busy = false; host.remove();
  }

  function resume() {
    if (!enabled || document.hidden || running) return;
    running = true; lastRootScan = 0;
    observe(document);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    tickTimer = setInterval(tick, 500);
    tick();
  }

  function setEnabled(value) {
    enabled = value;
    catalog?.setEnabled(value);
    if (enabled) resume(); else suspend();
  }

  function query(selector) {
    const result = [];
    for (const root of roots.keys()) result.push(...root.querySelectorAll(selector));
    return result;
  }

  function parentOf(element) {
    return element.parentElement || element.getRootNode()?.host || null;
  }

  function visible(element) {
    if (!element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
    for (let node = element; node; node = parentOf(node)) {
      const css = getComputedStyle(node);
      if (node.hidden || node.getAttribute("aria-hidden") === "true" || css.visibility === "hidden" || css.display === "none" || Number(css.opacity) === 0) return false;
    }
    return true;
  }

  function contains(container, element) {
    for (let node = element; node; node = parentOf(node)) if (node === container) return true;
    return false;
  }

  function restoreTracks() {
    for (const [track, mode] of changedTracks) if (track.mode === "hidden") track.mode = mode;
    changedTracks.clear();
  }

  function advertPlaying(video) {
    for (let node = video; node; node = parentOf(node)) {
      if (node.matches('.ad-showing,.vjs-ad-playing,[data-ad-playing="true"]')) return true;
    }
    return false;
  }

  function findNative(video, videos) {
    const rect = video.getBoundingClientRect();
    for (const element of query(`button,[role="button"],input[type="button"],${nativeHooks}`)) {
      const labeled = core.isSkipLabel(element.getAttribute("aria-label")) || core.isSkipLabel(element.textContent) || core.isSkipLabel(element.value);
      if ((!labeled && !element.matches(nativeHooks)) || element.disabled || element.getAttribute("aria-disabled") === "true" || !visible(element)) continue;
      const box = element.getBoundingClientRect();
      if (box.left < rect.left - 4 || box.right > rect.right + 4 || box.top < rect.top - 4 || box.bottom > rect.bottom + 4) continue;
      // Require a local player ancestor and an unambiguous video association.
      for (let parent = parentOf(video), depth = 0; parent && parent !== document.body && depth < 6; parent = parentOf(parent), depth++) {
        if (contains(parent, element)) {
          if (videos.filter(v => contains(parent, v)).length === 1) return element;
          break;
        }
      }
    }
    return null;
  }

  function readRanges(video) {
    const data = video.dataset;
    const result = [];
    const explicit = core.segment(data.skipIntroStart, data.skipIntroEnd, video.duration, "metadata");
    if (explicit) result.push(explicit);
    for (const track of Array.from(video.textTracks || [])) {
      if (track.kind !== "chapters" && track.kind !== "metadata") continue;
      if (track.mode === "disabled") { changedTracks.set(track, track.mode); track.mode = "hidden"; }
      try { result.push(...core.fromCues(track.cues, track.kind, video.duration)); } catch { /* Inaccessible track. */ }
    }
    for (const script of query('script[type="application/ld+json"]')) {
      const text = script.textContent;
      if (!text || text.length > 250000) continue;
      let cached = jsonCache.get(script);
      if (!cached || cached.text !== text) {
        try { cached = { text, value: JSON.parse(text) }; } catch { cached = { text, value: null }; }
        jsonCache.set(script, cached);
      }
      result.push(...core.fromStructuredData(cached.value, video.currentSrc, location.href, video.duration));
    }
    return result;
  }

  function seekable(video) {
    return Array.from({ length: video.seekable.length }, (_, i) => [video.seekable.start(i), video.seekable.end(i)]);
  }

  function detect(video, videos) {
    const native = findNative(video, videos);
    if (native) return { type: "native", element: native };
    const database = catalog?.getCandidate();
    const learned = database ? null : analysis?.getCandidate();
    const intro = [...readRanges(video), ...(database ? [database] : []), ...(learned ? [learned] : [])].find(range => core.seekTarget(range, video.currentTime, video.duration, seekable(video)) !== null);
    return intro ? { type: "range", intro } : null;
  }

  function tick() {
    candidate = null;
    host.style.display = "none";
    if (!running || !enabled || document.hidden) return;
    // Also discover roots attached to existing elements after initial insertion.
    if (performance.now() - lastRootScan > 3000) {
      for (const [root, observer] of roots) {
        if (root.host && !root.host.isConnected) unobserve(root, observer);
      }
      discover(document.documentElement);
      lastRootScan = performance.now();
    }
    const videos = query("video").filter(video => {
      const rect = video.getBoundingClientRect();
      return rect.width >= 240 && rect.height >= 120 && visible(video) && Number.isFinite(video.duration) && video.duration > 0;
    });
    const score = video => { const rect = video.getBoundingClientRect(); return rect.width * rect.height * (video.paused ? 1 : 4); };
    videos.sort((a, b) => score(b) - score(a));
    const next = videos[0] || null;
    if (next !== selected || route !== location.href || mediaSource !== next?.currentSrc) {
      restoreTracks(); selected = next; route = location.href; mediaSource = next?.currentSrc || "";
    }
    if (selected && advertPlaying(selected)) { analysis?.stop(); catalog?.stop(); return; }
    catalog?.select(selected);
    void analysis?.select(selected);
    if (!selected || busy) return;
    candidate = detect(selected, videos);
    if (!candidate) return;
    let fullscreen = document.fullscreenElement;
    while (fullscreen?.shadowRoot?.fullscreenElement) fullscreen = fullscreen.shadowRoot.fullscreenElement;
    if (fullscreen && (fullscreen === selected || !contains(fullscreen, selected))) { candidate = null; return; }
    const parent = fullscreen || document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
    const rect = selected.getBoundingClientRect();
    const anchor = candidate.type === "native" ? candidate.element.getBoundingClientRect() : null;
    const width = Math.max(196, Math.min(anchor?.width || 196, rect.width - 24));
    const height = Math.max(52, Math.min(anchor?.height || 52, 76));
    host.style.width = `${width}px`; host.style.height = `${height}px`;
    host.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, (anchor?.right || rect.right - 24) - width))}px`;
    host.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, (anchor?.top ?? rect.bottom - height - 64) - 16))}px`;
    host.style.display = "block";
  }

  button.addEventListener("click", () => {
    tick(); // Recheck the current player and signal immediately before acting.
    if (!candidate || !selected) return;
    const action = candidate;
    busy = true; host.style.display = "none";
    try {
      if (action.type === "native") action.element.click();
      else {
        const target = core.seekTarget(action.intro, selected.currentTime, selected.duration, seekable(selected));
        if (target !== null) selected.currentTime = target;
      }
    } catch { /* Leave playback alone if the player rejects the action. */ }
    clickTimer = setTimeout(() => { clickTimer = null; busy = false; tick(); }, 400);
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    settingsRevision++;
    setEnabled(changes.enabled.newValue !== false);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  api.storage.local.get("enabled").then(data => { if (!settingsRevision) setEnabled(data.enabled !== false); }).catch(() => { /* Stay idle when settings cannot be read. */ });
  // Legacy user-entered ranges are never read or used by the automatic detector.
  api.storage.local.get(null).then(data => {
    const keys = Object.keys(data).filter(key => key.startsWith("intro:"));
    if (keys.length) return api.storage.local.remove(keys);
  }).catch(() => {});
})();
