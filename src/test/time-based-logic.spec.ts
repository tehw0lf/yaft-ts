import { Feature } from '../FeatureToggle';
import { LocalStorageFeatureProvider } from '../examples/LocalStorageFeatureProvider';

describe('Time-based Feature Evaluation Logic', () => {
  describe('Current Time Logic', () => {
    it('should handle feature with value=true and no dates (always enabled)', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'always-enabled': {
              key: 'always-enabled',
              value: 'true',
              activeAt: '',
              disabledAt: ''
            }
          };
        }
      })();

      expect(provider.isEnabled('always-enabled')).toBe(true);
    });

    it('should handle feature with value=false (always disabled)', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'always-disabled': {
              key: 'always-disabled',
              value: 'false',
              activeAt: '',
              disabledAt: ''
            }
          };
        }
      })();

      expect(provider.isEnabled('always-disabled')).toBe(false);
    });

    it('should disable feature if disabledAt is in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'past-disabled': {
              key: 'past-disabled',
              value: 'true',
              activeAt: '',
              disabledAt: pastDate
            }
          };
        }
      })();

      expect(provider.isEnabled('past-disabled')).toBe(false);
    });

    it('should enable feature if activeAt is in the past and no disabledAt', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'past-active': {
              key: 'past-active',
              value: 'true',
              activeAt: pastDate,
              disabledAt: ''
            }
          };
        }
      })();

      expect(provider.isEnabled('past-active')).toBe(true);
    });

    it('BUG: should NOT enable feature if activeAt is in the future', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now

      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'future-active': {
              key: 'future-active',
              value: 'true',
              activeAt: futureDate,
              disabledAt: ''
            }
          };
        }
      })();

      // CURRENT BUGGY BEHAVIOR: Returns true because it falls through to line 28
      // Date.now() >= Date.parse(futureDate) is false, so it skips line 26
      // Falls through to: return JSON.parse(feature.value); which returns true

      // EXPECTED BEHAVIOR: Should return false because feature is not yet active
      expect(provider.isEnabled('future-active')).toBe(false);
    });

    it('should enable feature if within activeAt and disabledAt window', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now

      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'windowed-feature': {
              key: 'windowed-feature',
              value: 'true',
              activeAt: pastDate,
              disabledAt: futureDate
            }
          };
        }
      })();

      expect(provider.isEnabled('windowed-feature')).toBe(true);
    });

    it('should handle NaN dates gracefully (empty strings)', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'empty-dates': {
              key: 'empty-dates',
              value: 'true',
              activeAt: '',
              disabledAt: ''
            }
          };
        }
      })();

      // Date.parse('') returns NaN
      // Date.now() >= NaN is false for both checks
      // Should fall through to: return JSON.parse(feature.value);
      expect(provider.isEnabled('empty-dates')).toBe(true);
    });

    it('should handle invalid date strings gracefully', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'invalid-dates': {
              key: 'invalid-dates',
              value: 'true',
              activeAt: 'not-a-date',
              disabledAt: 'also-not-a-date'
            }
          };
        }
      })();

      // Date.parse('not-a-date') returns NaN
      // Similar behavior to empty strings
      expect(provider.isEnabled('invalid-dates')).toBe(true);
    });
  });
});
