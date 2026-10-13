# Privacy — version 0.1.0

Skip Intro does not send data to servers, use analytics, create accounts, or record audio or video. The lab generates a synthetic clip locally only when its button is clicked.

The extension reads page URLs, video elements, duration, playback position, seekable ranges, and chapter/metadata tracks locally to decide when to show the button.

The browser profile stores the enabled setting and user-entered intro timings. Timing keys are SHA-256 hashes of media identity, including URLs and duration; raw URLs are not stored. Hashing does not guarantee anonymity against someone who has access to the profile and knows possible URLs.

HTTP/HTTPS site access lets content scripts work across different players and frames. You can restrict access using browser controls, which reduces coverage. Cookie, browsing history, and tab capture permissions are not requested.

Use **Forget** to remove one manual timing, clear all saved timings from the popup, or uninstall the extension. The extension does not use `storage.sync` or synchronize data across devices.

Normal player requests and browser requests to load the site's media tracks remain subject to the site's and browser's policies. Future audiovisual recognition or shared catalog features must update this policy before distribution.
