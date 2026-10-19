# Site support notes

## FMHY scope in version 0.6

The [FMHY video directory](https://fmhy.net/video) was reviewed on October 19, 2026. It lists independent sites, shared embeds, live channels, and native apps. This extension operates in browser pages with an accessible HTML5 player. Directory membership alone is not a compatibility signal.

The following identity paths are implemented. Route contracts and metadata were inspected; live playback on these sites has not been tested by the project.

| Site or player family | Episode identity path | Evidence |
| --- | --- | --- |
| StreamingCommunity | Inertia `Titles/Watch` page metadata | Observed page structure |
| Flixer (`flixer.gd`, `.su`, `.cx`) and Flixor (`flixor.ru`) | `/watch/tv/{tmdbId}/{season}/{episode}` | Public application route definitions inspected October 19 |
| VidLink | `/tv/{tmdbId}/{season}/{episode}` and `/anime/{malId}/{episode}/{subOrDub}` | [Official documentation](https://vidlink.pro) |
| VixSrc | `/tv/{imdbOrTmdbId}/{season}/{episode}` | [Official documentation](https://vixsrc.to) |
| VidFast | `/tv/{imdbOrTmdbId}/{season}/{episode}` on `.pro` and `.vc` | [Official documentation](https://vidfast.vc) |
| Vidking | `/embed/tv/{tmdbId}/{season}/{episode}` | [Official documentation](https://www.vidking.net) |
| VidSrc | Complete episode routes on `.to`, `.me`, `.xyz`, `.sh` and mirrors named in `episode.js` | [Episode contract](https://vidsrc.to), [current domains](https://vidsrc.sh) |
| Any site embedding these players | Same identity, inherited along the selected player's actual ancestor chain | No parent-domain allowlist required |
| Any site with canonical URL fields | Explicit `imdb_id`/`imdb`, `tmdb_id`/`tmdb`, `mal_id`, or `anilist_id`, plus `season` and `episode` | Arbitrary numeric `id` is ignored |
| Any site with episode structured data | JSON-LD `TVEpisode` with canonical series/season links and episode numbers | Generic metadata adapter |
| Any site with a descriptive episode title | `Show S01E02`, `Show Season 1 Episode 2`, or `Show 1x02` | TVmaze exact-name identification; ambiguous matches rejected |

TMDB-only pages can now use TheIntroDB without IMDb. IMDb-only catalogs are skipped until that ID is available. Title search runs only when canonical identity is absent, never to override conflicting IDs. A year such as `(2008)` can disambiguate a remake. Translated names, missing episode numbers, and different numbering schemes may still fail.

Nested frames require the new `webNavigation` permission. Only the requesting player's ancestors supply identity, not sibling advertisements or unrelated tabs. A changed frame, route, or identity invalidates an outstanding result. Reload the extension and video page after updating and grant the new permission when prompted.

### Still unverified or unsupported

Movy's public title pages were readable but do not establish a complete episode route by themselves. Rive could not be inspected reliably over the available HTTPS connection. Neither is claimed as a dedicated integration. Generic title/metadata or supported embedded-player paths may still work there. Other FMHY sites remain unverified unless they expose one of the contracts above.

Live TV without a seekable episode, native apps outside the browser, opaque players, missing timings, and protected/inaccessible media remain outside these guarantees. FMHY is not downloaded or consulted at runtime. There is no claim that every listed site works, or that adding a domain alone fixes playback.

## StreamingCommunity

Target supplied by the user: `https://streamingcommunityz.shiksha/`.

Read-only HTML inspection on October 13, 2026 found a `Titles/Watch` Inertia page with explicit IMDb series and episode metadata. Version 0.4 reads `props.title.imdb_id`, `props.title.tmdb_id`, `props.episode.number`, and `props.episode.season.number`. Embedded frames obtain the watch-page identity through extension messaging. An adapter is included for this observed shape; playback compatibility has not been verified.

The free IntroDB API returned these catalog results during development:

- The Mentalist, IMDb `tt1196946`, season 1 episode 1: no intro entry; an outro entry exists and is deliberately ignored.
- The Mentalist, season 1 episode 2: intro from 0 to 16 seconds.

These are database responses, not verified video boundaries. Different editions may not match. Live playback testing is left to the user.

## Other sites

Explicit Schema.org `TVEpisode` data supports IMDb/TMDB series links and MyAnimeList/AniList season links with season and episode numbers. Complete episode titles can use the strict TVmaze resolver described above. Native controls, timed player data, and local fingerprint learning remain available independently of IntroDB.

## User evaluation

- Reload the extension and watch page after upgrading; allow site and player-frame access.
- Open the popup while the video is visible to see catalog lookup status and the timing provider.
- Missing timing means the API has no intro entry for that episode, not that an outro should be skipped instead.
- Confirm the button appears only within the actual opening and its destination does not cut into the episode.
- Record misses or incorrect boundaries without sharing media files, cookies, signed URLs, or credentials.

## Catalog fallback

IntroDB is queried first. TheIntroDB is queried only when needed; all supported reads are anonymous and have rate limits. TheIntroDB has public open-source integration repositories, but unrestricted database redistribution has not been established. Skip Intro uses individual API calls only.

A read-only TheIntroDB API lookup on October 13, 2026 returned an intro for Breaking Bad S1E1 (TMDB 1396): 228.664–246.143 seconds. IntroDB had returned no intro for that episode during the earlier inspection. This demonstrates a complementary catalog entry, not verified playback alignment or a measured coverage percentage.

The Mentalist S1E1 still had no intro in the inspected TheIntroDB response. A fallback cannot create entries missing from both catalogs.

Version 0.5 adds SkipDB after TheIntroDB and AniSkip for explicit MyAnimeList identities. The Mentalist S1E1 also had no SkipDB intro during the October 13 inspection. AniSkip returned an opening for MyAnimeList 9253 episode 1, but that response alone does not verify any streaming site. The StreamingCommunity adapter does not currently expose a MyAnimeList ID, so AniSkip is not used there. See [catalog integration requirements](CATALOGS.md).
