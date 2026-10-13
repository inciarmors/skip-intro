# Site support

## Requested target

`streamingcommunityz.shiksha` is the first user-supplied evaluation target.

Read-only navigation on October 13, 2026 reached a series watch page whose title contained series, season, and episode information. Its player was inside an iframe. Inspection stopped when the user requested to perform playback testing themselves.

No player-specific intro timestamps, working live capture, or successful skip have been verified on this site. No compatibility claim is made. The implementation does not include invented timing values or an unverified site-specific adapter.

The generic detector can use the site's signals only if the relevant player frame exposes accessible controls, valid timing metadata, or analyzable media and a reliable episode identity. The extension can request its owning tab's title through an internal background handler, without reading a cross-origin parent DOM. This does not remove restrictions on the media samples themselves.

## Evaluation checklist

- Install the unpacked build and allow access to both the watch site and the player-frame domain.
- Confirm normal playback and audio remain unchanged.
- Check whether a native intro control or chapter range is available.
- For fingerprint learning, observe accessible openings across multiple distinct episodes of the same identifiable series before expecting a learned match.
- Verify that the button appears during the opening and that its destination does not cut into the episode.
- Record misses or false matches without sharing protected media, cookies, signed URLs, or credentials.
