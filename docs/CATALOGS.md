# Free catalog integrations

Reviewed October 13, 2026. The extension queries individual episodes, with no account, API key, database download, or media upload. It stops at the first usable intro. Missing data, service failures, and rate limits allow the next eligible provider to run.

| Order | Provider | Required identity | Playback matching |
| --- | --- | --- | --- |
| 1 | [IntroDB](https://introdb.app/docs/api) | IMDb series, season, episode | Explicit episode boundaries |
| 2 | [TheIntroDB](https://theintrodb.org/openapi.yaml) | TMDB or IMDb series, season, episode | Duration hint; the service can return a popular release |
| 3 | [SkipDB](https://skipdb.tv/docs) | IMDb series, season, episode | Duration when available; no timestamp shifting |
| 4 | [AniSkip](https://api.aniskip.com/api-docs) | MyAnimeList season/cour entry and its episode number | Known duration required, within two seconds of the returned release |

Only opening segments qualify. SkipDB estimates for an entire season cannot locate an individual episode's intro and are ignored. AniSkip mixed openings may contain story scenes and are excluded. No result is a guarantee of alignment with every edition.

## Anime identity

AniSkip is not an IMDb lookup service. The page must explicitly identify the MyAnimeList entry belonging to the current season/cour. The generic adapter accepts a `TVEpisode` whose `partOfSeason.sameAs` or `partOfSeason.url` contains a MyAnimeList `/anime/{id}` URL. A `partOfSeries` URL is accepted only for season 1. Season and episode numbers are required. Conflicting entries are rejected.

For example, this metadata binds episode 1 to MyAnimeList entry 9253:

```json
{
  "@type": "TVEpisode",
  "episodeNumber": 1,
  "partOfSeason": {
    "seasonNumber": 1,
    "sameAs": "https://myanimelist.net/anime/9253/"
  }
}
```

This is a website integration contract, not a manual extension setting. IMDb-only pages cannot use AniSkip without a verified mapping. Split cours, absolute episode numbering, and inconsistent site metadata need dedicated adapters; the extension never guesses them from a title.

## Other sources considered

| Source | Reason it is not enabled |
| --- | --- |
| [IntroHater](https://github.com/introhaterapp/IntroHater) | Its public documentation host returned a service-suspended notice during inspection. No working public endpoint was verified. |
| [SkipMe.db](https://github.com/intro-skipper/skipme.db-plugin) | The public Jellyfin client requires a service URL supplied at build time; its README does not establish a public endpoint for third-party clients. |
| [The Open Skip Database](https://github.com/The-Open-Skip-Database/db) | The linked service could not be reached during inspection. No usable public API contract was verified. |
| Local Jellyfin/Plex markers | Require access to the user's media server; they are not anonymous global catalogs. |
| TMDB, IMDb, TVMaze | Title identification is distinct from intro timestamps; these are not substituted for timing databases. |

Unavailable services are not contacted speculatively. Reconsider them when a working public read API and usage terms can be verified. Mirrors of the same database do not count as additional independent coverage.

## Attribution and coverage

Intro data is provided by IntroDB, TheIntroDB, SkipDB, and AniSkip, with links in the popup. SkipDB's API data uses [ODbL 1.0 + Service Provider Reciprocity](https://skipdb.tv/license). The extension only displays individual API results and keeps a bounded session cache; it does not merge results into a new database. Project source licensing does not change third-party data licenses.

Four integrations do not establish 90% coverage or coverage of almost every series. That requires a representative playback evaluation measuring both missed intros and incorrect skips. Missing website identity, unlisted episodes, edition differences, and unavailable services remain independent failure modes. Live playback evaluation is left to the user.
