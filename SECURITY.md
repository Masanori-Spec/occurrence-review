# Security and resource boundaries

## Data handling

No calendar network APIs, uploads, analytics, remote fonts, accounts or calendar write-back exist. Browser processing occurs in a Worker. The static app sets `connect-src 'none'`, limits scripts/workers to same-origin, disallows objects and form submission, and renders untrusted event content using `textContent`, never HTML. URLs and attachments in calendars are not fetched or executed. The CLI is local and reads two explicitly selected regular files.

This does not make the host browser, extensions, hosting server, terminal, or downloaded report trustworthy. Serve a reviewed local build for sensitive files. Do not publish real calendars or JSON reports with personal data. Screenshots and repository examples must remain synthetic.

## Work and output budgets

- Each snapshot: at most 1,048,576 UTF-8 bytes
- Each unfolded content line: at most 65,536 bytes; UID: 1,024 bytes
- At most 500 master UID groups per snapshot
- At most 200,000 enumerated calendar days per snapshot (including pre-window count work)
- At most 20,000 materialized occurrences per snapshot / series generation
- At most 10,000 emitted changed occurrences
- Compact JSON report at most 4,194,304 bytes; pretty-printed CLI output adds indentation overhead
- At most 200 detailed diagnostics per snapshot, followed by a truncation notice
- Maximum review window: 3,660 days; date years 0001–9999; explicit duration no greater than 36,600 days
- CLI worker: 10-second watchdog and 256 MiB V8 old-generation target
- UI worker: 20-second watchdog, terminate-on-cancel and request IDs; 50 rows rendered at a time

A budget hit is incomplete. An affected UID is discarded as a whole and blocked on both sides, avoiding misleading removals. If report-wide bytes cannot fit, the report drops detailed rows and diagnostics with an explicit output-limit notice. Limits bound accepted output and synchronous enumeration, but are not a hard process RSS guarantee. Parsing may allocate temporary copies; hostile input may still consume CPU until the watchdog fires. The direct JS API is synchronous: callers needing isolation must use a worker like the shipped CLI and UI.

File reads are size-checked before and after reading in the CLI. Browser files are size-checked before reading and input text is byte-checked before starting a worker. Input edits, swap, cancellation, and repeated file selection invalidate old worker responses and pending file reads.

## Unsupported is safer than guessed

All referenced TZID values are unsupported, even if they appear familiar or contain an embedded VTIMEZONE. No fallback treats them as UTC. DST folds/gaps and changed same-name timezone definitions therefore cannot silently pass. Temporal-type changes across snapshots are incomplete. Scheduling METHOD messages are rejected as snapshots.

The engine is a scoped comparison tool, not a security sanitizer, full RFC validator, or calendar importer. Ignored fields are exposed in every report and in the UI. Unknown metadata outside the listed comparison scope can change without an occurrence-impact warning.

## Reporting issues

Use a minimal synthetic reproducer and include Node/browser versions, window and diagnostics. Never attach a real private calendar, credentials, access tokens, or personal contact information to a public issue. There is no security response SLA.
