/* IntroDB's public /segments contract. Only intro boundaries are accepted. */
(() => {
  "use strict";
  function parseResponse(data, episode) {
    if (!data || data.imdb_id !== episode.imdbId || data.season !== episode.season || data.episode !== episode.episode || data.is_movie === true || data.media_type !== "tv") throw new Error("Unexpected episode response");
    if (data.intro === null) return null;
    const intro = data.intro;
    if (!intro || !Number.isFinite(intro.start_ms) || !Number.isFinite(intro.end_ms)) throw new Error("Invalid intro response");
    const start = intro.start_ms / 1000, end = intro.end_ms / 1000;
    if (start < 0 || end - start < 2 || end - start > 300) throw new Error("Invalid intro boundaries");
    return { start, end, source: "introdb" };
  }
  globalThis.SkipIntroDB = Object.freeze({ parseResponse });
})();
