# Roadmap

## 0.2 — Automatic only

- [x] Remove timing forms, start/end marking, hover panels, and user-entered timing fallback.
- [x] Monochrome glass UI based on the reference skip-button design.
- [x] Native intro-control detection, chapter/metadata cues, and source-matched structured data.
- [x] Player discovery in dynamic frames and open shadow roots.
- [x] Deterministic live audio/visual descriptors with bounded local learning.
- [x] No AI, remote recognition, media downloads, or persisted media files.
- [ ] User validation on the requested streaming site and actual episode playback.
- [ ] Measure recurrence precision and boundary error across real openings, recaps, repeated scenes, dubbing, and edited versions.
- [ ] Measure CPU, memory, and battery use across browser engines and playback rates.

## Coverage

- [ ] Verified player adapters based on observed intro metadata, with specific supported versions and limitations.
- [x] Share owning-tab title internally for series/episode identity in embedded frames.
- [ ] Validate series/episode identity across real embedded player variants.
- [ ] Handle more soundtrack edits, very short openings, and variable intro versions without relaxing false-positive safeguards.
- [ ] Improve capture recovery after media-source or audio-track changes.
- [ ] Store submission, signing, and final accessibility checks.

Universal first-encounter detection is not promised. If a player supplies no boundaries and an opening has not been observed before, live matching cannot infer a trustworthy future ending. Conservative non-detection is preferable to inventing a skip duration.
