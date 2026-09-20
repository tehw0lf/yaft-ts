import { Clock } from '../evaluate';
import { Feature } from '../FeatureToggle';
import { ApiServiceFeatureProvider } from '../examples/ApiServiceFeatureProvider';
import { LocalStorageFeatureProvider } from '../examples/LocalStorageFeatureProvider';

/**
 * The clock has to be injectable for the conformance suite: every case there
 * carries its own `now`, and an adapter cannot set it if the providers read
 * `Date.now()` directly.
 *
 * These tests pin that down, and pin down that both feature-shaped providers
 * answer identically -- the point of moving the logic into evaluate().
 */
describe('injectable clock', () => {
  const windowed: Feature = {
    key: 'windowed',
    value: 'true',
    activeAt: '2026-09-18T10:00:00Z',
    disabledAt: '2026-09-18T14:00:00Z',
  };

  const at = (iso: string): Clock => () => Date.parse(iso);

  /** A provider holding `windowed`, without touching the filesystem. */
  const localAt = (iso: string) => {
    const provider = new LocalStorageFeatureProvider('', at(iso));
    provider.data = { windowed };
    return provider;
  };

  /** The same, for the API provider, without touching the network. */
  const apiAt = (iso: string) => {
    const provider = new ApiServiceFeatureProvider('', '', at(iso));
    provider.data = { windowed };
    return provider;
  };

  describe('LocalStorageFeatureProvider', () => {
    it('is off before the window', () => {
      expect(localAt('2026-09-18T09:59:59Z').isEnabled('windowed')).toBe(false);
    });

    it('is on inside the window', () => {
      expect(localAt('2026-09-18T12:00:00Z').isEnabled('windowed')).toBe(true);
    });

    it('is off after the window', () => {
      expect(localAt('2026-09-18T14:00:00Z').isEnabled('windowed')).toBe(false);
    });
  });

  describe('ApiServiceFeatureProvider', () => {
    it('is off before the window', () => {
      expect(apiAt('2026-09-18T09:59:59Z').isEnabled('windowed')).toBe(false);
    });

    it('is on inside the window', () => {
      expect(apiAt('2026-09-18T12:00:00Z').isEnabled('windowed')).toBe(true);
    });

    it('is off after the window', () => {
      expect(apiAt('2026-09-18T14:00:00Z').isEnabled('windowed')).toBe(false);
    });
  });

  // Before this change each provider carried its own copy of the logic, so
  // they could drift apart unnoticed. Now they must agree everywhere.
  it('both feature providers agree at every instant', () => {
    for (const iso of [
      '2026-09-18T09:00:00Z',
      '2026-09-18T10:00:00Z',
      '2026-09-18T12:00:00Z',
      '2026-09-18T13:59:59Z',
      '2026-09-18T14:00:00Z',
      '2026-09-18T20:00:00Z',
    ]) {
      expect(localAt(iso).isEnabled('windowed')).toBe(
        apiAt(iso).isEnabled('windowed')
      );
    }
  });

  it('the same provider answers differently as its clock advances', () => {
    let now = Date.parse('2026-09-18T09:00:00Z');
    const provider = new LocalStorageFeatureProvider('', () => now);
    provider.data = { windowed };

    expect(provider.isEnabled('windowed')).toBe(false);

    now = Date.parse('2026-09-18T12:00:00Z');
    expect(provider.isEnabled('windowed')).toBe(true);

    now = Date.parse('2026-09-18T15:00:00Z');
    expect(provider.isEnabled('windowed')).toBe(false);
  });

  it('defaults to the system clock when none is given', () => {
    const provider = new LocalStorageFeatureProvider('');
    provider.data = {
      open: { key: 'open', value: 'true', activeAt: '', disabledAt: '' },
      expired: {
        key: 'expired',
        value: 'true',
        activeAt: '',
        disabledAt: '2000-01-01T00:00:00Z',
      },
    };

    expect(provider.isEnabled('open')).toBe(true);
    expect(provider.isEnabled('expired')).toBe(false);
  });
});
