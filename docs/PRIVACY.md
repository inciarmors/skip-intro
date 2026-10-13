# Privacy — version 0.3.0

Skip Intro has no accounts, analytics, custom backend, or AI service. It calls the free IntroDB API for episode timings. Audio, images, videos, and fingerprints never leave the browser.

## External requests

When an enabled extension detects a visible player and a supported episode identity, it sends the IMDb series ID, season number, and episode number to `https://api.introdb.app/segments`. These identifiers disclose which episode is being looked up. IntroDB also receives normal connection information, including the user's IP address. Requests omit credentials and referrers. Page URLs, page titles, authentication tokens, cookies, and media URLs are not sent.

No API key is required. The extension performs read-only individual episode lookups; it does not submit data, replicate the database, or bulk-download its contents. See [IntroDB's terms](https://introdb.app/docs/terms).

## Local processing and storage

The extension reads player controls, URLs, series/episode metadata, chapter cues, playback position, duration, and seekable ranges. While an identifiable episode is playing, it may sample accessible frames and audio to calculate compact perceptual descriptors.

Local persistent storage contains the enabled setting and a bounded library of descriptors, their playback timestamps, hashed media identities, and update timestamps. It retains at most twelve series and four sampled episodes/learned patterns per series. Raw media, URLs, and titles are not persisted. Hashes are not a guarantee of anonymity.

Browser-session storage separately caches at most 100 IntroDB results with episode identifiers and expiry times. Successful timings expire after six hours, missing timings after fifteen minutes, and transient failures after thirty seconds. Session data is cleared when the browser session ends. This small request cache is not a replicated catalog. No sync storage is used.

## Media handling

Temporary canvas and Web Audio buffers exist in memory during analysis. The extension uses no media recorder, file writer, media fetcher, or video download. Sampling is limited to the first ten minutes and stops when hidden or disabled. The website's normal playback transfers and buffers still occur.

The development lab generates a synthetic clip in memory. It is not packaged with the extension and does not capture a real show.

## Controls and permissions

HTTP/HTTPS host access supports site/player frames and the IntroDB API. The only privileged API permission is `storage`; microphone, camera, tab capture, download, cookie, and history permissions are not requested. Firefox declares `websiteContent` transmission because episode identifiers are sent outside the browser.

Disable detection in the popup to stop new lookups and local analysis; active API fetches are aborted. Restrict host access in the browser or uninstall to remove stored extension data. DRM, CORS, authentication, and browser permissions are respected.
