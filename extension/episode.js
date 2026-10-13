/* Extract explicit episode identities. Titles alone never identify an IMDb show. */
(() => {
  "use strict";
  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const integer = value => (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  function normalize(value) {
    const season = integer(value?.season), episode = integer(value?.episode);
    if (!/^tt\d{7,10}$/.test(value?.imdbId || "") || season === null || season < 0 || season > 1000 || episode === null || episode < 1 || episode > 10000) return null;
    const result = { imdbId: value.imdbId, season, episode };
    const tmdbId = integer(value.tmdbId);
    if (tmdbId > 0 && tmdbId <= 10000000) result.tmdbId = tmdbId;
    return result;
  }
  const key = value => value ? `${value.imdbId}:${value.season}:${value.episode}` : "";
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
  function fromStructuredData(value) {
    const nodes = list(value).flatMap(node => node?.["@graph"] ? list(node["@graph"]) : [node]);
    const results = [];
    for (const node of nodes) {
      if (!list(node?.["@type"]).includes("TVEpisode")) continue;
      const series = node.partOfSeries || node.partOfSeason?.partOfSeries;
      // The episode's own IMDb ID is not the series ID required by IntroDB.
      const result = normalize({ imdbId: imdb(series?.sameAs) || imdb(series?.url) || imdb(series?.identifier), season: node.partOfSeason?.seasonNumber, episode: node.episodeNumber });
      if (result) results.push(result);
    }
    return results.length && results.every(value => key(value) === key(results[0])) ? results[0] : null;
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
    return candidates.length && candidates.every(value => key(value) === key(candidates[0])) ? candidates[0] : null;
  }
  globalThis.SkipIntroEpisode = Object.freeze({ normalize, key, titleNumbers, fromPage, fromStructuredData, readDocument });
})();
