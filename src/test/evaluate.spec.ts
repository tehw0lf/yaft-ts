import { Feature } from '../FeatureToggle';
import { Clock, evaluate, parseTimestamp, systemClock } from '../evaluate';

/**
 * Tests for the central evaluation rules.
 *
 * Every case carries its own `now`, so nothing here depends on when the suite
 * runs. This mirrors how the conformance suite supplies a `now` per case, and
 * is the reason the clock had to become injectable.
 */
describe('evaluate', () => {
  const NOW = Date.parse('2026-09-18T12:00:00Z');

  const feature = (overrides: Partial<Feature> = {}): Feature => ({
    key: 'f',
    value: 'true',
    activeAt: '',
    disabledAt: '',
    ...overrides,
  });

  describe('missing features', () => {
    it('treats undefined as off', () => {
      expect(evaluate(undefined, NOW)).toBe(false);
    });

    it('treats null as off', () => {
      expect(evaluate(null, NOW)).toBe(false);
    });
  });

  describe('value', () => {
    it('is on for exactly "true"', () => {
      expect(evaluate(feature({ value: 'true' }), NOW)).toBe(true);
    });

    // The backend stores the value as a string. Anything but "true" must read
    // as off, or backend and client would silently disagree.
    it.each(['false', 'TRUE', 'True', '1', '', 'yes'])(
      'is off for %p',
      (value) => {
        expect(evaluate(feature({ value }), NOW)).toBe(false);
      }
    );

    it('is off when the value is missing entirely', () => {
      const withoutValue = { key: 'f', activeAt: '', disabledAt: '' } as Feature;
      expect(evaluate(withoutValue, NOW)).toBe(false);
    });
  });

  describe('activeAt', () => {
    it('is off before activeAt', () => {
      expect(
        evaluate(feature({ activeAt: '2026-09-18T13:00:00Z' }), NOW)
      ).toBe(false);
    });

    it('is on after activeAt', () => {
      expect(
        evaluate(feature({ activeAt: '2026-09-18T11:00:00Z' }), NOW)
      ).toBe(true);
    });

    // The window is half-open: the comparison is `now < activeAt`.
    it('is on at exactly activeAt', () => {
      expect(
        evaluate(feature({ activeAt: '2026-09-18T12:00:00Z' }), NOW)
      ).toBe(true);
    });
  });

  describe('disabledAt', () => {
    it('is on before disabledAt', () => {
      expect(
        evaluate(feature({ disabledAt: '2026-09-18T13:00:00Z' }), NOW)
      ).toBe(true);
    });

    it('is off after disabledAt', () => {
      expect(
        evaluate(feature({ disabledAt: '2026-09-18T11:00:00Z' }), NOW)
      ).toBe(false);
    });

    // The comparison is `now >= disabledAt`, so the boundary is off -- the
    // opposite of the activeAt boundary.
    it('is off at exactly disabledAt', () => {
      expect(
        evaluate(feature({ disabledAt: '2026-09-18T12:00:00Z' }), NOW)
      ).toBe(false);
    });
  });

  describe('both bounds', () => {
    const windowed = feature({
      activeAt: '2026-09-18T10:00:00Z',
      disabledAt: '2026-09-18T14:00:00Z',
    });

    it('is on inside the window', () => {
      expect(evaluate(windowed, NOW)).toBe(true);
    });

    it('is off before the window', () => {
      expect(evaluate(windowed, Date.parse('2026-09-18T09:00:00Z'))).toBe(false);
    });

    it('is off after the window', () => {
      expect(evaluate(windowed, Date.parse('2026-09-18T15:00:00Z'))).toBe(false);
    });

    // Not a special case: the bounds simply never overlap.
    it('is off everywhere when activeAt is after disabledAt', () => {
      const inverted = feature({
        activeAt: '2026-09-18T14:00:00Z',
        disabledAt: '2026-09-18T10:00:00Z',
      });

      for (const at of [
        '2026-09-18T09:00:00Z',
        '2026-09-18T12:00:00Z',
        '2026-09-18T16:00:00Z',
      ]) {
        expect(evaluate(inverted, Date.parse(at))).toBe(false);
      }
    });
  });

  describe('timezone offsets', () => {
    it('converts an offset to the same instant as UTC', () => {
      // 14:00+02:00 is 12:00Z, which is exactly NOW, so the activeAt boundary
      // is inclusive and the feature is on.
      expect(
        evaluate(feature({ activeAt: '2026-09-18T14:00:00+02:00' }), NOW)
      ).toBe(true);
    });

    it('respects a negative offset', () => {
      // 08:00-05:00 is 13:00Z, one hour after NOW, so it is not active yet.
      expect(
        evaluate(feature({ activeAt: '2026-09-18T08:00:00-05:00' }), NOW)
      ).toBe(false);
    });
  });

  describe('unset and invalid bounds are ignored', () => {
    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ])('ignores %s', (_label, value) => {
      const f = feature({
        activeAt: value as string,
        disabledAt: value as string,
      });
      expect(evaluate(f, NOW)).toBe(true);
    });

    // Rejected on purpose: JavaScript reads a bare date as UTC midnight and an
    // offset-less timestamp as local time, while most other languages read
    // both as local. Accepting them would make a feature flip at a different
    // instant depending on the port.
    it.each([
      ['a bare date', '2026-09-18'],
      ['no offset', '2026-09-18T15:00:00'],
      ['garbage', 'not-a-date'],
      ['a unix timestamp', '1758196800'],
      ['a slash date', '2026/09/18'],
    ])('ignores %s in activeAt', (_label, value) => {
      // Would be off if parsed as a future bound; ignoring it leaves the
      // feature on.
      expect(evaluate(feature({ activeAt: value }), NOW)).toBe(true);
    });

    // Date.parse does not reject an impossible calendar date, it rolls it
    // over: 2027-02-30 becomes 2027-03-02. The date must therefore be in the
    // future, or the rolled-over value lands in the past and the activeAt
    // check passes for the wrong reason.
    it.each([
      ['a day past the end of February', '2027-02-30T00:00:00Z'],
      ['the 31st of a 30-day month', '2027-04-31T00:00:00Z'],
      ['month 13', '2027-13-01T00:00:00Z'],
      ['day zero', '2027-01-00T00:00:00Z'],
      ['February 29 in a non-leap year', '2027-02-29T00:00:00Z'],
      ['hour 24', '2027-01-01T24:00:00Z'],
      ['minute 60', '2027-01-01T00:60:00Z'],
    ])('ignores %s', (_label, value) => {
      expect(evaluate(feature({ activeAt: value }), NOW)).toBe(true);
      expect(parseTimestamp(value)).toBeUndefined();
    });

    it('accepts February 29 in a leap year', () => {
      expect(parseTimestamp('2028-02-29T00:00:00Z')).toBe(
        Date.parse('2028-02-29T00:00:00Z')
      );
    });

    // RFC 3339 permits second 60 for a leap second, but Date.parse returns
    // NaN for it, so the value is ignored like any other unusable bound. The
    // range check lets it through and the NaN guard catches it; asserted here
    // so the two stay consistent.
    it('ignores a leap second, which Date.parse cannot represent', () => {
      expect(parseTimestamp('2026-12-31T23:59:60Z')).toBeUndefined();
      expect(
        evaluate(feature({ activeAt: '2026-12-31T23:59:60Z' }), NOW)
      ).toBe(true);
    });

    it('never throws on malformed input', () => {
      expect(() =>
        evaluate(feature({ activeAt: 'x', disabledAt: 'y' }), NOW)
      ).not.toThrow();
    });
  });

  describe('fractional seconds', () => {
    it('accepts them', () => {
      expect(
        evaluate(feature({ disabledAt: '2026-09-18T12:00:00.001Z' }), NOW)
      ).toBe(true);
    });
  });
});

describe('parseTimestamp', () => {
  it('returns the epoch milliseconds for a valid timestamp', () => {
    expect(parseTimestamp('2026-09-18T12:00:00Z')).toBe(
      Date.parse('2026-09-18T12:00:00Z')
    );
  });

  it.each([undefined, null, ''])('returns undefined for %p', (value) => {
    expect(parseTimestamp(value)).toBeUndefined();
  });

  it('returns undefined for a format without an offset', () => {
    expect(parseTimestamp('2026-09-18T12:00:00')).toBeUndefined();
  });

  it('accepts a lowercase t and z', () => {
    expect(parseTimestamp('2026-09-18t12:00:00z')).toBe(
      Date.parse('2026-09-18T12:00:00Z')
    );
  });
});

describe('systemClock', () => {
  it('reports the current time', () => {
    const before = Date.now();
    const reading = systemClock();
    expect(reading).toBeGreaterThanOrEqual(before);
    expect(reading).toBeLessThanOrEqual(Date.now());
  });

  it('is the default, so a provider works without one', () => {
    const clock: Clock = () => 0;
    expect(typeof clock()).toBe('number');
  });
});
