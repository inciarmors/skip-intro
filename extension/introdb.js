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
  function parseSkipDB(data, episode, durationMs) {
    if (!data || data.imdb_id !== episode.imdbId || data.season !== episode.season || data.episode !== episode.episode) throw new Error("Unexpected episode response");
    const intro = data.segments?.intro;
    // A season-level length estimate cannot locate this episode's opening.
    if (intro === null) return [];
    if (!intro || !Number.isFinite(intro.start_ms) || !Number.isFinite(intro.end_ms)) throw new Error("Invalid intro response");
    if (intro.start_ms === 0 && intro.end_ms === 0) return [];
    if (!["exact", "agnostic", "shifted", "out-of-range"].includes(intro.match) || typeof intro.adjusted !== "boolean") throw new Error("Invalid release match");
    if (intro.adjusted || !["exact", "agnostic"].includes(intro.match)) return [];
    const start = intro.start_ms / 1000, end = intro.end_ms / 1000;
    if (start < 0 || end - start < 2 || end - start > 300) throw new Error("Invalid intro boundaries");
    if (durationMs && intro.end_ms > durationMs) return [];
    return [{ start, end, source: "skipdb" }];
  }
  function parseAniSkip(data, _episode, durationMs) {
    if (!data || typeof data.found !== "boolean") throw new Error("Invalid anime response");
    if (!data.found) return [];
    if (!Array.isArray(data.results) || data.results.length > 100) throw new Error("Invalid anime segments");
    const intros = [];
    for (const item of data.results) {
      // Mixed openings can contain story scenes; only plain openings qualify.
      if (item?.skipType !== "op") continue;
      const start = item.interval?.startTime, end = item.interval?.endTime;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 2 || end - start > 300 || !Number.isFinite(item.episodeLength) || item.episodeLength <= 0) throw new Error("Invalid anime boundaries");
      // Never shift an entire opening to compensate for a different release.
      if (!durationMs || Math.abs(item.episodeLength * 1000 - durationMs) > 2000 || end * 1000 > durationMs) continue;
      intros.push({ start, end, source: "aniskip" });
    }
    return intros.sort((a, b) => a.start - b.start);
  }
  const animeSkipEndpoint = "https://api.anime-skip.com/graphql";
  // The official client README explicitly publishes this shared, rate-limited ID.
  const animeSkipHeaders = { "Content-Type": "application/json", "X-Client-ID": "ZGfO0sMF3eCwLYf8yMSCJjlynwNGRXWE" };
  const graphRequest = (url, query, variables, headers = { "Content-Type": "application/json" }) => ({ url, method: "POST", headers, body: JSON.stringify({ query, variables }) });
  function graphData(value) {
    if (!value?.data || value.errors?.length) throw new Error("Catalog query failed");
    return value.data;
  }
  function animeEpisodeMatches(value, episode, durationMs) {
    return value && (String(value.season) === String(episode.season) || value.season === null && episode.season === 1) && String(value.number) === String(episode.episode) && Number.isFinite(value.baseDuration) && value.baseDuration > 0 && Math.abs(value.baseDuration * 1000 - durationMs) <= 2000;
  }
  function parseAnimeSkip(value, expectedId, episode, durationMs) {
    const data = graphData(value).findEpisode;
    if (!data || data.id !== expectedId || !animeEpisodeMatches(data, episode, durationMs)) throw new Error("Unexpected anime episode");
    if (!Array.isArray(data.timestamps) || data.timestamps.length > 500) throw new Error("Invalid anime timestamps");
    const stamps = [...data.timestamps].sort((a, b) => a.at - b.at);
    if (stamps.some((stamp, index) => !Number.isFinite(stamp.at) || stamp.at < 0 || stamp.at * 1000 > durationMs || index && stamp.at === stamps[index - 1].at)) throw new Error("Ambiguous anime boundaries");
    const intros = [];
    for (let index = 0; index < stamps.length - 1; index++) {
      if (stamps[index].typeId !== "14550023-2589-46f0-bfb4-152976506b4c") continue;
      const start = stamps[index].at, end = stamps[index + 1].at;
      if (end - start >= 2 && end - start <= 300) intros.push({ start, end, source: "anime-skip" });
    }
    return intros;
  }
  async function resolveAnimeSkip(episode, durationMs, request) {
    let anilistId = episode.anilistId;
    if (!anilistId) {
      const mapping = graphData(await request(graphRequest("https://graphql.anilist.co", "query($id:Int!){Media(idMal:$id,type:ANIME){id idMal}}", { id: episode.malId }))).Media;
      if (!mapping) return [];
      if (mapping.idMal !== episode.malId || !Number.isSafeInteger(mapping.id) || mapping.id < 1 || mapping.id > 10000000) throw new Error("Invalid anime ID mapping");
      anilistId = mapping.id;
    }
    const data = graphData(await request(graphRequest(animeSkipEndpoint, "query($id:String!){findShowsByExternalId(service:ANILIST,serviceId:$id){externalLinks{service serviceId} episodes{id season number baseDuration}}}", { id: String(anilistId) }, animeSkipHeaders)));
    const shows = data.findShowsByExternalId;
    if (!Array.isArray(shows) || shows.length > 20) throw new Error("Invalid anime show list");
    const matches = new Map();
    for (const show of shows) {
      if (!Array.isArray(show.externalLinks) || !show.externalLinks.some(link => link.service === "anilist.co" && link.serviceId === String(anilistId))) throw new Error("Unexpected anime show");
      if (!Array.isArray(show.episodes) || show.episodes.length > 3000) throw new Error("Invalid anime episode list");
      for (const item of show.episodes) {
        if (typeof item.id === "string" && /^[\da-f-]{36}$/i.test(item.id) && animeEpisodeMatches(item, episode, durationMs)) matches.set(item.id, item);
      }
    }
    // Duplicate editions that cannot be distinguished by duration remain ambiguous.
    if (matches.size !== 1) return [];
    const id = matches.keys().next().value;
    const timing = await request(graphRequest(animeSkipEndpoint, "query($id:ID!){findEpisode(episodeId:$id){id season number baseDuration timestamps{at typeId}}}", { id }, animeSkipHeaders));
    return parseAnimeSkip(timing, id, episode, durationMs);
  }
  const providers = Object.freeze([
    {
      id: "introdb", name: "IntroDB",
      supports: episode => Boolean(episode.imdbId),
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
      cacheKey: (episode, durationMs) => `${episode.tmdbId || 0}:${durationMs || 0}`,
      url(episode, durationMs) {
        const url = new URL("https://api.theintrodb.org/v3/media");
        const params = { season: episode.season, episode: episode.episode };
        if (episode.tmdbId) params.tmdb_id = episode.tmdbId; else params.imdb_id = episode.imdbId;
        if (durationMs) params.duration_ms = durationMs;
        url.search = new URLSearchParams(params);
        return url.href;
      },
      parse: parseTheIntroDB
    },
    {
      id: "skipdb", name: "SkipDB",
      supports: episode => Boolean(episode.imdbId),
      cacheKey: (_episode, durationMs) => String(durationMs || 0),
      url(episode, durationMs) {
        const url = new URL("https://api.skipdb.tv/api/segments");
        const params = { imdb_id: episode.imdbId, season: episode.season, episode: episode.episode, type: "intro", adjust: "none" };
        if (durationMs) params.duration = durationMs / 1000;
        url.search = new URLSearchParams(params);
        return url.href;
      },
      parse: parseSkipDB
    },
    {
      id: "aniskip", name: "AniSkip",
      supports: (episode, durationMs) => Boolean(episode.malId && durationMs),
      cacheKey: (episode, durationMs) => `${episode.malId}:${durationMs}`,
      url(episode, durationMs) {
        const url = new URL(`https://api.aniskip.com/v2/skip-times/${episode.malId}/${episode.episode}`);
        url.search = new URLSearchParams({ types: "op", episodeLength: durationMs / 1000 });
        return url.href;
      },
      parse: parseAniSkip
    },
    {
      id: "anime-skip", name: "Anime Skip", timeoutMs: 12000,
      supports: (episode, durationMs) => Boolean((episode.malId || episode.anilistId) && durationMs),
      cacheKey: (episode, durationMs) => `${episode.malId || 0}:${episode.anilistId || 0}:${durationMs}`,
      resolve: resolveAnimeSkip
    }
  ]);
  globalThis.SkipIntroDB = Object.freeze({ parseResponse, parseTheIntroDB, parseSkipDB, parseAniSkip, parseAnimeSkip, providers });
})();
