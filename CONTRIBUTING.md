# Contributing

Open an issue with your browser and version, the site URL (without tokens or credentials), player type, expected behavior, and observed behavior. Do not attach protected content, cookies, or signed URLs.

Before submitting a pull request:

```sh
npm ci
npx playwright install chromium firefox
npm run check
```

For a new detection strategy, add examples with intros, without intros, and with plausible false positives. Keep logic in the pure detection engine where possible. Automatic skipping, network requests, telemetry, and expanded permissions require an explicit rationale in the proposal.

Document the sites actually tested and distinguish simulated tests from real players. Keep all project text, interfaces, comments, documentation, and test fixtures in English. Accessibility improvements are welcome.
