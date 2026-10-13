(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  if (!api?.storage || globalThis.__skipIntroInstalled) return;
  globalThis.__skipIntroInstalled = true;
  const core = globalThis.SkipIntroCore;
  const host = document.createElement("skip-intro-overlay");
  host.style.cssText = "all:initial;position:fixed!important;z-index:2147483647!important;display:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme: dark; }
    * { box-sizing: border-box; }
    .panel { font: 13px/1.5 system-ui,sans-serif; color:#f6f7fb; background:#141722f5; border:1px solid #ffffff2b; border-radius:14px; padding:10px; box-shadow:0 8px 32px #0006; width:242px; }
    button { font:inherit; cursor:pointer; border:0; border-radius:8px; padding:9px 12px; color:inherit; background:#ffffff14; }
    button:focus-visible, input:focus-visible, summary:focus-visible { outline:2px solid #a9ff78; outline-offset:3px; }
    button:hover { background:#ffffff25; }
    #skip { width:100%; background:#b9ff83; color:#15210f; font-weight:750; font-size:15px; }
    #skip:disabled { opacity:.55; cursor:wait; }
    summary { cursor:pointer; padding:6px 2px; color:#c4c9d8; }
    .row { display:flex; gap:6px; margin:8px 0; }
    .row button { flex:1; }
    p { margin:6px 0; font-size:12px; color:#b2b8ca; }
    label { display:block; flex:1; color:#b2b8ca; font-size:12px; }
    input { width:100%; margin-top:4px; font:inherit; background:#070a12; border:1px solid #ffffff30; border-radius:6px; padding:7px; color:#fff; }
    [hidden] { display:none!important; }
    #status { color:#cef4b6; }
  `;
  shadow.append(style);
  // This template is constant; page-provided strings are never interpolated as markup.
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <button id="skip" hidden>Skip intro →</button>
    <details><summary>Skip Intro · regola sigla</summary>
      <p id="source">Nessuna sigla riconosciuta. Puoi segnarla tu.</p>
      <div class="row"><button id="start">Segna inizio</button><button id="end">Segna fine</button></div>
      <form><div class="row">
        <label>Inizio (secondi)<input id="from" type="number" min="0" step="0.1" required></label>
        <label>Fine (secondi)<input id="to" type="number" min="2" step="0.1" required></label>
      </div><div class="row"><button type="submit">Salva</button><button id="forget" type="button">Dimentica</button></div></form>
      <p>Salvato solo in questo browser, per questo video. Il salto avviene solo al click.</p>
      <p id="status" role="status" aria-live="polite"></p>
    </details>`;
  shadow.append(panel);
  const $ = (id) => shadow.getElementById(id);
  let enabled = true, video = null, identity = null, storageKey = null;
  let saved = null, detected = null, pendingStart = null, generation = 0;
  let lastPointer = { x: -1, y: -1 }, hover = false, busy = false;
  const details = shadow.querySelector("details");
  const changedTracks = new Map();

  function reset() {
    generation++;
    saved = detected = pendingStart = storageKey = null;
    $("from").value = $("to").value = "";
    $("status").textContent = "";
    details.open = false;
  }

  async function select(next, videos) {
    const nextIdentity = next ? core.mediaIdentity(location.href, next.currentSrc, next.duration, videos.indexOf(next)) : null;
    if (next === video && nextIdentity === identity) return;
    video = next;
    identity = nextIdentity;
    reset();
    if (!identity) return;
    const version = generation;
    // Hash URLs, including query strings, rather than persisting raw URLs or signed tokens.
    // On insecure pages without SubtleCrypto the manual range stays in memory only.
    if (!globalThis.crypto?.subtle) return;
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
      const key = "intro:" + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const data = await api.storage.local.get(key);
      if (version !== generation) return;
      storageKey = key;
      const item = data[key];
      saved = item ? core.segment(item.start, item.end, video.duration, "manual") : null;
    } catch { /* The UI remains usable if storage is unavailable. */ }
  }

  function restoreTracks() {
    for (const [track, mode] of changedTracks) {
      if (track.mode === "hidden") track.mode = mode;
    }
    changedTracks.clear();
  }

  function detect() {
    if (!video || !Number.isFinite(video.duration)) return null;
    if (saved) return core.segment(saved.start, saved.end, video.duration, "manual");
    const data = video.dataset;
    const explicit = core.segment(data.skipIntroStart, data.skipIntroEnd, video.duration, "metadata");
    if (explicit) return explicit;
    for (const track of Array.from(video.textTracks || [])) {
      if (track.kind !== "chapters" && track.kind !== "metadata") continue;
      if (track.mode === "disabled") {
        changedTracks.set(track, track.mode);
        track.mode = "hidden"; // Load chapter cues without rendering them as subtitles.
      }
      const found = core.fromCues(track.cues, track.kind, video.duration);
      if (found) return found;
    }
    return null;
  }

  function ranges() {
    return Array.from({ length: video.seekable.length }, (_, i) => [video.seekable.start(i), video.seekable.end(i)]);
  }

  function tick() {
    if (!enabled || document.hidden) { host.style.display = "none"; return; }
    const videos = Array.from(document.querySelectorAll("video"));
    const candidates = videos.filter(v => {
      const r = v.getBoundingClientRect();
      return r.width >= 240 && r.height >= 120 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth &&
        getComputedStyle(v).visibility !== "hidden" && Number.isFinite(v.duration) && v.duration > 0;
    });
    candidates.sort((a, b) => {
      const score = v => { const r = v.getBoundingClientRect(); return r.width * r.height * (v.paused ? 1 : 4); };
      return score(b) - score(a);
    });
    const next = candidates[0] || null;
    if (next !== video) restoreTracks();
    void select(next, videos);
    if (!video || !identity) { host.style.display = "none"; return; }
    detected = detect();
    const isIntro = core.active(detected, video.currentTime);
    $("skip").hidden = !isIntro;
    $("skip").disabled = busy || (isIntro && core.seekTarget(detected, video.currentTime, video.duration, ranges()) === null);
    $("skip").textContent = $("skip").disabled ? "Sigla · attendo il video…" : "Skip intro →";
    $("source").textContent = detected
      ? `${detected.source === "manual" ? "Intervallo manuale" : "Sigla dai dati del video"}: ${core.formatTime(detected.start)} – ${core.formatTime(detected.end)}`
      : "Nessuna sigla riconosciuta. Puoi segnarla tu.";
    const rect = video.getBoundingClientRect();
    const pointerOver = lastPointer.x >= rect.left && lastPointer.x <= rect.right && lastPointer.y >= rect.top && lastPointer.y <= rect.bottom;
    const fullscreen = document.fullscreenElement;
    // A native fullscreen <video> cannot render DOM overlays; container fullscreen can.
    const allowed = !fullscreen || (fullscreen !== video && fullscreen.contains(video));
    const parent = fullscreen && allowed ? fullscreen : document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
    host.style.display = allowed && (isIntro || pointerOver || hover || details.open || shadow.activeElement) ? "block" : "none";
    const height = host.getBoundingClientRect().height || 60;
    host.style.left = `${Math.max(8, Math.min(innerWidth - 250, rect.right - 258))}px`;
    host.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, rect.bottom - height - 56))}px`;
  }

  async function save(start, end) {
    if (!video) return;
    const value = core.segment(start, end, video.duration, "manual");
    if (!value) { $("status").textContent = "Scegli un intervallo di 2–300 secondi, entro la durata del video."; return; }
    saved = value;
    pendingStart = null;
    $("from").value = value.start.toFixed(1);
    $("to").value = value.end.toFixed(1);
    const version = generation;
    try {
      if (storageKey) await api.storage.local.set({ [storageKey]: { start: value.start, end: value.end } });
      if (version === generation) $("status").textContent = storageKey ? "Sigla salvata per questo video." : "Sigla attiva per questa sessione; salvataggio locale non disponibile.";
    } catch {
      if (version === generation) $("status").textContent = "Sigla attiva; impossibile salvarla in questo browser.";
    }
    tick();
  }

  $("skip").addEventListener("click", () => {
    tick(); // Revalidate the selected media after a route or source change.
    if (!video || busy) return;
    const target = core.seekTarget(detect(), video.currentTime, video.duration, ranges());
    if (target === null) { $("status").textContent = "La fine della sigla non è ancora raggiungibile."; return; }
    try {
      video.currentTime = target;
      busy = true;
      setTimeout(() => { busy = false; tick(); }, 500);
      tick();
    } catch { $("status").textContent = "Questo player non consente il salto."; details.open = true; }
  });
  $("start").addEventListener("click", () => {
    if (!video) return;
    pendingStart = video.currentTime;
    $("from").value = pendingStart.toFixed(1);
    $("status").textContent = "Inizio segnato. Alla fine della sigla premi Segna fine.";
  });
  $("end").addEventListener("click", () => {
    if (pendingStart === null) { $("status").textContent = "Premi prima Segna inizio."; return; }
    void save(pendingStart, video.currentTime);
  });
  shadow.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    void save($("from").value, $("to").value);
  });
  $("forget").addEventListener("click", async () => {
    const key = storageKey, version = generation;
    saved = pendingStart = null;
    $("from").value = $("to").value = "";
    try {
      if (key) await api.storage.local.remove(key);
      if (version === generation) $("status").textContent = "Intervallo manuale rimosso. Restano i capitoli, se presenti.";
    } catch {
      if (version === generation) $("status").textContent = "Rimosso dalla sessione; impossibile cancellare il salvataggio.";
    }
    tick();
  });
  document.addEventListener("pointermove", event => { lastPointer = { x: event.clientX, y: event.clientY }; }, { passive: true });
  host.addEventListener("pointerenter", () => { hover = true; });
  host.addEventListener("pointerleave", () => { hover = false; });
  document.addEventListener("fullscreenchange", tick);
  document.addEventListener("visibilitychange", tick);
  document.addEventListener("timeupdate", event => { if (event.target === video) tick(); }, true);
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) restoreTracks();
    }
    if (storageKey && changes[storageKey]) {
      const value = changes[storageKey].newValue;
      saved = value && video ? core.segment(value.start, value.end, video.duration, "manual") : null;
    }
    tick();
  });
  api.storage.local.get("enabled").then(data => { enabled = data.enabled !== false; tick(); }).catch(() => tick());
  // Bounded polling also handles SPA navigation, replaced players, and newly loaded tracks.
  setInterval(tick, 500);
})();
