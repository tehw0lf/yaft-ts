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
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

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

  if (!RFC3339_WITH_OFFSET.test(value)) {
    console.warn(
      `YaFT: ignoring "${value}", expected RFC 3339 with an offset (e.g. 2026-09-18T15:00:00Z)`
    );
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    // Shape is right but the value is not a real instant, e.g. 2026-02-30.
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
