# Skip Intro

**Your story, without the wait.** A Chrome and Firefox extension that shows a **Skip intro** button during opening credits and jumps to their end when you click it.

> **Status: prototype 0.1.0.** Universal audiovisual recognition is the project's goal, not a feature available today. This version uses chapters, explicit metadata, and manual timing. It does not promise compatibility with every streaming service.

## Available features

- Detects chapters labeled `Intro`, `Opening`, `Opening credits`, `Introduction`, or `Title sequence`.
- Reads explicit intro timing metadata.
- Displays a button over the video during the detected intro; never skips automatically.
- Lets you set start/end times with **Mark start / Mark end** or enter seconds manually.
- Saves timings locally for each video, without servers, accounts, analytics, or audio/video uploads.
- Handles dynamically inserted HTML5 players, SPA navigation, and authorized HTTP/HTTPS iframes.
- Selects the main visible player when several videos are present; supports player-container fullscreen.
- Includes a popup to disable the extension and clear saved timings.

## Development installation

Requires Node.js 22+ and npm. The distributed extension has no runtime dependencies or remote code.

```sh
git clone https://github.com/inciarmors/skip-intro.git
cd skip-intro
npm ci
npm run build
```

**Chrome 120+**

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select the `dist/chrome` folder.
4. Reload any video pages that are already open.

**Firefox 142+ desktop**

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/firefox/manifest.json` and grant the requested site access.
4. Reload any video pages that are already open. Temporary installation ends when Firefox closes.

The extension is not published in the stores yet. Persistent installation in Firefox requires Mozilla signing.

## Try it

```sh
npm run demo
```

Open `http://127.0.0.1:4173` with the extension loaded. **Generate test video** creates a local 16-second clip with an intro between seconds 3 and 9. Click **Go to intro**, then **Skip intro**: playback should seek to second 9.

The lab includes controls to remove chapters, try manual timing, and enter player-container fullscreen. It does not download external videos or test audio recognition.

On a page without chapters, hover over the video and open **Skip Intro · adjust timing**. Set the start and end of the intro (a 2–300 second range). The timing is reused for that video, not automatically applied to other episodes.

## Known limitations

- Without chapters or metadata, you must set the timing manually. There is no model listening to or watching the intro yet.
- The player must expose an HTML5 `<video>` element, a finite duration, and a range seekable through `currentTime`. Live streams, opaque players, shadow DOM, and internal browser pages are not supported.
- DRM and custom players may prevent access or seeking. The extension does not bypass protections, authentication, or subscriptions. Netflix, Prime Video, Disney+, and other commercial services have not been certified.
- Native `<video>` fullscreen and Picture-in-Picture cannot display this DOM overlay. Container fullscreen is supported.
- Manual timings are identified by page URL, media source, duration, and player index. Changing signed URLs may require setting the timing again. Different streams with the same page URL, duration, and player index cannot be distinguished: use **Forget** if a site reuses those values.
- On HTTP pages without Web Crypto, manual timing lasts for the current session only. Embedded players require access to their own domains.
- Players are scanned every 500 ms in visible tabs. Chapter detection depends on cues actually being available in the player.

## Development and verification

```sh
npx playwright install chromium firefox
npm run check
npm run package
```

`check` runs core logic tests, builds both extensions, validates the Firefox manifest, and tests behavior in Chromium and Firefox. Behavioral tests control the media clock and mock storage; an additional test loads the actual extension in Chromium and skips a clip generated in the browser. Firefox add-on installation and commercial players also require manual verification.

`package` creates `artifacts/skip-intro-chrome.zip` and `artifacts/skip-intro-firefox.zip` using the `zip` command. The Firefox archive is unsigned. Builds and artifacts are excluded from Git and attached to successful CI runs.

```text
extension/       Content script, detection engine, popup, and base manifest
scripts/         Browser builds, packaging, and local lab server
demo/            Locally generated synthetic clip with chapters
tests/           Core logic and browser behavior tests
docs/            Architecture, roadmap, and privacy
```

## Toward automatic recognition

The [roadmap](docs/ROADMAP.md) covers player adapters, series/episode identification, and audio fingerprint comparisons across episodes. Precision, false positives, processing cost, and access restrictions must be measured before claiming universal recognition.

See the [architecture](docs/ARCHITECTURE.md), [privacy policy](docs/PRIVACY.md), and [contribution guide](CONTRIBUTING.md).

Licensed under [MIT](LICENSE).
