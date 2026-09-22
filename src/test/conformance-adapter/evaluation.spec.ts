import { Feature } from '../../FeatureToggle';
import { evaluate } from '../../evaluate';
import { evaluationCases, title } from './cases';

/**
 * Runs the shared evaluation cases against this port.
 *
 * These are the same cases every YaFT implementation has to pass, so a
 * disagreement here is a disagreement with the spec, not a local test
 * preference. Each case brings its own `now`, which is why the clock is
 * injectable in the first place.
 */
describe('conformance: evaluation', () => {
  const cases = evaluationCases();

  it('loads the suite', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(title(c), () => {
      const now = Date.parse(c.now);
      // A case whose own `now` does not parse would silently evaluate against
      // NaN and pass or fail for the wrong reason.
      expect(Number.isNaN(now)).toBe(false);

      const feature = c.features[c.key] as Feature | null | undefined;
      expect(evaluate(feature, now)).toBe(c.expected);
    });
  }
});
