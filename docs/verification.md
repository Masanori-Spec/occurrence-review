# Verification status

This file distinguishes executed checks, their exact commits, and remaining verification limits.

## Verified public CI result

[Run 37115361793](https://github.com/Masanori-Spec/occurrence-review/actions/runs/37115361793) **passed** for commit [`8873a21114ae27303333a2de3977f23285c55a18`](https://github.com/Masanori-Spec/occurrence-review/commit/8873a21114ae27303333a2de3977f23285c55a18). All four Node/timezone unit jobs passed, and browser job logs explicitly report **22/22 browser scenarios passed**, including the strengthened repeated-input stale-result regression. Chromium ran with its sandbox enabled on the standard Ubuntu 22.04 runner.

Evidence checked: exact commit/run association, job conclusions, browser logs and scenario counts. The raw CI screenshot files and `results.json` artifact bytes were **not inspected**: the available browser download failed, and reopening its download target was blocked as a prohibited protocol. No restriction was bypassed. Therefore this is an automated browser-test pass, **not a manual visual review** or an inspected screenshot/artifact pass. Desktop/mobile layout assertions passed as part of automation; subjective layout quality has not been manually verified.

This documentation-only update does not modify runtime source or test assertions. The earlier failures and corrective changes remain below for traceability.

## Local environment, 2026-10-03

- Node engine/adversarial/CLI/worker contract tests: 321/321 passed under UTC and 321/321 under Asia/Tokyo (126 adversarial + 186 independent recurrence oracle + 9 CLI/worker/security contract tests)
- Exact same engine JSON in direct API, CLI worker and browser-worker entry point: executed
- Host timezone determinism: executed under UTC, Asia/Tokyo and America/Los_Angeles inside adversarial tests
- Browser bundle: built successfully with pinned esbuild
- Source formatting and JavaScript syntax: checked
- Runtime dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities reported; this is not a guarantee of security
- Adversarial payload check: 350 KB input / 10,000 RDATEs returned an explicitly incomplete, byte-bounded report. Work still examines later rows after the byte cap; workers remain the isolation boundary
- Synthetic example: engine contract verified
- Independent recurrence oracle: generated from Python dateutil 2.9.0.post0, compared as static golden fixtures
- Browser UI scenarios: **not executed locally**. Chromium launch hit the environment's socket restrictions; cloud-browser localhost navigation was blocked. No sandbox-disabling workaround was used
- Visual desktop/mobile screenshots: not manually inspected locally or from CI artifacts; see the explicit artifact-access limitation above

## CI gates

`.github/workflows/ci.yml` runs unit/contract tests on Node 22 and 24 under UTC and Asia/Tokyo, builds local assets, and runs the 22-scenario Playwright suite with the browser sandbox enabled. Browser artifacts contain a scenario results JSON plus representative/failure screenshots. Publication is not proof of correctness: inspect the CI result for the exact commit.

## Coverage

Identity/order/folding/bookkeeping invariance; single and recurring moves; detached override deletion; single/series cancellations; RDATE/EXDATE deduplication; COUNT/UNTIL/month-31/leap-year behavior; in→out and out→in moves; all-day exclusive end; explicit durations; TZID/DST unsupported diagnostics; duplicate/orphan/type errors; malformed lexical forms before parser normalization; safety limits; CLI exit codes; browser-worker error response; input and worker race scenarios.

The independent recurrence fixture exercises the supported UTC subset against another implementation. It is a regression oracle, not proof that either implementation satisfies every RFC combination. TZID behavior is tested only for explicit rejection, not successful DST computation.

## First published CI and runner correction

[Run 37114747033](https://github.com/Masanori-Spec/occurrence-review/actions/runs/37114747033), for commit `a3ca5bc8308e962f5002b994df54dbf4ece32190`, passed all four Node/timezone matrix jobs. The browser job failed at Chromium startup on Ubuntu 24.04 with “No usable sandbox”; none of its UI scenarios ran.

The browser job now selects the standard `ubuntu-22.04` runner, retaining the exact pinned Playwright Chromium build and `chromiumSandbox: true`. It does not change AppArmor, sysctl, privileges, browser sandbox flags, or test assertions. At that point, a new CI run was required; the second run below confirmed sandbox-compatible browser startup.

Maintenance boundary: [GitHub's official runner announcement](https://github.com/actions/runner-images/issues/14254) states that Ubuntu 22.04 deprecation began September 17, 2026 and retirement is scheduled for April 17, 2027, with March/April brownouts. This runner selection must be migrated before that cutoff. A possible future supported route is the vendor Chrome installation and its existing Ubuntu AppArmor profile, documented by [Chromium](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md); that route has not been adopted or verified here.

## Browser-state regression found in the second run

[Run 37115004539](https://github.com/Masanori-Spec/occurrence-review/actions/runs/37115004539), for commit `3a356843cc2fd771c253efb1e1f6645352ab4764`, successfully launched sandbox-enabled Chromium on Ubuntu 22.04. All four unit matrix jobs and 21 of 22 browser scenarios passed. The remaining scenario found that successive input events cleared the “Inputs changed” rerun notice after the first event invalidated the worker/report. Stale results were correctly suppressed, but the status notice disappeared.

The UI now preserves that stale state through subsequent edits until a new comparison or explicit action changes it. The scenario retains its original assertion and additionally makes repeated edits/input events before checking the notice and late-result suppression. At that point, a new exact-commit browser run was required. The verified third run above passed the strengthened scenario; the second run remains recorded as a failure.
