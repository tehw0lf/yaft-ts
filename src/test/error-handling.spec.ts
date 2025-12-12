import { FeatureToggle, FeatureToggleBase, FeatureProvider, Feature } from '../FeatureToggle';
import { LocalStorageFeatureProvider } from '../examples/LocalStorageFeatureProvider';
import { ApiServiceFeatureProvider } from '../examples/ApiServiceFeatureProvider';
import axios from 'axios';

// Mock axios for API provider tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.get = jest.fn();

describe('Error Handling and Edge Cases', () => {
  let mockProvider: FeatureProvider<boolean>;

  beforeEach(() => {
    mockProvider = {
      data: {},
      getConfig: jest.fn(),
      isEnabled: jest.fn()
    };
    FeatureToggleBase.featureProvider = mockProvider;
    jest.clearAllMocks();
    // Reset axios mock
    (mockedAxios.get as jest.Mock).mockReset();
  });

  describe('Provider Initialization Errors', () => {
    it('should handle missing provider gracefully', () => {
      FeatureToggleBase.featureProvider = null as any;

      expect(() => {
        class TestClass {
          @FeatureToggle('test')
          method() {}
        }
      }).toThrow('FeatureToggleProvider not set');
    });

    it('should handle undefined provider gracefully', () => {
      FeatureToggleBase.featureProvider = undefined as any;

      expect(() => {
        class TestClass {
          @FeatureToggle('test')
          method() {}
        }
      }).toThrow('FeatureToggleProvider not set');
    });
  });

  describe('LocalStorageFeatureProvider Error Handling', () => {
    it('should handle non-existent configuration files', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const provider = new LocalStorageFeatureProvider('./non-existent-file.json');
      
      expect(provider.data).toEqual({});
      expect(provider.isEnabled('anyKey')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load configuration from local file:',
        expect.objectContaining({
          code: 'MODULE_NOT_FOUND'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle corrupted JSON files', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalRequire = require;
      
      // Mock require to throw JSON parsing error
      (global as any).require = jest.fn(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      const provider = new LocalStorageFeatureProvider('./corrupted.json');
      
      expect(provider.data).toEqual({});
      expect(provider.isEnabled('anyKey')).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      // Restore
      (global as any).require = originalRequire;
      consoleSpy.mockRestore();
    });

    it('should handle features with malformed date strings', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'malformedDates': {
              key: 'malformedDates',
              value: 'true',
              activeAt: 'invalid-date',
              disabledAt: 'also-invalid-date'
            }
          };
        }
      })();

      // Date.parse returns NaN for invalid dates, which should be handled
      const result = provider.isEnabled('malformedDates');
      expect(typeof result).toBe('boolean');
    });

    it('should handle features with null/undefined date values', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'nullDates': {
              key: 'nullDates',
              value: 'true',
              activeAt: null as any,
              disabledAt: undefined as any
            }
          };
        }
      })();

      const result = provider.isEnabled('nullDates');
      expect(typeof result).toBe('boolean');
    });

    it('should handle features with invalid boolean values', () => {
      const provider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'invalidBoolean': {
              key: 'invalidBoolean',
              value: 'not-a-boolean',
              activeAt: '',
              disabledAt: ''
            }
          };
        }
      })();

      // New behavior: safely returns false for any value that is not "true"
      expect(provider.isEnabled('invalidBoolean')).toBe(false);
    });
  });

  describe('ApiServiceFeatureProvider Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const provider = new ApiServiceFeatureProvider('https://api.test.com', 'test-uuid');
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch feature toggle from API:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle API returning invalid data format', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedAxios.get
        .mockResolvedValueOnce({ data: { value: 'invalid-hash' } }) // collection hash
        .mockResolvedValueOnce({ data: { value: 'not-an-object' } }); // features

      const provider = new ApiServiceFeatureProvider('https://api.test.com', 'test-uuid');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should handle gracefully without crashing
      expect(provider.data).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedAxios.get.mockRejectedValue({
        response: { status: 404, statusText: 'Not Found' }
      });

      const provider = new ApiServiceFeatureProvider('https://api.test.com', 'test-uuid');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle timeout errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

      const provider = new ApiServiceFeatureProvider('https://api.test.com', 'test-uuid');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Decorator Edge Cases', () => {
    beforeEach(() => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should handle methods throwing errors in fallbacks', () => {
      function errorFallback() {
        throw new Error('Fallback error');
      }

      class TestClass {
        @FeatureToggle('disabled', errorFallback)
        method() {
          return 'original';
        }
      }

      const instance = new TestClass();
      
      expect(() => {
        instance.method();
      }).toThrow('Fallback error');
    });

    it('should handle async methods throwing errors', async () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle('enabled')
        async asyncMethod() {
          throw new Error('Async error');
        }
      }

      const instance = new TestClass();
      
      await expect(instance.asyncMethod()).rejects.toThrow('Async error');
    });

    it('should handle circular reference in fallback class', () => {
      class CircularClass {
        constructor() {
          (this as any).self = this;
        }
      }

      @FeatureToggle('disabled', CircularClass)
      class TestClass {
        constructor() {}
      }

      expect(() => {
        new TestClass();
      }).not.toThrow();
    });

    it('should handle fallback class constructor throwing errors', () => {
      class ErrorClass {
        constructor() {
          throw new Error('Constructor error');
        }
      }

      @FeatureToggle('disabled', ErrorClass)
      class TestClass {
        constructor() {}
      }

      expect(() => {
        new TestClass();
      }).toThrow('Constructor error');
    });

    it('should handle deeply nested method calls', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle('enabled')
        level1() {
          return this.level2();
        }

        level2() {
          return this.level3();
        }

        level3() {
          return 'deep result';
        }
      }

      const instance = new TestClass();
      expect(instance.level1()).toBe('deep result');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large number of decorated methods', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle('feature1') method1() { return 1; }
        @FeatureToggle('feature2') method2() { return 2; }
        @FeatureToggle('feature3') method3() { return 3; }
        @FeatureToggle('feature4') method4() { return 4; }
        @FeatureToggle('feature5') method5() { return 5; }
        // ... many more methods would be here in a real test
      }

      const instance = new TestClass();
      
      expect(instance.method1()).toBe(1);
      expect(instance.method5()).toBe(5);
      expect(mockProvider.isEnabled).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid instantiation of decorated classes', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      @FeatureToggle('disabled')
      class TestClass {
        value = Math.random();
      }

      const instances = Array.from({ length: 100 }, () => new TestClass());
      
      expect(instances).toHaveLength(100);
      expect(mockProvider.isEnabled).toHaveBeenCalledTimes(1); // Called once during decoration
    });

    it('should handle very long feature keys', () => {
      const longKey = 'a'.repeat(10000);
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle(longKey)
        method() {
          return 'result';
        }
      }

      const instance = new TestClass();
      expect(instance.method()).toBe('result');
      expect(mockProvider.isEnabled).toHaveBeenCalledWith(longKey);
    });
  });

  describe('Type Safety Edge Cases', () => {
    it('should handle mixed data types in providers', () => {
      const mixedProvider = {
        data: {
          'stringFeature': 'true',
          'booleanFeature': true,
          'numberFeature': 1,
          'objectFeature': { enabled: true },
          'nullFeature': null,
          'undefinedFeature': undefined
        },
        getConfig: jest.fn(),
        isEnabled: (key: string) => {
          const value = mixedProvider.data[key];
          if (value === null || value === undefined) return false;
          return Boolean(value);
        }
      };

      FeatureToggleBase.featureProvider = mixedProvider;

      class TestClass {
        @FeatureToggle('stringFeature') stringMethod() { return 'string'; }
        @FeatureToggle('booleanFeature') booleanMethod() { return 'boolean'; }
        @FeatureToggle('numberFeature') numberMethod() { return 'number'; }
        @FeatureToggle('nullFeature') nullMethod() { return 'null'; }
      }

      const instance = new TestClass();
      
      expect(instance.stringMethod()).toBe('string');
      expect(instance.booleanMethod()).toBe('boolean');
      expect(instance.numberMethod()).toBe('number');
      expect(instance.nullMethod()).toBeUndefined(); // null should be falsy
    });
  });
});