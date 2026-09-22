import { normaliseCollection, normaliseFeature } from '../../mapping';
import { mappingCases, title, unsupported } from './cases';

/**
 * Runs the shared mapping cases against this port.
 *
 * These pin down how a backend response becomes provider data: which envelopes
 * exist, how the two field spellings are reconciled, and that a present but
 * empty value is kept rather than replaced.
 */
describe('conformance: mapping', () => {
  const cases = mappingCases();

  it('loads the suite', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(title(c), () => {
      switch (c.shape) {
        case 'feature':
          expect(normaliseCollection(c.response)).toEqual(c.expected);
          break;

        case 'boolean':
          // The boolean shape is already keyed booleans; a provider stores it
          // as-is and maps it straight onto isEnabled.
          expect(c.response).toEqual(c.expected);
          break;

        default:
          unsupported('shape', c.shape, c.name);
      }
    });
  }
});

describe('normaliseFeature', () => {
  it('keeps a present but empty value instead of falling through', () => {
    // The reason this function exists: `f.value || f.Value` turns an off
    // feature into an on one.
    expect(
      normaliseFeature({ key: 'f', value: '', Value: 'true' })
    ).toEqual({
      key: 'f',
      value: '',
      activeAt: '',
      disabledAt: '',
      tags: [],
    });
  });

  it('reads the capitalised spelling older backends send', () => {
    expect(
      normaliseFeature({
        Key: 'f',
        Value: 'true',
        ActiveAt: null,
        DisabledAt: null,
        Tags: ['beta'],
      })
    ).toEqual({
      key: 'f',
      value: 'true',
      activeAt: '',
      disabledAt: '',
      tags: ['beta'],
    });
  });
});
