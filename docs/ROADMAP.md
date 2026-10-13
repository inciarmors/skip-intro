# Roadmap

## 0.1 — Verifiable prototype

- [x] Manifest V3 builds for Chrome and Firefox.
- [x] HTML5 players, chapters, and explicit timing metadata.
- [x] Click-to-skip button and local manual timing.
- [x] Reproducible lab, tests, and CI.
- [ ] Manual verification across a matrix of real sites and browser versions.

## 0.2 — Player coverage

- [ ] Isolated adapters for players that expose intro markers, selected after testing target sites.
- [ ] Stable series, season, and episode identity, avoiding confusion with trailers and ads.
- [ ] Support for players in open shadow roots and improved manual-control accessibility.
- [ ] Better fullscreen/Picture-in-Picture support where browser APIs allow it.
- [ ] Final icons, privacy review, and store publication.

## Research — Intros without metadata

- [ ] Build a test corpus with appropriate usage rights, annotated boundaries, and difficult examples: recaps, cold opens, changing intros, short versions, dubbing, and different edits.
- [ ] Evaluate local audio fingerprints for repeated sequences across episodes, measuring boundary errors and false positives before showing the button.
- [ ] Evaluate visual signals as supporting evidence with measured CPU and memory budgets.
- [ ] Separately verify stream access, CORS, DRM, and any required capture permissions or consent: analysis is not always technically available.
- [ ] Define conservative confidence thresholds and fallback behavior. Music alone does not prove a sequence is an intro.

The first episode watched, an unseen intro, or an inaccessible stream will still need a reliable source or manual confirmation. We do not promise 100% site coverage.

A shared catalog would be a separate project requiring consent, moderation, and a new privacy review. The current prototype does not contact a catalog.
