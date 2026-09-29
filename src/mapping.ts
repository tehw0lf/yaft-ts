import { Feature } from './FeatureToggle';

/**
 * Turns a backend response into provider data.
 *
 * This is the single definition of YaFT's mapping rules, the way `evaluate` is
 * the single definition of the evaluation rules. Providers call it instead of
 * unpacking responses themselves, so every provider -- and every port that
 * mirrors it -- agrees on what a response means.
 */

/** A raw entry as it arrives over the wire, in either field spelling. */
type RawFeature = Record<string, unknown>;

/**
 * Reads a field by presence, not by truthiness.
 *
 * The obvious `raw.value || raw.Value` is wrong: a present but empty value
 * falls through to the other spelling, so a feature stored as `""` reads as
 * whatever the capitalised field holds. An off feature then reports on. The
 * same trap applies to `tags: []`.
 *
 * Backends from 0.2.0 on send only the lowercase spelling; the capitalised one
 * is read because instances before that are still around.
 */
function field(raw: RawFeature, lower: string, upper: string): unknown {
  if (lower in raw) return raw[lower];
  if (upper in raw) return raw[upper];
  return undefined;
}

/**
 * A string field, or `''` for anything that is not a string (R33).
 *
 * `key` and `value` are strings; JSON booleans belong in the boolean shape.
 * `String(true)` would turn `"value": true` into `"true"` and the feature on,
 * so a non-string is not set instead: the value is off and an entry without a
 * string key is skipped (R25). The backend sends `null` for an unset bound and
 * local fixtures use `""`; both mean "no bound" (R24).
 */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Normalises one entry into a `Feature`, whichever spelling it arrived in. */
export function normaliseFeature(raw: RawFeature): Feature {
  const tags = field(raw, 'tags', 'Tags');

  return {
    key: text(field(raw, 'key', 'Key')),
    value: text(field(raw, 'value', 'Value')),
    activeAt: text(field(raw, 'activeAt', 'ActiveAt')),
    disabledAt: text(field(raw, 'disabledAt', 'DisabledAt')),
    // Filtered rather than asserted: `as string[]` is a compile-time claim
    // that a backend sending a mixed array would quietly break, handing
    // callers a non-string through a field typed as string.
    tags: Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
  };
}

/**
 * Normalises a whole response into features keyed by their key.
 *
 * Three envelopes are accepted, because the backend uses all three:
 *
 * - `{ "toggles": [...] }` for a UUID group;
 * - `{ "value": [...] }`, the same thing under a different name;
 * - a flat object for a single toggle.
 *
 * An entry without a usable key is skipped rather than stored under `""`,
 * where `isEnabled("")` could reach it.
 */
export function normaliseCollection(response: unknown): Record<string, Feature> {
  if (response === null || typeof response !== 'object') return {};

  const body = response as Record<string, unknown>;
  const collection = Array.isArray(body['toggles'])
    ? body['toggles']
    : Array.isArray(body['value'])
      ? body['value']
      : undefined;

  // A single toggle comes back flat, not wrapped. Older code only handled the
  // collections and dropped this shape entirely.
  const entries = collection ?? [body];

  const data: Record<string, Feature> = {};
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;

    const feature = normaliseFeature(entry as RawFeature);
    if (feature.key !== '') data[feature.key] = feature;
  }
  return data;
}

/**
 * Normalises a /features response, but only if it is recognisably a toggle
 * group: a collection envelope -- an empty one is a valid empty group -- or a
 * single toggle. Returns `undefined` for anything else.
 *
 * `normaliseCollection` turns null, an array, a proxy's error object or a
 * collection whose entries are all unusable into `{}`. A provider storing that
 * would switch every feature off without an error; this is what it should
 * check instead. Unusable entries next to good ones are still skipped (R25).
 */
export function normaliseGroup(response: unknown): Record<string, Feature> | undefined {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }
  const data = normaliseCollection(response);
  if (Object.keys(data).length > 0) return data;

  const body = response as Record<string, unknown>;
  const collection = Array.isArray(body['toggles'])
    ? body['toggles']
    : Array.isArray(body['value'])
      ? body['value']
      : undefined;
  return collection !== undefined && collection.length === 0 ? data : undefined;
}

/**
 * Normalises a boolean-shape payload, `{ "myToggle": true }`.
 *
 * Only real booleans are kept (R29). Anything else is dropped, so its key
 * reads as missing and therefore off. Keeping it and testing its truthiness
 * would turn `"false"` on, since a non-empty string is truthy.
 */
export function normaliseBooleans(response: unknown): Record<string, boolean> {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return {};
  }

  const data: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(response as Record<string, unknown>)) {
    if (typeof value === 'boolean') data[key] = value;
  }
  return data;
}

/**
 * Reads the hash from a /collectionHash response, or returns `undefined` if
 * it carries none.
 *
 * Reading `response.collectionHash || response.value` without checking let a
 * proxy's error page through as `undefined`. Once recorded, `undefined` matched
 * every later answer without a hash, and the provider stopped refreshing
 * without saying so.
 */
export function collectionHashOf(response: unknown): string | undefined {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }
  const body = response as Record<string, unknown>;
  const hash = 'collectionHash' in body ? body['collectionHash'] : body['value'];
  return typeof hash === 'string' && hash !== '' ? hash : undefined;
}
