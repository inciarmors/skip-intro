# Architecture

Manifest V3, with no custom backend, remote scripts, or runtime dependencies. Ordered content scripts share an isolated-world namespace: `core.js`, `episode.js`, `catalog.js`, `fingerprint.js`, `analysis.js`, and `content.js`. Privileged permissions are `storage` and `webNavigation`; the latter identifies the selected player’s ancestor frames on demand. No navigation event listener or browsing-history collection is used.

## Catalog integration

`episode.js` supports explicit IMDb, TMDB, MyAnimeList, and AniList identities with season and episode numbers. It recognizes StreamingCommunity/Inertia metadata, JSON-LD, documented player routes, Flixer watch routes, and explicit namespaced query parameters. Numeric IDs on unknown routes are never assumed to be TMDB. See [site support](SITE-SUPPORT.md) for the maintained contracts.

When canonical identity is missing, titles such as `Show S01E02`, `Show Season 1 Episode 2`, or `Show 1x02` provide a bounded search candidate. TVmaze's free search API receives only the extracted show name. Results must contain exactly one normalized exact name, also matching the premiere year when supplied. Similar names and ambiguous remakes are rejected. A bare show title without episode numbers causes no search.

The background reads only the requesting player's ancestor chain, up to twelve frames, with `webNavigation.getAllFrames` and extension messages. Sibling players never supply identity. Ancestor URL, document ID when available, and content-script context are compared again after asynchronous lookups; a changed chain invalidates the result. Complementary IDs can be combined within this chain, while contradictory IDs or episode numbers are rejected. Explicit ID conflicts never fall back to title search.

The background first requests `https://api.introdb.app/segments?imdb_id=...&season=...&episode=...`, with credentials omitted, no referrer, redirects rejected, and an eight-second timeout. Returned identity must match the request. Milliseconds are converted to seconds once; only finite intro boundaries of 2–300 seconds are accepted. Null intro or HTTP 404 means no catalog timing, even when an outro is present. The player duration and seekable range are checked again before displaying the button and seeking.

If no primary timing is available, the background tries TheIntroDB's public `/v3/media` endpoint using canonical TMDB when available, otherwise IMDb, plus season, episode, and optional player duration. The returned TV/episode identity is validated, including TMDB when known. Intro arrays are normalized to seconds; null start means zero, while null end is rejected for an intro. Multiple bounded intro segments are supported. Other segment types are ignored. IMDb-only lookup relies on the provider's server-side ID mapping; duration is a release-selection hint, not a guarantee.

SkipDB is the next fallback, using `/api/segments` with IMDb, season, episode, `type=intro`, optional duration in seconds, and `adjust=none`. Identity must match. Shifted, adjusted, out-of-range, and beyond-duration segments are rejected. A null intro, the documented 0/0 sentinel, and season-wide length estimates do not create a button.

AniSkip is tried only with an explicit MyAnimeList season/cour ID and known player duration. JSON-LD may supply a MyAnimeList anime URL in `partOfSeason.sameAs` or `partOfSeason.url`; a series-level URL is accepted only for season 1. IMDb is optional for this path. The episode number belongs to that explicit entry: no fuzzy title matching, cross-season ID mapping, or absolute episode-number conversion is attempted. Only `op` results qualify, never `mixed-op`, endings, or recaps. Returned duration must match playback within two seconds, and timestamps are never shifted. Providers without the necessary IDs are skipped without a request.

Requests for the same provider/episode/release are coalesced. At most 100 response entries live in browser-session storage, with a six-hour positive TTL, fifteen-minute missing-result TTL, and thirty-second error TTL. HTTP 429 honors Retry-After and exhausted rate/usage reset headers with a bounded, provider-specific cooldown. A throttled provider does not block subsequent providers. No personal API keys, submissions, or database copies are used. Anime Skip uses the shared public client ID explicitly offered in its official client README, with its rate limits respected. An enabled-state generation token is checked before and after asynchronous steps. Disabling detection aborts active API fetches, invalidates pending work, and prevents late replies from starting a fallback or writing a cache result. Lookup state is shown in the popup.

Anime Skip follows AniSkip. It resolves MAL to AniList through an exact `Media(idMal: ...)` lookup only when an AniList ID is absent, then requests that AniList entry's show/episode index. It accepts a single episode with matching number, season (null is allowed only for season 1), and duration within two seconds. A separate request retrieves only that episode's timestamps. Only the plain intro type is accepted, ending at the next explicit timestamp. Mixed intros, a trailing intro without an end marker, duplicate editions, and conflicting timestamps are rejected. GraphQL errors remain failures even with HTTP 200. All steps share one cancellable twelve-second timeout and cannot continue after OFF.

Native controls and player metadata take precedence over catalogs; local recurrence is a fallback. Catalog state resets on player/source/route changes, is refreshed while the player is visible, and expires if background replies stop. Different edits of an episode can still have different timings; catalog availability is not proof that the returned timing matches every release.

## Player signals

Each authorized HTTP/HTTPS frame discovers visible HTML5 players in the document and open shadow roots. The main visible player is chosen by area and playback state. Native controls must be visible, enabled, inside its rectangle, and associated with a local ancestor containing exactly one video. Only explicit intro labels or semantic intro hooks are accepted. Ad and recap buttons are rejected.

Timed signals include chapter/metadata cues, `data-skip-intro-start` and `data-skip-intro-end` attributes, and JSON-LD `VideoObject.hasPart` clips with an intro label. Structured data must match the exact `contentUrl` of the selected media; page-wide timing is never guessed to belong to a video. Values must be finite, within the media duration, and form a 2–300 second range.

```html
<video data-skip-intro-start="42" data-skip-intro-end="128"></video>
```

```json
{"type":"intro","start":42,"end":128}
```

The JSON above is supported as text in a metadata cue. Chapter cues can use `Intro`, `Opening`, `Opening credits`, `Introduction`, or `Title sequence`. These are integration contracts, not metadata every streaming service provides.

## Live analysis without AI

The sampler processes only a currently selected, playing, visible video, at most once per media second during the first 600 seconds. It does not request media URLs. It uses a temporary 9×8 canvas for a luminance difference hash and, where available, `captureStream()` plus a Web Audio analyser for a normalized 32-band spectral descriptor.

The captured stream is connected only to an analyser, never to speakers. `createMediaElementSource()` is deliberately avoided because it can affect a site's audio routing. Capture tracks are owned by this extension and stopped when paused, hidden, disabled, replaced, or outside the sampling window. Canvas tainting, protected media, absent capture support, and blocked audio contexts cause graceful loss of that signal. They are not bypassed.

Raw media is never recorded or persisted. The stored data consists of timestamps and compact hexadecimal descriptors. Identifiable series are grouped using source-matched series metadata or episode-style titles such as `Example S1:E2`. Same-origin parent titles and the owning tab's title supplied by the extension background handler may supply that identity. Generic player titles do not establish a series. Known advertising states suspend sampling and detection.

## Deterministic recurrence matcher

A sliding eight-sample window is compared against earlier episodes using visual Hamming distance and normalized spectral distance. At least seven samples must agree, the reference must vary enough to reject still frames/static tones, and times must be contiguous.

A run shared by two different episodes becomes a template after three unmatched samples establish its end. Accepted recurring sequences last 18–240 seconds. The template ends at the last confirmed matching sample. A later matching window predicts the current occurrence's start and end. The proposed range expires if the live evidence stops matching, playback is interrupted, or the observation becomes stale.

These are conservative heuristics, not a semantic classifier. Similar recaps, repeated scenes, or reused sequences can still match. Synthetic algorithm tests do not establish precision on real shows. Boundary accuracy, false positives, CPU use, and site coverage require user validation.

## Persistence

`storage.local` holds `enabled` and `fingerprints:v1:<series-hash>`. A series record contains up to four sampled episodes, four learned templates, and an update timestamp. At most twelve series are retained. Episode and series identities are SHA-256 hashes; raw URLs/titles are not saved. Hashing is not anonymization.

Legacy `intro:` records from version 0.1 are removed automatically and never consulted by detection. There is no UI for entering start/end times. Disabling detection releases capture resources; uninstalling removes extension storage.

## UI and seeking

The only injected control is a white frosted-glass **Skip intro** button with a black skip icon. It is never revealed by hover. Before acting, the extension rechecks the selected player and current signal. A native candidate forwards the click; a timed candidate must still be active and its endpoint seekable before `currentTime` is assigned. No automatic playback jump occurs.

Mutation discovery and bounded periodic checks handle new players, routes, frames, and open shadow roots. Container fullscreen is supported; native video fullscreen and Picture-in-Picture cannot host the DOM overlay.

## References

- [Chrome content scripts and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [HTMLMediaElement text tracks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/textTracks)
- [Schema.org clip offsets](https://schema.org/startOffset)
- [Mozilla manifest settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

## OFF and browser lifecycle

The Chrome background is a service worker; Firefox manages background lifetime through its Manifest V3 event-page lifecycle. The generated manifest omits `persistent`, which causes an unsupported-property warning in Firefox MV3. Neither background has an interval or keep-alive loop. Settings and runtime-message listeners are registered synchronously. No tab-navigation listener wakes the background while OFF. Session caches survive background suspension; the enabled state is read before any metadata lookup.

The content controller starts its polling interval and DOM/player observers only when enabled and visible. OFF cancels intervals, animation frames, and click cooldowns; disconnects observers and player/scroll/resize listeners; restores text-track modes; stops analysis and catalog state; and removes the overlay. Visibility changes suspend and resume active detection. BFCache page transitions are handled through pagehide/pageshow.

The analyser starts its sampling interval only after establishing a series matcher and stops it in `stop()`. Audio resume listeners and captured tracks are released as well. The popup stops status polling while OFF. Lightweight settings, visibility, and runtime listeners remain to support reactivation. The browser ultimately controls whether the background context is unloaded, and a connected debugger may keep it alive.
