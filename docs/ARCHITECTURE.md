# Architecture

Manifest V3, with no background worker or backend. Content scripts run in authorized HTTP/HTTPS frames; each frame manages its own main player. `core.js` contains pure functions shared with the tests. `content.js` handles the DOM, storage, and interaction.

## Detection

Priority: saved manual timing → explicit attributes → chapters/metadata. The first valid range becomes the candidate. The button appears only within `[start, end)`; clicking it revalidates duration and `seekable`, then sets `video.currentTime = end`. Playback remains paused or playing according to the user's existing choice.

Accepted ranges are finite, last 2–300 seconds, and fit within the media duration. Subtitles and generic page text are not treated as intros. Disabled chapter tracks are switched to `hidden` to load their cues and restored when the selected player changes or the extension is disabled. Subtitle tracks are not modified.

A cooperating player can expose:

```html
<video data-skip-intro-start="42" data-skip-intro-end="128"></video>
```

Or a WebVTT cue in a `chapters` track:

```vtt
WEBVTT

00:00:42.000 --> 00:02:08.000
Intro
```

Or a cue in a `metadata` track containing JSON:

```json
{"type":"intro","start":42,"end":128}
```

These are supported prototype contracts, not metadata exposed by every streaming service. All values are validated; page-provided text is never inserted as HTML.

## State and data

Local storage holds `enabled` and `intro:<sha256>` keys, each containing `{start, end}`. The hash includes the full page URL, media source, duration rounded to a tenth of a second, and video index. Session-specific `blob:` URLs are replaced with a stable marker; streams without a readable source use the same strategy.

An identity change clears the range, controls, and pending manual start. A generation counter prevents asynchronous reads for an old video from updating the new player. Hashing is not anonymization: someone with known URLs could compare their hashes. These values remain in the browser.

## Integration and UI

The overlay uses Shadow DOM to isolate its styles. It follows the video rectangle and moves inside a fullscreen player container when appropriate. It appears during the intro or on hover, and remains visible while the user adjusts timing. Periodic checks handle replaced players and SPA navigation without patching site code.

HTTP/HTTPS permissions allow the feature to run across domains and embedded players. The only privileged API permission is `storage`. It does not require cookies, browsing history, tab capture, downloads, or network interception.

## Official references

- [Chrome: content scripts and frames](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Mozilla: browser-specific settings and data collection declarations](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
