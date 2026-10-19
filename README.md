# Skip Intro

An automatic-only Chrome and Firefox extension with a minimal, monochrome glass button. It appears during a detected opening and skips it when clicked. There are no timing fields, marking controls, or hover panels.

> **0.6.0 / experimental.** Detection uses free IntroDB, TheIntroDB, SkipDB, AniSkip, and Anime Skip APIs, player signals, and deterministic live audio/visual fingerprints. No AI, no extra video downloads, and no saved media files. Coverage is not universal: unfamiliar openings, inaccessible media, and ambiguous sequences may not be recognized. Recurrence is evidence of repeated content, not proof that it is an intro.

## Detection

The extension tries these sources in order:

1. **Native player controls.** A visible, enabled, explicitly labeled intro button inside the selected player. The extension forwards your click to that control; it does not invent an end time.
2. **Timed player data.** Intro chapter cues, metadata cues, explicit timing attributes, and Schema.org intro clips tied to the exact media source.
3. **Catalog timestamps.** Episode identity comes from page metadata, documented player URLs, or an exact, unique TVmaze show-name match when the page title includes season and episode numbers. IMDb, TMDB, MyAnimeList, and AniList identities are supported. The background checks IntroDB, TheIntroDB, and SkipDB in order until it finds an intro, skipping catalogs whose required IDs are unavailable. TMDB-only pages can query TheIntroDB directly. AniSkip is an additional anime fallback when the page explicitly identifies the MyAnimeList season/cour and episode. Anime Skip provides a fifth fallback using exact AniList mappings and a matching release duration. No user account or personal API key is required. Only intro segments are accepted; credits and recaps are never substituted. The popup names the provider that supplied the timing.
4. **Live recurring sequences.** During normal playback, small visual/audio descriptors are compared with earlier episodes of an identifiable series. Once a sufficiently distinctive sequence has recurred across two different episodes, its pattern can identify a subsequent occurrence.

On a new series without player metadata or a catalog result, the extension must first observe matching openings across episodes. A learned opening typically needs several seconds of matching playback before the button appears. It cannot know the ending of an unseen intro from a single live frame. Silence, black frames, static imagery, pauses, and discontinuous playback are rejected as learning evidence.

The fourth strategy is an experimental deterministic matcher, not a trained model. Recaps or other repeated opening material may still be misclassified. Player-provided boundaries are preferable whenever available.

## What stays in the browser

- Playback is sampled at most once per media second during the first ten minutes.
- Each visual sample becomes a 64-bit difference hash from a temporary 9×8 canvas.
- Accessible audio becomes a compact 32-band spectral descriptor through Web Audio.
- Raw frames and audio buffers are not persisted, recorded, uploaded, or assembled into video files.
- Local storage contains the enabled setting and a bounded library of numeric fingerprints with hashed identities. It retains at most twelve series and four sampled episodes/patterns per series.
- IntroDB receives the IMDb series ID, season, and episode through HTTPS. TheIntroDB receives TMDB (or IMDb), season, episode, and video duration for release matching, only when fallback is needed. SkipDB receives IMDb, season, episode, and optional duration in seconds. AniSkip receives the explicit MyAnimeList ID, episode number, and duration in seconds. Anime Skip receives AniList and internal episode IDs; AniList may receive a MAL ID for exact mapping. TVmaze receives the extracted show name when canonical IDs are missing. No site URL, full page title, cookies, fingerprint, or media is sent. Each contacted service also sees the normal network connection information, including your IP address.
- A temporary browser-session cache holds at most 100 provider/episode results: successful lookups for six hours, missing intros for fifteen minutes, and failures for thirty seconds. It is cleared when the browser session ends. Show-name identification shares this bounded session cache. There is no database replication; Anime Skip reads a matching show’s episode index before requesting timestamps for one episode.
- No custom backend, AI model, media fetcher, or download permission is used.

Normal playback still transfers and buffers media through the website's own player. The extension adds no independent video download. See [privacy](docs/PRIVACY.md) and [architecture](docs/ARCHITECTURE.md).

## Installation

Requires Node.js 22+ and npm for development. The packaged extension has no runtime dependencies.

```sh
git clone https://github.com/inciarmors/skip-intro.git
cd skip-intro
npm ci
npm run build
```

**Chrome 120+**

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `dist/chrome`.
3. Reload open video pages.

**Firefox 142+ desktop**

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and select `dist/firefox/manifest.json`.
3. Grant the requested site access, frame-navigation access, and episode-metadata transmission permission, then reload video pages. Temporary installation ends when Firefox closes.

It is not published in the extension stores. Persistent Firefox installation requires Mozilla signing.

## Use

Enable **Automatic detection** in the popup, then watch normally. When an actionable intro is detected, **Skip intro** appears over the player. Click it to advance; playback is never skipped without your click. No signal means no overlay. Switching OFF cancels API requests, stops sampling and page polling, disconnects player observers, and removes the button. Switching ON restarts detection without a page reload. The popup reports missing episode identity, missing catalog timings, temporary API failures, or a timing ready to use. After updating, reload the extension and the video page.

The design follows a black-and-white palette with a frosted white button, dark icon, subtle glass surfaces, and reduced-motion support. All project text and interfaces are in English.

## Background lifecycle

Chrome runs a Manifest V3 service worker; Firefox uses the Manifest V3 event-page lifecycle without a `persistent` property. The browser suspends these contexts when idle. Being listed in a debug screen does not mean the extension is continuously analysing video.

OFF stops active extension work. The small settings/message listeners remain registered so ON can work again; the browser controls unloading the background context. To fully unload the add-on, disable it through the browser's extension manager. Keeping its debugger open may keep a background context alive.

The manifest includes PNG icons at 16, 32, 48, 96, and 128 pixels, generated from the existing skip glyph. To regenerate the committed assets, run `python3 scripts/generate-icons.py`.

## Limits

- Automatic does not mean universal. Cross-origin media restrictions, protected playback, missing episode identity, or opaque players can prevent learning. Browser audio policies may require a normal user interaction before audio sampling can start.
- Learning requires a recognizable series/episode title or explicit series metadata. It does not pool unrelated shows under a generic player title.
- Player APIs are used without bypassing DRM, CORS, authentication, or browser permissions. The extension never replaces the player's audio source.
- The live matcher currently needs a distinctive repeated sequence lasting 18–240 seconds, a matching run of eight samples, and uninterrupted accessible playback. Very short or substantially edited openings can be missed.
- The inferred end is conservative: the last confirmed matching sample. It may leave a small part of an opening unskipped. Music or visual repetition alone does not establish semantic certainty.
- Closed shadow roots, browser-internal pages, native video-element fullscreen, and Picture-in-Picture are unsupported. Open shadow roots and fullscreen player containers are handled.
- A native player may reject a programmatic forwarded click. Small or hidden videos and unseekable ranges do not receive a button.
- StreamingCommunity watch-page metadata has an adapter for its observed `Titles/Watch` format. Other sites can use supported player URLs, structured data, explicit namespaced URL parameters, or a page title such as `The Mentalist S1E2` that resolves uniquely through TVmaze. Parent frame identity is carried into nested players. See the [FMHY compatibility scope](docs/SITE-SUPPORT.md); this does not certify every listed site.
- Catalog coverage and timing accuracy vary by episode and edition. TheIntroDB uses the player duration as a release-selection hint; it may return its most popular version if no matching release exists. The extension uses the returned boundaries without assuming that different cuts share the same timing.
- The requested StreamingCommunity domain is an evaluation target, not a certified integration. Live playback validation is left to the user; see [site notes](docs/SITE-SUPPORT.md).

## Local signal lab

```sh
npm run demo
```

Open `http://127.0.0.1:4173` with the extension loaded. **Generate test scene** creates a synthetic 16-second clip in memory, with an intro from second 3 to second 9. It never downloads real media or saves a media file.

The lab can expose chapters, a native button, structured metadata, or no signal. These simulate site behavior; they are not extension settings. It verifies player-signal paths, not the accuracy of live fingerprint recognition on real shows.

## Development

```sh
npx playwright install chromium firefox
npm run check
npm run package
```

The suite includes pure signal/fingerprint fixtures, controlled browser scenarios, and a synthetic Chromium extension scenario. Synthetic fixtures do not establish real-world recognition accuracy. See the [contribution guide](CONTRIBUTING.md).

`package` writes `artifacts/skip-intro-chrome.zip` and `artifacts/skip-intro-firefox.zip` using `zip`. Firefox packages are unsigned. Generated files are excluded from Git.

```text
extension/core.js         Validated player signals and seek boundaries
extension/episode.js      Explicit episode metadata extraction
extension/introdb.js      Five free catalog provider contracts
extension/background.js   Free API fallback, cancellation, and session cache
extension/catalog.js      Current player and catalog result binding
extension/fingerprint.js  Deterministic sequence matcher
extension/analysis.js     In-browser sampling and bounded fingerprint storage
extension/content.js      Player discovery, automatic button, and click handling
extension/popup.*         On/off control, catalog diagnostics, and glass interface
extension/icons/         Skip glyph icons for toolbar and extension management
demo/                     Synthetic signal lab
```

Intro data provided by [IntroDB](https://introdb.app), [TheIntroDB](https://theintrodb.org), [SkipDB](https://skipdb.tv), [AniSkip](https://github.com/aniskip), and [Anime Skip](https://anime-skip.com). Metadata identification uses [TVmaze](https://www.tvmaze.com/api) and [AniList](https://anilist.co). SkipDB data is licensed under [ODbL 1.0 + Service Provider Reciprocity](https://skipdb.tv/license); the extension uses individual read-only lookups and does not build a database from these results. See the [catalog comparison and integration requirements](docs/CATALOGS.md). Free API access does not imply unrestricted database redistribution.

[Roadmap](docs/ROADMAP.md) · [Architecture](docs/ARCHITECTURE.md) · [Privacy](docs/PRIVACY.md) · [MIT license](LICENSE)
