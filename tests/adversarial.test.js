import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { compareCalendars } from "../src/engine.js";

// These tests deliberately exercise public behavior only. Diagnostic wording and
// codes, evidence wording, internal counters, and timestamp rendering are not API
// assumptions; calendar semantics and fail-closed behavior are.
const WINDOW = { start: "2026-01-01", end: "2026-02-01" };
const calendar = (...events) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Occurrence Review adversarial tests//EN",
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
const event = (uid, lines = []) => [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  "DTSTAMP:20251201T000000Z",
  ...lines,
  "END:VEVENT",
];
const timed = (
  uid,
  start = "20260105T090000Z",
  extra = [],
  end = "20260105T100000Z",
) =>
  event(uid, [`DTSTART:${start}`, ...(end ? [`DTEND:${end}`] : []), ...extra]);
const recurring = (uid, rule = "FREQ=DAILY;COUNT=3", extra = []) =>
  timed(
    uid,
    "20260101T090000Z",
    [`RRULE:${rule}`, ...extra],
    "20260101T100000Z",
  );
const compare = (before, after, options = WINDOW) =>
  compareCalendars(before, after, options);
const changesFor = (result, uid) =>
  result.changes.filter((change) => change.uid === uid);
const stamp = (value) =>
  String(value)
    .replace(/[-:]/g, "")
    .replace(/\.000(?=Z?$)/, "");
const dateOf = (value) => stamp(value).slice(0, 8);

function clean(result) {
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.complete, true, JSON.stringify(result.diagnostics));
  assert.ok(Array.isArray(result.changes));
  assert.ok(Array.isArray(result.diagnostics));
  assert.ok(result.window && result.summary && result.stats);
  return result;
}
function incomplete(result) {
  assert.equal(
    result.complete,
    false,
    "Incomplete/unsupported input must not look authoritative",
  );
  assert.ok(
    Array.isArray(result.diagnostics) && result.diagnostics.length > 0,
    "Incomplete analysis must explain its limitation",
  );
  return result;
}
function oneChange(result, uid, kind = "changed") {
  const rows = changesFor(clean(result), uid);
  assert.equal(rows.length, 1, JSON.stringify(rows));
  assert.equal(rows[0].kind, kind);
  return rows[0];
}
function noFalseDiff(beforeEvent, invalidAfterEvent, uid = "blocked") {
  const result = incomplete(
    compare(calendar(beforeEvent), calendar(invalidAfterEvent)),
  );
  assert.deepEqual(
    changesFor(result, uid),
    [],
    "An invalid side must block its UID on both sides",
  );
  return result;
}

test("empty valid snapshots yield an empty complete report", () => {
  const result = clean(compare(calendar(), calendar()));
  assert.deepEqual(result.changes, []);
  for (const key of [
    "added",
    "removed",
    "moved",
    "durationChanged",
    "metadataChanged",
    "unchanged",
  ]) {
    assert.equal(result.summary[key], 0, key);
  }
});

test("folding, property order, CRLF/LF, and export timestamps do not create changes", () => {
  const before = calendar(
    event("stable", [
      "DTSTART:20260105T090000Z",
      "DTEND:20260105T100000Z",
      "SUMMARY:Architecture plan",
      " ning",
      "LOCATION:Room A",
      "DESCRIPTION:First line\\nSecond line",
      "LAST-MODIFIED:20251201T000000Z",
      "SEQUENCE:1",
    ]),
  );
  const after = calendar(
    event("stable", [
      "SEQUENCE:40",
      "SUMMARY:Architecture planning",
      "LAST-MODIFIED:20260101T000000Z",
      "DESCRIPTION:First line\\nSecond line",
      "DTEND:20260105T100000Z",
      "LOCATION:Room A",
      "DTSTART:20260105T090000Z",
    ]),
  )
    .replace("DTSTAMP:20251201T000000Z", "DTSTAMP:20260102T000000Z")
    .replaceAll("\r\n", "\n");
  const result = clean(compare(before, after));
  assert.deepEqual(result.changes, []);
  assert.equal(result.summary.unchanged, 1);
});

test("event reordering does not alter the result or identities", () => {
  const a = timed("a"),
    b = timed("b", "20260106T090000Z", [], "20260106T100000Z");
  const result = clean(compare(calendar(a, b), calendar(b, a)));
  assert.deepEqual(result.changes, []);
  assert.equal(result.summary.unchanged, 2);
});

test("a single same-UID event move keeps one stable identity", () => {
  const result = compare(
    calendar(timed("move")),
    calendar(timed("move", "20260106T110000Z", [], "20260106T120000Z")),
  );
  const row = oneChange(result, "move");
  assert.deepEqual(row.changes, ["start"]);
  assert.ok(row.before && row.after);
  assert.equal(result.summary.moved, 1);
  assert.equal(result.summary.added, 0);
  assert.equal(result.summary.removed, 0);
  assert.ok(row.id && row.evidence && row.evidence.identity);
});

test("different UIDs with matching text and times are never heuristically paired", () => {
  const result = clean(
    compare(
      calendar(timed("old", undefined, ["SUMMARY:Same"])),
      calendar(timed("new", undefined, ["SUMMARY:Same"])),
    ),
  );
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.moved, 0);
  assert.equal(changesFor(result, "old")[0].kind, "removed");
  assert.equal(changesFor(result, "new")[0].kind, "added");
});

test("metadata, duration, and start changes can coexist in a single change", () => {
  const result = compare(
    calendar(
      timed("all", undefined, [
        "SUMMARY:Old",
        "LOCATION:A",
        "DESCRIPTION:Before",
      ]),
    ),
    calendar(
      timed(
        "all",
        "20260106T090000Z",
        ["SUMMARY:New", "LOCATION:B", "DESCRIPTION:After"],
        "20260106T110000Z",
      ),
    ),
  );
  const row = oneChange(result, "all");
  assert.deepEqual([...row.changes].sort(), ["duration", "metadata", "start"]);
  assert.equal(row.after.durationSeconds, 7200);
  assert.equal(result.summary.moved, 1);
  assert.equal(result.summary.durationChanged, 1);
  assert.equal(result.summary.metadataChanged, 1);
});

test("DURATION and equivalent DTEND represent the same occurrence duration", () => {
  const before = calendar(timed("duration", undefined, ["SUMMARY:Meeting"]));
  const after = calendar(
    timed("duration", undefined, ["DURATION:PT1H", "SUMMARY:Meeting"], null),
  );
  const result = clean(compare(before, after));
  assert.deepEqual(result.changes, []);
  assert.equal(result.summary.unchanged, 1);
});

test("the start-date window includes its start and excludes its end", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed("included", "20260101T000000Z", [], "20260101T010000Z"),
        timed("excluded", "20260201T000000Z", [], "20260201T010000Z"),
        timed("overlap-only", "20251231T230000Z", [], "20260101T010000Z"),
      ),
    ),
  );
  assert.deepEqual(
    result.changes.map((x) => x.uid),
    ["included"],
  );
  assert.equal(result.summary.added, 1);
});

test("nonrecurring outside-to-inside moves retain the outside counterpart", () => {
  const row = oneChange(
    compare(
      calendar(timed("cross", "20251231T090000Z", [], "20251231T100000Z")),
      calendar(timed("cross", "20260101T090000Z", [], "20260101T100000Z")),
    ),
    "cross",
  );
  assert.equal(row.before.inWindow, false);
  assert.equal(row.after.inWindow, true);
  assert.deepEqual(row.changes, ["start"]);
});

test("nonrecurring inside-to-outside moves retain the outside counterpart", () => {
  const row = oneChange(
    compare(
      calendar(timed("cross", "20260131T090000Z", [], "20260131T100000Z")),
      calendar(timed("cross", "20260202T090000Z", [], "20260202T100000Z")),
    ),
    "cross",
  );
  assert.equal(row.before.inWindow, true);
  assert.equal(row.after.inWindow, false);
});

test("events outside on both sides do not appear as changes", () => {
  const result = clean(
    compare(
      calendar(timed("outside", "20251230T090000Z", [], "20251230T100000Z")),
      calendar(timed("outside", "20260202T090000Z", [], "20260202T100000Z")),
    ),
  );
  assert.deepEqual(result.changes, []);
});

test("DATE events use exclusive DTEND and a missing DTEND defaults to one day", () => {
  const a = calendar(
    event("date", ["DTSTART;VALUE=DATE:20260105", "DTEND;VALUE=DATE:20260106"]),
  );
  const b = calendar(event("date", ["DTSTART;VALUE=DATE:20260105"]));
  const result = clean(compare(a, b));
  assert.deepEqual(result.changes, []);
  const row = oneChange(compare(calendar(), a), "date", "added");
  assert.equal(row.after.temporalType, "date");
  assert.equal(row.after.durationSeconds, 86400);
  assert.equal(dateOf(row.after.end), "20260106");
});

test("DATE multi-day duration changes preserve start identity", () => {
  const row = oneChange(
    compare(
      calendar(
        event("date", [
          "DTSTART;VALUE=DATE:20260105",
          "DTEND;VALUE=DATE:20260106",
        ]),
      ),
      calendar(
        event("date", [
          "DTSTART;VALUE=DATE:20260105",
          "DTEND;VALUE=DATE:20260108",
        ]),
      ),
    ),
    "date",
  );
  assert.deepEqual(row.changes, ["duration"]);
  assert.equal(row.after.durationSeconds, 259200);
});

test("floating and UTC date membership are independent of the host timezone", () => {
  const before = calendar();
  const after = calendar(
    timed("utc-edge", "20260131T233000Z", [], "20260201T003000Z"),
    timed("floating-edge", "20260101T003000", [], "20260101T013000"),
    event("date-edge", ["DTSTART;VALUE=DATE:20260131"]),
  );
  const engineURL = new URL("../src/engine.js", import.meta.url).href;
  const program = `import {compareCalendars} from ${JSON.stringify(engineURL)}; const r=compareCalendars(${JSON.stringify(before)},${JSON.stringify(after)},${JSON.stringify(WINDOW)}); delete r.stats; process.stdout.write(JSON.stringify(r));`;
  const outputs = ["UTC", "Asia/Tokyo", "America/Los_Angeles"].map((TZ) => {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", program],
      {
        env: { ...process.env, TZ },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(child.status, 0, child.stderr || String(child.error));
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[0], outputs[2]);
  assert.equal(outputs[0].complete, true);
  assert.equal(outputs[0].summary.added, 3);
  assert.deepEqual(
    new Set(outputs[0].changes.map((x) => x.after.temporalType)),
    new Set(["utc", "floating", "date"]),
  );
});

test("DAILY COUNT bounds the sequence and INTERVAL skips correctly", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(recurring("daily", "FREQ=DAILY;INTERVAL=2;COUNT=3")),
    ),
  );
  assert.equal(result.summary.added, 3);
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260101",
    "20260103",
    "20260105",
  ]);
});

test("COUNT counts candidates before the review window, not just visible ones", () => {
  const result = clean(
    compare(calendar(), calendar(recurring("past", "FREQ=DAILY;COUNT=3")), {
      start: "2026-01-03",
      end: "2026-01-20",
    }),
  );
  assert.equal(result.summary.added, 1);
  assert.equal(dateOf(result.changes[0].after.start), "20260103");
});

test("UNTIL is inclusive at the exact UTC timestamp", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(recurring("until", "FREQ=DAILY;UNTIL=20260103T090000Z")),
    ),
  );
  assert.equal(result.summary.added, 3);
  const earlier = clean(
    compare(
      calendar(),
      calendar(recurring("until", "FREQ=DAILY;UNTIL=20260103T085959Z")),
    ),
  );
  assert.equal(earlier.summary.added, 2);
});

test("a DATE UNTIL is inclusive for an all-day recurrence", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        event("allday-rule", [
          "DTSTART;VALUE=DATE:20260101",
          "RRULE:FREQ=DAILY;UNTIL=20260103",
        ]),
      ),
    ),
  );
  assert.equal(result.summary.added, 3);
  assert.ok(result.changes.every((x) => x.after.durationSeconds === 86400));
});

test("WEEKLY BYDAY uses the specified weekdays and COUNT", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "weekly",
          "20260105T090000Z",
          ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4;WKST=MO"],
          "20260105T100000Z",
        ),
      ),
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260105",
    "20260107",
    "20260112",
    "20260114",
  ]);
});

test("WEEKLY interval week boundaries honor WKST", () => {
  const make = (wkst) =>
    calendar(
      timed(
        "wkst",
        "20260104T090000Z",
        [`RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;COUNT=4;WKST=${wkst}`],
        "20260104T100000Z",
      ),
    );
  const monday = clean(compare(calendar(), make("MO")));
  const sunday = clean(compare(calendar(), make("SU")));
  assert.deepEqual(monday.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260104",
    "20260112",
    "20260118",
    "20260126",
  ]);
  assert.deepEqual(sunday.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260104",
    "20260105",
    "20260118",
    "20260119",
  ]);
});

test("MONTHLY on day 31 skips invalid months instead of normalizing overflow", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "month31",
          "20260131T090000Z",
          ["RRULE:FREQ=MONTHLY;COUNT=4"],
          "20260131T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2026-08-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260131",
    "20260331",
    "20260531",
    "20260731",
  ]);
});

test("MONTHLY BYMONTHDAY supports the last day of the month", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "last-day",
          "20260131T090000Z",
          ["RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3"],
          "20260131T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2026-04-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260131",
    "20260228",
    "20260331",
  ]);
});

test("MONTHLY ordinal BYDAY finds the second Monday", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "second-mon",
          "20260112T090000Z",
          ["RRULE:FREQ=MONTHLY;BYDAY=2MO;COUNT=3"],
          "20260112T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2026-04-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260112",
    "20260209",
    "20260309",
  ]);
});

test("YEARLY leap-day recurrences skip non-leap years without consuming COUNT", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "leap",
          "20240229T090000Z",
          ["RRULE:FREQ=YEARLY;COUNT=3"],
          "20240229T100000Z",
        ),
      ),
      { start: "2024-01-01", end: "2033-01-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20240229",
    "20280229",
    "20320229",
  ]);
});

test("YEARLY BYMONTH and BYMONTHDAY select a bounded annual date", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "annual",
          "20260115T090000Z",
          ["RRULE:FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=15;COUNT=3"],
          "20260115T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2029-01-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260115",
    "20270115",
    "20280115",
  ]);
});

test("EXDATE removes an occurrence and RDATE adds one without duplicating DTSTART", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        recurring("set", "FREQ=DAILY;COUNT=3", [
          "EXDATE:20260102T090000Z",
          "RDATE:20260101T090000Z,20260105T090000Z",
        ]),
      ),
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260101",
    "20260103",
    "20260105",
  ]);
  assert.equal(new Set(result.changes.map((x) => x.id)).size, 3);
});

test("EXDATE wins over a duplicate RDATE", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        recurring("exclude", "FREQ=DAILY;COUNT=1", [
          "RDATE:20260104T090000Z",
          "EXDATE:20260104T090000Z",
        ]),
      ),
    ),
  );
  assert.equal(result.summary.added, 1);
});

test("detached overrides compare by recurrence-origin rather than displayed DTSTART", () => {
  const base = recurring("override");
  const override = timed(
    "override",
    "20260108T120000Z",
    ["RECURRENCE-ID:20260102T090000Z"],
    "20260108T130000Z",
  );
  const result = compare(calendar(base), calendar(base, override));
  const row = oneChange(result, "override");
  assert.deepEqual(row.changes, ["start"]);
  assert.equal(dateOf(row.before.start), "20260102");
  assert.equal(dateOf(row.after.start), "20260108");
  assert.ok(row.recurrenceId);
  assert.equal(result.summary.unchanged, 2);
});

test("removing an override restores the original occurrence instead of add/remove", () => {
  const base = recurring("restore");
  const override = timed(
    "restore",
    "20260108T120000Z",
    ["RECURRENCE-ID:20260102T090000Z"],
    "20260108T130000Z",
  );
  const row = oneChange(
    compare(calendar(base, override), calendar(base)),
    "restore",
  );
  assert.deepEqual(row.changes, ["start"]);
  assert.equal(dateOf(row.before.start), "20260108");
  assert.equal(dateOf(row.after.start), "20260102");
});

test("override with origin outside the window can move inside", () => {
  const base = timed(
    "inbound",
    "20251231T090000Z",
    ["RRULE:FREQ=DAILY;COUNT=1"],
    "20251231T100000Z",
  );
  const override = timed(
    "inbound",
    "20260105T120000Z",
    ["RECURRENCE-ID:20251231T090000Z"],
    "20260105T130000Z",
  );
  const row = oneChange(
    compare(calendar(base), calendar(base, override)),
    "inbound",
  );
  assert.equal(row.before.inWindow, false);
  assert.equal(row.after.inWindow, true);
});

test("override with origin inside the window can move outside", () => {
  const base = recurring("outbound");
  const override = timed(
    "outbound",
    "20260205T120000Z",
    ["RECURRENCE-ID:20260102T090000Z"],
    "20260205T130000Z",
  );
  const row = oneChange(
    compare(calendar(base), calendar(base, override)),
    "outbound",
  );
  assert.equal(row.before.inWindow, true);
  assert.equal(row.after.inWindow, false);
});

test("two overrides moved to the same displayed time remain distinct identities", () => {
  const base = recurring("collision");
  const overrides = ["20260102T090000Z", "20260103T090000Z"].map((origin) =>
    timed(
      "collision",
      "20260108T120000Z",
      [`RECURRENCE-ID:${origin}`],
      "20260108T130000Z",
    ),
  );
  const result = clean(compare(calendar(base), calendar(base, ...overrides)));
  assert.equal(result.summary.moved, 2);
  assert.equal(result.changes.length, 2);
  assert.equal(new Set(result.changes.map((x) => x.id)).size, 2);
  assert.equal(new Set(result.changes.map((x) => x.recurrenceId)).size, 2);
});

test("RRULE count changes preserve matching recurrence identities", () => {
  const result = clean(
    compare(
      calendar(recurring("shorter")),
      calendar(recurring("shorter", "FREQ=DAILY;COUNT=2")),
    ),
  );
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.unchanged, 2);
  assert.equal(result.summary.moved, 0);
  const row = result.changes[0];
  assert.equal(row.kind, "removed");
  assert.equal(dateOf(row.before.start), "20260103");
});

test("changing recurring DTSTART time does not heuristically pair different origins", () => {
  const before = calendar(recurring("new-origins"));
  const after = calendar(
    timed(
      "new-origins",
      "20260101T110000Z",
      ["RRULE:FREQ=DAILY;COUNT=3"],
      "20260101T120000Z",
    ),
  );
  const result = clean(compare(before, after));
  assert.equal(result.summary.removed, 3);
  assert.equal(result.summary.added, 3);
  assert.equal(result.summary.moved, 0);
});

test("a detached STATUS:CANCELLED suppresses only its matching origin", () => {
  const base = recurring("cancel-one");
  const cancellation = event("cancel-one", [
    "RECURRENCE-ID:20260102T090000Z",
    "STATUS:CANCELLED",
  ]);
  const result = compare(calendar(base), calendar(base, cancellation));
  const row = oneChange(result, "cancel-one", "removed");
  assert.equal(dateOf(row.before.start), "20260102");
  assert.equal(result.summary.unchanged, 2);
});

test("series STATUS:CANCELLED removes all bounded occurrences", () => {
  const result = clean(
    compare(
      calendar(recurring("cancel-all")),
      calendar(
        recurring("cancel-all", "FREQ=DAILY;COUNT=3", ["STATUS:CANCELLED"]),
      ),
    ),
  );
  assert.equal(result.summary.removed, 3);
  assert.equal(result.summary.added, 0);
});

test("a cancelled series does not leak active detached overrides", () => {
  const base = recurring("cancel-master");
  const override = timed(
    "cancel-master",
    "20260108T120000Z",
    ["RECURRENCE-ID:20260102T090000Z"],
    "20260108T130000Z",
  );
  const result = clean(
    compare(
      calendar(base, override),
      calendar(
        recurring("cancel-master", "FREQ=DAILY;COUNT=3", ["STATUS:CANCELLED"]),
        override,
      ),
    ),
  );
  assert.equal(result.summary.removed, 3);
  assert.equal(result.summary.added, 0);
});

for (const [name, extra] of [
  ["BYSETPOS", ["RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1"]],
  ["BYHOUR", ["RRULE:FREQ=DAILY;BYHOUR=9,10"]],
  ["BYMINUTE", ["RRULE:FREQ=DAILY;BYMINUTE=15"]],
  ["BYSECOND", ["RRULE:FREQ=DAILY;BYSECOND=30"]],
  ["BYYEARDAY", ["RRULE:FREQ=YEARLY;BYYEARDAY=100"]],
  ["BYWEEKNO", ["RRULE:FREQ=YEARLY;BYWEEKNO=2"]],
  ["EXRULE", ["EXRULE:FREQ=DAILY;COUNT=2"]],
  ["RDATE PERIOD", ["RDATE;VALUE=PERIOD:20260106T090000Z/20260106T100000Z"]],
  ["unknown FREQ", ["RRULE:FREQ=FORTNIGHTLY;COUNT=2"]],
  ["HOURLY", ["RRULE:FREQ=HOURLY;COUNT=2"]],
]) {
  test(`unsupported ${name} fails closed for the UID on both sides`, () => {
    noFalseDiff(timed("blocked"), timed("blocked", undefined, extra));
  });
}

test("TZID is explicitly incomplete even when it names a common timezone", () => {
  noFalseDiff(
    timed("blocked"),
    event("blocked", [
      "DTSTART;TZID=Asia/Tokyo:20260105T090000",
      "DTEND;TZID=Asia/Tokyo:20260105T100000",
    ]),
  );
});

test("TZID on recurrence dates also blocks the UID", () => {
  noFalseDiff(
    recurring("blocked"),
    recurring("blocked", "FREQ=DAILY;COUNT=3", [
      "EXDATE;TZID=America/New_York:20260102T090000",
    ]),
  );
});

test("RANGE=THISANDFUTURE overrides fail closed", () => {
  const before = calendar(recurring("blocked"));
  const after = calendar(
    recurring("blocked"),
    timed(
      "blocked",
      "20260102T120000Z",
      ["RECURRENCE-ID;RANGE=THISANDFUTURE:20260102T090000Z"],
      "20260102T130000Z",
    ),
  );
  const result = incomplete(compare(before, after));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

test("orphan overrides fail closed rather than becoming standalone events", () => {
  noFalseDiff(
    timed("blocked"),
    timed(
      "blocked",
      "20260102T120000Z",
      ["RECURRENCE-ID:20260102T090000Z"],
      "20260102T130000Z",
    ),
  );
});

test("an override whose origin is absent from the recurrence set is rejected", () => {
  const base = recurring("blocked");
  const orphan = timed(
    "blocked",
    "20260108T120000Z",
    ["RECURRENCE-ID:20260120T090000Z"],
    "20260108T130000Z",
  );
  const result = incomplete(compare(calendar(base), calendar(base, orphan)));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

test("duplicate overrides are rejected even if byte-identical", () => {
  const base = recurring("blocked");
  const override = timed(
    "blocked",
    "20260108T120000Z",
    ["RECURRENCE-ID:20260102T090000Z"],
    "20260108T130000Z",
  );
  const result = incomplete(
    compare(calendar(base), calendar(base, override, override)),
  );
  assert.deepEqual(changesFor(result, "blocked"), []);
});

test("duplicate masters are rejected instead of selecting a latest export", () => {
  const base = timed("blocked");
  const result = incomplete(compare(calendar(base), calendar(base, base)));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

for (const [name, start, end] of [
  ["February 30", "20260230T090000Z", "20260230T100000Z"],
  ["non-leap February 29", "20260229T090000Z", "20260229T100000Z"],
  ["month 13", "20261305T090000Z", "20261305T100000Z"],
  ["day zero", "20260100T090000Z", "20260100T100000Z"],
  ["hour 24", "20260105T240000Z", "20260106T010000Z"],
  ["minute 60", "20260105T096000Z", "20260105T110000Z"],
  ["numeric UTC offset", "20260105T090000+0900", "20260105T100000+0900"],
  ["mixed temporal types", "20260105T090000Z", "20260105T100000"],
  ["end before start", "20260105T100000Z", "20260105T090000Z"],
]) {
  test(`invalid ${name} never normalizes into a misleading diff`, () => {
    noFalseDiff(timed("blocked"), timed("blocked", start, [], end));
  });
}

for (const [name, extra] of [
  ["negative duration", ["DURATION:-PT1H"]],
  ["both DTEND and DURATION", ["DTEND:20260105T100000Z", "DURATION:PT1H"]],
  ["COUNT=0", ["RRULE:FREQ=DAILY;COUNT=0"]],
  ["INTERVAL=0", ["RRULE:FREQ=DAILY;INTERVAL=0"]],
  ["COUNT plus UNTIL", ["RRULE:FREQ=DAILY;COUNT=3;UNTIL=20260103T090000Z"]],
  ["invalid BYMONTHDAY", ["RRULE:FREQ=MONTHLY;BYMONTHDAY=32"]],
  ["invalid BYMONTH", ["RRULE:FREQ=YEARLY;BYMONTH=13"]],
  ["invalid BYDAY", ["RRULE:FREQ=WEEKLY;BYDAY=XX"]],
  ["mismatched UNTIL type", ["RRULE:FREQ=DAILY;UNTIL=20260103"]],
  ["mismatched RDATE type", ["RDATE;VALUE=DATE:20260106"]],
]) {
  test(`invalid ${name} fails closed`, () => {
    noFalseDiff(timed("blocked"), timed("blocked", undefined, extra, null));
  });
}

test("one invalid UID does not hide an independently valid changed UID", () => {
  const before = calendar(timed("blocked"), timed("good"));
  const after = calendar(
    timed("blocked", undefined, ["RRULE:FREQ=HOURLY;COUNT=2"]),
    timed("good", undefined, ["SUMMARY:New title"]),
  );
  const result = incomplete(compare(before, after));
  assert.deepEqual(changesFor(result, "blocked"), []);
  assert.equal(changesFor(result, "good").length, 1);
  assert.deepEqual(changesFor(result, "good")[0].changes, ["metadata"]);
});

for (const [name, malformed] of [
  [
    "missing calendar end",
    calendar(timed("broken")).replace("END:VCALENDAR", ""),
  ],
  ["missing event end", calendar(timed("broken")).replace("END:VEVENT", "")],
  ["unmatched event end", calendar(["END:VEVENT"])],
  [
    "missing UID",
    calendar(
      event("broken", ["DTSTART:20260105T090000Z"]).filter(
        (x) => !x.startsWith("UID:"),
      ),
    ),
  ],
  [
    "duplicate DTSTART",
    calendar(timed("broken", undefined, ["DTSTART:20260106T090000Z"])),
  ],
  [
    "invalid content line",
    calendar(timed("broken", undefined, ["NO-COLON-HERE"])),
  ],
  ["noncalendar document", "<html>This is a login page</html>"],
]) {
  test(`malformed ICS: ${name} reports incompleteness`, () => {
    incomplete(compare(calendar(), malformed));
  });
}

test("maxBytes is enforced on Unicode bytes, not only JS string length", () => {
  const input = calendar(
    timed("huge", undefined, [`DESCRIPTION:${"界".repeat(100)}`]),
  );
  assert.ok(Buffer.byteLength(input, "utf8") > input.length);
  incomplete(
    compare(calendar(), input, {
      ...WINDOW,
      limits: { maxBytes: input.length + 1 },
    }),
  );
});

test("maxSeries reports incompleteness rather than silently truncating", () => {
  incomplete(
    compare(calendar(), calendar(timed("one"), timed("two")), {
      ...WINDOW,
      limits: { maxSeries: 1 },
    }),
  );
});

test("maxSteps bounds recurrence work and reports incompleteness", () => {
  incomplete(
    compare(
      calendar(),
      calendar(
        timed(
          "ancient",
          "20000101T090000Z",
          ["RRULE:FREQ=DAILY"],
          "20000101T100000Z",
        ),
      ),
      { ...WINDOW, limits: { maxSteps: 2 } },
    ),
  );
});

test("maxOccurrences marks truncation as incomplete", () => {
  incomplete(
    compare(calendar(), calendar(recurring("many", "FREQ=DAILY;COUNT=20")), {
      ...WINDOW,
      limits: { maxOccurrences: 3 },
    }),
  );
});

test("maxChanges bounds the emitted report and marks it incomplete", () => {
  const result = incomplete(
    compare(calendar(), calendar(recurring("many", "FREQ=DAILY;COUNT=20")), {
      ...WINDOW,
      limits: { maxChanges: 2 },
    }),
  );
  assert.ok(result.changes.length <= 2);
});

test("repeated comparisons produce deterministic identifiers and change ordering", () => {
  const before = calendar(recurring("b"), timed("a"));
  const after = calendar(
    recurring("b", "FREQ=DAILY;COUNT=2"),
    timed("a", undefined, ["SUMMARY:Changed"]),
  );
  const first = clean(compare(before, after)),
    second = clean(compare(before, after));
  assert.deepEqual(first.changes, second.changes);
  assert.deepEqual(first.summary, second.summary);
});

// ical.js intentionally tolerates/normalizes several malformed inputs. The
// application promises explicit incomplete results rather than silently repairing
// the source, so these exercise raw grammar before library normalization.
for (const [name, lines] of [
  [
    "COUNT suffix",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=DAILY;COUNT=3cats"],
  ],
  [
    "COUNT fraction",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=DAILY;COUNT=2.5"],
  ],
  [
    "INTERVAL suffix",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=DAILY;INTERVAL=2cats;COUNT=3"],
  ],
  [
    "INTERVAL fraction",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=DAILY;INTERVAL=1.5;COUNT=3"],
  ],
  [
    "BYMONTH suffix",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=YEARLY;BYMONTH=1cats;COUNT=2"],
  ],
  [
    "duplicate FREQ",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=HOURLY;FREQ=DAILY;COUNT=2"],
  ],
  [
    "duplicate COUNT",
    ["DTSTART:20260101T090000Z", "RRULE:FREQ=DAILY;COUNT=3;COUNT=2"],
  ],
  ["DATE-TIME trailing junk", ["DTSTART:20260101T090000Zjunk"]],
  ["DATE-TIME extra digit", ["DTSTART:20260101T0900000Z"]],
  ["DATE trailing junk", ["DTSTART;VALUE=DATE:20260101junk"]],
  ["DTSTART list", ["DTSTART:20260101T090000Z,20260102T090000Z"]],
]) {
  test(`strict source validation rejects ${name}`, () => {
    noFalseDiff(timed("blocked"), event("blocked", lines));
  });
}

test("nested VEVENT is not silently ignored as an unknown event child", () => {
  incomplete(
    compare(
      calendar(),
      calendar(
        event("outer", [
          "DTSTART:20260101T090000Z",
          ...event("inner", ["DTSTART:20260102T090000Z"]),
        ]),
      ),
    ),
  );
});

test("mismatched component closing tags fail closed", () => {
  const invalid = calendar(timed("blocked")).replace("END:VEVENT", "END:VTODO");
  const result = incomplete(compare(calendar(timed("blocked")), invalid));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

test("YEARLY BYMONTHDAY without BYMONTH expands across the year", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "year-monthday",
          "20260115T090000Z",
          ["RRULE:FREQ=YEARLY;BYMONTHDAY=15;COUNT=4"],
          "20260115T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2027-01-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260115",
    "20260215",
    "20260315",
    "20260415",
  ]);
});

test("YEARLY BYMONTH with multiple months retains the DTSTART day-of-month", () => {
  const result = clean(
    compare(
      calendar(),
      calendar(
        timed(
          "year-months",
          "20260115T090000Z",
          ["RRULE:FREQ=YEARLY;BYMONTH=1,3;COUNT=4"],
          "20260115T100000Z",
        ),
      ),
      { start: "2026-01-01", end: "2028-01-01" },
    ),
  );
  assert.deepEqual(result.changes.map((x) => dateOf(x.after.start)).sort(), [
    "20260115",
    "20260315",
    "20270115",
    "20270315",
  ]);
});

test("single-UID cancellation without DTSTART cancels an existing complete series", () => {
  const result = clean(
    compare(
      calendar(recurring("minimal-cancel")),
      calendar(event("minimal-cancel", ["STATUS:CANCELLED"])),
    ),
  );
  assert.equal(result.summary.removed, 3);
});

test("floating UNTIL must remain floating, not silently interpreted as UTC", () => {
  const before = timed("blocked", "20260101T090000", [], "20260101T100000");
  const after = timed(
    "blocked",
    "20260101T090000",
    ["RRULE:FREQ=DAILY;UNTIL=20260103T090000Z"],
    "20260101T100000",
  );
  noFalseDiff(before, after);
});

test("all-day DURATION cannot use timed hours even when they sum to one day", () => {
  noFalseDiff(
    event("blocked", ["DTSTART;VALUE=DATE:20260101"]),
    event("blocked", ["DTSTART;VALUE=DATE:20260101", "DURATION:PT24H"]),
  );
});

for (const [name, startLine] of [
  ["duplicate VALUE", "DTSTART;VALUE=DATE;VALUE=DATE:20260101"],
  [
    "case-insensitive duplicate VALUE",
    "DTSTART;VALUE=DATE;value=DATE:20260101",
  ],
]) {
  test(`duplicate date parameter: ${name} is rejected`, () => {
    noFalseDiff(timed("blocked"), event("blocked", [startLine]));
  });
}

for (const until of [
  "20260103T090000Zjunk",
  "20260103T090000+0900",
  "20260103T090000Z,20260104T090000Z",
]) {
  test(`strict UNTIL syntax rejects ${until}`, () => {
    noFalseDiff(
      recurring("blocked"),
      recurring("blocked", `FREQ=DAILY;UNTIL=${until}`),
    );
  });
}

test("a single-event temporal type change is explicitly incomplete", () => {
  const result = compare(
    calendar(timed("type", "20260105T090000Z", [], "20260105T100000Z")),
    calendar(timed("type", "20260105T090000", [], "20260105T100000")),
  );
  incomplete(result);
  assert.deepEqual(changesFor(result, "type"), []);
  assert.equal(result.summary.moved, 0);
});

test("recurring temporal type changes are explicitly incomplete", () => {
  const before = calendar(recurring("typed-origins"));
  const after = calendar(
    timed(
      "typed-origins",
      "20260101T090000",
      ["RRULE:FREQ=DAILY;COUNT=3"],
      "20260101T100000",
    ),
  );
  const result = incomplete(compare(before, after));
  assert.deepEqual(changesFor(result, "typed-origins"), []);
  assert.equal(result.summary.moved, 0);
});

test("single all-day to UTC changes do not infer cross-domain moves", () => {
  const before = calendar(
    event("date-to-time", ["DTSTART;VALUE=DATE:20260105"]),
  );
  const after = calendar(
    timed("date-to-time", "20260105T000000Z", [], "20260106T000000Z"),
  );
  const result = incomplete(compare(before, after));
  assert.deepEqual(changesFor(result, "date-to-time"), []);
});

test("RDATE and EXDATE support multiple properties and reordered value lists", () => {
  const a = calendar(
    recurring("date-lists", "FREQ=DAILY;COUNT=3", [
      "RDATE:20260105T090000Z,20260106T090000Z",
      "RDATE:20260107T090000Z",
      "EXDATE:20260102T090000Z,20260103T090000Z",
    ]),
  );
  const b = calendar(
    recurring("date-lists", "FREQ=DAILY;COUNT=3", [
      "EXDATE:20260103T090000Z",
      "EXDATE:20260102T090000Z",
      "RDATE:20260107T090000Z,20260106T090000Z,20260105T090000Z",
    ]),
  );
  const result = clean(compare(a, b));
  assert.equal(result.summary.unchanged, 4);
  assert.deepEqual(result.changes, []);
});

test("metadata escaping and parameter order preserve semantic equality", () => {
  const before = calendar(
    timed("escaping", undefined, [
      "SUMMARY:A\\, B\\; C\\\\D",
      "DESCRIPTION:line one\\nline two",
      'ATTENDEE;CN="Person: Test";ROLE=REQ-PARTICIPANT:mailto:test@example.invalid',
    ]),
  );
  const after = calendar(
    timed("escaping", undefined, [
      'ATTENDEE;ROLE=REQ-PARTICIPANT;CN="Person: Test":mailto:test@example.invalid',
      "DESCRIPTION:line one\\Nline two",
      "SUMMARY:A\\, B\\; C\\\\D",
    ]),
  );
  const result = clean(compare(before, after));
  assert.equal(result.summary.unchanged, 1);
  assert.deepEqual(result.changes, []);
});

test("VALARM changes remain outside occurrence comparison scope", () => {
  const before = calendar(
    timed("alarm", undefined, [
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
    ]),
  );
  const after = calendar(
    timed("alarm", undefined, [
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Earlier reminder",
      "END:VALARM",
    ]),
  );
  const result = clean(compare(before, after));
  assert.equal(result.summary.unchanged, 1);
  assert.deepEqual(result.changes, []);
});

test("METHOD scheduling messages are not accepted as complete snapshots", () => {
  const message = calendar(timed("blocked")).replace(
    "VERSION:2.0",
    "VERSION:2.0\r\nMETHOD:REQUEST",
  );
  const result = incomplete(compare(calendar(timed("blocked")), message));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

for (const rule of [
  "FREQ=DAILY;INTERVAL=1;interval=0",
  "FREQ=DAILY;interval=0",
  "FREQ=DAILY;count=3cats",
  "FREQ=DAILY;COUNT=3;count=2",
  "FREQ=HOURLY;freq=DAILY;COUNT=2",
]) {
  test(`case-insensitive RRULE validation rejects ${rule}`, () => {
    noFalseDiff(recurring("blocked"), recurring("blocked", rule));
  });
}

test("cancellation does not bypass orphan override validation", () => {
  const before = calendar(recurring("blocked"));
  const after = calendar(
    recurring("blocked", "FREQ=DAILY;COUNT=3", ["STATUS:CANCELLED"]),
    timed(
      "blocked",
      "20260120T100000Z",
      ["RECURRENCE-ID:20260120T090000Z"],
      "20260120T110000Z",
    ),
  );
  const result = incomplete(compare(before, after));
  assert.deepEqual(changesFor(result, "blocked"), []);
});

test("future recurrence origin moved inside carries its outside counterpart", () => {
  const base = recurring("future-origin", "FREQ=DAILY;COUNT=365");
  const override = timed(
    "future-origin",
    "20260105T120000Z",
    ["RECURRENCE-ID:20260801T090000Z"],
    "20260105T130000Z",
  );
  const row = oneChange(
    compare(calendar(base), calendar(base, override)),
    "future-origin",
  );
  assert.equal(dateOf(row.before.start), "20260801");
  assert.equal(row.before.inWindow, false);
  assert.equal(row.after.inWindow, true);
  assert.deepEqual(row.changes, ["start"]);
});

test("removing a future-origin override keeps the restored outside counterpart", () => {
  const base = recurring("future-restore", "FREQ=DAILY;COUNT=365");
  const override = timed(
    "future-restore",
    "20260105T120000Z",
    ["RECURRENCE-ID:20260801T090000Z"],
    "20260105T130000Z",
  );
  const row = oneChange(
    compare(calendar(base, override), calendar(base)),
    "future-restore",
  );
  assert.equal(dateOf(row.after.start), "20260801");
  assert.equal(row.before.inWindow, true);
  assert.equal(row.after.inWindow, false);
  assert.deepEqual(row.changes, ["start"]);
});

test("cancellation with an override cannot bypass recurrence work limits", () => {
  const base = recurring("blocked", "FREQ=DAILY;COUNT=365");
  const override = timed(
    "blocked",
    "20260105T120000Z",
    ["RECURRENCE-ID:20260801T090000Z"],
    "20260105T130000Z",
  );
  const result = incomplete(
    compare(
      calendar(base),
      calendar(
        recurring("blocked", "FREQ=DAILY;COUNT=365", ["STATUS:CANCELLED"]),
        override,
      ),
      { ...WINDOW, limits: { maxSteps: 2 } },
    ),
  );
  assert.deepEqual(changesFor(result, "blocked"), []);
});
