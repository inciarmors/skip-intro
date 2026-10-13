/* Extract explicit episode identities. Titles alone never identify a catalog entry. */
(() => {
  "use strict";
  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const integer = value => (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  function normalize(value) {
    const season = integer(value?.season), episode = integer(value?.episode);
    const imdbId = /^tt\d{7,10}$/.test(value?.imdbId || "") ? value.imdbId : null;
    const malId = integer(value?.malId);
    const hasMal = malId > 0 && malId <= 10000000;
    if ((!imdbId && !hasMal) || season === null || season < 0 || season > 1000 || episode === null || episode < 1 || episode > 10000) return null;
    const result = { season, episode };
    if (imdbId) result.imdbId = imdbId;
    if (hasMal) result.malId = malId;
    const tmdbId = integer(value.tmdbId);
    if (tmdbId > 0 && tmdbId <= 10000000) result.tmdbId = tmdbId;
    return result;
  }
  const key = value => value ? `${value.imdbId || `mal${value.malId}`}:${value.season}:${value.episode}` : "";
  const consistent = values => values.length && values.every(value => key(value) === key(values[0])) && ["malId", "tmdbId"].every(field => new Set(values.map(value => value[field]).filter(Boolean)).size <= 1);
  function titleNumbers(title) {
    const match = String(title).match(/\bs(\d+)\s*[:.\-]?\s*e(\d+)\b/i) || String(title).match(/\bseason\s+(\d+)\s*[,.:\-]?\s*episode\s+(\d+)\b/i);
    return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
  }
  function fromPage(page, href, title) {
    if (page?.component !== "Titles/Watch" || typeof page.url !== "string") return null;
    // Inertia's initial data-page can outlive an SPA navigation.
    try {
      const route = new URL(page.url, href), current = new URL(href);
      if (route.origin !== current.origin || route.pathname !== current.pathname || route.search !== current.search) return null;
    } catch { return null; }
    const props = page.props;
    if (props?.title?.type !== "tv") return null;
    const result = normalize({ imdbId: props.title.imdb_id, tmdbId: props.title.tmdb_id, season: props.episode?.season?.number, episode: props.episode?.number });
    const numbers = titleNumbers(title);
    if (result && numbers && (numbers.season !== result.season || numbers.episode !== result.episode)) return null;
    return result;
  }
  function imdb(value) {
    for (const item of list(value)) {
      if (typeof item !== "string") continue;
      if (/^tt\d{7,10}$/.test(item)) return item;
      try {
        const url = new URL(item);
        const match = url.pathname.match(/^\/title\/(tt\d{7,10})(?:\/|$)/);
        if ((url.hostname === "imdb.com" || url.hostname.endsWith(".imdb.com")) && match) return match[1];
      } catch { /* Not an IMDb identifier. */ }
    }
    return null;
  }
  function myAnimeList(value) {
    const ids = [];
    for (const item of list(value)) {
      if (typeof item !== "string") continue;
      try {
        const url = new URL(item);
        const match = url.pathname.match(/^\/anime\/(\d+)(?:\/|$)/);
        if (["myanimelist.net", "www.myanimelist.net"].includes(url.hostname) && match) ids.push(Number(match[1]));
      } catch { /* Not a MyAnimeList URL. */ }
    }
    return ids.length && ids.every(id => id === ids[0]) ? ids[0] : null;
  }
  function fromStructuredData(value) {
    const nodes = list(value).flatMap(node => node?.["@graph"] ? list(node["@graph"]) : [node]);
    const results = [];
    for (const node of nodes) {
      if (!list(node?.["@type"]).includes("TVEpisode")) continue;
      const series = node.partOfSeries || node.partOfSeason?.partOfSeries;
      // The episode's own IMDb ID is not the series ID required by IntroDB.
      const season = integer(node.partOfSeason?.seasonNumber);
      const seasonMal = myAnimeList([...list(node.partOfSeason?.sameAs), ...list(node.partOfSeason?.url)]);
      // MAL entries represent individual seasons/cours. A series-level URL is
      // usable only for season 1, never as a guessed mapping for later seasons.
      const seriesMal = season === 1 ? myAnimeList([...list(series?.sameAs), ...list(series?.url)]) : null;
      const result = normalize({ imdbId: imdb(series?.sameAs) || imdb(series?.url) || imdb(series?.identifier), malId: seasonMal || seriesMal, season, episode: node.episodeNumber });
      if (result) results.push(result);
    }
    return consistent(results) ? Object.assign({}, ...results) : null;
  }
  function readDocument(doc = document, href = location.href) {
    const candidates = [];
    for (const node of doc.querySelectorAll('[data-page],script[type="application/ld+json"]')) {
      const raw = node.hasAttribute("data-page") ? node.getAttribute("data-page") : node.textContent;
      if (!raw || raw.length > 1000000) continue;
      try {
        const parsed = JSON.parse(raw);
        const value = node.hasAttribute("data-page") ? fromPage(parsed, href, doc.title) : fromStructuredData(parsed);
        if (value) candidates.push(value);
      } catch { /* Unrelated page data. */ }
    }
    return consistent(candidates) ? Object.assign({}, ...candidates) : null;
  }
  globalThis.SkipIntroEpisode = Object.freeze({ normalize, key, titleNumbers, fromPage, fromStructuredData, readDocument });
})();
