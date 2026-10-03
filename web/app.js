import { SAMPLE_BEFORE, SAMPLE_AFTER } from "./samples.js";

const TEXT = {
  ja: {
    skip: "比較ツールへ",
    language: "表示言語",
    local: "端末内で処理",
    title: "予定の差分を、\n開催回ごとに。",
    subtitle:
      "繰り返し予定の変更も、実際の1回ずつに展開。更新前と更新後の .ics を比べ、見落としたくない変更を確認します。",
    example: "サンプルで試す",
    noUpload: "アップロード不要・登録不要",
    visualCaption: "シリーズ全体ではなく、変わった1回を。",
    step1: "01 / INPUT",
    inputTitle: "2つのカレンダーを比較",
    swap: "前後を入れ替え",
    before: "更新前",
    after: "更新後",
    chooseFile: ".ics を選ぶ",
    pasteHint: "ファイルを選ぶか、ICSを貼り付け",
    start: "比較開始日",
    end: "終了日（含まない）",
    cancel: "中止",
    compare: "開催回を比較",
    windowNote:
      "開始日時で期間に含まれる開催回を比較します。UTC・タイムゾーンなし・終日は別々に扱い、端末のタイムゾーンへ変換しません。",
    step2: "02 / REVIEW",
    resultsTitle: "変更レポート",
    download: "JSONを保存",
    overlap: "変更の種類は重複する場合があります",
    emptyTitle: "変更を見つける準備ができました",
    emptyText:
      "2つのファイルと期間を選ぶと、追加・削除・時刻移動などの差分がここに表示されます。",
    principle1: "カレンダーは端末の中に",
    principle1Text:
      "入力内容はブラウザ内で処理。サーバーへの送信、分析用の収集、保存はしません。",
    principle2: "判断の根拠まで確認",
    principle2Text:
      "UIDとRECURRENCE-IDで開催回を照合。変更前後と照合の根拠を一緒に確認できます。",
    principle3: "比較できない内容は明示",
    principle3Text:
      "未対応のルールや不正な入力があれば「不完全」と表示。差分がないとは断定しません。",
    footer: "カレンダーを書き換えずに、変更を確かめる。",
    working: "開催回を展開して比較しています…",
    finished: "比較が完了しました",
    partialFinished: "比較は不完全です。警告を確認してください",
    cancelled: "比較を中止しました",
    stale: "入力が変わりました。もう一度比較してください",
    swapped: "更新前と更新後を入れ替えました",
    exampleLoaded: "サンプルを読み込みました",
    missing: "更新前と更新後の両方に、VCALENDAR形式の内容を入力してください。",
    dates:
      "有効な開始日と終了日を選んでください。終了日は開始日より後である必要があります。",
    size: "入力はそれぞれ1 MiB以下にしてください。",
    fileError:
      "ファイルを読み込めませんでした。別のファイルを選ぶか、内容を貼り付けてください。",
    fileLoading: "ファイルを読み込んでいます。完了してから比較してください。",
    workerError:
      "比較処理が失敗しました。入力を確認して、もう一度試してください。",
    timeout:
      "処理時間の上限に達したため中止しました。期間や入力を小さくして、もう一度試してください。",
    reportError:
      "有効な比較レポートを受け取れませんでした。もう一度試してください。",
    complete: "比較完了",
    completeNote:
      "指定した期間内の開催回を、対応する機能の範囲で比較しました。",
    incomplete: "不完全な比較 · 結果は確定できません",
    incompleteNote:
      "未対応の内容、不正な入力、または処理上限が見つかりました。表示された差分は一部のみです。「変更なし」の判断には使わないでください。下の診断を確認してください。",
    added: "追加",
    removed: "削除",
    moved: "時刻・日付の移動",
    durationChanged: "長さの変更",
    metadataChanged: "内容の変更",
    unchanged: "変更なし",
    all: "すべて",
    filterLabel: "差分を絞り込む",
    noChanges: "対応機能の範囲では、この期間の開催回に変更はありません。",
    noChangesPartial:
      "表示できる差分はありませんが、比較が不完全なため「変更なし」とは判断できません。",
    noFilter: "この種類の変更はありません。",
    untitled: "タイトルなし",
    absent: "該当する開催回なし",
    outside: "比較期間の外",
    utc: "UTC",
    floating: "タイムゾーンなし",
    date: "終日",
    endLabel: "終了",
    exclusive: "終了日は含みません",
    duration: "長さ",
    minutes: "分",
    hours: "時間",
    days: "日",
    seconds: "秒",
    location: "場所",
    description: "説明",
    evidence: "照合と変更の根拠",
    identity: "照合キー",
    recurrence: "開催回のID",
    original: "単発 / 元の開催回",
    fields: "比較したフィールド",
    diagnostics: "診断・対応していない内容",
    window: "比較期間",
    to: "から",
    until: "まで（終了日を除く）",
    shown: "件の変更",
    changed: "変更",
    saved: "JSONレポートを保存しました",
    noDiagnostic: "診断の詳細はありません。入力と対応機能を確認してください。",
    metadataValues: "内容の変更前後",
    scopeTitle: "比較の範囲と上限",
    scopeText:
      "UTC・タイムゾーンなし・終日を比較します。TZID、未対応の繰り返し指定は診断に表示されます。通知、添付ファイル、独自プロパティ、更新日時などは比較対象外です。",
    ignored: "比較対象外のプロパティ",
    more: "次の50件を表示",
    showing: "表示中",
    of: " / ",
  },
  en: {
    skip: "Skip to comparison",
    language: "Display language",
    local: "Runs on your device",
    title: "Calendar changes,\none occurrence at a time.",
    subtitle:
      "Unfold recurring events into real occurrences. Compare two .ics snapshots and see the changes that are easy to miss.",
    example: "Try an example",
    noUpload: "No uploads. No account.",
    visualCaption: "Find the one occurrence that changed.",
    step1: "01 / INPUT",
    inputTitle: "Compare two calendars",
    swap: "Swap before / after",
    before: "Before",
    after: "After",
    chooseFile: "Choose .ics",
    pasteHint: "Choose a file or paste ICS content",
    start: "Start date",
    end: "End date (exclusive)",
    cancel: "Cancel",
    compare: "Compare occurrences",
    windowNote:
      "Occurrences are included by their start date and time. UTC, floating times, and all-day dates are evaluated separately, without converting to your device’s timezone.",
    step2: "02 / REVIEW",
    resultsTitle: "Change report",
    download: "Save JSON",
    overlap: "Change categories can overlap",
    emptyTitle: "Ready to find what changed",
    emptyText:
      "Choose two files and a date window. Added, removed, moved, and other changed occurrences will appear here.",
    principle1: "Your calendars stay here",
    principle1Text:
      "All processing happens in your browser. Calendar content is never sent to a server, collected for analytics, or stored.",
    principle2: "Evidence with every change",
    principle2Text:
      "Occurrences are matched by UID and RECURRENCE-ID. Inspect both snapshots and the evidence behind each match.",
    principle3: "Limits are made visible",
    principle3Text:
      "Unsupported rules and invalid input are marked incomplete. Partial results are never presented as “no changes.”",
    footer: "Review changes without changing your calendars.",
    working: "Expanding and comparing occurrences…",
    finished: "Comparison finished",
    partialFinished: "Comparison is incomplete. Review the diagnostics.",
    cancelled: "Comparison cancelled",
    stale: "Inputs changed. Compare again for an up-to-date report.",
    swapped: "Before and after have been swapped",
    exampleLoaded: "Example loaded",
    missing: "Add full VCALENDAR content to both the before and after inputs.",
    dates:
      "Choose valid start and end dates. The end date must be later than the start date.",
    size: "Each input must be 1 MiB or smaller.",
    fileError:
      "The file could not be read. Choose another file or paste its content.",
    fileLoading:
      "Files are still loading. Compare once the file read is complete.",
    workerError: "Comparison failed. Check the inputs and try again.",
    timeout:
      "Comparison stopped at the time limit. Try a smaller date window or input.",
    reportError:
      "A valid comparison report was not received. Please try again.",
    complete: "Comparison complete",
    completeNote:
      "Occurrences in this window were compared within the supported feature set.",
    incomplete: "Incomplete comparison · Results are not conclusive",
    incompleteNote:
      "Unsupported content, invalid input, or a processing limit was found. Changes shown may be partial. Do not interpret this report as “no changes.” Check the diagnostics below.",
    added: "Added",
    removed: "Removed",
    moved: "Moved",
    durationChanged: "Duration changed",
    metadataChanged: "Content changed",
    unchanged: "Unchanged",
    all: "All changes",
    filterLabel: "Filter changes",
    noChanges:
      "No occurrence changes were found in this window within the supported feature set.",
    noChangesPartial:
      "No changes can be displayed, but this incomplete comparison cannot establish that nothing changed.",
    noFilter: "No changes in this category.",
    untitled: "Untitled event",
    absent: "No matching occurrence",
    outside: "Outside this window",
    utc: "UTC",
    floating: "Floating time",
    date: "All day",
    endLabel: "Ends",
    exclusive: "end date is exclusive",
    duration: "Duration",
    minutes: "min",
    hours: "hr",
    days: "days",
    seconds: "sec",
    location: "Location",
    description: "Description",
    evidence: "Matching and change evidence",
    identity: "Match key",
    recurrence: "Occurrence ID",
    original: "Single / original occurrence",
    fields: "Compared fields",
    diagnostics: "Diagnostics & unsupported content",
    window: "Window",
    to: "to",
    until: "(end exclusive)",
    shown: "changed occurrences",
    changed: "Changed",
    saved: "JSON report saved",
    noDiagnostic:
      "No diagnostic details were returned. Check the input and supported features.",
    metadataValues: "Before and after metadata values",
    scopeTitle: "Comparison scope and limits",
    scopeText:
      "Compares UTC, floating, and all-day dates. TZID and unsupported recurrence rules are diagnosed. Alarms, attachments, custom properties, and bookkeeping timestamps are outside the comparison scope.",
    ignored: "Properties not compared",
    more: "Show next 50 changes",
    showing: "Showing",
    of: " of ",
  },
};
const $ = (id) => document.getElementById(id);
const MAX_BYTES = 1024 * 1024;
const WATCHDOG_MS = 20000;
let lang = "ja";
let currentWorker = null;
let requestId = 0;
let watchdog = null;
let report = null;
let filter = "all";
let visibleLimit = 50;
let statusKey = "";
let errorKey = "";
let errorDetail = "";
const fileTokens = { before: 0, after: 0 };
const fileNames = { before: "", after: "" };
const fileLoading = { before: false, after: false };
const t = (key) => TEXT[lang][key] ?? key;
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
};
function setStatus(key) {
  statusKey = key;
  $("status").textContent = key ? t(key) : "";
}
function setError(key = "", detail = "") {
  errorKey = key;
  errorDetail = detail;
  $("error").hidden = !key;
  $("error").textContent = key ? `${t(key)}${detail ? ` ${detail}` : ""}` : "";
}
function stopWorker() {
  requestId += 1;
  if (currentWorker) currentWorker.terminate();
  currentWorker = null;
  clearTimeout(watchdog);
  watchdog = null;
  $("compare").disabled = false;
  $("cancel").hidden = true;
  $("workspace").setAttribute("aria-busy", "false");
}
function clearReport() {
  report = null;
  $("results").hidden = true;
  $("empty").hidden = false;
  $("changes").replaceChildren();
  $("diagnostics").replaceChildren();
}
function invalidate(key = "stale") {
  // Keep the rerun notice across every keystroke after work was invalidated.
  // The first edit already retired the worker/report, but the inputs remain stale.
  const hadWork = Boolean(currentWorker || report || statusKey === "stale");
  stopWorker();
  clearReport();
  setError();
  setStatus(hadWork ? key : "");
}
function refreshFileNames() {
  for (const side of ["before", "after"])
    $("" + side + "-file-note").textContent = fileNames[side] || t("pasteHint");
}
function setLanguage(value) {
  lang = value === "en" ? "en" : "ja";
  document.documentElement.lang = lang;
  document.title =
    lang === "ja"
      ? "Occurrence Review · カレンダーの変更を、開催回ごとに"
      : "Occurrence Review · Calendar changes, occurrence by occurrence";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = t(element.dataset.i18n);
    if (element.id === "hero-title") {
      const lines = value.split("\n");
      element.replaceChildren(
        document.createTextNode(lines[0]),
        document.createElement("br"),
        document.createTextNode(lines[1]),
      );
    } else element.textContent = value;
  });
  $("filters").setAttribute("aria-label", t("filterLabel"));
  for (const side of ["before", "after"])
    $(side + "-file").setAttribute(
      "aria-label",
      `${t(side)}: ${t("chooseFile")}`,
    );
  $("status").textContent = statusKey ? t(statusKey) : "";
  setError(errorKey, errorDetail);
  refreshFileNames();
  if (report) renderReport();
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function compare() {
  stopWorker();
  clearReport();
  setError();
  setStatus("");
  if (fileLoading.before || fileLoading.after) return setError("fileLoading");
  const beforeText = $("before").value;
  const afterText = $("after").value;
  const options = { start: $("start").value, end: $("end").value };
  if (!beforeText.trim() || !afterText.trim()) return setError("missing");
  if (
    new Blob([beforeText]).size > MAX_BYTES ||
    new Blob([afterText]).size > MAX_BYTES
  )
    return setError("size");
  if (
    !validDate(options.start) ||
    !validDate(options.end) ||
    options.start >= options.end
  )
    return setError("dates");
  const id = requestId;
  setStatus("working");
  $("compare").disabled = true;
  $("cancel").hidden = false;
  $("workspace").setAttribute("aria-busy", "true");
  const fail = (key, detail = "") => {
    if (id !== requestId) return;
    stopWorker();
    setStatus("");
    setError(key, detail);
  };
  try {
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    currentWorker = worker;
    worker.onmessage = ({ data }) => {
      if (id !== requestId || data?.requestId !== id) return;
      if (data.error) {
        fail("workerError", String(data.error));
        return;
      }
      if (
        !data.report ||
        typeof data.report.complete !== "boolean" ||
        !Array.isArray(data.report.changes) ||
        !Array.isArray(data.report.diagnostics) ||
        !data.report.summary
      ) {
        fail("reportError");
        return;
      }
      stopWorker();
      report = data.report;
      filter = "all";
      visibleLimit = 50;
      setStatus(report.complete ? "finished" : "partialFinished");
      renderReport();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fail("workerError");
    };
    worker.onmessageerror = () => fail("workerError");
    watchdog = setTimeout(() => fail("timeout"), WATCHDOG_MS);
    worker.postMessage({ requestId: id, beforeText, afterText, options });
  } catch (error) {
    fail("workerError");
  }
}
function chipsFor(change) {
  if (change.kind === "added") return ["added"];
  if (change.kind === "removed") return ["removed"];
  const fields = Array.isArray(change.changes) ? change.changes : [];
  return [
    fields.includes("start") && "moved",
    fields.includes("duration") && "durationChanged",
    fields.includes("metadata") && "metadataChanged",
  ].filter(Boolean);
}
function formatTime(value, temporalType) {
  if (value === undefined || value === null || value === "") return "—";
  const raw = String(value);
  let normalized = raw.replace(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/,
    (_, y, m, d, h, min, s, z) =>
      `${y}-${m}-${d}${h ? `T${h}:${min}:${s}${z || ""}` : ""}`,
  );
  if (temporalType === "date") return normalized.slice(0, 10);
  return (
    normalized
      .replace("T", " ")
      .replace(/:00(?:\.000)?Z?$/, "")
      .replace(/Z$/, "") + (temporalType === "utc" ? " UTC" : "")
  );
}
function formatDuration(seconds, type) {
  if (!Number.isFinite(seconds)) return "—";
  if (type === "date" && seconds % 86400 === 0)
    return `${seconds / 86400} ${t("days")}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} ${t("hours")}`;
  if (seconds % 60 === 0) return `${seconds / 60} ${t("minutes")}`;
  return `${seconds} ${t("seconds")}`;
}
function renderOccurrence(value, side) {
  const card = node("div", `occurrence ${side}`);
  const heading = node("div", "occurrence-heading");
  heading.append(node("span", "", t(side).toUpperCase()));
  if (value) {
    heading.append(node("span", "", t(value.temporalType || "floating")));
    if (value.inWindow === false)
      heading.append(node("span", "outside", t("outside")));
  }
  card.append(heading);
  if (!value) {
    card.append(node("p", "absent", t("absent")));
    return card;
  }
  card.append(
    node("p", "occurrence-start", formatTime(value.start, value.temporalType)),
  );
  card.append(
    node(
      "p",
      "occurrence-end",
      `${t("endLabel")}: ${formatTime(value.end, value.temporalType)}${value.temporalType === "date" ? ` · ${t("exclusive")}` : ""}`,
    ),
  );
  card.append(
    node(
      "p",
      "occurrence-detail",
      `${t("duration")}: ${formatDuration(value.durationSeconds, value.temporalType)}`,
    ),
  );
  // Show both titles as evidence, including a renamed occurrence.
  card.append(node("p", "occurrence-detail", value.summary || t("untitled")));
  if (value.location)
    card.append(
      node("p", "occurrence-detail", `${t("location")}: ${value.location}`),
    );
  if (value.description)
    card.append(
      node(
        "p",
        "occurrence-detail",
        `${t("description")}: ${value.description}`,
      ),
    );
  return card;
}
function displayEvidence(value) {
  return typeof value === "string"
    ? value
    : JSON.stringify(value ?? {}, null, 2);
}
function renderChange(change) {
  const card = node("article", "change-card");
  card.dataset.kind = change.kind;
  const heading = node("div", "change-header");
  const titleBox = node("div");
  titleBox.append(
    node(
      "h3",
      "change-title",
      change.after?.summary || change.before?.summary || t("untitled"),
    ),
  );
  titleBox.append(
    node(
      "p",
      "change-subtitle",
      change.uid || change.after?.uid || change.before?.uid || "—",
    ),
  );
  const chips = node("div", "chips");
  const kinds = chipsFor(change);
  for (const kind of kinds.length ? kinds : ["changed"])
    chips.append(node("span", `chip ${kind}`, t(kind)));
  heading.append(titleBox, chips);
  const pair = node("div", "occurrence-pair");
  pair.append(
    renderOccurrence(change.before, "before"),
    renderOccurrence(change.after, "after"),
  );
  const evidence = node("details", "evidence");
  evidence.append(node("summary", "", t("evidence")));
  const evidenceContent = node("div", "evidence-content");
  const definition = node("dl");
  const matchKey = change.evidence?.identity ?? {
    uid: change.uid,
    recurrenceId: change.recurrenceId,
  };
  for (const [label, value] of [
    [t("identity"), displayEvidence(matchKey)],
    [t("recurrence"), change.recurrenceId || t("original")],
  ])
    definition.append(node("dt", "", label), node("dd", "", value));
  evidenceContent.append(
    definition,
    node(
      "pre",
      "",
      `${t("fields")}\n${displayEvidence(change.evidence?.fields ?? change.changes)}`,
    ),
  );
  if (
    Array.isArray(change.evidence?.metadataChanges) &&
    change.evidence.metadataChanges.length
  )
    evidenceContent.append(
      node(
        "pre",
        "",
        `${t("metadataValues")}\n${displayEvidence(change.evidence.metadataChanges)}`,
      ),
    );
  evidence.append(evidenceContent);
  card.append(heading, pair, evidence);
  return card;
}
function renderChanges() {
  const holder = $("changes");
  holder.replaceChildren();
  const changes = report.changes.filter(
    (change) => filter === "all" || chipsFor(change).includes(filter),
  );
  if (!changes.length)
    holder.append(
      node(
        "p",
        "no-results",
        t(
          filter !== "all"
            ? "noFilter"
            : report.complete
              ? "noChanges"
              : "noChangesPartial",
        ),
      ),
    );
  for (const change of changes.slice(0, visibleLimit))
    holder.append(renderChange(change));
  if (changes.length > visibleLimit) {
    const pagination = node("div", "pagination");
    pagination.append(
      node(
        "p",
        "",
        `${t("showing")} ${visibleLimit}${t("of")}${changes.length}`,
      ),
    );
    const more = node("button", "button secondary", t("more"));
    more.type = "button";
    more.id = "load-more";
    more.addEventListener("click", () => {
      visibleLimit += 50;
      renderChanges();
    });
    pagination.append(more);
    holder.append(pagination);
  }
  $("filters")
    .querySelectorAll("button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === filter),
      ),
    );
}
function renderReport() {
  $("results").hidden = false;
  $("empty").hidden = true;
  const banner = $("report-banner");
  banner.className = `report-banner${report.complete ? "" : " warning"}`;
  banner.setAttribute("role", report.complete ? "status" : "alert");
  const bannerCopy = node("div");
  bannerCopy.append(
    node("p", "banner-title", t(report.complete ? "complete" : "incomplete")),
    node(
      "p",
      "banner-note",
      t(report.complete ? "completeNote" : "incompleteNote"),
    ),
  );
  banner.replaceChildren(
    node("span", "banner-symbol", report.complete ? "✓" : "!"),
    bannerCopy,
  );
  const summary = $("summary");
  summary.replaceChildren();
  for (const key of [
    "added",
    "removed",
    "moved",
    "durationChanged",
    "metadataChanged",
    "unchanged",
  ]) {
    const stat = node("div", "stat");
    stat.dataset.kind = key;
    stat.append(
      node(
        "div",
        "stat-value",
        Number.isFinite(report.summary[key]) ? report.summary[key] : 0,
      ),
      node("div", "stat-label", t(key)),
    );
    summary.append(stat);
  }
  const start = report.window?.start || $("start").value;
  const end = report.window?.end || $("end").value;
  $("result-context").textContent =
    `${t("window")}: ${start} → ${end} ${t("until")} · ${report.changes.length} ${t("shown")}`;
  const filters = $("filters");
  filters.replaceChildren();
  for (const key of [
    "all",
    "added",
    "removed",
    "moved",
    "durationChanged",
    "metadataChanged",
  ]) {
    const button = node("button", "filter", t(key));
    button.type = "button";
    button.dataset.filter = key;
    button.setAttribute("aria-pressed", String(filter === key));
    button.addEventListener("click", () => {
      filter = key;
      visibleLimit = 50;
      renderChanges();
    });
    filters.append(button);
  }
  renderChanges();
  const diagnostics = $("diagnostics");
  diagnostics.replaceChildren();
  const scope = node("details", "scope-details");
  scope.append(node("summary", "", t("scopeTitle")));
  const scopeContent = node("div", "scope-content");
  scopeContent.append(node("p", "", t("scopeText")));
  if (Array.isArray(report.scope?.ignored))
    scopeContent.append(
      node(
        "p",
        "scope-properties",
        `${t("ignored")}: ${report.scope.ignored.join(", ")}`,
      ),
    );
  if (report.scope?.limits)
    scopeContent.append(
      node("pre", "", JSON.stringify(report.scope.limits, null, 2)),
    );
  scope.append(scopeContent);
  diagnostics.append(scope);
  if (report.diagnostics.length || !report.complete) {
    const box = node("section", "diagnostics-box");
    box.append(
      node("h3", "", `${t("diagnostics")} (${report.diagnostics.length})`),
    );
    if (!report.diagnostics.length)
      box.append(node("p", "diagnostic", t("noDiagnostic")));
    for (const diagnostic of report.diagnostics) {
      const item = node("div", "diagnostic");
      item.append(
        node(
          "span",
          "diagnostic-label",
          `${diagnostic.side ? t(diagnostic.side) : ""}${diagnostic.code ? ` / ${diagnostic.code}` : ""}${diagnostic.uid ? ` · ${diagnostic.uid}` : ""}`,
        ),
        node("p", "", diagnostic.message || "—"),
      );
      box.append(item);
    }
    diagnostics.append(box);
  }
}
for (const side of ["before", "after"]) {
  $(side).addEventListener("input", () => {
    fileTokens[side] += 1;
    fileLoading[side] = false;
    fileNames[side] = "";
    $(side + "-file").value = "";
    invalidate();
    refreshFileNames();
  });
  $(side + "-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    invalidate();
    const token = ++fileTokens[side];
    fileLoading[side] = false;
    // Enforce the byte limit before reading the file into memory.
    if (file.size > MAX_BYTES) {
      setError("size");
      event.target.value = "";
      return;
    }
    fileLoading[side] = true;
    try {
      const text = await file.text();
      if (token !== fileTokens[side]) return;
      fileLoading[side] = false;
      // Other input edits during file reading must also retire any newer comparison.
      invalidate();
      $(side).value = text;
      fileNames[side] = file.name;
      refreshFileNames();
    } catch (error) {
      if (token === fileTokens[side]) {
        fileLoading[side] = false;
        setError("fileError");
      }
    }
  });
}
for (const key of ["start", "end"])
  $(key).addEventListener("input", () => invalidate());
$("language").addEventListener("change", (event) =>
  setLanguage(event.target.value),
);
$("compare").addEventListener("click", compare);
$("cancel").addEventListener("click", () => {
  stopWorker();
  clearReport();
  setError();
  setStatus("cancelled");
});
$("swap").addEventListener("click", () => {
  invalidate();
  for (const side of ["before", "after"]) {
    fileTokens[side] += 1;
    fileLoading[side] = false;
    $(side + "-file").value = "";
  }
  [$("before").value, $("after").value] = [$("after").value, $("before").value];
  [fileNames.before, fileNames.after] = [fileNames.after, fileNames.before];
  refreshFileNames();
  setStatus("swapped");
});
$("example").addEventListener("click", () => {
  invalidate();
  for (const side of ["before", "after"]) {
    fileTokens[side] += 1;
    fileLoading[side] = false;
    fileNames[side] = "";
    $(side + "-file").value = "";
  }
  $("before").value = SAMPLE_BEFORE;
  $("after").value = SAMPLE_AFTER;
  $("start").value = "2026-10-01";
  $("end").value = "2026-11-01";
  refreshFileNames();
  compare();
});
$("download").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = node("a");
  link.href = url;
  link.download = `occurrence-review-${report.window?.start || "report"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("saved");
});
window.addEventListener("pagehide", () => {
  stopWorker();
  for (const side of ["before", "after"]) fileTokens[side] += 1;
});
setLanguage(lang);
