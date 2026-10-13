# Site support notes

## StreamingCommunity

Target supplied by the user: `https://streamingcommunityz.shiksha/`.

Read-only HTML inspection on October 13, 2026 found a `Titles/Watch` Inertia page with explicit IMDb series and episode metadata. Version 0.3 reads `props.title.imdb_id`, `props.episode.number`, and `props.episode.season.number`. Embedded frames obtain the watch-page identity through extension messaging. An adapter is included for this observed shape; playback compatibility has not been verified.

The free IntroDB API returned these catalog results during development:

- The Mentalist, IMDb `tt1196946`, season 1 episode 1: no intro entry; an outro entry exists and is deliberately ignored.
- The Mentalist, season 1 episode 2: intro from 0 to 16 seconds.

These are database responses, not verified video boundaries. Different editions may not match. Live playback testing is left to the user.

## Other sites

Explicit Schema.org `TVEpisode` data is supported when it includes the series IMDb URL/identifier, season number, and episode number. Ambiguous metadata and title-only guesses do not trigger API calls. Native controls, timed player data, and local fingerprint learning remain available independently of IntroDB.

## User evaluation

- Reload the extension and watch page after upgrading; allow site and player-frame access.
- Open the popup while the video is visible to see IntroDB lookup status.
- Missing timing means the API has no intro entry for that episode, not that an outro should be skipped instead.
- Confirm the button appears only within the actual opening and its destination does not cut into the episode.
- Record misses or incorrect boundaries without sharing media files, cookies, signed URLs, or credentials.
