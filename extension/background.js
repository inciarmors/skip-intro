/* Metadata-only catalog requests. Browser-managed, non-persistent background. */
if (typeof importScripts === "function") importScripts("episode.js", "introdb.js");
const api = globalThis.browser || globalThis.chrome;
const episodes = globalThis.SkipIntroEpisode;
const providers = globalThis.SkipIntroDB.providers;
const identityProvider = {
  id: "tvmaze", identify: true,
  cacheKey: query => JSON.stringify(query),
  url(query) { return `https://api.tvmaze.com/search/shows?${new URLSearchParams({ q: query.title })}`; },
  parse: episodes.parseTVMaze
};
const cache = new Map(), pending = new Map(), controllers = new Set(), statuses = new Map();
const cooldowns = {};
let enabled = false, generation = 0;
const ready = Promise.all([
  api.storage.local.get("enabled").then(value => { if (!generation) enabled = value.enabled !== false; }),
  api.storage.session.get(["catalogCache", "catalogCooldowns"]).then(values => {
    for (const provider of [...providers, identityProvider]) {
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
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 8000);
  const result = status => ({ status, provider: provider.id });
  async function request(input) {
    if (!active(token) || controller.signal.aborted) throw new Error("Lookup cancelled");
    const { url, ...options } = typeof input === "string" ? { url: input } : input;
    const response = await fetch(url, { ...options, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal });
    if (!active(token)) throw new Error("Lookup cancelled");
    if (response.status === 429) {
      const delay = retryDelay(response);
      cooldowns[provider.id] = Date.now() + delay;
      throw Object.assign(new Error("Catalog rate limit"), { status: "rate-limited", ttl: delay });
    }
    if (response.status === 404) throw Object.assign(new Error("Catalog entry missing"), { status: "not-found", ttl: 15 * 60000 });
    if (!response.ok) throw new Error("Catalog unavailable");
    const text = await response.text();
    if (!active(token) || controller.signal.aborted) throw new Error("Lookup cancelled");
    if (text.length > 100000) throw new Error("Unexpected response size");
    return JSON.parse(text);
  }
  try {
    const intros = provider.resolve ? await provider.resolve(episode, durationMs, request) : provider.parse(await request(provider.url(episode, durationMs)), episode, durationMs);
    const value = provider.identify ? { ...result(intros ? "identified" : "missing-identity"), episode: intros } : intros.length ? { ...result("ready"), intros } : result("not-found");
    return remember(key, value, ["ready", "identified"].includes(value.status) ? 6 * 3600000 : 15 * 60000, token);
  } catch (error) {
    return remember(key, result(error.status || "unavailable"), error.ttl || 30000, token);
  } finally { clearTimeout(timeout); controllers.delete(controller); }
}
async function lookupProvider(provider, episode, durationMs, token) {
  if (!active(token)) return disabled();
  if (provider.supports && !provider.supports(episode, durationMs)) return { status: "unsupported", provider: provider.id };
  const key = `${provider.id}:${provider.identify ? "show" : episodes.key(episode)}:${provider.cacheKey?.(episode, durationMs) || "0"}`;
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
async function pageContext(tabId, frameId = 0) {
  return api.tabs.sendMessage(tabId, { type: "skip-intro:page-context" }, { frameId }).catch(() => null);
}
async function frameContext(sender) {
  const tabId = sender.tab.id;
  // Read only the current player's ancestry, never sibling videos or other tabs.
  const frames = await api.webNavigation?.getAllFrames({ tabId }).catch(() => null);
  if (!frames) {
    const top = await pageContext(tabId);
    return { episode: episodes.normalize(top?.episode), queries: [episodes.normalizeQuery(top?.query)].filter(Boolean), route: top?.route, stamp: JSON.stringify(top), conflict: false };
  }
  const chain = [], seen = new Set();
  let frame = frames.find(value => value.frameId === (sender.frameId || 0));
  if (!frame || sender.documentId && frame.documentId && sender.documentId !== frame.documentId) return null;
  while (frame && chain.length < 12 && !seen.has(frame.frameId)) {
    seen.add(frame.frameId); chain.push(frame);
    if (frame.frameId === 0) break;
    frame = frames.find(value => value.frameId === frame.parentFrameId);
  }
  if (chain.at(-1)?.frameId !== 0) return null;
  const snapshots = await Promise.all(chain.map(async value => {
    const context = await pageContext(tabId, value.frameId);
    return { frameId: value.frameId, documentId: value.documentId, url: value.url, context };
  }));
  const identities = snapshots.flatMap(value => [episodes.fromUrl(value.url), episodes.normalize(value.context?.episode)]).filter(Boolean);
  const episode = episodes.merge(identities);
  return { episode, queries: snapshots.map(value => episodes.normalizeQuery(value.context?.query)).filter(Boolean), route: chain.at(-1).url, conflict: identities.length > 0 && !episode, stamp: JSON.stringify(snapshots) };
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
  const context = await frameContext(sender);
  if (!active(token)) return disabled();
  const top = episodes.normalize(context?.episode), local = episodes.normalize(message.episode);
  const conflict = context?.conflict || !context || top && local && !episodes.merge([top, local]);
  let episode = conflict ? null : episodes.merge([top, local]);
  let identityResult = null;
  if (!episode && !conflict) {
    const queries = [...context.queries, episodes.normalizeQuery(message.query)].filter(Boolean);
    if (queries.length && new Set(queries.map(value => JSON.stringify(value))).size === 1) {
      identityResult = await lookupProvider(identityProvider, queries[0], null, token);
      if (!active(token)) return disabled();
      const latest = await frameContext(sender);
      if (!latest || latest.stamp !== context.stamp) return { status: "waiting" };
      episode = identityResult.status === "identified" ? identityResult.episode : null;
    }
  }
  const durationMs = Number.isSafeInteger(message.durationMs) && message.durationMs > 0 && message.durationMs <= 86400000 ? message.durationMs : null;
  let result = episode ? { ...await lookup(episode, durationMs, token), episode } : { status: ["unavailable", "rate-limited"].includes(identityResult?.status) ? identityResult.status : "missing-identity" };
  if (!active(token)) return disabled();
  // A slow response must not apply the previous episode after top-frame navigation.
  if (episode) {
    const latest = await frameContext(sender);
    if (!latest || latest.stamp !== context.stamp) result = { status: "waiting" };
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
