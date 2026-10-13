/* Public catalog contracts. Only bounded intro segments are accepted. */
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
  function parseTheIntroDB(data, episode) {
    if (!data || data.type !== "tv" || data.season !== episode.season || data.episode !== episode.episode || !Number.isSafeInteger(data.tmdb_id) || data.tmdb_id < 1 || episode.tmdbId && data.tmdb_id !== episode.tmdbId) throw new Error("Unexpected episode response");
    if (data.intro === undefined) return [];
    if (!Array.isArray(data.intro) || data.intro.length > 20) throw new Error("Invalid intro response");
    return data.intro.map(intro => {
      // This provider documents null start as the beginning of the episode.
      const startMs = intro?.start_ms === null ? 0 : intro?.start_ms;
      if (!Number.isFinite(startMs) || !Number.isFinite(intro?.end_ms)) throw new Error("Invalid intro boundaries");
      const start = startMs / 1000, end = intro.end_ms / 1000;
      if (start < 0 || end - start < 2 || end - start > 300) throw new Error("Invalid intro boundaries");
      return { start, end, source: "theintrodb" };
    }).sort((a, b) => a.start - b.start);
  }
  const providers = Object.freeze([
    {
      id: "introdb", name: "IntroDB",
      url(episode) {
        const url = new URL("https://api.introdb.app/segments");
        url.search = new URLSearchParams({ imdb_id: episode.imdbId, season: episode.season, episode: episode.episode });
        return url.href;
      },
      parse(data, episode) { const intro = parseResponse(data, episode); return intro ? [intro] : []; }
    },
    {
      id: "theintrodb", name: "TheIntroDB",
      supports: episode => episode.season >= 1 && (episode.tmdbId || /^tt\d{7,8}$/.test(episode.imdbId)),
      url(episode, durationMs) {
        const url = new URL("https://api.theintrodb.org/v3/media");
        const params = { season: episode.season, episode: episode.episode };
        if (episode.tmdbId) params.tmdb_id = episode.tmdbId; else params.imdb_id = episode.imdbId;
        if (durationMs) params.duration_ms = durationMs;
        url.search = new URLSearchParams(params);
        return url.href;
      },
      parse: parseTheIntroDB
    }
  ]);
  globalThis.SkipIntroDB = Object.freeze({ parseResponse, parseTheIntroDB, providers });
})();
