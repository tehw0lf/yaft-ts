import axios from 'axios';
import { ApiServiceBooleanProvider } from '../examples/ApiServiceBooleanProvider';

jest.mock('axios');
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

/**
 * Serves a collection hash, then `features` for the group -- the two calls the
 * provider makes on construction.
 */
function serve(features: unknown): void {
  mockedGet.mockImplementation(async (url: string) =>
    url.includes('/collectionHash/')
      ? { data: { collectionHash: 'h1' } }
      : { data: features }
  );
}

async function provider(features: unknown): Promise<ApiServiceBooleanProvider> {
  serve(features);
  const p = new ApiServiceBooleanProvider('http://yaft.test', 'uuid');
  await p.getCollectionHash('http://yaft.test/collectionHash/uuid');
  return p;
}

describe('ApiServiceBooleanProvider', () => {
  afterEach(() => mockedGet.mockReset());

  it('keeps booleans and drops everything else (R29)', async () => {
    const p = await provider({ on: true, off: false, text: 'false', one: 1, nul: null });

    expect(p.data).toEqual({ on: true, off: false });
    expect(p.isEnabled('on')).toBe(true);
    expect(p.isEnabled('off')).toBe(false);
    // A non-empty string is truthy; returning it would switch this on.
    expect(p.isEnabled('text')).toBe(false);
    expect(p.isEnabled('one')).toBe(false);
    expect(p.isEnabled('missing')).toBe(false);
  });

  it('reads a feature-shaped response by its value', async () => {
    const p = await provider({
      toggles: [
        { key: 'uuid|a', value: 'true', activeAt: null, disabledAt: null },
        { key: 'uuid|b', value: 'false', activeAt: null, disabledAt: null },
      ],
    });

    expect(p.data).toEqual({ 'uuid|a': true, 'uuid|b': false });
  });

  it('reads a single flat feature, which carries no boolean', async () => {
    const p = await provider({ key: 'uuid|a', value: 'true', activeAt: null, disabledAt: null });

    expect(p.data).toEqual({ 'uuid|a': true });
  });
});
