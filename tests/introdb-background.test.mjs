import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const sources = await Promise.all(["episode.js", "introdb.js", "background.js"].map(name => readFile(new URL(`../extension/${name}`, import.meta.url), "utf8")));
const episode = { imdbId: "tt1196946", season: 1, episode: 2 };
const valid = { imdb_id: episode.imdbId, media_type: "tv", is_movie: false, season: 1, episode: 2, intro: { start_ms: 0, end_ms: 16000 } };
const secondary = { tmdb_id: 5920, type: "tv", season: 1, episode: 2, intro: [{ start_ms: null, end_ms: 16000 }] };
function harness(primary = { data: valid }, fallback = { status: 404 }, skipdb = { status: 404 }, aniskip = { status: 404 }) {
  let listener, storageListener;
  const state = { episode, enabled: true, calls: [], session: {}, primary, fallback, skipdb, aniskip };
  const browser = {
    runtime: { id: "extension", onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { get: async () => ({ enabled: state.enabled }) }, session: { get: async () => state.session, set: async value => Object.assign(state.session, value) }, onChanged: { addListener(fn) { storageListener = fn; } } },
    tabs: { sendMessage: async () => ({ episode: state.episode, route: "https://watch.example/episode" }), get: async () => ({ title: "Example S1:E2" }) }
  };
  const context = vm.createContext({ browser, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: async (url, options) => {
    state.calls.push({ url, options });
    const config = { "api.introdb.app": state.primary, "api.theintrodb.org": state.fallback, "api.skipdb.tv": state.skipdb, "api.aniskip.com": state.aniskip }[new URL(url).hostname];
    assert.ok(config, "Only known catalog hosts may be contacted");
    if (config.wait) await config.wait(options.signal);
    const status = config.status || 200;
    return { ok: status === 200, status, headers: { get: name => name === "Retry-After" ? "120" : null }, text: async () => JSON.stringify(config.data) };
  } });
  for (const source of sources) vm.runInContext(source, context);
  state.send = async message => JSON.parse(JSON.stringify(await new Promise(resolve => listener(message, { id: "extension", tab: { id: 1 }, frameId: 1 }, resolve))));
  state.lookup = (local, durationMs) => state.send({ type: "skip-intro:lookup", episode: local, durationMs });
  state.setEnabled = value => { state.enabled = value; storageListener({ enabled: { newValue: value } }, "local"); };
  return state;
}

test("embedded player resolves top-frame identity and coalesces metadata-only API calls", async () => {
  const state = harness();
  const [first, second] = await Promise.all([state.lookup(), state.lookup()]);
  assert.equal(first.status, "ready");
  assert.deepEqual(second, first);
  assert.deepEqual(first.intros, [{ start: 0, end: 16, source: "introdb" }]);
  assert.equal((await state.lookup()).status, "ready");
  assert.equal(state.calls.length, 1);
  const { url, options } = state.calls[0];
  assert.equal(url, "https://api.introdb.app/segments?imdb_id=tt1196946&season=1&episode=2");
  assert.equal(options.credentials, "omit");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(options.redirect, "error");
  assert.equal(state.session.catalogCache.length, 1);
});

test("disabled, missing, and conflicting identities cause no network lookup", async () => {
  const state = harness();
  state.setEnabled(false);
  assert.equal((await state.lookup()).status, "disabled");
  assert.equal((await state.send({ type: "skip-intro:tab-context" })).status, "disabled");
  state.setEnabled(true); state.episode = null;
  assert.equal((await state.lookup()).status, "missing-identity");
  state.episode = episode;
  assert.equal((await state.lookup({ ...episode, episode: 3 })).status, "missing-identity");
  assert.equal(state.calls.length, 0);
});

test("missing intros use the second catalog and cache both responses", async () => {
  const state = harness({ data: { ...valid, intro: null, outro: valid.intro } }, { data: secondary });
  state.episode = { ...episode, tmdbId: 5920 };
  const result = await state.lookup(undefined, 2613000);
  assert.equal(result.status, "ready");
  assert.equal(result.provider, "theintrodb");
  assert.deepEqual(result.intros, [{ start: 0, end: 16, source: "theintrodb" }]);
  const url = new URL(state.calls[1].url);
  assert.equal(url.origin, "https://api.theintrodb.org");
  assert.equal(url.searchParams.get("tmdb_id"), "5920");
  assert.equal(url.searchParams.get("duration_ms"), "2613000");
  assert.equal(url.searchParams.has("imdb_id"), false);
  await state.lookup(undefined, 2613000);
  assert.equal(state.calls.length, 2);
  assert.equal(state.session.catalogCache.length, 2);
});

test("catalog rate limits are independent and a working fallback is still used", async () => {
  const state = harness({ status: 429 }, { data: secondary });
  assert.equal((await state.lookup()).provider, "theintrodb");
  state.episode = { ...episode, episode: 3 };
  state.fallback = { status: 404 };
  assert.equal((await state.lookup()).status, "rate-limited");
  assert.equal(state.calls.length, 4);
  assert.ok(state.session.catalogCooldowns.introdb > Date.now());
});

test("no catalog has an intro and malformed responses never become timing ranges", async () => {
  const missing = harness({ data: { ...valid, intro: null } });
  assert.equal((await missing.lookup()).status, "not-found");
  await missing.lookup();
  assert.equal(missing.calls.length, 3);
  const wrong = harness({ data: { ...valid, episode: 3 } });
  assert.equal((await wrong.lookup()).status, "unavailable");
});

test("switching OFF aborts a pending request, prevents fallback, and rejects its late result", async () => {
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const state = harness({ data: { ...valid, intro: null }, wait: async signal => { entered(signal); await wait; } }, { data: secondary });
  const lookup = state.lookup();
  const signal = await started;
  state.setEnabled(false);
  assert.equal(signal.aborted, true);
  release();
  assert.equal((await lookup).status, "disabled");
  assert.equal(state.calls.length, 1);
  assert.equal(state.session.catalogCache, undefined);
  state.primary = { data: valid };
  state.setEnabled(true);
  assert.equal((await state.lookup()).status, "ready");
  assert.equal(state.calls.length, 2);
});

test("SkipDB is a third fallback with duration-aware caching and no timestamp adjustment", async () => {
  const data = { imdb_id: episode.imdbId, season: 1, episode: 2, segments: { intro: { start_ms: 42000, end_ms: 75000, match: "exact", adjusted: false } } };
  const state = harness({ status: 404 }, { status: 404 }, { data });
  const result = await state.lookup(undefined, 2600500);
  assert.equal(result.provider, "skipdb");
  assert.deepEqual(result.intros, [{ start: 42, end: 75, source: "skipdb" }]);
  assert.deepEqual(result.attempts.map(item => item.provider), ["introdb", "theintrodb", "skipdb"]);
  const url = new URL(state.calls[2].url);
  assert.equal(url.searchParams.get("duration"), "2600.5");
  assert.equal(url.searchParams.get("adjust"), "none");
  assert.equal(url.searchParams.get("type"), "intro");
  await state.lookup(undefined, 2600500);
  assert.equal(state.calls.length, 3);
  await state.lookup(undefined, 2700000);
  assert.equal(state.calls.length, 5);
});

test("MAL-only episodes query only AniSkip, and missing duration prevents the request", async () => {
  const state = harness();
  state.episode = { malId: 9253, season: 1, episode: 1 };
  state.aniskip = { data: { found: true, results: [{ skipType: "op", interval: { startTime: 638.489, endTime: 728.489 }, episodeLength: 1418.624 }] } };
  await state.lookup();
  assert.equal(state.calls.length, 0);
  const result = await state.lookup(undefined, 1418624);
  assert.equal(result.provider, "aniskip");
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].url, "https://api.aniskip.com/v2/skip-times/9253/1?types=op&episodeLength=1418.624");
  await state.lookup(undefined, 1418624);
  assert.equal(state.calls.length, 1);
});

test("an unavailable SkipDB still allows an explicit anime fallback", async () => {
  const state = harness({ status: 404 }, { status: 429 }, { status: 503 }, { data: { found: true, results: [{ skipType: "op", interval: { startTime: 42, endTime: 75 }, episodeLength: 1500 }] } });
  state.episode = { ...episode, malId: 9253 };
  assert.equal((await state.lookup(undefined, 1500000)).provider, "aniskip");
  assert.equal(state.calls.length, 4);
});

test("OFF while SkipDB is pending aborts it and never starts AniSkip", async () => {
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  const state = harness({ status: 404 }, { status: 404 }, { status: 404, wait: async signal => { entered(signal); await waiting; } });
  state.episode = { ...episode, malId: 9253 };
  const request = state.lookup(undefined, 1500000);
  const signal = await started;
  state.setEnabled(false);
  assert.equal(signal.aborted, true);
  release();
  assert.equal((await request).status, "disabled");
  assert.equal(state.calls.length, 3);
  assert.equal(state.session.catalogCache.length, 2);
});

test("a changed MAL mapping invalidates a late result even when the IMDb episode is unchanged", async () => {
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  const state = harness({ data: valid, wait: async () => { entered(); await waiting; } });
  state.episode = { ...episode, malId: 9253 };
  const request = state.lookup(undefined, 1500000);
  await started;
  state.episode = { ...episode, malId: 1 };
  release();
  assert.equal((await request).status, "waiting");
});
