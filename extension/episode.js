/* Extract explicit episode identities. Titles alone never identify a catalog entry. */
(() => {
  "use strict";
  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const integer = value => (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  function normalize(value) {
    const season = integer(value?.season), episode = integer(value?.episode);
    const imdbId = /^tt\d{7,10}$/.test(value?.imdbId || "") ? value.imdbId : null;
    const malId = integer(value?.malId);
    const tmdbId = integer(value?.tmdbId);
    const anilistId = integer(value?.anilistId);
    const hasAnilist = anilistId > 0 && anilistId <= 10000000;
    const hasMal = malId > 0 && malId <= 10000000;
    const hasTmdb = tmdbId > 0 && tmdbId <= 10000000;
    if ((!imdbId && !hasMal && !hasTmdb && !hasAnilist) || season === null || season < 0 || season > 1000 || episode === null || episode < 1 || episode > 10000) return null;
    const result = { season, episode };
    if (imdbId) result.imdbId = imdbId;
    if (hasMal) result.malId = malId;
    if (hasAnilist) result.anilistId = anilistId;
    if (hasTmdb) result.tmdbId = tmdbId;
    return result;
  }
  const key = value => value ? `${value.imdbId || (value.tmdbId ? `tmdb${value.tmdbId}` : value.malId ? `mal${value.malId}` : `anilist${value.anilistId}`)}:${value.season}:${value.episode}` : "";
  const fields = ["imdbId", "tmdbId", "malId", "anilistId"];
  function merge(values) {
    const entries = values.filter(Boolean);
    if (!entries.length) return null;
    const first = entries[0];
    if (entries.some(value => value.season !== first.season || value.episode !== first.episode) || fields.some(field => new Set(entries.map(value => value[field]).filter(Boolean)).size > 1)) return null;
    // The same page/frame ancestry can supply complementary canonical IDs.
    return normalize(Object.assign({}, ...entries));
  }
  const signature = value => value ? `${key(value)}:${value.imdbId || ""}:${value.tmdbId || ""}:${value.malId || ""}:${value.anilistId || ""}` : "";
  function titleNumbers(title) {
    const match = String(title).match(/\bs(\d+)\s*[:.\-]?\s*e(\d+)\b/i) || String(title).match(/\bseason\s+(\d+)\s*[,.:\-]?\s*episode\s+(\d+)\b/i);
    return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
  }
  function titleQuery(title) {
    if (typeof title !== "string" || title.length > 500) return null;
    const match = title.match(/^(?:watch\s+)?(.+?)\s*(?:[-–—:|]\s*)?(?:s(\d+)\s*[:.\-]?\s*e(\d+)|season\s+(\d+)\s*[,.:\-]?\s*episode\s+(\d+)|(\d+)x(\d+))\b/i);
    if (!match) return null;
    let name = match[1].replace(/[\s\-–—:|[(]+$/, "").trim();
    const yearMatch = name.match(/\s*\((\d{4})\)$/);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    if (yearMatch) name = name.slice(0, yearMatch.index).trim();
    const season = Number(match[2] || match[4] || match[6]), episode = Number(match[3] || match[5] || match[7]);
    if (name.length < 2 || name.length > 150 || season > 1000 || episode < 1 || episode > 10000 || year && (year < 1900 || year > 2100)) return null;
    return { title: name, season, episode, ...(year ? { year } : {}) };
  }
  function normalizeQuery(value) {
    if (typeof value?.title !== "string" || !Number.isSafeInteger(value.season) || !Number.isSafeInteger(value.episode) || value.year !== undefined && !Number.isSafeInteger(value.year)) return null;
    const query = titleQuery(`${value.title}${value.year ? ` (${value.year})` : ""} S${value.season}E${value.episode}`);
    return query?.title === value.title && query.season === value.season && query.episode === value.episode && query.year === value.year ? query : null;
  }
  function parseTVMaze(data, query) {
    if (!Array.isArray(data) || data.length > 100) throw new Error("Invalid show search response");
    const nameKey = value => typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") : "";
    const matches = data.filter(item => nameKey(item?.show?.name) === nameKey(query.title) && (!query.year || String(item.show.premiered).startsWith(`${query.year}-`)));
    // An exact name can still identify multiple unrelated shows or remakes.
    if (matches.length !== 1) return null;
    return normalize({ imdbId: matches[0].show.externals?.imdb, season: query.season, episode: query.episode });
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
  function animeId(value, hosts = ["myanimelist.net", "www.myanimelist.net"]) {
    const ids = [];
    for (const item of list(value)) {
      if (typeof item !== "string") continue;
      try {
        const url = new URL(item);
        const match = url.pathname.match(/^\/anime\/(\d+)(?:\/|$)/);
        if (hosts.includes(url.hostname) && match) ids.push(Number(match[1]));
      } catch { /* Not a MyAnimeList URL. */ }
    }
    return ids.length && ids.every(id => id === ids[0]) ? ids[0] : null;
  }
  function tmdb(value) {
    const ids = [];
    for (const item of list(value)) {
      if (typeof item !== "string") continue;
      try {
        const url = new URL(item), match = url.pathname.match(/^\/tv\/(\d+)(?:[-/]|$)/);
        if (["themoviedb.org", "www.themoviedb.org"].includes(url.hostname) && match) ids.push(Number(match[1]));
      } catch { /* Not a TMDB series URL. */ }
    }
    return ids.length && ids.every(id => id === ids[0]) ? ids[0] : null;
  }
  function fromUrl(href) {
    let url;
    try { url = new URL(href); } catch { return null; }
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, "");
    const flixer = ["flixer.gd", "flixer.su", "flixer.cx", "flixor.ru"].includes(host) && url.pathname.match(/^\/watch\/tv\/(\d+)\/(\d+)\/(\d+)\/?$/);
    if (flixer) return normalize({ tmdbId: flixer[1], season: flixer[2], episode: flixer[3] });
    // Numeric route IDs are interpreted only for documented player contracts.
    const direct = ["vidlink.pro", "vixsrc.to", "vidfast.pro", "vidfast.vc"].includes(host);
    const embed = ["vidking.net", "vidsrc.to", "vidsrc.me", "vidsrc.xyz", "vidsrc.sh", "vidsrcme.ru", "vidsrcme.su", "vidsrc-me.ru", "vidsrc-me.su", "vidsrc-embed.ru", "vidsrc-embed.su", "vsrc.su", "vidsrc2.ru"].includes(host);
    const match = (direct ? url.pathname.match(/^\/tv\/(tt\d{7,10}|\d+)\/(\d+)\/(\d+)\/?$/) : null) || (embed ? url.pathname.match(/^\/embed\/tv\/(tt\d{7,10}|\d+)\/(\d+)[/-](\d+)\/?$/) : null);
    if (match) return normalize({ [match[1].startsWith("tt") ? "imdbId" : "tmdbId"]: match[1], season: match[2], episode: match[3] });
    const anime = host === "vidlink.pro" && url.pathname.match(/^\/anime\/(\d+)\/(\d+)\/(?:sub|dub)\/?$/);
    if (anime) return normalize({ malId: anime[1], season: 1, episode: anime[2] });
    // Explicit namespaces work on any site; generic ?id=123 is never guessed.
    const params = url.searchParams;
    const read = names => {
      const values = names.flatMap(name => params.getAll(name));
      return values.length && new Set(values).size === 1 ? values[0] : null;
    };
    // Duplicate contradictory parameters invalidate the whole route.
    if ([["type", "media_type"], ["imdb_id", "imdb"], ["tmdb_id", "tmdb"], ["mal_id"], ["anilist_id"], ["season"], ["episode"]].some(names => new Set(names.flatMap(name => params.getAll(name))).size > 1)) return null;
    const type = read(["type", "media_type"]);
    if (type && !["tv", "series", "anime"].includes(type)) return null;
    return normalize({ imdbId: read(["imdb_id", "imdb"]), tmdbId: read(["tmdb_id", "tmdb"]), malId: read(["mal_id"]), anilistId: read(["anilist_id"]), season: read(["season"]), episode: read(["episode"]) });
  }
  function fromStructuredData(value) {
    const nodes = list(value).flatMap(node => node?.["@graph"] ? list(node["@graph"]) : [node]);
    const results = [];
    for (const node of nodes) {
      if (!list(node?.["@type"]).includes("TVEpisode")) continue;
      const series = node.partOfSeries || node.partOfSeason?.partOfSeries;
      // The episode's own IMDb ID is not the series ID required by IntroDB.
      const season = integer(node.partOfSeason?.seasonNumber);
      const seasonMal = animeId([...list(node.partOfSeason?.sameAs), ...list(node.partOfSeason?.url)]);
      // MAL entries represent individual seasons/cours. A series-level URL is
      // usable only for season 1, never as a guessed mapping for later seasons.
      const seriesMal = season === 1 ? animeId([...list(series?.sameAs), ...list(series?.url)]) : null;
      const anilistHosts = ["anilist.co", "www.anilist.co"];
      const anilistId = animeId([...list(node.partOfSeason?.sameAs), ...list(node.partOfSeason?.url)], anilistHosts) || (season === 1 ? animeId([...list(series?.sameAs), ...list(series?.url)], anilistHosts) : null);
      const result = normalize({ anilistId, imdbId: imdb(series?.sameAs) || imdb(series?.url) || imdb(series?.identifier), tmdbId: tmdb([...list(series?.sameAs), ...list(series?.url)]), malId: seasonMal || seriesMal, season, episode: node.episodeNumber });
      if (result) results.push(result);
    }
    return merge(results);
  }
  function readDocument(doc = document, href = location.href) {
    const candidates = [fromUrl(href)];
    for (const node of doc.querySelectorAll('[data-page],script[type="application/ld+json"]')) {
      const raw = node.hasAttribute("data-page") ? node.getAttribute("data-page") : node.textContent;
      if (!raw || raw.length > 1000000) continue;
      try {
        const parsed = JSON.parse(raw);
        const value = node.hasAttribute("data-page") ? fromPage(parsed, href, doc.title) : fromStructuredData(parsed);
        if (value) candidates.push(value);
      } catch { /* Unrelated page data. */ }
    }
    return merge(candidates);
  }
  globalThis.SkipIntroEpisode = Object.freeze({ normalize, key, signature, merge, fromUrl, titleNumbers, titleQuery, normalizeQuery, parseTVMaze, fromPage, fromStructuredData, readDocument });
})();
