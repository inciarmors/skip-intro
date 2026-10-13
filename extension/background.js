/* Metadata-only catalog requests. Browser-managed, non-persistent background. */
if (typeof importScripts === "function") importScripts("episode.js", "introdb.js");
const api = globalThis.browser || globalThis.chrome;
const episodes = globalThis.SkipIntroEpisode;
const providers = globalThis.SkipIntroDB.providers;
const cache = new Map(), pending = new Map(), controllers = new Set(), statuses = new Map();
const cooldowns = {};
let enabled = false, generation = 0;
const ready = Promise.all([
  api.storage.local.get("enabled").then(value => { if (!generation) enabled = value.enabled !== false; }),
  api.storage.session.get(["catalogCache", "catalogCooldowns"]).then(values => {
    for (const provider of providers) {
      const until = values.catalogCooldowns?.[provider.id];
      if (Number.isFinite(until)) cooldowns[provider.id] = Math.min(until, Date.now() + 86400000);
    }
    for (const entry of (Array.isArray(values.catalogCache) ? values.catalogCache : []).slice(-100)) {
      if (entry?.expires > Date.now() && typeof entry.key === "string" && entry.key.length < 150) cache.set(entry.key, entry);
    }
  }).catch(() => {})
]).catch(() => { enabled = false; });
const active = token => enabled && token === generation;
const disabled = () => ({ status: "disabled" });
function remember(key, value, ttl, token) {
  if (!active(token)) return disabled();
  cache.delete(key);
  cache.set(key, { key, value, expires: Date.now() + ttl });
  for (const [id, entry] of cache) if (entry.expires <= Date.now()) cache.delete(id);
  while (cache.size > 100) cache.delete(cache.keys().next().value);
  void api.storage.session.set({ catalogCache: [...cache.values()], catalogCooldowns: cooldowns }).catch(() => {});
  return value;
}
function retryDelay(response) {
  const header = response.headers.get("Retry-After");
  const retry = /^\d+$/.test(header || "") ? Number(header) * 1000 : Date.parse(header) - Date.now();
  const resets = ["X-RateLimit-Reset", "X-UsageLimit-Reset"].map(name => {
    if (response.headers.get(name.replace("Reset", "Remaining")) !== "0") return 0;
    const raw = response.headers.get(name);
    return /^\d+$/.test(raw || "") ? Number(raw) * 1000 : 0;
  });
  return Math.max(60000, Math.min(Math.max(Number.isFinite(retry) ? retry : 0, ...resets), 86400000));
}
async function fetchProvider(provider, episode, durationMs, key, token) {
  if (!active(token)) return disabled();
  const controller = new AbortController();
  controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 8000);
  const result = status => ({ status, provider: provider.id });
  try {
    const response = await fetch(provider.url(episode, durationMs), { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal });
    if (!active(token)) return disabled();
    if (response.status === 429) {
      const delay = retryDelay(response);
      cooldowns[provider.id] = Date.now() + delay;
      return remember(key, result("rate-limited"), delay, token);
    }
    if (response.status === 404) return remember(key, result("not-found"), 15 * 60000, token);
    if (!response.ok) throw new Error("Catalog unavailable");
    const text = await response.text();
    if (!active(token)) return disabled();
    if (text.length > 100000) throw new Error("Unexpected response size");
    const intros = provider.parse(JSON.parse(text), episode);
    const value = intros.length ? { ...result("ready"), intros } : result("not-found");
    return remember(key, value, intros.length ? 6 * 3600000 : 15 * 60000, token);
  } catch {
    return remember(key, result("unavailable"), 30000, token);
  } finally { clearTimeout(timeout); controllers.delete(controller); }
}
async function lookupProvider(provider, episode, durationMs, token) {
  if (!active(token)) return disabled();
  if (provider.supports && !provider.supports(episode)) return { status: "unsupported", provider: provider.id };
  const key = `${provider.id}:${episodes.key(episode)}:${provider.id === "theintrodb" ? `${episode.tmdbId || 0}:${durationMs || 0}` : "0"}`;
  const entry = cache.get(key);
  if (entry?.expires > Date.now()) return entry.value;
  if (Date.now() < (cooldowns[provider.id] || 0)) return { status: "rate-limited", provider: provider.id };
  const requestKey = `${token}:${key}`;
  if (!pending.has(requestKey)) pending.set(requestKey, fetchProvider(provider, episode, durationMs, key, token).finally(() => pending.delete(requestKey)));
  return pending.get(requestKey);
}
async function lookup(episode, durationMs, token) {
  const attempts = [];
  for (const provider of providers) {
    if (!active(token)) return disabled();
    const value = await lookupProvider(provider, episode, durationMs, token);
    if (!active(token)) return disabled();
    attempts.push({ provider: provider.id, status: value.status });
    if (value.status === "ready") return { ...value, attempts };
  }
  const status = attempts.some(value => value.status === "unavailable") ? "unavailable" : attempts.some(value => value.status === "rate-limited") ? "rate-limited" : "not-found";
  return { status, attempts };
}
async function pageContext(tabId) {
  return api.tabs.sendMessage(tabId, { type: "skip-intro:page-context" }, { frameId: 0 }).catch(() => null);
}
async function handle(message, sender) {
  await ready;
  if (!enabled) return disabled();
  const token = generation;
  if (message.type === "skip-intro:status" && !sender.tab) {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!active(token)) return disabled();
    const status = statuses.get(tab?.id);
    return status && Date.now() - status.at < 15000 && status.route === tab?.url ? status.value : { status: "waiting" };
  }
  if (!Number.isInteger(sender.tab?.id)) return null;
  if (message.type === "skip-intro:tab-context") {
    const tab = await api.tabs.get(sender.tab.id);
    return active(token) ? { title: typeof tab.title === "string" ? tab.title.slice(0, 500) : "" } : disabled();
  }
  if (message.type !== "skip-intro:lookup") return null;
  const context = await pageContext(sender.tab.id);
  if (!active(token)) return disabled();
  const top = episodes.normalize(context?.episode), local = episodes.normalize(message.episode);
  const conflict = top && local && (episodes.key(top) !== episodes.key(local) || top.tmdbId && local.tmdbId && top.tmdbId !== local.tmdbId);
  const episode = conflict ? null : top && local ? { ...local, ...top } : local || top;
  const durationMs = Number.isSafeInteger(message.durationMs) && message.durationMs > 0 && message.durationMs <= 86400000 ? message.durationMs : null;
  let result = episode ? { ...await lookup(episode, durationMs, token), episode } : { status: "missing-identity" };
  if (!active(token)) return disabled();
  // A slow response must not apply the previous episode after top-frame navigation.
  if (top && episode) {
    const latest = await pageContext(sender.tab.id);
    if (latest?.route !== context?.route || episodes.key(episodes.normalize(latest?.episode)) !== episodes.key(top)) result = { status: "waiting" };
  }
  if (!active(token)) return disabled();
  statuses.set(sender.tab.id, { at: Date.now(), route: context?.route || sender.tab.url, value: result });
  for (const [id, status] of statuses) if (Date.now() - status.at >= 15000) statuses.delete(id);
  while (statuses.size > 100) statuses.delete(statuses.keys().next().value);
  return result;
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== api.runtime.id || !["skip-intro:tab-context", "skip-intro:lookup", "skip-intro:status"].includes(message?.type)) return false;
  handle(message, sender).then(respond).catch(() => respond(enabled ? { status: "unavailable" } : disabled()));
  return true;
});
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  generation++; enabled = changes.enabled.newValue !== false;
  for (const controller of controllers) controller.abort();
  pending.clear(); statuses.clear();
});
