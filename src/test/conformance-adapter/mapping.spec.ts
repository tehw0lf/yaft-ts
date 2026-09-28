import axios from 'axios';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ApiServiceFeatureProvider } from '../../examples/ApiServiceFeatureProvider';
import { LocalStorageBooleanProvider } from '../../examples/LocalStorageBooleanProvider';
import { normaliseCollection, normaliseFeature, normaliseGroup } from '../../mapping';
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

jest.mock('axios');
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

const API = 'http://yaft.test';
const GROUP = 'uuid';
const HASH = `${API}/collectionHash/${GROUP}`;

/** Answers the hash and the features the way the backend would. */
function serve(hash: string, features: unknown): void {
  mockedGet.mockImplementation(async (url: string) => ({
    data: url === HASH ? { collectionHash: hash } : features,
  }));
}

/**
 * Runs a refresh case (R30) through the real API provider: `held` is served
 * and loaded first, then `response` under a new hash. A body that is not a
 * group fails the second refresh, which the provider logs; the data it leaves
 * behind is what the case asserts.
 */
async function refreshOver(held: Record<string, unknown>, response: unknown): Promise<ApiServiceFeatureProvider> {
  serve('held', { toggles: Object.values(held) });
  const provider = new ApiServiceFeatureProvider(API, GROUP);
  await provider.getCollectionHash(HASH);
  expect(provider.data).toEqual(held);

  serve('response', response);
  await provider.getCollectionHash(HASH);
  return provider;
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

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => {
    mockedGet.mockReset();
    jest.restoreAllMocks();
  });

  for (const c of cases) {
    it(title(c), async () => {
      switch (c.shape) {
        case 'feature':
          if (c.held) {
            if (typeof c.rejected !== 'boolean') unsupported('rejected', String(c.rejected), c.name);
            // R32 is not checked here: getCollectionHash only logs a failed
            // refresh and reports nothing to its caller, so there is no
            // outcome to compare with c.rejected. The data assertions below
            // still run.
            const provider = await refreshOver(c.held, c.response);
            expect(provider.data).toEqual(c.expected);
            if (c.retry) {
              // Same hash: a port that recorded it on the rejected body
              // never fetches again (R30).
              serve('response', c.retry.response);
              await provider.getCollectionHash(HASH);
              expect(provider.data).toEqual(c.retry.expected);
            }
          } else {
            expect(normaliseCollection(c.response)).toEqual(c.expected);
          }
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

describe('normaliseGroup', () => {
  it.each([null, [], 'x', 1, { error: 'proxy says no' }, { toggles: [null] }, { value: [{ Value: 'true' }] }])(
    'refuses %j, which is not a toggle group',
    (response) => {
      expect(normaliseGroup(response)).toBeUndefined();
    }
  );

  it('accepts an empty group, a mixed collection and a single toggle', () => {
    expect(normaliseGroup({ toggles: [] })).toEqual({});
    expect(Object.keys(normaliseGroup({ toggles: [null, { key: 'k', value: 'true' }] }) ?? {})).toEqual(['k']);
    expect(Object.keys(normaliseGroup({ key: 'solo', value: 'true' }) ?? {})).toEqual(['solo']);
  });
});
