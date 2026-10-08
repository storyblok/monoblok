import { CommandError } from "../../../utils/error/command-error";

/** Both bounds are inclusive. A missing bound leaves that side open. */
export type DateRange = { from?: Date; to?: Date };

/**
 * Which way a bare duration points. Past dates (`7d` = "in the last 7 days")
 * suit everything that has already happened to a story; a pending schedule is
 * always ahead, so there `7d` reads as "in the next 7 days".
 */
export type DateDirection = "past" | "future";

/**
 * One end of a range, widened to the precision it was written at: `2024-06` is
 * the whole of June, so as a lower bound it starts on the 1st and as an upper
 * bound it ends on the 30th. Durations and `now` are instants.
 */
type Point = { start: Date; end: Date; relative: boolean };

const DURATION = /^(\d+)(mo|m|h|d|w|y)$/;
const CALENDAR = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/i;

const MINUTE = 60_000;
const UNIT_MS: Record<string, number> = {
  m: MINUTE,
  h: 60 * MINUTE,
  d: 24 * 60 * MINUTE,
  w: 7 * 24 * 60 * MINUTE,
};

/**
 * Reads a date flag's value into an inclusive range.
 *
 * Accepted forms:
 * - a duration, `30m`, `12h`, `7d`, `2w`, `3mo` or `1y`: within the last (or next) N
 * - a calendar date, `2024`, `2024-06` or `2024-06-15`: that whole year, month or day
 * - an ISO datetime, `2024-06-15T09:00`, with an optional offset
 * - a range of any two of those, or `now`, as `a..b`, `a..` or `..b`
 *
 * Dates without an offset are UTC, the zone the API reports story dates in, so
 * a value reads the same as the timestamps in the output, on any machine.
 */
export function parseDateRange(
  flag: string,
  raw: string,
  { now, direction }: { now: Date; direction: DateDirection },
): DateRange {
  const value = raw.trim();
  const fail = (reason?: string): never => {
    throw new CommandError(
      `${flag} expects a duration like '7d', a date like '2024-06', or a range like '2024-01-01..2024-06-30', and got: ${raw}` +
        (reason ? `\n${reason}` : "\nDurations take m (minutes), h, d, w, mo (months) or y."),
    );
  };
  const point = (text: string): Point => parsePoint(text.trim(), now, direction) ?? fail();

  if (!value.includes("..")) {
    if (value === "now") {
      fail("'now' is a single instant. Use it as one end of a range, e.g. 'now..7d'.");
    }
    const { start, end, relative } = point(value);
    if (!relative) {
      return { from: start, to: end };
    }
    // "In the last 7 days" runs up to now, which nothing in the past can exceed,
    // so the upper bound is left open. "In the next 7 days" needs both ends.
    return direction === "past" ? { from: start } : { from: now, to: end };
  }

  const [left, right, ...rest] = value.split("..");
  if (rest.length > 0 || (!left.trim() && !right.trim())) {
    fail();
  }
  const from = left.trim() ? point(left).start : undefined;
  const to = right.trim() ? point(right).end : undefined;
  if (from && to && from > to) {
    fail(
      `The range starts after it ends (${from.toISOString()} > ${to.toISOString()}), so nothing could match.`,
    );
  }
  return { from, to };
}

function parsePoint(text: string, now: Date, direction: DateDirection): Point | undefined {
  if (text === "now") {
    return { start: now, end: now, relative: true };
  }

  const duration = DURATION.exec(text);
  if (duration) {
    const instant = shift(now, Number(duration[1]), duration[2], direction === "past" ? -1 : 1);
    return { start: instant, end: instant, relative: true };
  }

  const calendar = CALENDAR.exec(text);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = calendar[2] === undefined ? undefined : Number(calendar[2]);
    const day = calendar[3] === undefined ? undefined : Number(calendar[3]);
    const start = utcDate(year, month ?? 1, day ?? 1);
    if (!start) {
      return undefined;
    }
    const next = new Date(start);
    if (day !== undefined) {
      next.setUTCDate(next.getUTCDate() + 1);
    } else if (month !== undefined) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    } else {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
    }
    return { start, end: new Date(next.getTime() - 1), relative: false };
  }

  const datetime = DATETIME.exec(text);
  if (datetime) {
    const [, year, month, day, hour, minute, second, millis, offset] = datetime;
    const date = utcDate(Number(year), Number(month), Number(day));
    if (!date || Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59) {
      return undefined;
    }
    const offsetMs = parseOffset(offset);
    if (offsetMs === undefined) {
      return undefined;
    }
    const start = new Date(
      date.getTime() +
        Number(hour) * 60 * MINUTE +
        Number(minute) * MINUTE +
        Number(second ?? 0) * 1000 +
        Number((millis ?? "0").padEnd(3, "0")) -
        offsetMs,
    );
    const precision = millis !== undefined ? 1 : second !== undefined ? 1000 : MINUTE;
    return { start, end: new Date(start.getTime() + precision - 1), relative: false };
  }

  return undefined;
}

/** The UTC midnight of a calendar date, or `undefined` when there is no such day, e.g. `2024-02-30`. */
function utcDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : undefined;
}

/** `Z`, `+02:00` or `-0530` as milliseconds east of UTC. No offset means UTC. */
function parseOffset(offset: string | undefined): number | undefined {
  if (offset === undefined || offset.toUpperCase() === "Z") {
    return 0;
  }
  const digits = offset.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (hours > 23 || minutes > 59) {
    return undefined;
  }
  return (offset.startsWith("-") ? -1 : 1) * (hours * 60 + minutes) * MINUTE;
}

function shift(from: Date, amount: number, unit: string, sign: 1 | -1): Date {
  if (unit === "mo" || unit === "y") {
    return shiftMonths(from, sign * amount * (unit === "y" ? 12 : 1));
  }
  return new Date(from.getTime() + sign * amount * UNIT_MS[unit]);
}

/**
 * Moves along the calendar, keeping the day of the month where it exists and
 * clamping to the month's last day where it does not. `Date#setUTCMonth` would
 * overflow instead: one month back from 31 March would land in early March.
 */
function shiftMonths(from: Date, months: number): Date {
  const date = new Date(from);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

/**
 * Whether a story date falls in the range. A story with no such date (a draft
 * has no `published_at`, a folder is never published) never matches: asking
 * when something happened excludes what never happened.
 */
export function isInDateRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) {
    return false;
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return false;
  }
  return (
    (range.from === undefined || time >= range.from.getTime()) &&
    (range.to === undefined || time <= range.to.getTime())
  );
}
