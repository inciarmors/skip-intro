# Contributing

Keep all project text, interfaces, comments, documentation, and fixtures in English. Detection must remain automatic-only: do not add timing fields or user marking steps.

## Constraints

- No AI models or external recognition services.
- No extra media downloads, raw media persistence, microphone capture, or tab recording.
- Audio/visual analysis is allowed only in the browser during normal playback.
- No bypass of DRM, CORS, authentication, or browser permission checks.
- No skipping without the user's click.

## Verification

```sh
npm ci
npx playwright install chromium firefox
npm run check
```

Add deterministic fixtures for new detection logic, including unrelated content, stale signals, inaccessible ranges, and plausible false positives. Distinguish simulated browser fixtures from real player validation; do not claim universal accuracy from unit tests.

When reporting site behavior, include browser/version, the site domain, expected behavior, and observed behavior. Do not attach protected media, credentials, cookies, or signed stream URLs. Document any runtime limitation openly.
