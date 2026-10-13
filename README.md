# Skip Intro

**Straight to the story.** An automatic-only Chrome and Firefox extension with a minimal, monochrome glass button. It appears during a detected opening and skips it when clicked. There are no timing fields, marking controls, or hover panels.

> **0.3.0 / experimental.** Detection uses the free IntroDB API, player signals, and deterministic live audio/visual fingerprints. No AI, no extra video downloads, and no saved media files. Coverage is not universal: unfamiliar openings, inaccessible media, and ambiguous sequences may not be recognized. Recurrence is evidence of repeated content, not proof that it is an intro.

## Detection

The extension tries these sources in order:

1. **Native player controls.** A visible, enabled, explicitly labeled intro button inside the selected player. The extension forwards your click to that control; it does not invent an end time.
2. **Timed player data.** Intro chapter cues, metadata cues, explicit timing attributes, and Schema.org intro clips tied to the exact media source.
3. **IntroDB timestamps.** Explicit page metadata identifies the IMDb series, season, and episode. The background script calls the public `/segments` API without an account or API key. Only an `intro` segment is accepted; credits and recaps are never substituted.
4. **Live recurring sequences.** During normal playback, small visual/audio descriptors are compared with earlier episodes of an identifiable series. Once a sufficiently distinctive sequence has recurred across two different episodes, its pattern can identify a subsequent occurrence.

On a new series without player metadata or an IntroDB result, the extension must first observe matching openings across episodes. A learned opening typically needs several seconds of matching playback before the button appears. It cannot know the ending of an unseen intro from a single live frame. Silence, black frames, static imagery, pauses, and discontinuous playback are rejected as learning evidence.

The fourth strategy is an experimental deterministic matcher, not a trained model. Recaps or other repeated opening material may still be misclassified. Player-provided boundaries are preferable whenever available.

## What stays in the browser

- Playback is sampled at most once per media second during the first ten minutes.
- Each visual sample becomes a 64-bit difference hash from a temporary 9×8 canvas.
- Accessible audio becomes a compact 32-band spectral descriptor through Web Audio.
- Raw frames and audio buffers are not persisted, recorded, uploaded, or assembled into video files.
- Local storage contains the enabled setting and a bounded library of numeric fingerprints with hashed identities. It retains at most twelve series and four sampled episodes/patterns per series.
- IntroDB receives only the IMDb series ID, season, and episode through HTTPS. No site URL, title, cookies, fingerprint, or media is sent. The service also sees the normal network connection information, including your IP address.
- A temporary browser-session cache holds at most 100 episode results: successful lookups for six hours, missing intros for fifteen minutes, and failures for thirty seconds. It is cleared when the browser session ends. There is no database replication or bulk fetching.
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
3. Grant the requested site access and episode-metadata transmission permission, then reload video pages. Temporary installation ends when Firefox closes.

It is not published in the extension stores. Persistent Firefox installation requires Mozilla signing.

## Use

Enable **Automatic detection** in the popup, then watch normally. When an actionable intro is detected, **Skip intro** appears over the player. Click it to advance; playback is never skipped without your click. No signal means no overlay. The popup reports missing episode identity, missing IntroDB timings, temporary API failures, or a timing ready to use. After updating, reload the extension and the video page.

The design follows a black-and-white palette with a frosted white button, dark icon, subtle glass surfaces, and reduced-motion support. All project text and interfaces are in English.

## Limits

- Automatic does not mean universal. Cross-origin media restrictions, protected playback, missing episode identity, or opaque players can prevent learning. Browser audio policies may require a normal user interaction before audio sampling can start.
- Learning requires a recognizable series/episode title or explicit series metadata. It does not pool unrelated shows under a generic player title.
- Player APIs are used without bypassing DRM, CORS, authentication, or browser permissions. The extension never replaces the player's audio source.
- The live matcher currently needs a distinctive repeated sequence lasting 18–240 seconds, a matching run of eight samples, and uninterrupted accessible playback. Very short or substantially edited openings can be missed.
- The inferred end is conservative: the last confirmed matching sample. It may leave a small part of an opening unskipped. Music or visual repetition alone does not establish semantic certainty.
- Closed shadow roots, browser-internal pages, native video-element fullscreen, and Picture-in-Picture are unsupported. Open shadow roots and fullscreen player containers are handled.
- A native player may reject a programmatic forwarded click. Small or hidden videos and unseekable ranges do not receive a button.
- StreamingCommunity watch-page metadata has an adapter for its observed `Titles/Watch` format. Other sites need explicit Schema.org `TVEpisode` metadata containing the series IMDb ID and episode numbers. A title alone is not enough.
- IntroDB coverage and timing accuracy vary by episode and edition. The extension uses the returned boundaries without assuming that different cuts share the same timing.
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
extension/introdb.js      IntroDB response validation
extension/background.js   Free API requests, session cache, and frame context
extension/catalog.js      Current player and catalog result binding
extension/fingerprint.js  Deterministic sequence matcher
extension/analysis.js     In-browser sampling and bounded fingerprint storage
extension/content.js      Player discovery, automatic button, and click handling
extension/popup.*         On/off control and monochrome glass interface
demo/                     Synthetic signal lab
```

Intro data provided by [IntroDB](https://introdb.app). API documentation: [public segment endpoints](https://introdb.app/docs/api).

[Roadmap](docs/ROADMAP.md) · [Architecture](docs/ARCHITECTURE.md) · [Privacy](docs/PRIVACY.md) · [MIT license](LICENSE)
