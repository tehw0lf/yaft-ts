import { Feature } from "./FeatureToggle";

/**
 * A source of the current time, in milliseconds since the epoch.
 *
 * Everything that evaluates a feature takes one of these instead of calling
 * `Date.now()` directly, so tests -- and the conformance suite, which supplies
 * a `now` with every case -- can evaluate against a fixed instant.
 */
export type Clock = () => number;

/** The default clock: the system time. */
export const systemClock: Clock = () => Date.now();

/**
 * Matches RFC 3339 timestamps that carry an explicit offset (`Z` or `±hh:mm`).
 *
 * Only this format is accepted. A bare date such as `2026-09-18` or a
 * timestamp without an offset is rejected, because languages disagree on how
 * to read them -- JavaScript treats a bare date as UTC midnight and an
 * offset-less timestamp as local time, while most other languages read both as
 * local. A feature would then flip at a different instant depending on which
 * port evaluated it, so such values are ignored rather than guessed at.
 */
const RFC3339_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** Days per month, index 1-12; February is handled by the leap-year branch. */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month];
  return day <= max;
}

function isRealTime(hour: number, minute: number, second: number): boolean {
  // RFC 3339 permits second 60 for a leap second; it is allowed through here
  // and then rejected by the NaN guard, because Date.parse cannot represent
  // one. The value ends up ignored either way.
  return hour <= 23 && minute <= 59 && second <= 60;
}

/**
 * Parses an RFC 3339 timestamp with an offset.
 *
 * Returns `undefined` for anything unset, malformed or in another format;
 * callers treat that as "no bound", never as an error. An invalid value is
 * warned about but never throws, so a bad timestamp in the backend cannot take
 * an application down.
 */
export function parseTimestamp(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  const match = RFC3339_WITH_OFFSET.exec(value);
  if (!match) {
    console.warn(
      `YaFT: ignoring "${value}", expected RFC 3339 with an offset (e.g. 2026-09-18T15:00:00Z)`
    );
    return undefined;
  }

  // The pattern only checks the shape, and Date.parse does not reject an
  // impossible calendar date -- it rolls it over, turning 2027-02-30 into
  // 2027-03-02. Silently shifting a bound by days is worse than ignoring it,
  // so the components are range-checked first.
  const [, year, month, day, hour, minute, second] = match;
  if (!isRealDate(+year, +month, +day) || !isRealTime(+hour, +minute, +second)) {
    console.warn(`YaFT: ignoring "${value}", not a valid date or time`);
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    console.warn(`YaFT: ignoring "${value}", not a valid timestamp`);
    return undefined;
  }

  return parsed;
}

/**
 * Decides whether a feature is on at the instant `now`.
 *
 * This is the single definition of YaFT's evaluation rules. Providers call it
 * rather than implementing the logic themselves, so every provider -- and
 * every port that mirrors this function -- agrees on the same answer.
 *
 * The rules:
 *
 * - A missing feature is off.
 * - Only the exact string `"true"` is on. `"TRUE"`, `"1"` and `""` are off,
 *   because the backend stores the value as a string and anything else would
 *   be a silent disagreement between backend and client.
 * - `activeAt` and `disabledAt` are optional bounds. Unset, null or
 *   unparseable values are ignored rather than treated as an error.
 * - The window is half-open: at exactly `activeAt` the feature is on
 *   (`now < activeAt` is off), at exactly `disabledAt` it is off
 *   (`now >= disabledAt` is off).
 * - `activeAt` after `disabledAt` is not special-cased; it simply yields a
 *   window that is never open.
 */
export function evaluate(
  feature: Feature | null | undefined,
  now: number
): boolean {
  if (feature === undefined || feature === null) return false;

  if (feature.value !== "true") return false;

  const activeAt = parseTimestamp(feature.activeAt);
  if (activeAt !== undefined && now < activeAt) return false;

  const disabledAt = parseTimestamp(feature.disabledAt);
  if (disabledAt !== undefined && now >= disabledAt) return false;

  return true;
}
