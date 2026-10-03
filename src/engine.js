import ICAL from "ical.js";

/** No machine-local Date methods or global ICAL timezone registrations are used. */
export const DEFAULT_LIMITS = Object.freeze({
  maxBytes: 1_048_576,
  maxSeries: 500,
  maxSteps: 200_000,
  maxOccurrences: 20_000,
  maxChanges: 10_000,
  maxReportBytes: 4_194_304,
});
const DAY = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const META = [
  "summary",
  "location",
  "description",
  "status",
  "transp",
  "class",
  "categories",
  "url",
  "organizer",
  "attendee",
  "priority",
  "resources",
  "contact",
];
const RECUR = ["rrule", "rdate", "exdate", "exrule"];
const SINGLE = [
  "uid",
  "dtstart",
  "dtend",
  "duration",
  "recurrence-id",
  "rrule",
  ...META.filter(
    (x) => !["attendee", "categories", "resources", "contact"].includes(x),
  ),
];
class Unsupported extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
function fail(code, message) {
  throw new Unsupported(code, message);
}
function dateMs(y, m, d, h = 0, i = 0, s = 0) {
  const a = new Date(0);
  a.setUTCFullYear(y, m - 1, d);
  a.setUTCHours(h, i, s, 0);
  return a.getTime();
}
function temporal(value, type) {
  if (typeof value !== "string")
    fail("INVALID_TIME", "A date value must be text.");
  const isDate = type === "date";
  if (!isDate && type !== "date-time")
    fail("UNSUPPORTED_VALUE_TYPE", `Unsupported time value type: ${type}`);
  const match = value.match(
    isDate
      ? /^(\d{4})-(\d{2})-(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z?)$/,
  );
  if (!match)
    fail(
      "INVALID_TIME",
      "Expected an RFC 5545 DATE or DATE-TIME with seconds.",
    );
  const [y, m, d, h, i, s] = match.slice(1, 7).map((x) => Number(x || 0));
  if (
    y < 1 ||
    y > 9999 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31 ||
    h > 23 ||
    i > 59 ||
    s > 59
  )
    fail("INVALID_TIME", "Invalid date/time (leap seconds are unsupported).");
  const ms = dateMs(y, m, d, h, i, s);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  )
    fail("INVALID_TIME", "Calendar date does not exist.");
  return {
    value,
    ms,
    type: isDate ? "date" : match[7] ? "utc" : "floating",
    y,
    m,
    d,
    h,
    i,
    s,
  };
}
function timeProperty(p) {
  if (p.getParameter("tzid") !== undefined)
    fail(
      "UNSUPPORTED_TZID",
      `TZID=${p.getParameter("tzid")} is not evaluated; this release supports UTC, DATE and floating values only.`,
    );
  return p.jCal.slice(3).map((v) => temporal(v, p.type));
}
function format(ms, type) {
  const value = new Date(ms).toISOString();
  if (value.startsWith("+") || value.startsWith("-"))
    fail("DATE_RANGE", "Computed date leaves years 0001–9999.");
  return type === "date"
    ? value.slice(0, 10)
    : value.slice(0, 19) + (type === "utc" ? "Z" : "");
}
function sameType(a, b) {
  if (a.type !== b.type)
    fail(
      "CONFLICTING_TYPES",
      "DTSTART, DTEND, recurrence identifiers and recurrence values must share one temporal type.",
    );
}
function durationValue(p, type) {
  const raw = p.jCal[3];
  const m =
    typeof raw === "string" &&
    raw.match(
      /^\+?P(?:(\d+)W|(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/,
    );
  if (!m || !m.slice(1).some(Boolean))
    fail("INVALID_DURATION", "Invalid or negative DURATION.");
  if (type === "date" && m.slice(3).some(Boolean))
    fail("CONFLICTING_TYPES", "DATE duration can contain only days or weeks.");
  const seconds =
    (Number(m[1] || 0) * 7 + Number(m[2] || 0)) * 86400 +
    Number(m[3] || 0) * 3600 +
    Number(m[4] || 0) * 60 +
    Number(m[5] || 0);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 36600 * 86400)
    fail(
      "INVALID_DURATION",
      "DURATION must be positive and no greater than 36,600 days.",
    );
  return seconds;
}
function metadata(component) {
  const result = {};
  for (const name of META) {
    const values = component.getAllProperties(name).map((p) => {
      const params = Object.fromEntries(
        Object.entries(p.jCal[1]).sort(([a], [b]) => a.localeCompare(b, "en")),
      );
      const vals = p.jCal.slice(3);
      return {
        params,
        values: ["categories", "resources"].includes(name)
          ? [...vals].sort()
          : vals,
      };
    });
    result[name] = values.sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b), "en"),
    );
  }
  return result;
}
function eventData(c) {
  for (const name of SINGLE)
    if (c.getAllProperties(name).length > 1)
      fail(
        "DUPLICATE_PROPERTY",
        `More than one ${name.toUpperCase()} in VEVENT.`,
      );
  const uid = c.getFirstPropertyValue("uid");
  if (typeof uid !== "string" || !uid.trim())
    fail("MISSING_UID", "VEVENT requires a nonempty UID.");
  if (new TextEncoder().encode(uid).length > 1024)
    fail("UID_LIMIT", "UID must not exceed 1,024 bytes.");
  for (const p of c.getAllProperties())
    if (p.getParameter("tzid") !== undefined)
      fail(
        "UNSUPPORTED_TZID",
        `TZID=${p.getParameter("tzid")} is not evaluated.`,
      );
  if (c.hasProperty("exrule"))
    fail("UNSUPPORTED_EXRULE", "EXRULE is not supported.");
  const ridProp = c.getFirstProperty("recurrence-id");
  if (ridProp?.getParameter("range") !== undefined)
    fail("UNSUPPORTED_RANGE", "RANGE overrides are not supported.");
  const rid = ridProp ? timeProperty(ridProp)[0] : null;
  if (rid && RECUR.some((p) => c.hasProperty(p)))
    fail(
      "OVERRIDE_RECURRENCE",
      "Detached overrides may not contain recurrence-set properties.",
    );
  const cancelled =
    String(c.getFirstPropertyValue("status") || "").toUpperCase() ===
    "CANCELLED";
  const startProp = c.getFirstProperty("dtstart");
  if (!startProp && !cancelled)
    fail("MISSING_DTSTART", "An active VEVENT requires DTSTART.");
  const start = startProp ? timeProperty(startProp)[0] : rid;
  if (rid && start) sameType(rid, start);
  if (c.hasProperty("dtend") && c.hasProperty("duration"))
    fail("END_AND_DURATION", "DTEND and DURATION cannot occur together.");
  let seconds = start?.type === "date" ? 86400 : 0;
  if (c.hasProperty("dtend")) {
    if (!start) fail("MISSING_DTSTART", "DTEND requires DTSTART.");
    const end = timeProperty(c.getFirstProperty("dtend"))[0];
    sameType(start, end);
    seconds = (end.ms - start.ms) / 1000;
    if (seconds <= 0)
      fail("INVALID_END", "Explicit DTEND must be strictly after DTSTART.");
  } else if (c.hasProperty("duration"))
    seconds = durationValue(c.getFirstProperty("duration"), start?.type);
  const rdates = c.getAllProperties("rdate").flatMap(timeProperty);
  const exdates = c.getAllProperties("exdate").flatMap(timeProperty);
  for (const t of [...rdates, ...exdates]) {
    if (!start) fail("MISSING_DTSTART", "Recurrence values require DTSTART.");
    sameType(start, t);
  }
  const ruleProp = c.getFirstProperty("rrule");
  const rule = ruleProp ? validateRule(ruleProp, start) : null;
  return {
    uid,
    c,
    start,
    rid,
    cancelled,
    seconds,
    rdates,
    exdates,
    rule,
    recurring: !!(rule || rdates.length),
    metadata: metadata(c),
  };
}
function integer(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    fail("INVALID_RULE", `Invalid ${label}.`);
  return n;
}
function list(v) {
  return Array.isArray(v) ? v : [v];
}
function validateRule(p, start) {
  if (!start) fail("MISSING_DTSTART", "RRULE requires DTSTART.");
  const raw = p.jCal[3],
    allowed = [
      "freq",
      "interval",
      "count",
      "until",
      "byday",
      "bymonthday",
      "bymonth",
      "wkst",
    ];
  for (const k of Object.keys(raw))
    if (!allowed.includes(k))
      fail(
        "UNSUPPORTED_RULE_PART",
        `${k.toUpperCase()} is outside the supported recurrence subset.`,
      );
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(raw.freq))
    fail(
      "UNSUPPORTED_FREQUENCY",
      "Only DAILY, WEEKLY, MONTHLY and YEARLY are supported.",
    );
  const rule = {
    freq: raw.freq,
    interval: integer(raw.interval ?? 1, 1, 10000, "INTERVAL"),
  };
  if (raw.count !== undefined)
    rule.count = integer(raw.count, 1, 1_000_000, "COUNT");
  if (raw.until !== undefined) {
    rule.until = temporal(
      raw.until,
      start.type === "date" ? "date" : "date-time",
    );
    sameType(start, rule.until);
  }
  if (rule.count && rule.until)
    fail("INVALID_RULE", "COUNT and UNTIL cannot both be specified.");
  if (rule.until && rule.until.ms < start.ms)
    fail(
      "INVALID_RULE",
      "UNTIL before DTSTART is outside the supported synchronized recurrence subset.",
    );
  if (
    raw.wkst !== undefined &&
    (!Number.isInteger(raw.wkst) || raw.wkst < 1 || raw.wkst > 7)
  )
    fail("INVALID_RULE", "Invalid WKST.");
  rule.wkst = raw.wkst === undefined ? 1 : raw.wkst - 1;
  if (raw.bymonth !== undefined)
    rule.months = list(raw.bymonth).map((v) => integer(v, 1, 12, "BYMONTH"));
  if (raw.bymonthday !== undefined)
    rule.monthdays = list(raw.bymonthday).map((v) => {
      const n = integer(v, -31, 31, "BYMONTHDAY");
      if (!n) fail("INVALID_RULE", "BYMONTHDAY cannot be zero.");
      return n;
    });
  if (rule.monthdays && rule.freq === "WEEKLY")
    fail("INVALID_RULE", "BYMONTHDAY is invalid with WEEKLY.");
  if (raw.byday !== undefined) {
    if (rule.freq === "YEARLY")
      fail(
        "UNSUPPORTED_RULE_PART",
        "YEARLY BYDAY is outside this release’s recurrence subset.",
      );
    rule.days = list(raw.byday).map((v) => {
      const m = String(v).match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (!m) fail("INVALID_RULE", "Invalid BYDAY.");
      const n =
        m[1] === undefined ? null : integer(m[1], -5, 5, "BYDAY ordinal");
      if (n === 0 || (n !== null && rule.freq !== "MONTHLY"))
        fail(
          "UNSUPPORTED_RULE_PART",
          "Numbered BYDAY is supported only for MONTHLY, ordinals ±1…5.",
        );
      return { day: WEEKDAYS.indexOf(m[2]), ordinal: n };
    });
  }
  if (!matchesDay(start.ms, start, rule))
    fail(
      "UNSYNCHRONIZED_DTSTART",
      "DTSTART must match its RRULE; otherwise RFC 5545 defines the recurrence set as undefined.",
    );
  return rule;
}
function matchesDay(ms, start, r) {
  const d = new Date(ms),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth() + 1,
    day = d.getUTCDate(),
    wd = d.getUTCDay();
  const dayDelta = Math.round(
    (dateMs(y, m, day) - dateMs(start.y, start.m, start.d)) / DAY,
  );
  const monthDelta = (y - start.y) * 12 + m - start.m;
  const weekStart = (x) =>
    x - ((new Date(x).getUTCDay() - r.wkst + 7) % 7) * DAY;
  if (r.freq === "DAILY" && dayDelta % r.interval) return false;
  if (
    r.freq === "WEEKLY" &&
    Math.round(
      (weekStart(dateMs(y, m, day)) -
        weekStart(dateMs(start.y, start.m, start.d))) /
        (7 * DAY),
    ) % r.interval
  )
    return false;
  if (r.freq === "MONTHLY" && monthDelta % r.interval) return false;
  if (r.freq === "YEARLY" && (y - start.y) % r.interval) return false;
  if (r.months && !r.months.includes(m)) return false;
  const monthLength = new Date(dateMs(y, m + 1, 1) - DAY).getUTCDate();
  if (
    r.monthdays &&
    !r.monthdays.some((n) => day === (n > 0 ? n : monthLength + n + 1))
  )
    return false;
  if (
    r.days &&
    !r.days.some(
      (n) =>
        wd === n.day &&
        (n.ordinal === null ||
          (n.ordinal > 0
            ? Math.floor((day - 1) / 7) + 1
            : -Math.floor((monthLength - day) / 7) - 1) === n.ordinal),
    )
  )
    return false;
  if (r.freq === "WEEKLY" && !r.days && wd !== new Date(start.ms).getUTCDay())
    return false;
  if (r.freq === "MONTHLY" && !r.days && !r.monthdays && day !== start.d)
    return false;
  if (r.freq === "YEARLY") {
    if (!r.months && !r.monthdays && m !== start.m) return false;
    if (!r.monthdays && day !== start.d) return false;
  }
  return true;
}
function diagnostic(ctx, code, message, uid) {
  ctx.complete = false;
  if (ctx.diagnostics.length >= 200) {
    if (ctx.diagnostics.length === 200)
      ctx.diagnostics.push({
        side: ctx.side,
        code: "DIAGNOSTIC_LIMIT",
        message: "Further diagnostics omitted after 200 messages.",
      });
    return;
  }
  ctx.diagnostics.push({
    side: ctx.side,
    ...(uid ? { uid: uid.slice(0, 1024) } : {}),
    code,
    message: message.slice(0, 2048),
  });
}
// ICAL.js is permissive (e.g. INTERVAL=0 normalization). Validate lexical forms first.
function preflight(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/),
    stack = [];
  let roots = 0;
  for (const line of lines) {
    if (!line) continue;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(line))
      fail(
        "INVALID_SYNTAX",
        "Control characters are not supported in content lines.",
      );
    if (new TextEncoder().encode(line).length > 65536)
      fail("PROPERTY_LIMIT", "An unfolded content line exceeds 65,536 bytes.");
    if (line.includes("\r"))
      fail("INVALID_SYNTAX", "Bare carriage returns are not supported.");
    let quoted = false,
      colon = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ":" && !quoted) {
        colon = i;
        break;
      }
    }
    if (colon < 1) fail("INVALID_SYNTAX", "Invalid content line.");
    const head = line.slice(0, colon),
      value = line.slice(colon + 1),
      name = head.split(";")[0].toUpperCase();
    let paramQuoted = false,
      segment = "",
      parts = [];
    for (const character of head) {
      if (character === '\"') paramQuoted = !paramQuoted;
      if (character === ";" && !paramQuoted) {
        parts.push(segment);
        segment = "";
      } else segment += character;
    }
    parts.push(segment);
    const paramNames = new Set();
    for (const part of parts.slice(1)) {
      const key = part.split("=")[0].toUpperCase();
      if (!key || !part.includes("=") || paramNames.has(key))
        fail("INVALID_SYNTAX", "Duplicate or malformed property parameter.");
      paramNames.add(key);
    }
    if (!/^[A-Z0-9-]+$/.test(name))
      fail("INVALID_SYNTAX", "Invalid property name.");
    if (name === "BEGIN") {
      const component = value.toUpperCase();
      if (!stack.length) {
        roots++;
        if (component !== "VCALENDAR")
          fail("INVALID_SYNTAX", "Root must be VCALENDAR.");
      } else if (
        (stack.at(-1) === "VEVENT" && component !== "VALARM") ||
        (stack.at(-1) === "VTIMEZONE" &&
          !["STANDARD", "DAYLIGHT"].includes(component)) ||
        !["VCALENDAR", "VEVENT", "VTIMEZONE"].includes(stack.at(-1)) ||
        component === "VCALENDAR"
      )
        fail("INVALID_SYNTAX", "Invalid component nesting.");
      if (stack.length > 8)
        fail("NESTING_LIMIT", "Component nesting exceeds 8.");
      stack.push(component);
      continue;
    }
    if (name === "END") {
      if (stack.pop() !== value.toUpperCase())
        fail("INVALID_SYNTAX", "Unbalanced BEGIN/END components.");
      continue;
    }
    if (!stack.length) fail("INVALID_SYNTAX", "Property outside a component.");
    if (stack.at(-1) !== "VEVENT") continue;
    if (
      ["DTSTART", "DTEND", "RECURRENCE-ID", "RDATE", "EXDATE"].includes(name)
    ) {
      const date = /;VALUE=DATE(?:;|$)/i.test(head),
        period = /;VALUE=PERIOD(?:;|$)/i.test(head);
      if (period)
        fail(
          "UNSUPPORTED_VALUE_TYPE",
          "PERIOD recurrence values are not supported.",
        );
      const pattern = date ? /^\d{8}$/ : /^\d{8}T\d{6}Z?$/;
      if (!["RDATE", "EXDATE"].includes(name) && value.includes(","))
        fail(
          "INVALID_TIME",
          "A singleton date property cannot contain a list.",
        );
      for (const v of value.split(","))
        if (!pattern.test(v))
          fail(
            "INVALID_TIME",
            "DATE/DATE-TIME lexical form is invalid; numeric offsets are not supported.",
          );
    }
    if (name === "RRULE") {
      const keys = new Set();
      for (const part of value.split(";")) {
        const [rawKey, v, ...extra] = part.split("=");
        const key = rawKey.toUpperCase();
        if (extra.length || !key || !v || keys.has(key))
          fail("INVALID_RULE", "Duplicate or malformed RRULE part.");
        keys.add(key);
        if (
          ["COUNT", "INTERVAL"].includes(key) &&
          (!/^\d+$/.test(v) || Number(v) < 1)
        )
          fail("INVALID_RULE", `${key} must be positive.`);
        if (key === "WKST" && !WEEKDAYS.includes(v))
          fail("INVALID_RULE", "Invalid WKST.");
        if (
          ["BYMONTH", "BYMONTHDAY"].includes(key) &&
          !v.split(",").every((n) => /^[+-]?\d+$/.test(n))
        )
          fail("INVALID_RULE", `${key} must contain integers.`);
        if (key === "UNTIL" && !/^\d{8}(?:T\d{6}Z?)?$/.test(v))
          fail("INVALID_RULE", "Invalid UNTIL lexical form.");
      }
    }
  }
  if (stack.length || roots !== 1)
    fail("INVALID_SYNTAX", "Exactly one balanced root calendar is required.");
}
function parseSnapshot(text, ctx) {
  if (typeof text !== "string") {
    diagnostic(ctx, "INVALID_INPUT", "ICS input must be text.");
    ctx.globalInvalid = true;
    return new Map();
  }
  if (new TextEncoder().encode(text).length > ctx.limits.maxBytes) {
    diagnostic(ctx, "BYTE_LIMIT", "Snapshot exceeds the byte limit.");
    ctx.globalInvalid = true;
    return new Map();
  }
  let calendar;
  try {
    const un = text.replace(/\r?\n[ \t]/g, "");
    if (
      !/^BEGIN:VCALENDAR\r?\n/i.test(un) ||
      !/(?:\r?\n)END:VCALENDAR\s*$/i.test(un)
    )
      fail("INVALID_CALENDAR", "Input must be a complete VCALENDAR.");
    preflight(text);
    calendar = new ICAL.Component(ICAL.parse(text));
    if (
      calendar.name !== "vcalendar" ||
      calendar.getFirstPropertyValue("version") !== "2.0"
    )
      fail("INVALID_CALENDAR", "One VCALENDAR with VERSION:2.0 is required.");
    if (calendar.getAllProperties("version").length !== 1)
      fail("INVALID_CALENDAR", "Exactly one VERSION is required.");
    if (calendar.getFirstPropertyValue("method"))
      fail(
        "UNSUPPORTED_METHOD",
        "METHOD scheduling messages are not complete calendar snapshots.",
      );
  } catch (e) {
    diagnostic(
      ctx,
      e.code || "PARSE_ERROR",
      e instanceof Unsupported ? e.message : "ICS syntax could not be parsed.",
    );
    ctx.globalInvalid = true;
    return new Map();
  }
  const grouped = new Map();
  for (const comp of calendar.getAllSubcomponents()) {
    if (comp.name === "vtimezone") continue;
    if (comp.name !== "vevent") {
      diagnostic(
        ctx,
        "UNSUPPORTED_COMPONENT",
        `${comp.name.toUpperCase()} is outside the VEVENT comparison scope.`,
      );
      continue;
    }
    const uid = comp.getFirstPropertyValue("uid");
    try {
      const data = eventData(comp);
      if (!grouped.has(data.uid)) grouped.set(data.uid, []);
      grouped.get(data.uid).push(data);
      if (grouped.size > ctx.limits.maxSeries) {
        diagnostic(
          ctx,
          "SERIES_LIMIT",
          "Snapshot exceeds the UID/series limit.",
        );
        ctx.globalInvalid = true;
        return new Map();
      }
    } catch (e) {
      diagnostic(
        ctx,
        e.code || "INVALID_EVENT",
        e instanceof Unsupported ? e.message : "VEVENT could not be evaluated.",
        typeof uid === "string" ? uid : undefined,
      );
      if (typeof uid === "string") ctx.blocked.add(uid);
      else ctx.globalInvalid = true;
    }
  }
  const series = new Map();
  for (const [uid, events] of grouped) {
    try {
      const masters = events.filter((e) => !e.rid),
        overrides = events.filter((e) => e.rid);
      if (masters.length !== 1)
        fail(
          masters.length ? "DUPLICATE_MASTER" : "ORPHAN_OVERRIDE",
          "Exactly one master per UID is required.",
        );
      const master = masters[0],
        overrideMap = new Map();
      for (const event of overrides) {
        if (!master.start || !master.recurring)
          fail(
            "ORPHAN_OVERRIDE",
            "Detached overrides require a recurring master.",
          );
        sameType(master.start, event.rid);
        if (event.start) sameType(master.start, event.start);
        if (overrideMap.has(event.rid.value))
          fail("DUPLICATE_OVERRIDE", "Duplicate RECURRENCE-ID.");
        overrideMap.set(event.rid.value, event);
      }
      series.set(uid, { master, overrides: overrideMap });
    } catch (e) {
      diagnostic(ctx, e.code || "INVALID_SERIES", e.message, uid);
      ctx.blocked.add(uid);
    }
  }
  return series;
}
function tick(ctx, uid) {
  if (++ctx.steps > ctx.limits.maxSteps)
    fail(
      "STEP_LIMIT",
      "Calendar-day expansion step limit reached; this UID is not compared.",
    );
}
function expand(series, ctx, extraTargets) {
  const result = new Map();
  for (const [uid, { master: m, overrides }] of [...series].sort(([a], [b]) =>
    a.localeCompare(b, "en"),
  )) {
    if (ctx.blocked.has(uid)) continue;
    try {
      if (m.cancelled && !overrides.size) {
        result.set(uid, new Map());
        continue;
      }
      const slots = new Map(),
        excluded = new Set(m.exdates.map((d) => d.value));
      slots.set(m.start.value, m.start);
      for (const d of m.rdates) slots.set(d.value, d);
      // Expand to both snapshots' explicit identity/DTSTART targets, including future origins moved in.
      let target = Math.max(
        ctx.endMs,
        ...[...overrides.values()].map((e) => e.rid.ms),
        ...(extraTargets.get(uid) || []),
      );
      if (m.rule?.until) target = Math.min(target, m.rule.until.ms);
      if (m.rule) {
        let count = 0;
        for (let day = m.start.ms; day <= target; day += DAY) {
          tick(ctx, uid);
          if (matchesDay(day, m.start, m.rule)) {
            if (m.rule.until && day > m.rule.until.ms) break;
            count++;
            slots.set(format(day, m.start.type), {
              ...m.start,
              ms: day,
              value: format(day, m.start.type),
            });
            if (slots.size > ctx.limits.maxOccurrences)
              fail(
                "OCCURRENCE_LIMIT",
                "Generated recurrence set exceeds the occurrence limit.",
              );
            if (m.rule.count && count >= m.rule.count) break;
          }
        }
      }
      for (const [rid] of overrides)
        if (!slots.has(rid))
          fail(
            "ORPHAN_OVERRIDE",
            "RECURRENCE-ID is not a member of the master recurrence set.",
          );
      if (m.cancelled) {
        result.set(uid, new Map());
        continue;
      }
      const occurrences = new Map();
      for (const [origin, slot] of slots) {
        if (excluded.has(origin)) continue;
        const effective = overrides.get(origin) || m;
        if (effective.cancelled) continue;
        const start = effective === m ? slot : effective.start;
        const end = format(start.ms + effective.seconds * 1000, start.type);
        const recurrenceId = m.recurring ? origin : null;
        const key = m.recurring ? `${m.start.type}:${origin}` : "single";
        const inWindow = start.ms >= ctx.startMs && start.ms < ctx.endMs;
        // Keep outside counterparts for stable identities and moved occurrences; trim only after compare.
        occurrences.set(key, {
          uid,
          recurrenceId,
          temporalType: start.type,
          start: start.value,
          end,
          durationSeconds: effective.seconds,
          summary: String(effective.c.getFirstPropertyValue("summary") || ""),
          location: String(effective.c.getFirstPropertyValue("location") || ""),
          description: String(
            effective.c.getFirstPropertyValue("description") || "",
          ),
          metadata: effective.metadata,
          inWindow,
        });
        if (++ctx.occurrences > ctx.limits.maxOccurrences)
          fail(
            "OCCURRENCE_LIMIT",
            "Expanded occurrence limit reached; this UID is not compared.",
          );
      }
      result.set(uid, occurrences);
    } catch (e) {
      diagnostic(
        ctx,
        e.code || "EXPANSION_ERROR",
        e instanceof Unsupported
          ? e.message
          : "Recurrence expansion could not be completed.",
        uid,
      );
      ctx.blocked.add(uid);
    }
  }
  return result;
}
function targets(series) {
  const result = new Map();
  for (const [uid, { master, overrides }] of series)
    result.set(uid, [
      ...(master.start ? [master.start.ms] : []),
      ...master.rdates.map((t) => t.ms),
      ...[...overrides.values()].map((e) => e.rid.ms),
    ]);
  return result;
}
function cleanOccurrence(o) {
  if (!o) return null;
  const { metadata, ...clean } = o;
  return clean;
}
function limitsOf(overrides = {}) {
  const limits = { ...DEFAULT_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      !(key in limits) ||
      !Number.isInteger(value) ||
      value < (key === "maxReportBytes" ? 16384 : 1) ||
      value > DEFAULT_LIMITS[key]
    )
      throw new TypeError(
        `Limit ${key} must be an integer from ${key === "maxReportBytes" ? 16384 : 1} to ${DEFAULT_LIMITS[key]}.`,
      );
    limits[key] = value;
  }
  return limits;
}
/** Compare start membership in [start,end) separately for UTC, floating and DATE. */
export function compareCalendars(beforeText, afterText, options = {}) {
  const start = temporal(options.start, "date"),
    end = temporal(options.end, "date");
  if (start.ms >= end.ms) throw new TypeError("Window start must precede end.");
  if (end.ms - start.ms > 3660 * DAY)
    throw new TypeError("Window cannot exceed 3,660 days.");
  const limits = limitsOf(options.limits);
  const context = (side) => ({
    side,
    limits,
    startMs: start.ms,
    endMs: end.ms,
    diagnostics: [],
    complete: true,
    blocked: new Set(),
    globalInvalid: false,
    steps: 0,
    occurrences: 0,
  });
  const before = context("before"),
    after = context("after"),
    a = parseSnapshot(beforeText, before),
    b = parseSnapshot(afterText, after);
  const blocked = new Set([...before.blocked, ...after.blocked]);
  before.blocked = blocked;
  after.blocked = blocked;
  for (const [uid, s] of a) {
    const other = b.get(uid);
    if (
      s.master.start &&
      other?.master.start &&
      s.master.start.type !== other.master.start.type
    ) {
      blocked.add(uid);
      diagnostic(
        after,
        "CROSS_SNAPSHOT_TYPES",
        "Same-UID DTSTART changes temporal domain; no cross-domain move is inferred.",
        uid,
      );
    }
  }
  const aa =
    before.globalInvalid || after.globalInvalid
      ? new Map()
      : expand(a, before, targets(b));
  const bb =
    before.globalInvalid || after.globalInvalid
      ? new Map()
      : expand(b, after, targets(a));
  const summary = {
      added: 0,
      removed: 0,
      moved: 0,
      durationChanged: 0,
      metadataChanged: 0,
      unchanged: 0,
    },
    changes = [];
  let outputLimited = false;
  let outputBytes =
    new TextEncoder().encode(
      JSON.stringify([...before.diagnostics, ...after.diagnostics]),
    ).length + 8192;
  for (const uid of [...new Set([...aa.keys(), ...bb.keys()])].sort()) {
    if (blocked.has(uid)) continue;
    const av = aa.get(uid) || new Map(),
      bv = bb.get(uid) || new Map();
    for (const key of [...new Set([...av.keys(), ...bv.keys()])].sort()) {
      const old = av.get(key),
        next = bv.get(key);
      if (!old?.inWindow && !next?.inWindow) continue;
      const fields = [];
      if (old && next) {
        if (old.start !== next.start || old.temporalType !== next.temporalType)
          fields.push("start");
        if (old.durationSeconds !== next.durationSeconds)
          fields.push("duration");
        if (JSON.stringify(old.metadata) !== JSON.stringify(next.metadata))
          fields.push("metadata");
        if (!fields.length) {
          summary.unchanged++;
          continue;
        }
      }
      if (changes.length >= limits.maxChanges) {
        outputLimited = true;
        continue;
      }
      const kind = !old ? "added" : !next ? "removed" : "changed";
      if (kind === "added") summary.added++;
      else if (kind === "removed") summary.removed++;
      else {
        if (fields.includes("start")) summary.moved++;
        if (fields.includes("duration")) summary.durationChanged++;
        if (fields.includes("metadata")) summary.metadataChanged++;
      }
      const metadataFields =
        old && next
          ? META.filter(
              (name) =>
                JSON.stringify(old.metadata[name]) !==
                JSON.stringify(next.metadata[name]),
            )
          : [];
      const change = {
        id: JSON.stringify([uid, key]),
        uid,
        recurrenceId: (next || old).recurrenceId,
        kind,
        changes: fields,
        before: cleanOccurrence(old),
        after: cleanOccurrence(next),
        evidence: {
          identity:
            key === "single"
              ? "same UID, nonrecurring event"
              : "same UID and typed RECURRENCE-ID",
          fields:
            kind === "changed"
              ? [...fields.filter((f) => f !== "metadata"), ...metadataFields]
              : ["occurrence-set membership"],
          metadataChanges: metadataFields.map((field) => ({
            field,
            before: old.metadata[field],
            after: next.metadata[field],
          })),
        },
      };
      const changeBytes =
        new TextEncoder().encode(JSON.stringify(change)).length + 1;
      if (outputBytes + changeBytes > limits.maxReportBytes) {
        outputLimited = true;
        if (kind === "added") summary.added--;
        else if (kind === "removed") summary.removed--;
        else {
          if (fields.includes("start")) summary.moved--;
          if (fields.includes("duration")) summary.durationChanged--;
          if (fields.includes("metadata")) summary.metadataChanged--;
        }
        continue;
      }
      outputBytes += changeBytes;
      changes.push(change);
    }
  }
  const diagnostics = [...before.diagnostics, ...after.diagnostics];
  if (outputLimited)
    diagnostics.push({
      side: "comparison",
      code: "OUTPUT_LIMIT",
      message:
        "Changed-occurrence count or byte output limit reached. Summary counts include only emitted changes.",
    });
  diagnostics.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b), "en"),
  );
  const report = {
    schemaVersion: "1.0",
    complete: before.complete && after.complete && !outputLimited,
    window: {
      start: options.start,
      end: options.end,
      semantics:
        "Occurrence START is in [start 00:00, end 00:00). UTC, floating and DATE are separate temporal domains; this is not interval-overlap matching.",
    },
    summary,
    changes,
    diagnostics,
    stats: {
      beforeSeries: a.size,
      afterSeries: b.size,
      beforeSteps: before.steps,
      afterSteps: after.steps,
      beforeOccurrences: before.occurrences,
      afterOccurrences: after.occurrences,
      skippedUids: [...blocked].sort(),
    },
    scope: {
      temporalTypes: ["utc", "floating", "date"],
      metadataFields: META,
      ignored: [
        "DTSTAMP",
        "CREATED",
        "LAST-MODIFIED",
        "SEQUENCE",
        "VALARM",
        "ATTACH",
        "X-properties",
      ],
      limits,
      unfoldedLineBytes: 65536,
      uidBytes: 1024,
      diagnosticsPerSnapshot: 200,
    },
  };
  if (
    new TextEncoder().encode(JSON.stringify(report)).length >
    limits.maxReportBytes
  ) {
    report.complete = false;
    report.changes = [];
    report.summary = {
      added: 0,
      removed: 0,
      moved: 0,
      durationChanged: 0,
      metadataChanged: 0,
      unchanged: 0,
    };
    report.diagnostics = [
      {
        side: "comparison",
        code: "OUTPUT_LIMIT",
        message:
          "Complete report exceeded its byte budget. Details omitted; comparison is incomplete.",
      },
    ];
    report.stats = {
      beforeSeries: a.size,
      afterSeries: b.size,
      skippedUidCount: blocked.size,
    };
  }
  return report;
}
