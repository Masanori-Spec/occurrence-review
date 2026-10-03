# Browser verification

Build the application and run the static server on port 4173, then run:

```sh
node tests/browser/browser-test.mjs
```

The runner uses Playwright Chromium with the Chromium sandbox enabled. Install its browser through the project’s normal dependency setup first. `BASE_URL` can select a different local preview, `CHROMIUM_PATH` can select a system Chromium, and `BROWSER_ARTIFACT_DIR` sets the screenshot/report destination (default `tests/browser/artifacts`). No fallback disables the browser sandbox.

The suite covers 22 scenarios: initial accessible controls and skip link; missing inputs and invalid dates; real-engine sample counts; repeat runs; filters and evidence; JSON export; swapping; malformed/incomplete reports and recovery; locale preservation; stale input invalidation; file and paste size limits; hostile ICS rendered as text; absence of off-origin calendar traffic; an out-of-window counterpart; cancellation and late-result suppression; request IDs; worker/constructor/message/report failures and recovery; mobile overflow in both languages; asynchronous file-read races; file-read failure recovery; and incremental rendering of large reports.

Failures produce a screenshot, and successful representative desktop/mobile runs also save screenshots. A final `results.json` records every scenario’s outcome. A launch failure occurs before any scenario runs and must not be reported as a test pass.
