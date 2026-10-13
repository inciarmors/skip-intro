/* Bridge explicit page identities to player frames through extension messaging. */
(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const episodes = globalThis.SkipIntroEpisode;
  let video = null, identity = "", result = null, lastRead = 0, lastReply = 0, generation = 0, pending = false;
  let navigationPage = null;
  let enabled = false;
  function navigate(event) {
    try { navigationPage = JSON.parse(JSON.stringify(event.detail?.page)); } catch { navigationPage = null; }
    stop();
  }
  function setEnabled(value) {
    if (enabled === value) return;
    enabled = value;
    if (enabled) document.addEventListener("inertia:navigate", navigate);
    else { document.removeEventListener("inertia:navigate", navigate); navigationPage = null; stop(); }
  }
  function readEpisode() {
    return episodes.fromPage(navigationPage, location.href, document.title) || episodes.readDocument();
  }
  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "skip-intro:page-context") return false;
    respond({ episode: enabled ? readEpisode() : null, route: location.href });
    return false;
  });
  function stop() {
    generation++; video = null; identity = ""; result = null; lastRead = lastReply = 0; pending = false;
  }
  function select(next) {
    if (!enabled) return;
    if (!next) { if (video) stop(); return; }
    const episode = readEpisode();
    const id = `${location.href}|${document.title}|${next.currentSrc}|${next.duration}|${episodes.key(episode)}`;
    if (video !== next || identity !== id) { stop(); video = next; identity = id; }
    if (pending || Date.now() - lastRead < 2000) return;
    pending = true; lastRead = Date.now();
    const current = generation;
    api.runtime.sendMessage({ type: "skip-intro:lookup", episode, durationMs: Math.round(next.duration * 1000) }).then(value => {
      if (current !== generation) return;
      result = value; lastReply = Date.now();
    }).catch(() => { if (current === generation) result = null; }).finally(() => { if (current === generation) pending = false; });
  }
  function getCandidate() {
    if (!video || result?.status !== "ready" || Date.now() - lastReply > 4000) return null;
    const intros = result.intros || (result.intro ? [result.intro] : []);
    const valid = intros.map(intro => globalThis.SkipIntroCore.segment(intro.start, intro.end, video.duration, intro.source)).filter(Boolean);
    return valid.find(intro => globalThis.SkipIntroCore.active(intro, video.currentTime)) || valid[0] || null;
  }
  window.addEventListener("pagehide", stop);
  globalThis.SkipIntroCatalog = Object.freeze({ select, stop, getCandidate, setEnabled });
})();
