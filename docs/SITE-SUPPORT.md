# Site support notes

## StreamingCommunity

Target supplied by the user: `https://streamingcommunityz.shiksha/`.

Read-only HTML inspection on October 13, 2026 found a `Titles/Watch` Inertia page with explicit IMDb series and episode metadata. Version 0.4 reads `props.title.imdb_id`, `props.title.tmdb_id`, `props.episode.number`, and `props.episode.season.number`. Embedded frames obtain the watch-page identity through extension messaging. An adapter is included for this observed shape; playback compatibility has not been verified.

The free IntroDB API returned these catalog results during development:

- The Mentalist, IMDb `tt1196946`, season 1 episode 1: no intro entry; an outro entry exists and is deliberately ignored.
- The Mentalist, season 1 episode 2: intro from 0 to 16 seconds.

These are database responses, not verified video boundaries. Different editions may not match. Live playback testing is left to the user.

## Other sites

Explicit Schema.org `TVEpisode` data is supported when it includes the series IMDb URL/identifier, season number, and episode number. Ambiguous metadata and title-only guesses do not trigger API calls. Native controls, timed player data, and local fingerprint learning remain available independently of IntroDB.

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
