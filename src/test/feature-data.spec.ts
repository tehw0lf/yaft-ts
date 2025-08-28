import { Feature } from '../FeatureToggle';

describe('Feature Data Type', () => {
  describe('Feature structure validation', () => {
    it('should accept valid Feature objects', () => {
      const validFeature: Feature = {
        key: 'testFeature',
        value: 'true',
        activeAt: '2023-01-01T00:00:00Z',
        disabledAt: '2023-12-31T23:59:59Z'
      };

      expect(validFeature.key).toBe('testFeature');
      expect(validFeature.value).toBe('true');
      expect(validFeature.activeAt).toBe('2023-01-01T00:00:00Z');
      expect(validFeature.disabledAt).toBe('2023-12-31T23:59:59Z');
    });

    it('should accept Feature with empty date strings', () => {
      const featureWithEmptyDates: Feature = {
        key: 'testFeature',
        value: 'false',
        activeAt: '',
        disabledAt: ''
      };

      expect(featureWithEmptyDates.activeAt).toBe('');
      expect(featureWithEmptyDates.disabledAt).toBe('');
    });

    it('should accept boolean-like string values', () => {
      const trueBooleanFeature: Feature = {
        key: 'trueFeature',
        value: 'true',
        activeAt: '',
        disabledAt: ''
      };

      const falseBooleanFeature: Feature = {
        key: 'falseFeature', 
        value: 'false',
        activeAt: '',
        disabledAt: ''
      };

      expect(JSON.parse(trueBooleanFeature.value)).toBe(true);
      expect(JSON.parse(falseBooleanFeature.value)).toBe(false);
    });

    it('should handle various date formats', () => {
      const isoDateFeature: Feature = {
        key: 'isoFeature',
        value: 'true',
        activeAt: '2023-01-01T00:00:00.000Z',
        disabledAt: '2023-12-31T23:59:59.999Z'
      };

      const simpleDateFeature: Feature = {
        key: 'simpleFeature',
        value: 'true', 
        activeAt: '2023-01-01',
        disabledAt: '2023-12-31'
      };

      expect(Date.parse(isoDateFeature.activeAt)).not.toBeNaN();
      expect(Date.parse(isoDateFeature.disabledAt)).not.toBeNaN();
      expect(Date.parse(simpleDateFeature.activeAt)).not.toBeNaN();
      expect(Date.parse(simpleDateFeature.disabledAt)).not.toBeNaN();
    });
  });

  describe('Feature collection structures', () => {
    it('should handle Record<string, Feature> collections', () => {
      const featureCollection: Record<string, Feature> = {
        'feature1': {
          key: 'feature1',
          value: 'true',
          activeAt: '',
          disabledAt: ''
        },
        'feature2': {
          key: 'feature2',
          value: 'false',
          activeAt: '2023-01-01',
          disabledAt: '2023-12-31'
        }
      };

      expect(Object.keys(featureCollection)).toHaveLength(2);
      expect(featureCollection['feature1']).toBeDefined();
      expect(featureCollection['feature2']).toBeDefined();
      expect(featureCollection['nonexistent']).toBeUndefined();
    });

    it('should handle empty feature collections', () => {
      const emptyCollection: Record<string, Feature> = {};

      expect(Object.keys(emptyCollection)).toHaveLength(0);
      expect(emptyCollection['anyKey']).toBeUndefined();
    });
  });
});