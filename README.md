# Occurrence Review

**カレンダーの更新で、実際の開催回がどう変わるか。**

2つの完全な `.ics` スナップショットを読み、指定期間内の追加・削除・移動・長さ・内容の変更を確認するローカルツールです。日本語 / English のブラウザUIと、同じ比較エンジンを使うCLIがあります。

- アップロード、アカウント、カレンダー接続は不要
- UIDと開催回のIDで照合。近い日時を推測で結び付けない
- 期間内から外、期間外から内への移動は、相手側の予定も表示
- 未対応や処理上限は `complete: false`。「変更なし」と区別
- UTC・タイムゾーンなし・終日を別々に扱う。TZIDはこの版では未対応

> 開発者向けの限定スコープのレビュー補助です。すべてのiCalendar機能を検証するツールではありません。通知、添付、独自プロパティ、更新日時は比較対象外です。

## Start locally

Requires Node.js 22 or later. Dependencies are pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run serve
```

Open `http://127.0.0.1:4173` and choose **サンプルで試す / Try an example**. All sample events are synthetic. Building downloads dependencies; the running UI has no CDN, analytics, remote fonts, or calendar network requests. Browser modules require this local HTTP server, rather than opening `index.html` as `file://`.

### CLI

```sh
node src/cli.js fixtures/before.ics fixtures/after.ics \
  --start 2026-01-01 --end 2026-02-01

node src/cli.js fixtures/before.ics fixtures/after.ics \
  --start 2026-01-01 --end 2026-02-01 --json > report.json
```

Exit codes: **0** = complete with no changes; **1** = complete with changes; **2** = incomplete or error. A report with `complete: false` may contain useful partial findings, but must never be used to approve a no-change regression check. Invalid CLI arguments and a worker timeout produce stderr and exit 2.

The sample changes one weekly design review from January 13 to January 14, makes it 90 minutes, and changes its room. The all-day two-day workshop is unchanged.

## Exact meaning of the window

The window is required and **half-open**: `[start 00:00, end 00:00)`.
Membership is determined by occurrence **start**, not interval overlap. An event beginning before the window and continuing into it is not included unless its counterpart starts within the window.

- UTC events use UTC calendar dates
- Floating DATE-TIME uses the written wall-clock date, without assigning a timezone
- DATE events use date-only membership; `DTEND` is exclusive
- These domains are never converted into the machine timezone
- A same-UID change between temporal domains is explicitly incomplete

A matched change is shown when either side starts inside the window. The outside counterpart remains in the result with `inWindow: false`.

## Supported scope

- One master VEVENT per UID in each complete VCALENDAR 2.0 snapshot
- UTC, floating DATE-TIME, and all-day DATE
- DAILY, WEEKLY, MONTHLY, YEARLY recurrence in the [documented subset](docs/semantics.md)
- `INTERVAL`, `COUNT`, inclusive `UNTIL`; selected BYDAY/BYMONTHDAY/BYMONTH/WKST combinations
- RDATE / EXDATE deduplication; EXDATE wins
- Single-instance detached overrides and cancellations; whole-series cancellation
- Stable same-UID identity for nonrecurring moves; original typed RECURRENCE-ID for recurring occurrences
- Metadata: summary, location, description, status, transparency, class, categories, URL, organizer, attendee, priority, resources, contact

**Explicitly incomplete:** referenced TZID (including embedded VTIMEZONE and DST), RANGE overrides, PERIOD RDATE, EXRULE, subdaily recurrence, unsupported BY-parts, YEARLY BYDAY, invalid or conflicting temporal types, duplicate/orphan identities, unsupported top-level components, scheduling METHOD messages, and budgets being exceeded.

Bookkeeping timestamps and SEQUENCE, VALARM, ATTACH, and X-properties are deliberately outside the comparison scope. `complete: true` means complete **within that stated scope**, not equivalent entire calendars. This is not a scheduling-message processor, synchronization engine, ICS repair tool, or full RFC validator.

## Limits and privacy

Each input: 1 MiB; each unfolded line: 64 KiB; UID: 1 KiB. Defaults: 500 series, 200,000 calendar-day steps and 20,000 expanded occurrences per snapshot; 10,000 changed rows and 4 MiB for the compact JSON report. Window: at most 3,660 days. Limits may be lowered via the JS API. There are worker watchdogs and cancellation; see [security and resource limits](SECURITY.md).

Browser data stays in memory until the page closes. Nothing is saved unless you download JSON. Downloaded reports include event content and potentially names/email addresses: review them before sharing. The CLI reads only the two explicitly supplied paths and writes to stdout/stderr.

## Verification

```sh
npm test
npm run test:tz
npm run build
npx playwright install --with-deps chromium
npm run serve                 # another terminal
npm run test:browser
```

Tests cover recurrence boundaries, exception identity, cancellation, malformed parser inputs, budgets, deterministic output under different host timezones, CLI/worker parity, and independent recurrence golden cases. The 22-scenario browser suite exercises repeated input, invalid/recovery, cancellation, stale responses, swaps, file races, hostile text, JSON export, and mobile layout. CI runs Node 22/24, UTC/Tokyo, and a sandbox-enabled Chromium browser gate.

See [verification status](docs/verification.md) for what actually ran, including local browser restrictions. Do not mistake an implemented test suite for a passed run.

## Why this exists

The intended user is a developer reviewing changes to calendar exports or generation code before deployment. Existing tools already compare ICS properties or expand recurrence rules. This project combines full-snapshot input, bounded occurrence review, explicit exception identity, window-crossing evidence, and visible incompleteness in one local workflow.

See the [competitor comparison](docs/positioning.md). We do not claim first invention, patent novelty, proven demand, or a new general-purpose recurrence library.

## Architecture and development

`src/engine.js` is shared by the browser Worker and the Node CLI worker. Pinned **ical.js 2.2.1** parses content. A strict lexical preflight catches lossy parser normalization; a bounded UTC-arithmetic calendar-day enumerator implements the explicitly supported recurrence subset. It never registers global timezone definitions. [Design and semantics](docs/semantics.md) describe the decisions and boundaries.

This project was substantially designed, implemented, and tested with OpenAI AI assistance. Synthetic tests and independent checks provide evidence, not a claim of exhaustive correctness or human review. No account, university site, or real calendar was accessed for development.

## License

No license has been selected for this project's original code. Public visibility does not grant an open-source license. Third-party dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
