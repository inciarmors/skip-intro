import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const sources = await Promise.all(["episode.js", "introdb.js", "background.js"].map(name => readFile(new URL(`../extension/${name}`, import.meta.url), "utf8")));
const episode = { imdbId: "tt1196946", season: 1, episode: 2 };
function harness(response, status = 200) {
  let listener;
  const state = { episode, enabled: true, calls: [], session: {} };
  const event = { addListener() {} };
  const browser = {
    runtime: { id: "extension", onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { get: async () => ({ enabled: state.enabled }) }, session: { get: async () => state.session, set: async value => Object.assign(state.session, value) }, onChanged: event },
    tabs: { sendMessage: async () => ({ episode: state.episode, route: "https://watch.example/episode" }), onRemoved: event, onUpdated: event }
  };
  const context = vm.createContext({ browser, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: async (url, options) => {
    state.calls.push({ url, options });
    return { ok: status === 200, status, headers: { get: () => "120" }, text: async () => JSON.stringify(response) };
  } });
  for (const source of sources) vm.runInContext(source, context);
  state.lookup = async local => JSON.parse(JSON.stringify(await new Promise(resolve => listener({ type: "skip-intro:lookup", episode: local }, { id: "extension", tab: { id: 1 }, frameId: 1 }, resolve))));
  return state;
}
const valid = { imdb_id: episode.imdbId, media_type: "tv", is_movie: false, season: 1, episode: 2, intro: { start_ms: 0, end_ms: 16000 } };

test("embedded player resolves top-frame identity and coalesces metadata-only API calls", async () => {
  const state = harness(valid);
  const [first, second] = await Promise.all([state.lookup(), state.lookup()]);
  assert.equal(first.status, "ready");
  assert.deepEqual(second, first);
  assert.deepEqual(first.intro, { start: 0, end: 16, source: "introdb" });
  assert.equal((await state.lookup()).status, "ready");
  assert.equal(state.calls.length, 1);
  const { url, options } = state.calls[0];
  assert.equal(url, "https://api.introdb.app/segments?imdb_id=tt1196946&season=1&episode=2");
  assert.equal(options.credentials, "omit");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(options.redirect, "error");
  assert.equal(state.session.introdbCache.length, 1);
});

test("disabled, missing, and conflicting identities cause no network lookup", async () => {
  const state = harness(valid);
  state.enabled = false;
  assert.equal((await state.lookup()).status, "disabled");
  state.enabled = true; state.episode = null;
  assert.equal((await state.lookup()).status, "missing-identity");
  state.episode = episode;
  assert.equal((await state.lookup({ ...episode, episode: 3 })).status, "missing-identity");
  assert.equal(state.calls.length, 0);
});

test("missing intros are cached and rate limits pause other episode lookups", async () => {
  const missing = harness({ ...valid, intro: null, outro: valid.intro });
  assert.equal((await missing.lookup()).status, "not-found");
  assert.equal((await missing.lookup()).status, "not-found");
  assert.equal(missing.calls.length, 1);
  const limited = harness({}, 429);
  assert.equal((await limited.lookup()).status, "rate-limited");
  limited.episode = { ...episode, episode: 3 };
  assert.equal((await limited.lookup()).status, "rate-limited");
  assert.equal(limited.calls.length, 1);
});

test("wrong-episode responses are rejected instead of producing a button", async () => {
  const state = harness({ ...valid, episode: 3 });
  assert.equal((await state.lookup()).status, "unavailable");
});
