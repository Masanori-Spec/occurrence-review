# Useful scope, existing work, and limits of the claim

Research checked the following public project descriptions on 2026-10-03. These are competitors / prior engineering, not an exhaustive market or patent search.

| Existing tool | Existing functionality | This project's chosen emphasis |
| --- | --- | --- |
| [FileDiffs ICS Compare](https://filediffs.com/ics-compare) | Browser-local ICS comparison, UID alignment, event/property and recurrence/timezone field differences | Explicit bounded occurrence impact and same-origin override evidence, rather than only property changes |
| [asouqi/ics-suite](https://github.com/asouqi/ics-suite) | UID-oriented component diff, exception detection and recurrence expansion APIs | A finished CLI/UI review workflow combining those concerns with visible incomplete outcomes |
| [RRuleLab](https://github.com/cjkzD/apq_project) | Recurrence-instance comparison in a selected window; documented floating/local-time orientation | Two complete calendar snapshots, detached instances, outside-window counterparts, and separate temporal types |

The difference is the end-to-end review workflow and cautious failure model, not invention of ICS diffing or occurrence-set comparison. No claim is made that these tools cannot add or already have overlapping details. These descriptions were reviewed from public materials, not from exhaustive product conformance tests.

## Target job

A developer changes a generator or export process and asks: “What happens to actual appointments in the next month?” Input two complete synthetic/export snapshots, choose the release review window, inspect changes and evidence, and fail a regression check whenever the result is incomplete.

## Evidence still missing

No user interviews, real customer adoption, willingness-to-pay tests, enterprise support guarantee, exhaustive RFC conformance, general IANA timezone support, or patent novelty investigation supports this release. It is a practical portfolio utility with a narrow technical scope. A useful next validation would be observing developers reviewing deliberately changed synthetic exports, before adding broader recurrence or timezone support.

## Data and authorship

All committed fixtures, screenshots and demonstrations use synthetic data. Development did not access calendar accounts, university systems, or private patent research. AI assistance was substantial and is disclosed in the README. No project license was selected on the author's behalf.
