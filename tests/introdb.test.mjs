import test from "node:test";
import assert from "node:assert/strict";
import "../extension/episode.js";
import "../extension/introdb.js";
const { normalize, fromPage, fromStructuredData } = globalThis.SkipIntroEpisode;
const { parseResponse } = globalThis.SkipIntroDB;
const episode = { imdbId: "tt1196946", season: 1, episode: 2 };
const response = { imdb_id: episode.imdbId, media_type: "tv", is_movie: false, season: 1, episode: 2, intro: { start_ms: 42000, end_ms: 75000 } };

test("uses explicit watch metadata without confusing internal IDs and season numbers", () => {
  const page = { component: "Titles/Watch", url: "/watch/177?episode_id=4607", props: { title: { type: "tv", imdb_id: episode.imdbId }, episode: { id: 4607, number: 2, season_id: 354, season: { id: 354, number: 1 } } } };
  const url = "https://watch.example/watch/177?episode_id=4607";
  assert.deepEqual(fromPage(page, url, "Watch Example S1:E2"), episode);
  assert.equal(fromPage(page, url.replace("4607", "4608"), "Watch Example S1:E3"), null);
  assert.equal(fromPage(page, url, "Watch Example S1:E3"), null);
  assert.equal(fromPage({ ...page, url: undefined }, url, ""), null);
  assert.equal(normalize({ ...episode, season: null }), null);
  assert.equal(normalize({ ...episode, episode: 1.5 }), null);
  assert.equal(normalize({ ...episode, imdbId: "https://other.example" }), null);
});

test("uses the series IMDb ID and rejects ambiguous structured episodes", () => {
  const node = { "@type": "TVEpisode", sameAs: "https://www.imdb.com/title/tt9999999/", episodeNumber: 2, partOfSeason: { seasonNumber: 1 }, partOfSeries: { sameAs: "https://www.imdb.com/title/tt1196946/" } };
  assert.deepEqual(fromStructuredData(node), episode);
  assert.equal(fromStructuredData({ ...node, partOfSeries: undefined }), null);
  assert.equal(fromStructuredData([node, { ...node, episodeNumber: 3 }]), null);
});

test("converts milliseconds once and never treats an outro as an intro", () => {
  assert.deepEqual(parseResponse(response, episode), { start: 42, end: 75, source: "introdb" });
  assert.equal(parseResponse({ ...response, intro: null, outro: response.intro }, episode), null);
  for (const data of [
    { ...response, episode: 3 },
    { ...response, imdb_id: "tt9999999" },
    { ...response, is_movie: true },
    { ...response, intro: { start_ms: null, end_ms: 75000 } },
    { ...response, intro: { start_ms: 75000, end_ms: 42000 } },
    { ...response, intro: { start_ms: 0, end_ms: 9999999 } },
    { ...response, intro: undefined }
  ]) assert.throws(() => parseResponse(data, episode));
});

test("TheIntroDB validates canonical identity and keeps multiple bounded intro segments", () => {
  const parse = globalThis.SkipIntroDB.parseTheIntroDB;
  const identity = { ...episode, tmdbId: 5920 };
  const data = { tmdb_id: 5920, type: "tv", season: 1, episode: 2, intro: [{ start_ms: null, end_ms: 16000 }, { start_ms: 42000, end_ms: 75000 }] };
  assert.deepEqual(parse(data, identity), [{ start: 0, end: 16, source: "theintrodb" }, { start: 42, end: 75, source: "theintrodb" }]);
  assert.deepEqual(parse({ ...data, intro: undefined, credits: data.intro }, identity), []);
  for (const bad of [
    { ...data, tmdb_id: 1 },
    { ...data, episode: 3 },
    { ...data, type: "movie" },
    { ...data, intro: null },
    { ...data, intro: [{ start_ms: 0, end_ms: null }] },
    { ...data, intro: [{ start_ms: "0", end_ms: 16000 }] }
  ]) assert.throws(() => parse(bad, identity));
});

test("SkipDB accepts exact boundaries, not estimates, uncertain cuts, or no-intro sentinels", () => {
  const parse = globalThis.SkipIntroDB.parseSkipDB;
  const intro = { start_ms: 42000, end_ms: 75000, match: "exact", adjusted: false };
  const data = { imdb_id: episode.imdbId, season: 1, episode: 2, segments: { intro } };
  assert.deepEqual(parse(data, episode, 2600000), [{ start: 42, end: 75, source: "skipdb" }]);
  assert.deepEqual(parse({ ...data, segments: { intro: null }, intro_length_estimate_ms: 33000 }, episode), []);
  for (const changes of [
    { start_ms: 0, end_ms: 0 }, { match: "out-of-range" }, { match: "shifted" }, { adjusted: true }
  ]) assert.deepEqual(parse({ ...data, segments: { intro: { ...intro, ...changes } } }, episode), []);
  assert.deepEqual(parse(data, episode, 60000), []);
  assert.throws(() => parse({ ...data, episode: 3 }, episode));
  assert.throws(() => parse({ ...data, imdb_id: "tt9999999" }, episode));
  assert.throws(() => parse({ ...data, segments: { intro: { ...intro, start_ms: "42000" } } }, episode));
  assert.throws(() => parse({ ...data, segments: {} }, episode));
});

test("anime identity belongs to an explicit MAL season and rejects conflicting metadata", () => {
  const node = { "@type": "TVEpisode", episodeNumber: 1, partOfSeason: { seasonNumber: 2, sameAs: "https://myanimelist.net/anime/9253/" } };
  assert.deepEqual(fromStructuredData(node), { malId: 9253, season: 2, episode: 1 });
  const seriesOnly = { ...node, partOfSeason: { seasonNumber: 2 }, partOfSeries: { sameAs: "https://myanimelist.net/anime/9253/" } };
  assert.equal(fromStructuredData(seriesOnly), null);
  assert.deepEqual(fromStructuredData({ ...seriesOnly, partOfSeason: { seasonNumber: 1 } }), { malId: 9253, season: 1, episode: 1 });
  assert.equal(fromStructuredData({ ...node, partOfSeason: { seasonNumber: 2, sameAs: "https://myanimelist.net.evil.example/anime/9253/" } }), null);
  assert.equal(fromStructuredData([node, { ...node, episodeNumber: 2 }]), null);
  const withImdb = { ...node, partOfSeries: { sameAs: "https://imdb.com/title/tt1196946/" } };
  const noMal = { ...withImdb, partOfSeason: { seasonNumber: 2 } };
  const conflicting = { ...withImdb, partOfSeason: { seasonNumber: 2, sameAs: "https://myanimelist.net/anime/1/" } };
  assert.equal(fromStructuredData([noMal, withImdb, conflicting]), null);
});

test("AniSkip preserves seconds and requires an opening with a matching playback duration", () => {
  const parse = globalThis.SkipIntroDB.parseAniSkip;
  const item = { skipType: "op", interval: { startTime: 638.489, endTime: 728.489 }, episodeLength: 1418.624 };
  const data = { found: true, results: [item] };
  assert.deepEqual(parse(data, episode, 1418624), [{ start: 638.489, end: 728.489, source: "aniskip" }]);
  assert.deepEqual(parse(data, episode, 1450000), []);
  assert.deepEqual(parse(data, episode), []);
  assert.deepEqual(parse({ found: false }, episode, 1418624), []);
  assert.deepEqual(parse({ ...data, results: ["mixed-op", "ed", "recap"].map(skipType => ({ ...item, skipType })) }, episode, 1418624), []);
  assert.throws(() => parse({ ...data, results: [{ ...item, interval: { startTime: -1, endTime: 90 } }] }, episode, 1418624));
  assert.throws(() => parse({ results: [] }, episode, 1418624));
});
