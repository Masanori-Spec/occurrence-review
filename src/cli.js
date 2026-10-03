#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { DEFAULT_LIMITS } from "./engine.js";
const USAGE = `occurrence-review BEFORE.ics AFTER.ics --start YYYY-MM-DD --end YYYY-MM-DD [--json]\n\nCompare complete snapshots locally. START membership in [start, end), independently\nfor UTC, floating and all-day DATE. TZID is explicitly unsupported.\nExit 0: complete, no changes; 1: complete, changes; 2: incomplete/error.\n`;
function readable(r) {
  const lines = [
    `Occurrence Review · ${r.window.start} ≤ start < ${r.window.end}`,
    r.complete
      ? "COMPLETE within the documented scope"
      : "INCOMPLETE · do not interpret as no changes",
    `${r.summary.added} added · ${r.summary.removed} removed · ${r.summary.moved} moved · ${r.summary.durationChanged} duration · ${r.summary.metadataChanged} metadata · ${r.summary.unchanged} unchanged`,
  ];
  for (const c of r.changes) {
    lines.push(
      "",
      `${c.kind.toUpperCase()} ${JSON.stringify(c.uid)} / ${c.recurrenceId || "single"}${c.changes.length ? " [" + c.changes.join(", ") + "]" : ""}`,
    );
    for (const [label, o] of [
      ["before", c.before],
      ["after", c.after],
    ])
      lines.push(
        o
          ? `  ${label}: ${o.start} → ${o.end} (${o.temporalType}${o.inWindow ? "" : ", outside window"}) ${JSON.stringify(o.summary)}`
          : `  ${label}: absent`,
      );
    lines.push(
      `  evidence: ${c.evidence.identity}; ${c.evidence.fields.join(", ")}`,
    );
  }
  for (const d of r.diagnostics)
    lines.push(
      `! ${d.side}${d.uid ? " / " + JSON.stringify(d.uid) : ""}: ${d.code}: ${JSON.stringify(d.message)}`,
    );
  return lines.join("\n") + "\n";
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE);
    return;
  }
  let json = false;
  const options = {},
    files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") json = true;
    else if (a === "--start" || a === "--end") {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new Error(`Missing ${a} value.`);
      options[a.slice(2)] = args[++i];
    } else if (a.startsWith("-")) throw new Error(`Unknown option ${a}`);
    else files.push(a);
  }
  if (files.length !== 2 || !options.start || !options.end)
    throw new Error(USAGE);
  const texts = [];
  for (const file of files) {
    const info = await stat(file);
    if (!info.isFile() || info.size > DEFAULT_LIMITS.maxBytes)
      throw new Error("Input must be a regular file no larger than 1 MiB.");
    const bytes = await readFile(file);
    if (bytes.length > DEFAULT_LIMITS.maxBytes)
      throw new Error("Input exceeds 1 MiB.");
    texts.push(bytes.toString("utf8"));
  }
  const worker = new Worker(new URL("./cli-worker.js", import.meta.url), {
    workerData: { before: texts[0], after: texts[1], options },
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Analysis exceeded 10 seconds; incomplete."));
    }, 10000);
    const finish = (fn) => (value) => {
      clearTimeout(timer);
      worker.terminate();
      fn(value);
    };
    worker.once("message", finish(resolve));
    worker.once("error", finish(reject));
    worker.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(
          new Error(`Analysis worker stopped (code ${code}); incomplete.`),
        );
      }
    });
  });
  if (result.error) throw new Error(result.error);
  process.stdout.write(
    json
      ? JSON.stringify(result.report, null, 2) + "\n"
      : readable(result.report),
  );
  process.exitCode = !result.report.complete
    ? 2
    : result.report.changes.length
      ? 1
      : 0;
}
main().catch((error) => {
  process.stderr.write(`occurrence-review: ${error.message}\n`);
  process.exitCode = 2;
});
