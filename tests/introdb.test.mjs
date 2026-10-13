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
