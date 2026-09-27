import axios from 'axios';
import { ApiServiceBooleanProvider } from '../examples/ApiServiceBooleanProvider';
import { ApiServiceFeatureProvider } from '../examples/ApiServiceFeatureProvider';

jest.mock('axios');
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

const HASH = 'http://yaft.test/collectionHash/uuid';
const FEATURES = 'http://yaft.test/features/uuid';

/** Answers the hash and the features the way the backend would, or fails. */
function serve(hash: string, features: unknown | Error): void {
  mockedGet.mockImplementation(async (url: string) => {
    if (url === HASH) return { data: { collectionHash: hash } };
    if (features instanceof Error) throw features;
    return { data: features };
  });
}

const group = (value: string) => ({ toggles: [{ key: 'k', value, activeAt: null, disabledAt: null }] });

/** What both API providers share, as far as these tests need it. */
interface Refreshing {
  getCollectionHash(url: string): Promise<void>;
  isEnabled(key: string): boolean;
}

async function loaded(make: () => Refreshing): Promise<Refreshing> {
  serve('h1', group('true'));
  const provider = make();
  await provider.getCollectionHash(HASH);
  return provider;
}

const providers: Record<string, () => Refreshing> = {
  ApiServiceFeatureProvider: () => new ApiServiceFeatureProvider('http://yaft.test', 'uuid'),
  ApiServiceBooleanProvider: () => new ApiServiceBooleanProvider('http://yaft.test', 'uuid'),
};

describe.each(Object.entries(providers))('%s', (_name, make) => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => {
    mockedGet.mockReset();
    jest.restoreAllMocks();
  });

  // Found in yaft-go's review: a 200 whose body is not a group replaced the
  // data with nothing, silently.
  it.each([null, [], 'x', { error: 'proxy says no' }, { toggles: [null] }, { toggles: [{}] }])(
    'keeps the data when /features sends %j',
    async (body) => {
      const provider = await loaded(make);
      expect(provider.isEnabled('k')).toBe(true);

      serve('h2', body);
      await provider.getCollectionHash(HASH);
      expect(provider.isEnabled('k')).toBe(true);
    }
  );

  // The hash used to be recorded before the group loaded, so one failed
  // fetch stopped every later refresh until the backend changed again.
  it('retries a failed fetch although the hash is unchanged', async () => {
    const provider = await loaded(make);

    serve('h2', new Error('network down'));
    await provider.getCollectionHash(HASH);
    expect(provider.isEnabled('k')).toBe(true);

    serve('h2', group('false'));
    await provider.getCollectionHash(HASH);
    expect(provider.isEnabled('k')).toBe(false);
  });

  it('accepts an empty group', async () => {
    const provider = await loaded(make);
    serve('h2', { toggles: [] });
    await provider.getCollectionHash(HASH);
    expect(provider.isEnabled('k')).toBe(false);
  });
});
