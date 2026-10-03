import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const results = [];
const artifactDir =
  process.env.BROWSER_ARTIFACT_DIR || "tests/browser/artifacts";
await mkdir(artifactDir, { recursive: true });
const calendar = (...lines) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UI tests//EN",
    ...lines,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
const event = (
  start = "20261005T100000Z",
  title = "Review",
  end = "20261005T110000Z",
) => [
  "BEGIN:VEVENT",
  "UID:ui-test@example.invalid",
  `DTSTART:${start}`,
  `DTEND:${end}`,
  `SUMMARY:${title}`,
  "END:VEVENT",
];
const fakeReport = {
  schemaVersion: "1.0",
  complete: true,
  window: { start: "2026-10-01", end: "2026-11-01", semantics: "half-open" },
  summary: {
    added: 0,
    removed: 0,
    moved: 0,
    durationChanged: 0,
    metadataChanged: 0,
    unchanged: 1,
  },
  changes: [],
  diagnostics: [],
  stats: {},
};
async function setup(page, locale = "en") {
  await page.goto(baseURL);
  await page.locator("#language").selectOption(locale);
}
async function ready(page) {
  await page.locator("#results").waitFor({ state: "visible" });
  await page.locator("#compare").waitFor({ state: "visible" });
  assert.equal(await page.locator("#compare").isDisabled(), false);
}
async function fillPair(page, before = calendar(...event()), after = before) {
  await page.locator("#before").fill(before);
  await page.locator("#after").fill(after);
}
async function mockWorker(page, mode) {
  await page.addInitScript(
    ({ report, mode }) => {
      window.__workers = { created: 0, terminated: 0, messages: 0 };
      window.Worker = class {
        constructor() {
          this.number = ++window.__workers.created;
          if (mode === "constructor" && this.number === 1)
            throw new Error("simulated constructor failure");
        }
        terminate() {
          window.__workers.terminated++;
        }
        postMessage(message) {
          window.__workers.messages++;
          const callback = this;
          if (mode === "error" && this.number === 1) {
            setTimeout(() => callback.onerror?.({ preventDefault() {} }), 10);
            return;
          }
          if (mode === "messageerror" && this.number === 1) {
            setTimeout(() => callback.onmessageerror?.({}), 10);
            return;
          }
          if (mode === "invalid" && this.number === 1) {
            setTimeout(
              () =>
                callback.onmessage?.({
                  data: { requestId: message.requestId, report: {} },
                }),
              10,
            );
            return;
          }
          if (mode === "thrown" && this.number === 1) {
            setTimeout(
              () =>
                callback.onmessage?.({
                  data: {
                    requestId: message.requestId,
                    error: "simulated engine error",
                  },
                }),
              10,
            );
            return;
          }
          if (mode === "id")
            setTimeout(
              () =>
                callback.onmessage?.({
                  data: {
                    requestId: message.requestId + 100,
                    error: "Wrong request should be ignored",
                  },
                }),
              10,
            );
          setTimeout(
            () =>
              callback.onmessage?.({
                data: { requestId: message.requestId, report },
              }),
            mode === "late" && this.number === 1
              ? 300
              : mode === "id"
                ? 100
                : 25,
          );
        }
      };
    },
    { report: fakeReport, mode },
  );
}
async function test(name, fn, viewport) {
  const page = await browser.newPage({
    viewport: viewport || { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await fn(page);
    assert.deepEqual(pageErrors, [], "no uncaught browser errors");
    results.push({ name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", error: error.stack });
    await page.screenshot({
      path: `${artifactDir}/${name.replace(/[^a-z0-9]+/gi, "-")}-failure.png`,
      fullPage: true,
    });
    console.error(`FAIL ${name}\n${error.stack}`);
  } finally {
    await page.close();
  }
}

await test("initial state and keyboard labels", async (page) => {
  await page.goto(baseURL);
  await page.keyboard.press("Tab");
  assert.match(
    await page.evaluate(() => document.activeElement.textContent),
    /比較ツールへ/,
  );
  await page.keyboard.press("Enter");
  assert.match(page.url(), /#workspace$/);
  await page.locator("#language").selectOption("en");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.match(await page.title(), /Occurrence Review/);
  assert.equal(await page.locator("#empty").isVisible(), true);
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.getByLabel("Before", { exact: true }).count(), 1);
  assert.equal(await page.getByLabel("After", { exact: true }).count(), 1);
});

await test("required inputs dates and recovery", async (page) => {
  await setup(page);
  await page.locator("#compare").click();
  assert.match(
    await page.locator("#error").textContent(),
    /both the before and after/,
  );
  await fillPair(page);
  await page.locator("#end").fill("2026-10-01");
  await page.locator("#compare").click();
  assert.match(await page.locator("#error").textContent(), /later than/);
  await page.locator("#end").fill("2026-11-01");
  await page.locator("#compare").click();
  await ready(page);
  assert.match(
    await page.locator("#report-banner").textContent(),
    /Comparison complete/,
  );
  assert.match(
    await page.locator("#changes").textContent(),
    /No occurrence changes/,
  );
  assert.equal(await page.locator("#error").isVisible(), false);
});

await test("real sample repeated compare filters evidence and JSON", async (page) => {
  await setup(page);
  await page.locator("#example").click();
  await ready(page);
  for (const [key, count] of Object.entries({
    added: 1,
    removed: 1,
    moved: 1,
    durationChanged: 1,
    metadataChanged: 2,
    unchanged: 4,
  })) {
    assert.equal(
      await page.locator(`.stat[data-kind="${key}"] .stat-value`).textContent(),
      String(count),
      key,
    );
  }
  assert.equal(await page.locator(".change-card").count(), 4);
  await page.locator(".evidence summary").first().click();
  assert.match(
    await page.locator(".evidence-content").first().textContent(),
    /Match key/,
  );
  await page.locator('.filter[data-filter="moved"]').click();
  assert.equal(await page.locator(".change-card").count(), 1);
  assert.match(await page.locator("#changes").textContent(), /11:00 UTC/);
  assert.match(await page.locator("#changes").textContent(), /Room C/);
  await page.locator('.filter[data-filter="all"]').click();
  for (let i = 0; i < 2; i++) {
    await page.locator("#compare").click();
    await ready(page);
  }
  assert.equal(await page.locator(".change-card").count(), 4);
  const downloaded = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloaded;
  assert.match(download.suggestedFilename(), /^occurrence-review-.*\.json$/);
  const stream = await download.createReadStream();
  let json = "";
  for await (const chunk of stream) json += chunk;
  const report = JSON.parse(json);
  assert.equal(report.schemaVersion, "1.0");
  assert.equal(report.complete, true);
  assert.equal(report.summary.moved, 1);
  await page.screenshot({
    path: `${artifactDir}/desktop-report.png`,
    fullPage: true,
  });
});

await test("swap invalidates results and reverses evidence", async (page) => {
  await setup(page);
  await page.locator("#example").click();
  await ready(page);
  const before = await page.locator("#before").inputValue();
  const after = await page.locator("#after").inputValue();
  await page.locator("#swap").click();
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.locator("#before").inputValue(), after);
  assert.equal(await page.locator("#after").inputValue(), before);
  await page.locator("#compare").click();
  await ready(page);
  await page.locator('.filter[data-filter="added"]').click();
  assert.match(await page.locator("#changes").textContent(), /Archive review/);
  await page.locator('.filter[data-filter="removed"]').click();
  assert.match(await page.locator("#changes").textContent(), /Team handoff/);
});

await test("malformed input is explicitly incomplete and recovers", async (page) => {
  await setup(page);
  await fillPair(page, "not a calendar", "not a calendar");
  await page.locator("#compare").click();
  await ready(page);
  assert.match(
    await page.locator("#report-banner").textContent(),
    /Incomplete comparison/,
  );
  assert.match(
    await page.locator("#changes").textContent(),
    /cannot establish that nothing changed/,
  );
  assert.equal((await page.locator(".diagnostic").count()) > 0, true);
  await page.locator("#example").click();
  await ready(page);
  assert.match(
    await page.locator("#report-banner").textContent(),
    /Comparison complete/,
  );
  assert.equal(await page.locator(".diagnostics-box").count(), 0);
});

await test("input edits hide stale reports and language keeps content", async (page) => {
  await setup(page);
  await page.locator("#example").click();
  await ready(page);
  const content = await page.locator("#before").inputValue();
  await page.locator("#language").selectOption("ja");
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  assert.match(await page.locator("#report-banner").textContent(), /比較完了/);
  assert.equal(await page.locator("#before").inputValue(), content);
  await page.locator("#language").selectOption("en");
  assert.match(
    await page.locator("#report-banner").textContent(),
    /Comparison complete/,
  );
  await page.locator("#start").fill("2026-10-02");
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.match(await page.locator("#status").textContent(), /Inputs changed/);
});

await test("file limits are checked before read and file selection recovers", async (page) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    window.__fileReads = 0;
    File.prototype.text = function (...args) {
      window.__fileReads++;
      return original.apply(this, args);
    };
  });
  await setup(page);
  await page.locator("#before-file").setInputFiles({
    name: "too-large.ics",
    mimeType: "text/calendar",
    buffer: Buffer.alloc(1024 * 1024 + 1, 65),
  });
  assert.match(await page.locator("#error").textContent(), /1 MiB/);
  assert.equal(await page.evaluate(() => window.__fileReads), 0);
  await page.locator("#before-file").setInputFiles({
    name: "before.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(calendar(...event())),
  });
  await page.waitForFunction(() =>
    document.querySelector("#before").value.startsWith("BEGIN:VCALENDAR"),
  );
  await page.locator("#after-file").setInputFiles({
    name: "after.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(calendar(...event())),
  });
  await page.waitForFunction(() =>
    document.querySelector("#after").value.startsWith("BEGIN:VCALENDAR"),
  );
  assert.equal(
    await page.locator("#before-file-note").textContent(),
    "before.ics",
  );
  assert.equal(await page.evaluate(() => window.__fileReads), 2);
  await page.locator("#compare").click();
  await ready(page);
  assert.match(
    await page.locator("#report-banner").textContent(),
    /Comparison complete/,
  );
});

await test("oversized paste is rejected and can be corrected", async (page) => {
  await setup(page);
  await page.locator("#before").fill("x".repeat(1024 * 1024 + 1));
  await page.locator("#after").fill(calendar(...event()));
  await page.locator("#compare").click();
  assert.match(await page.locator("#error").textContent(), /1 MiB/);
  await page.locator("#before").fill(calendar(...event()));
  await page.locator("#compare").click();
  await ready(page);
});

await test("untrusted ICS is text and no calendar network requests occur", async (page) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await setup(page);
  const hostile = "<img src=https://untrusted.invalid/track onerror=alert(1)>";
  await fillPair(
    page,
    calendar(...event()),
    calendar(...event("20261005T100000Z", hostile)),
  );
  await page.locator("#compare").click();
  await ready(page);
  assert.match(
    await page.locator("#changes").textContent(),
    /<img src=https:\/\/untrusted.invalid/,
  );
  assert.equal(await page.locator("#changes img").count(), 0);
  assert.equal(
    requests.some((url) => !url.startsWith(baseURL)),
    false,
  );
});

await test("moved counterpart outside window is visible", async (page) => {
  await setup(page);
  await fillPair(
    page,
    calendar(...event("20261005T100000Z")),
    calendar(...event("20261105T100000Z", "Review", "20261105T110000Z")),
  );
  await page.locator("#compare").click();
  await ready(page);
  assert.equal(await page.locator(".change-card").count(), 1);
  assert.match(
    await page.locator("#changes").textContent(),
    /Outside this window/,
  );
  assert.match(await page.locator("#changes").textContent(), /2026-11-05/);
});

await test("cancel terminates work ignores late results and can recover", async (page) => {
  await mockWorker(page, "late");
  await setup(page);
  await fillPair(page);
  await page.locator("#compare").click();
  await page.locator("#cancel").click();
  assert.match(await page.locator("#status").textContent(), /cancelled/);
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.evaluate(() => window.__workers.terminated), 1);
  await page.locator("#compare").click();
  await ready(page);
});

await test("newer inputs suppress an old asynchronous result", async (page) => {
  await mockWorker(page, "late");
  await setup(page);
  await fillPair(page);
  await page.locator("#compare").click();
  await page
    .locator("#before")
    .fill(calendar(...event("20261005T100000Z", "New content")));
  // A second edit must retain the rerun notice after the first retired the worker.
  await page
    .locator("#before")
    .fill(calendar(...event("20261005T100000Z", "Newest content")));
  await page.locator("#before").dispatchEvent("input");
  assert.match(await page.locator("#status").textContent(), /Inputs changed/);
  assert.equal(await page.locator("#cancel").isVisible(), false);
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.match(await page.locator("#status").textContent(), /Inputs changed/);
  await page.locator("#compare").click();
  await ready(page);
});

await test("incorrect worker request ids are ignored", async (page) => {
  await mockWorker(page, "id");
  await setup(page);
  await fillPair(page);
  await page.locator("#compare").click();
  await ready(page);
  assert.equal(await page.locator("#error").isVisible(), false);
});

for (const mode of [
  "error",
  "messageerror",
  "constructor",
  "invalid",
  "thrown",
]) {
  await test(`worker ${mode} failure recovers on repeat`, async (page) => {
    await mockWorker(page, mode);
    await setup(page);
    await fillPair(page);
    await page.locator("#compare").click();
    await page.locator("#error").waitFor({ state: "visible" });
    assert.equal(await page.locator("#compare").isDisabled(), false);
    assert.equal(await page.locator("#cancel").isVisible(), false);
    assert.equal(await page.locator("#results").isVisible(), false);
    await page.locator("#compare").click();
    await ready(page);
    assert.equal(await page.locator("#error").isVisible(), false);
  });
}

await test(
  "mobile layout and tap targets have no horizontal overflow",
  async (page) => {
    await setup(page, "ja");
    await page.locator("#example").click();
    await ready(page);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    for (const id of ["compare", "before", "after", "start", "end"]) {
      const box = await page.locator("#" + id).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 390, `${id} fits screen`);
    }
    await page.screenshot({
      path: `${artifactDir}/mobile-report-ja.png`,
      fullPage: true,
    });
    await page.locator("#language").selectOption("en");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${artifactDir}/mobile-report-en.png`,
      fullPage: true,
    });
  },
  { width: 390, height: 844 },
);

await test("file read races keep latest content and swap cancels pending read", async (page) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = async function (...args) {
      const text = await original.apply(this, args);
      if (this.name.startsWith("slow"))
        await new Promise((resolve) => setTimeout(resolve, 300));
      return text;
    };
  });
  await setup(page);
  await page.locator("#before-file").setInputFiles({
    name: "slow.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("OLD"),
  });
  await page.locator("#before-file").setInputFiles({
    name: "latest.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("LATEST"),
  });
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#before").inputValue(), "LATEST");
  await page.locator("#after").fill("AFTER");
  await page.locator("#before-file").setInputFiles({
    name: "slow-again.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("STALE"),
  });
  await page.locator("#compare").click();
  assert.match(await page.locator("#error").textContent(), /still loading/);
  assert.equal(await page.locator("#results").isVisible(), false);
  await page.locator("#swap").click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#before").inputValue(), "AFTER");
  assert.equal(await page.locator("#after").inputValue(), "LATEST");
});

await test("file read failure is recoverable", async (page) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function (...args) {
      if (this.name === "bad.ics")
        return Promise.reject(new Error("simulated file read error"));
      return original.apply(this, args);
    };
  });
  await setup(page);
  await page.locator("#before-file").setInputFiles({
    name: "bad.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("test"),
  });
  await page.locator("#error").waitFor({ state: "visible" });
  assert.match(await page.locator("#error").textContent(), /could not be read/);
  await page.locator("#example").click();
  await ready(page);
  assert.equal(await page.locator("#error").isVisible(), false);
});

await test("large reports paginate without dropping JSON report contents", async (page) => {
  const changes = Array.from({ length: 125 }, (_, i) => ({
    id: String(i),
    uid: `event-${i}`,
    kind: "added",
    changes: [],
    before: null,
    after: {
      summary: `Event ${i}`,
      start: "2026-10-05T10:00:00Z",
      end: "2026-10-05T11:00:00Z",
      durationSeconds: 3600,
      temporalType: "utc",
      inWindow: true,
    },
    evidence: { identity: "test", fields: ["occurrence-set membership"] },
  }));
  await page.addInitScript(
    (report) => {
      window.Worker = class {
        terminate() {}
        postMessage(message) {
          setTimeout(
            () =>
              this.onmessage?.({
                data: { requestId: message.requestId, report },
              }),
            0,
          );
        }
      };
    },
    { ...fakeReport, changes, summary: { ...fakeReport.summary, added: 125 } },
  );
  await setup(page);
  await fillPair(page);
  await page.locator("#compare").click();
  await ready(page);
  assert.equal(await page.locator(".change-card").count(), 50);
  await page.locator("#load-more").click();
  assert.equal(await page.locator(".change-card").count(), 100);
  await page.locator("#load-more").click();
  assert.equal(await page.locator(".change-card").count(), 125);
  assert.equal(await page.locator("#load-more").count(), 0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let exported = "";
  for await (const chunk of stream) exported += chunk;
  assert.equal(JSON.parse(exported).changes.length, 125);
  await page.locator('.filter[data-filter="removed"]').click();
  assert.equal(await page.locator(".change-card").count(), 0);
  await page.locator('.filter[data-filter="all"]').click();
  assert.equal(await page.locator(".change-card").count(), 50);
});

await browser.close();
await writeFile(
  `${artifactDir}/results.json`,
  JSON.stringify(
    {
      baseURL,
      total: results.length,
      passed: results.filter((x) => x.status === "passed").length,
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `\n${results.filter((x) => x.status === "passed").length}/${results.length} browser tests passed`,
);
if (results.some((result) => result.status === "failed")) process.exitCode = 1;
