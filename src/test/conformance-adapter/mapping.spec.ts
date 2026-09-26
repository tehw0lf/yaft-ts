import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorageBooleanProvider } from '../../examples/LocalStorageBooleanProvider';
import { normaliseCollection, normaliseFeature } from '../../mapping';
import { mappingCases, title, unsupported } from './cases';

/**
 * The boolean-shape provider reads a JSON file, so each case's response is
 * written to one first. Asking the provider -- rather than comparing the
 * response with itself -- is what checks that a missing key is off (R21).
 */
function booleanProvider(response: unknown): LocalStorageBooleanProvider {
  const dir = mkdtempSync(join(tmpdir(), 'yaft-conformance-'));
  try {
    const file = join(dir, 'boolean.json');
    writeFileSync(file, JSON.stringify(response));
    return new LocalStorageBooleanProvider(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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

        case 'boolean': {
          const provider = booleanProvider(c.response);
          expect(provider.data).toEqual(c.expected);
          if (!c.isEnabled) throw new Error(`Case "${c.name}" has no isEnabled probes`);
          for (const [key, enabled] of Object.entries(c.isEnabled)) {
            expect({ key, enabled: provider.isEnabled(key) }).toEqual({ key, enabled });
          }
          break;
        }

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

  it('drops a tag that is not a string', () => {
    // `Feature.tags` is typed string[]; asserting rather than filtering would
    // hand a caller a number through a field that promises a string.
    expect(
      normaliseFeature({ key: 'f', value: 'true', tags: ['ok', 42, null, 'fine'] })
        .tags
    ).toEqual(['ok', 'fine']);
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
