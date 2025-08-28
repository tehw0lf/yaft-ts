import { FeatureToggle, FeatureToggleBase, Feature } from '../FeatureToggle';
import { LocalStorageFeatureProvider } from '../examples/LocalStorageFeatureProvider';
import { LocalStorageBooleanProvider } from '../examples/LocalStorageBooleanProvider';

describe('Integration Tests', () => {
  describe('Real-world Usage Scenarios', () => {
    describe('E-commerce Feature Toggles', () => {
      beforeEach(() => {
        // Mock feature configuration for e-commerce scenarios
        const ecommerceFeatures: Record<string, Feature> = {
          'checkout_v2': {
            key: 'checkout_v2',
            value: 'true',
            activeAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            disabledAt: new Date(Date.now() + 86400000).toISOString()  // 1 day from now
          },
          'premium_features': {
            key: 'premium_features',
            value: 'false',
            activeAt: '',
            disabledAt: ''
          },
          'beta_ui': {
            key: 'beta_ui',
            value: 'true',
            activeAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            disabledAt: new Date(Date.now() + 86400000).toISOString()  // 1 day from now
          }
        };

        const provider = new (class extends LocalStorageFeatureProvider {
          constructor() {
            super('');
            this.data = ecommerceFeatures;
          }
        })();

        FeatureToggleBase.featureProvider = provider;
      });

      it('should handle checkout flow feature toggle', () => {
        class LegacyCheckout {
          process(items: string[]) {
            return `Legacy checkout processing ${items.length} items`;
          }
        }

        class NewCheckout {
          process(items: string[]) {
            return `New checkout v2 processing ${items.length} items`;
          }
        }

        @FeatureToggle('checkout_v2', LegacyCheckout)
        class CheckoutService {
          process(items: string[]) {
            return `Enhanced checkout processing ${items.length} items`;
          }
        }

        const checkout = new CheckoutService();
        const result = checkout.process(['item1', 'item2']);
        
        expect(result).toBe('Enhanced checkout processing 2 items');
      });

      it('should handle premium features with method-level toggles', () => {
        function basicRecommendations() {
          return ['Popular item 1', 'Popular item 2'];
        }

        class RecommendationService {
          @FeatureToggle('premium_features', basicRecommendations)
          getPersonalizedRecommendations(userId: string) {
            return [`AI recommendation for ${userId}`, `Premium suggestion for ${userId}`];
          }

          getBasicRecommendations() {
            return ['Basic item 1', 'Basic item 2'];
          }
        }

        const service = new RecommendationService();
        const recommendations = service.getPersonalizedRecommendations('user123');
        
        expect(recommendations).toEqual(['Popular item 1', 'Popular item 2']);
      });

      it('should handle UI feature toggles', () => {
        class StandardUI {
          render() {
            return '<div>Standard UI</div>';
          }
        }

        @FeatureToggle('beta_ui', StandardUI)
        class BetaUI {
          render() {
            return '<div>Beta UI with new features</div>';
          }
        }

        const ui = new BetaUI();
        const rendered = ui.render();
        
        expect(rendered).toBe('<div>Beta UI with new features</div>');
      });
    });

    describe('Microservice Feature Coordination', () => {
      it('should handle multiple services with coordinated feature toggles', () => {
        const serviceFeatures = {
          'service_a_feature': true,
          'service_b_feature': false,
          'shared_feature': true
        };

        const provider = new (class extends LocalStorageBooleanProvider {
          constructor() {
            super('');
            this.data = serviceFeatures;
          }
        })();

        FeatureToggleBase.featureProvider = provider;

        class ServiceA {
          @FeatureToggle('service_a_feature')
          processData(data: any) {
            return `ServiceA: Enhanced processing of ${JSON.stringify(data)}`;
          }

          @FeatureToggle('shared_feature')
          sharedFunction() {
            return 'ServiceA: Shared feature active';
          }
        }

        class ServiceB {
          @FeatureToggle('service_b_feature')
          transformData(data: any) {
            return `ServiceB: New transformation of ${JSON.stringify(data)}`;
          }

          @FeatureToggle('shared_feature')
          sharedFunction() {
            return 'ServiceB: Shared feature active';
          }
        }

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();

        expect(serviceA.processData({ test: true })).toBe('ServiceA: Enhanced processing of {"test":true}');
        expect(serviceB.transformData({ test: true })).toBeUndefined(); // Feature disabled
        expect(serviceA.sharedFunction()).toBe('ServiceA: Shared feature active');
        expect(serviceB.sharedFunction()).toBe('ServiceB: Shared feature active');
      });
    });

    describe('A/B Testing Scenarios', () => {
      it('should support A/B testing with multiple variants', () => {
        // This test demonstrates A/B testing where the feature evaluation
        // happens at class definition time, not method call time
        
        function variantA() {
          return 'Algorithm A result';
        }

        function variantB() {
          return 'Algorithm B result';
        }

        const abTestFeatures = {
          'algorithm_variant_a': false,
          'algorithm_variant_b': true
        };

        const provider = new (class extends LocalStorageBooleanProvider {
          constructor() {
            super('');
            this.data = abTestFeatures;
          }
        })();

        // Set provider BEFORE defining the class (critical for decorator evaluation)
        FeatureToggleBase.featureProvider = provider;

        // Define class with enabled variant
        class AlgorithmB {
          @FeatureToggle('algorithm_variant_b', variantB)
          calculate(input: number) {
            return 'Default algorithm result';
          }
        }

        // Define class with disabled variant  
        class AlgorithmA {
          @FeatureToggle('algorithm_variant_a', variantA)
          calculate(input: number) {
            return 'Default algorithm result';
          }
        }

        const algorithmB = new AlgorithmB();
        const algorithmA = new AlgorithmA();
        
        const resultB = algorithmB.calculate(42);
        const resultA = algorithmA.calculate(42);
        
        // Enabled variant should use original method (returns "Default algorithm result")
        // Disabled variant should use fallback method
        expect(resultB).toBe('Default algorithm result'); // enabled, uses original
        expect(resultA).toBe('Algorithm A result'); // disabled, uses fallback
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency feature toggle evaluations', () => {
      const provider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = { 'myToggle': true };
        }
      })();
      FeatureToggleBase.featureProvider = provider;

      class HighFrequencyService {
        @FeatureToggle('myToggle')
        processItem(item: any) {
          return `Processed: ${item}`;
        }
      }

      const service = new HighFrequencyService();
      const items = Array.from({ length: 1000 }, (_, i) => `item${i}`);
      
      const start = performance.now();
      const results = items.map(item => service.processItem(item));
      const end = performance.now();

      expect(results).toHaveLength(1000);
      expect(results[0]).toBe('Processed: item0');
      expect(results[999]).toBe('Processed: item999');
      
      // Performance check - should complete within reasonable time
      expect(end - start).toBeLessThan(100); // 100ms for 1000 operations
    });

    it('should handle concurrent access to feature toggles', async () => {
      const provider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = { 'myToggle': true };
        }
      })();
      FeatureToggleBase.featureProvider = provider;

      class ConcurrentService {
        @FeatureToggle('myToggle')
        async asyncProcess(id: number) {
          await new Promise(resolve => setTimeout(resolve, 1));
          return `Async result ${id}`;
        }
      }

      const service = new ConcurrentService();
      const promises = Array.from({ length: 50 }, (_, i) => service.asyncProcess(i));
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(50);
      expect(results[0]).toBe('Async result 0');
      expect(results[49]).toBe('Async result 49');
    });
  });

  describe('Cross-Provider Compatibility', () => {
    it('should work consistently across different provider types', () => {
      // Test with Feature provider using mock data that enables myMethodToggle
      const featureProvider = new (class extends LocalStorageFeatureProvider {
        constructor() {
          super('');
          this.data = {
            'myMethodToggle': {
              key: 'myMethodToggle',
              value: 'true',
              activeAt: new Date(Date.now() - 86400000).toISOString(),
              disabledAt: new Date(Date.now() + 86400000).toISOString()
            }
          };
        }
      })();
      FeatureToggleBase.featureProvider = featureProvider;

      class TestService {
        @FeatureToggle('myMethodToggle')
        testMethod() {
          return 'feature provider result';
        }
      }

      let service = new TestService();
      let result = service.testMethod();
      expect(result).toBe('feature provider result');

      // Switch to Boolean provider
      const booleanProvider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = { 'myToggle': true };
        }
      })();
      FeatureToggleBase.featureProvider = booleanProvider;

      // Create new class instance to trigger re-evaluation
      class TestService2 {
        @FeatureToggle('myToggle')
        testMethod() {
          return 'boolean provider result';
        }
      }

      service = new TestService2();
      result = service.testMethod();
      expect(result).toBe('boolean provider result');
    });
  });

  describe('Real-world Integration Patterns', () => {
    it('should support factory pattern with feature toggles', () => {
      const factoryFeatures = {
        'use_redis_cache': true,
        'use_memory_cache': false
      };

      const provider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = factoryFeatures;
        }
      })();

      FeatureToggleBase.featureProvider = provider;

      class MemoryCache {
        get(key: string) { return `memory:${key}`; }
      }

      class RedisCache {
        get(key: string) { return `redis:${key}`; }
      }

      class CacheFactory {
        @FeatureToggle('use_redis_cache', () => new MemoryCache())
        createCache() {
          return new RedisCache();
        }
      }

      const factory = new CacheFactory();
      const cache = factory.createCache();
      
      expect(cache).toBeInstanceOf(RedisCache);
      expect(cache.get('test')).toBe('redis:test');
    });

    it('should support middleware pattern with feature toggles', () => {
      const middlewareFeatures = {
        'auth_middleware': true,
        'logging_middleware': false,
        'rate_limit_middleware': true
      };

      const provider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = middlewareFeatures;
        }
      })();

      FeatureToggleBase.featureProvider = provider;

      class RequestProcessor {
        private logs: string[] = [];

        @FeatureToggle('auth_middleware')
        authenticate(request: any) {
          this.logs.push('auth executed');
          return { ...request, authenticated: true };
        }

        @FeatureToggle('logging_middleware')
        log(request: any) {
          this.logs.push('logging executed');
          return request;
        }

        @FeatureToggle('rate_limit_middleware')
        rateLimit(request: any) {
          this.logs.push('rate limit executed');
          return request;
        }

        process(request: any) {
          let processedRequest = request;
          processedRequest = this.authenticate(processedRequest) || processedRequest;
          processedRequest = this.log(processedRequest) || processedRequest;
          processedRequest = this.rateLimit(processedRequest) || processedRequest;
          return processedRequest;
        }

        getLogs() { return this.logs; }
      }

      const processor = new RequestProcessor();
      const result = processor.process({ id: 1 });

      expect(result.authenticated).toBe(true);
      expect(processor.getLogs()).toEqual(['auth executed', 'rate limit executed']);
    });

    it('should support plugin architecture with feature toggles', () => {
      const pluginFeatures = {
        'analytics_plugin': false,
        'social_sharing_plugin': true,
        'comments_plugin': true
      };

      const provider = new (class extends LocalStorageBooleanProvider {
        constructor() {
          super('');
          this.data = pluginFeatures;
        }
      })();

      FeatureToggleBase.featureProvider = provider;

      class PluginManager {
        private activePlugins: string[] = [];

        @FeatureToggle('analytics_plugin')
        loadAnalytics() {
          this.activePlugins.push('analytics');
        }

        @FeatureToggle('social_sharing_plugin')
        loadSocialSharing() {
          this.activePlugins.push('social-sharing');
        }

        @FeatureToggle('comments_plugin')
        loadComments() {
          this.activePlugins.push('comments');
        }

        initialize() {
          this.loadAnalytics();
          this.loadSocialSharing();
          this.loadComments();
          return this.activePlugins;
        }
      }

      const manager = new PluginManager();
      const activePlugins = manager.initialize();

      expect(activePlugins).toEqual(['social-sharing', 'comments']);
    });
  });
});