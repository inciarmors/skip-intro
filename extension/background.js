/* Metadata-only IntroDB requests. No site URLs, credentials, or media leave the browser. */
if (typeof importScripts === "function") importScripts("episode.js", "introdb.js");
const api = globalThis.browser || globalThis.chrome;
const episodes = globalThis.SkipIntroEpisode;
const cache = new Map(), pending = new Map(), controllers = new Set(), statuses = new Map();
let cooldownUntil = 0;
const ready = api.storage.session.get(["introdbCache", "introdbCooldownUntil"]).then(values => {
  if (Number.isFinite(values.introdbCooldownUntil)) cooldownUntil = Math.min(values.introdbCooldownUntil, Date.now() + 86400000);
  for (const entry of (Array.isArray(values.introdbCache) ? values.introdbCache : []).slice(-100)) {
    if (entry?.expires > Date.now() && /^tt\d{7,10}:\d+:\d+$/.test(entry.key)) cache.set(entry.key, entry);
  }
}).catch(() => {});
function remember(key, value, ttl) {
  cache.delete(key);
  cache.set(key, { key, value, expires: Date.now() + ttl });
  for (const [id, entry] of cache) if (entry.expires <= Date.now()) cache.delete(id);
  while (cache.size > 100) cache.delete(cache.keys().next().value);
  void api.storage.session.set({ introdbCache: [...cache.values()], introdbCooldownUntil: cooldownUntil }).catch(() => {});
  return value;
}
async function fetchIntro(episode) {
  const key = episodes.key(episode);
  const controller = new AbortController();
  controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL("https://api.introdb.app/segments");
    url.search = new URLSearchParams({ imdb_id: episode.imdbId, season: episode.season, episode: episode.episode });
    const response = await fetch(url.href, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal });
    if (response.status === 429) {
      const header = response.headers.get("Retry-After");
      const delay = /^\d+$/.test(header || "") ? Number(header) * 1000 : Date.parse(header) - Date.now();
      cooldownUntil = Date.now() + Math.max(60000, Math.min(Number.isFinite(delay) ? delay : 60000, 86400000));
      return remember(key, { status: "rate-limited" }, cooldownUntil - Date.now());
    }
    if (response.status === 404) return remember(key, { status: "not-found" }, 15 * 60000);
    if (!response.ok) throw new Error("IntroDB unavailable");
    const text = await response.text();
    if (text.length > 100000) throw new Error("Unexpected response size");
    const intro = globalThis.SkipIntroDB.parseResponse(JSON.parse(text), episode);
    return remember(key, intro ? { status: "ready", intro } : { status: "not-found" }, intro ? 6 * 3600000 : 15 * 60000);
  } catch {
    return remember(key, { status: "unavailable" }, 30000);
  } finally { clearTimeout(timeout); controllers.delete(controller); }
}
async function lookup(episode) {
  await ready;
  const key = episodes.key(episode), entry = cache.get(key);
  if (entry?.expires > Date.now()) return entry.value;
  if (Date.now() < cooldownUntil) return { status: "rate-limited" };
  if (!pending.has(key)) pending.set(key, fetchIntro(episode).finally(() => pending.delete(key)));
  return pending.get(key);
}
async function handle(message, sender) {
  if (message.type === "skip-intro:status" && !sender.tab) {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const status = statuses.get(tab?.id);
    return status && Date.now() - status.at < 15000 ? status.value : { status: "waiting" };
  }
  if (!Number.isInteger(sender.tab?.id)) return null;
  if (message.type === "skip-intro:tab-context") {
    const tab = await api.tabs.get(sender.tab.id);
    return { title: typeof tab.title === "string" ? tab.title.slice(0, 500) : "" };
  }
  if (message.type !== "skip-intro:lookup") return null;
  if ((await api.storage.local.get("enabled")).enabled === false) return { status: "disabled" };
  const context = await api.tabs.sendMessage(sender.tab.id, { type: "skip-intro:page-context" }, { frameId: 0 }).catch(() => null);
  const top = episodes.normalize(context?.episode), local = episodes.normalize(message.episode);
  const episode = top && local && episodes.key(top) !== episodes.key(local) ? null : local || top;
  let result = episode ? { ...await lookup(episode), episode } : { status: "missing-identity" };
  // A slow response must not apply the previous episode after top-frame navigation.
  if (top && episode) {
    const latest = await api.tabs.sendMessage(sender.tab.id, { type: "skip-intro:page-context" }, { frameId: 0 }).catch(() => null);
    if (latest?.route !== context?.route || episodes.key(episodes.normalize(latest?.episode)) !== episodes.key(top)) result = { status: "waiting" };
  }
  if ((await api.storage.local.get("enabled")).enabled === false) result = { status: "disabled" };
  statuses.set(sender.tab.id, { at: Date.now(), value: result });
  return result;
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== api.runtime.id || !["skip-intro:tab-context", "skip-intro:lookup", "skip-intro:status"].includes(message?.type)) return false;
  handle(message, sender).then(respond).catch(() => respond({ status: "unavailable" }));
  return true;
});
api.tabs.onRemoved.addListener(id => statuses.delete(id));
api.tabs.onUpdated.addListener((id, change) => { if (change.url || change.status === "loading") statuses.delete(id); });
api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled?.newValue === false) {
    for (const controller of controllers) controller.abort();
    statuses.clear();
  }
});
