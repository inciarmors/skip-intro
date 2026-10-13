# Architecture

Manifest V3, with no backend, remote scripts, or runtime dependencies. Ordered content scripts share an isolated-world namespace: `core.js`, `fingerprint.js`, `analysis.js`, and `content.js`. A tiny background handler shares the owning tab's title with this extension's player frames using the existing host permissions. It accepts only messages from this extension, performs no network requests, and shares no page data with website scripts. The only privileged API permission is `storage`.

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
