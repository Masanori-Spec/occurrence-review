import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { compareCalendars } from "../src/engine.js";
const before = await readFile(
  new URL("../fixtures/before.ics", import.meta.url),
  "utf8",
);
const after = await readFile(
  new URL("../fixtures/after.ics", import.meta.url),
  "utf8",
);
const options = { start: "2026-01-01", end: "2026-02-01" };
const cli = (...args) =>
  spawnSync(process.execPath, ["src/cli.js", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
test("CLI JSON, browser worker and direct engine share exact report", async () => {
  const expected = compareCalendars(before, after, options);
  const run = cli(
    "fixtures/before.ics",
    "fixtures/after.ics",
    "--start",
    options.start,
    "--end",
    options.end,
    "--json",
  );
  assert.equal(run.status, 1, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), expected);
  let received;
  globalThis.self = {
    postMessage: (value) => {
      received = value;
    },
  };
  await import("../web/worker.js");
  await self.onmessage({
    data: { requestId: 42, beforeText: before, afterText: after, options },
  });
  assert.deepEqual(received, { requestId: 42, report: expected });
  await self.onmessage({
    data: {
      requestId: 43,
      beforeText: before,
      afterText: after,
      options: { ...options, end: options.start },
    },
  });
  assert.equal(received.requestId, 43);
  assert.equal(typeof received.error, "string");
  delete globalThis.self;
});
test("saved synthetic expected report is current", async () => {
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL("../fixtures/expected-report.json", import.meta.url),
        "utf8",
      ),
    ),
    compareCalendars(before, after, options),
  );
});
test("CLI exit codes distinguish unchanged, changed and incomplete", async () => {
  const same = cli(
    "fixtures/before.ics",
    "fixtures/before.ics",
    "--start",
    options.start,
    "--end",
    options.end,
  );
  assert.equal(same.status, 0);
  assert.match(same.stdout, /COMPLETE/);
  const diff = cli(
    "fixtures/before.ics",
    "fixtures/after.ics",
    "--start",
    options.start,
    "--end",
    options.end,
  );
  assert.equal(diff.status, 1);
  assert.match(diff.stdout, /same UID and typed RECURRENCE-ID/);
  const dir = await mkdtemp(join(tmpdir(), "occurrence-contract-"));
  try {
    const invalid = join(dir, "invalid.ics");
    await writeFile(invalid, "not ics");
    const run = cli(
      invalid,
      "fixtures/before.ics",
      "--start",
      options.start,
      "--end",
      options.end,
      "--json",
    );
    assert.equal(run.status, 2);
    assert.equal(JSON.parse(run.stdout).complete, false);
    const huge = join(dir, "huge.ics");
    await writeFile(huge, "a".repeat(1048577));
    assert.equal(
      cli(
        huge,
        "fixtures/before.ics",
        "--start",
        options.start,
        "--end",
        options.end,
      ).status,
      2,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("CLI reports usage and invalid options without false success", () => {
  assert.equal(cli("--help").status, 0);
  for (const args of [
    [],
    ["--wat"],
    [
      "missing.ics",
      "missing.ics",
      "--start",
      options.start,
      "--end",
      options.end,
    ],
  ])
    assert.equal(cli(...args).status, 2);
});
test("invalid, reversed and unbounded windows are rejected", () => {
  for (const window of [
    {},
    { start: "2026-02-30", end: "2026-03-01" },
    { start: "2026-01-01", end: "2026-01-01" },
    { start: "2026-01-02", end: "2026-01-01" },
    { start: "2020-01-01", end: "2040-01-01" },
  ])
    assert.throws(() => compareCalendars(before, after, window));
});
test("limits cannot silently expand the safety envelope", () => {
  for (const limits of [
    { wat: 1 },
    { maxSteps: 200001 },
    { maxChanges: 0 },
    { maxBytes: 1.5 },
  ])
    assert.throws(() =>
      compareCalendars(before, after, { ...options, limits }),
    );
});
test("report byte and unfolded property limits are enforced honestly", () => {
  const empty = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
  const event = (uid, text) =>
    `BEGIN:VEVENT\nUID:${uid}\nDTSTART:20260101T090000Z\nDESCRIPTION:${text}\nEND:VEVENT`;
  const large = `BEGIN:VCALENDAR\nVERSION:2.0\n${Array.from({ length: 20 }, (_, i) => event("event-" + i, "x".repeat(4000))).join("\n")}\nEND:VCALENDAR`;
  const result = compareCalendars(empty, large, {
    ...options,
    limits: { maxReportBytes: 16384 },
  });
  assert.equal(result.complete, false);
  assert.ok(new TextEncoder().encode(JSON.stringify(result)).length <= 16384);
  assert.ok(result.diagnostics.some((d) => d.code === "OUTPUT_LIMIT"));
  const hugeLine = `BEGIN:VCALENDAR\nVERSION:2.0\n${event("large", "x".repeat(65537))}\nEND:VCALENDAR`;
  assert.equal(compareCalendars(empty, hugeLine, options).complete, false);
});
test("snapshot control characters cannot leak through readable CLI output", () => {
  const input = before.replace("Design review", "Design\u001b[31mreview");
  assert.equal(compareCalendars(input, after, options).complete, false);
});
test("all TZID DST boundaries and different same-name definitions stay incomplete", () => {
  const calendar = (offset, date) =>
    `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VTIMEZONE\nTZID:Example/Zone\nBEGIN:STANDARD\nDTSTART:19700101T000000\nTZOFFSETFROM:${offset}\nTZOFFSETTO:${offset}\nEND:STANDARD\nEND:VTIMEZONE\nBEGIN:VEVENT\nUID:zone\nDTSTART;TZID=Example/Zone:${date}\nDURATION:PT1H\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\nEND:VCALENDAR`;
  for (const date of ["20260308T023000", "20261101T013000"]) {
    const r = compareCalendars(
      calendar("-0500", date),
      calendar("-0400", date),
      { start: "2026-01-01", end: "2027-01-01" },
    );
    assert.equal(r.complete, false);
    assert.deepEqual(r.changes, []);
    assert.ok(r.diagnostics.every((d) => d.code === "UNSUPPORTED_TZID"));
  }
});
