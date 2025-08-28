import { FeatureToggle, FeatureToggleBase, FeatureProvider } from '../FeatureToggle';

describe('FeatureToggle Decorator Behavior', () => {
  let mockProvider: FeatureProvider<boolean>;

  beforeEach(() => {
    mockProvider = {
      data: {},
      getConfig: jest.fn(),
      isEnabled: jest.fn()
    };
    FeatureToggleBase.featureProvider = mockProvider;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Method Decoration', () => {
    it('should execute original method when feature is enabled', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);
      let executionResult = '';

      class TestClass {
        @FeatureToggle('enabledFeature')
        testMethod() {
          executionResult = 'original method executed';
          return 'original result';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(executionResult).toBe('original method executed');
      expect(result).toBe('original result');
      expect(mockProvider.isEnabled).toHaveBeenCalledWith('enabledFeature');
    });

    it('should execute fallback method when feature is disabled', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);
      let executionResult = '';

      function fallbackMethod() {
        executionResult = 'fallback method executed';
        return 'fallback result';
      }

      class TestClass {
        @FeatureToggle('disabledFeature', fallbackMethod)
        testMethod() {
          executionResult = 'original method executed';
          return 'original result';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(executionResult).toBe('fallback method executed');
      expect(result).toBe('fallback result');
      expect(mockProvider.isEnabled).toHaveBeenCalledWith('disabledFeature');
    });

    it('should execute empty function when feature is disabled and no fallback provided', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);
      let executionResult = '';

      class TestClass {
        @FeatureToggle('disabledFeature')
        testMethod() {
          executionResult = 'original method executed';
          return 'original result';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(executionResult).toBe('');
      expect(result).toBeUndefined();
    });

    it('should preserve method context (this binding)', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        value = 'test value';

        @FeatureToggle('enabledFeature')
        getValue() {
          return this.value;
        }
      }

      const instance = new TestClass();
      const result = instance.getValue();

      expect(result).toBe('test value');
    });

    it('should handle method arguments correctly', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle('enabledFeature')
        add(a: number, b: number) {
          return a + b;
        }
      }

      const instance = new TestClass();
      const result = instance.add(5, 3);

      expect(result).toBe(8);
    });

    it('should handle async methods', async () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      class TestClass {
        @FeatureToggle('enabledFeature')
        async asyncMethod() {
          return Promise.resolve('async result');
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod();

      expect(result).toBe('async result');
    });

    it('should handle async fallback methods', async () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      async function asyncFallback() {
        return Promise.resolve('async fallback result');
      }

      class TestClass {
        @FeatureToggle('disabledFeature', asyncFallback)
        async asyncMethod() {
          return Promise.resolve('async original result');
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod();

      expect(result).toBe('async fallback result');
    });
  });

  describe('Class Decoration', () => {
    it('should use original class when feature is enabled', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(true);

      @FeatureToggle('enabledFeature')
      class TestClass {
        value = 'original class';
        
        getValue() {
          return this.value;
        }
      }

      const instance = new TestClass();
      expect(instance.getValue()).toBe('original class');
      expect(instance instanceof TestClass).toBe(true);
    });

    it('should use fallback class when feature is disabled', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      class FallbackClass {
        value = 'fallback class';
        
        getValue() {
          return this.value;
        }
      }

      @FeatureToggle('disabledFeature', FallbackClass)
      class TestClass {
        value = 'original class';
        
        getValue() {
          return this.value;
        }
      }

      const instance = new TestClass();
      expect(instance.getValue()).toBe('fallback class');
    });

    it('should use EmptyClass when feature is disabled and no fallback provided', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      @FeatureToggle('disabledFeature')
      class TestClass {
        value = 'original class';
        
        getValue() {
          return this.value;
        }

        async getAsyncValue() {
          return Promise.resolve(this.value);
        }
      }

      const instance = new TestClass();
      
      // Should have empty methods
      expect(instance.getValue()).toBeUndefined();
      
      // Should handle async methods
      expect(instance.getAsyncValue()).toBeInstanceOf(Promise);
    });

    it('should preserve constructor arguments in fallback class', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      class FallbackClass {
        constructor(public name: string, public age: number) {}
        
        getInfo() {
          return `${this.name} is ${this.age}`;
        }
      }

      @FeatureToggle('disabledFeature', FallbackClass)
      class TestClass {
        constructor(public name: string, public age: number) {}
        
        getInfo() {
          return `Original: ${this.name} is ${this.age}`;
        }
      }

      const instance = new TestClass('John', 30);
      expect(instance.getInfo()).toBe('John is 30');
    });

    it('should handle inheritance in fallback classes', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      class BaseClass {
        baseMethod() {
          return 'base method';
        }
      }

      class FallbackClass extends BaseClass {
        fallbackMethod() {
          return 'fallback method';
        }
      }

      @FeatureToggle('disabledFeature', FallbackClass)
      class TestClass {
        originalMethod() {
          return 'original method';
        }
      }

      const instance = new TestClass();
      expect((instance as any).baseMethod()).toBe('base method');
      expect((instance as any).fallbackMethod()).toBe('fallback method');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should throw error when FeatureToggleProvider is not set', () => {
      FeatureToggleBase.featureProvider = null as any;

      expect(() => {
        class TestClass {
          @FeatureToggle('anyFeature')
          testMethod() {}
        }
      }).toThrow('FeatureToggleProvider not set');
    });

    it('should handle provider throwing errors gracefully', () => {
      (mockProvider.isEnabled as jest.Mock).mockImplementation(() => {
        throw new Error('Provider error');
      });

      expect(() => {
        class TestClass {
          @FeatureToggle('errorFeature')
          testMethod() {}
        }
      }).toThrow('Provider error');
    });

    it('should handle undefined/null feature keys', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      class TestClass {
        @FeatureToggle(undefined as any)
        testMethod() {
          return 'should not execute';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();
      
      expect(result).toBeUndefined();
      expect(mockProvider.isEnabled).toHaveBeenCalledWith(undefined);
    });

    it('should handle empty string feature keys', () => {
      (mockProvider.isEnabled as jest.Mock).mockReturnValue(false);

      class TestClass {
        @FeatureToggle('')
        testMethod() {
          return 'should not execute';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();
      
      expect(result).toBeUndefined();
      expect(mockProvider.isEnabled).toHaveBeenCalledWith('');
    });
  });

  describe('Multiple Decorators on Same Class/Method', () => {
    it('should handle multiple method decorators', () => {
      (mockProvider.isEnabled as jest.Mock)
        .mockReturnValueOnce(true)  // First feature enabled
        .mockReturnValueOnce(false); // Second feature disabled

      function fallback() {
        return 'fallback executed';
      }

      class TestClass {
        @FeatureToggle('feature1')
        @FeatureToggle('feature2', fallback)
        testMethod() {
          return 'original executed';
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      // The behavior depends on decorator execution order
      expect(mockProvider.isEnabled).toHaveBeenCalledTimes(2);
    });
  });
});