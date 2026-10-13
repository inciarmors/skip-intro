# Privacy — version 0.2.0

Skip Intro operates in the browser. It has no accounts, analytics, backend, AI service, or external fingerprint catalog. It does not upload page data, audio, images, or video.

## What is read

The extension reads player controls, URLs, series/episode metadata, chapter cues, playback position, duration, and seekable ranges. While an identifiable episode is playing, it may sample accessible frames and audio to calculate compact perceptual descriptors.

## What is stored

Local extension storage contains the enabled setting and a bounded library of descriptors, their playback timestamps, hashed media identities, and update timestamps. It retains at most twelve series and four sampled episodes/learned patterns per series. Raw URLs, titles, pixels, audio samples, and video files are not stored. Hashes may be compared against known identities by someone with access to the browser profile; they are not guaranteed anonymity.

Version 0.1 user-entered timing records are removed on upgrade and are never used for detection. The extension does not use `storage.sync` or synchronize learning across devices.

## Media handling

Temporary canvas and Web Audio buffers exist in memory during analysis. No media recorder, file writer, media fetcher, or video download is used by the extension. Sampling is limited to the first ten minutes of a playing episode and stops when the tab is hidden or detection is disabled. The website's normal media transfers and browser playback buffers still occur.

The separate development lab can generate a synthetic clip in memory. That generation code is not packaged with the extension and does not capture a real show.

## Controls and permissions

HTTP/HTTPS access allows content scripts to operate inside different sites and player frames. The only privileged API permission is `storage`; the extension does not request microphone, camera, tab capture, download, cookie, or history permissions. Capturing a media element's available stream is distinct from capturing the microphone.

You can disable detection in the popup, restrict site access through the browser, or uninstall the extension to remove its stored data. Browser protections, DRM, CORS, and site authentication are respected; inaccessible signals are skipped.
