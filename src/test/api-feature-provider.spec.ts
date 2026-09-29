import axios from 'axios';
import { ApiServiceBooleanProvider } from '../examples/ApiServiceBooleanProvider';
import { ApiServiceFeatureProvider } from '../examples/ApiServiceFeatureProvider';

jest.mock('axios');
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

const HASH = 'http://yaft.test/collectionHash/uuid';
const FEATURES = 'http://yaft.test/features/uuid';

/**
 * Answers the hash and the features the way the backend would, or fails. A
 * hash that is not a string is served as the whole /collectionHash body.
 */
function serve(hash: string | unknown, features: unknown | Error): void {
  mockedGet.mockImplementation(async (url: string) => {
    if (url === HASH) return { data: typeof hash === 'string' ? { collectionHash: hash } : hash };
    if (features instanceof Error) throw features;
    return { data: features };
  });
}

const group = (value: string) => ({ toggles: [{ key: 'k', value, activeAt: null, disabledAt: null }] });

/** What both API providers share, as far as these tests need it. */
interface Refreshing {
  getCollectionHash(url: string): Promise<void>;
  refresh(): Promise<boolean>;
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

  // R32: a caller that asks can tell a failing refresh from a working one.
  describe('refresh', () => {
    it('reports new data, then no change', async () => {
      const provider = await loaded(make);
      serve('h2', group('false'));
      await expect(provider.refresh()).resolves.toBe(true);
      expect(provider.isEnabled('k')).toBe(false);
      await expect(provider.refresh()).resolves.toBe(false);
    });

    it.each([null, [], { error: 'proxy says no' }, { toggles: [null] }])(
      'rejects when /features sends %j, and keeps the data',
      async (body) => {
        const provider = await loaded(make);
        serve('h2', body);
        await expect(provider.refresh()).rejects.toThrow('not a toggle group');
        expect(provider.isEnabled('k')).toBe(true);
      }
    );

    it('rejects when the backend cannot be reached', async () => {
      const provider = await loaded(make);
      serve('h2', new Error('network down'));
      await expect(provider.refresh()).rejects.toThrow('network down');
      expect(provider.isEnabled('k')).toBe(true);
    });

    // Reading the hash unchecked recorded `undefined`, which then matched
    // every later answer without one: refreshing stopped, silently.
    it.each([null, 42, { error: 'proxy says no' }, { collectionHash: '' }])(
      'rejects when /collectionHash sends %j',
      async (body) => {
        const provider = await loaded(make);
        serve(body, group('false'));
        await expect(provider.refresh()).rejects.toThrow('sent no collectionHash');
        expect(provider.isEnabled('k')).toBe(true);
      }
    );

    it('is retried after a failure although the hash is unchanged', async () => {
      const provider = await loaded(make);
      serve('h2', { error: 'proxy says no' });
      await expect(provider.refresh()).rejects.toThrow();
      serve('h2', group('false'));
      await expect(provider.refresh()).resolves.toBe(true);
      expect(provider.isEnabled('k')).toBe(false);
    });
  });

  // Found by CodeRabbit on #29: the constructor's refresh is not awaited, so a
  // refresh() right after it ran alongside and could be overwritten by it.
  it('runs refreshes one after another', async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => (release = resolve));
    let hash = 'h1';
    mockedGet.mockImplementation(async (url: string) => {
      if (url === HASH) return { data: { collectionHash: hash } };
      if (hash === 'h1') {
        await slow;
        return { data: group('true') };
      }
      return { data: group('false') };
    });

    const provider = make(); // starts loading h1, held up in /features
    await Promise.resolve();
    hash = 'h2';
    const newer = provider.refresh();
    release();

    await expect(newer).resolves.toBe(true);
    expect(provider.isEnabled('k')).toBe(false);
    await expect(provider.refresh()).resolves.toBe(false);
  });

  it('getCollectionHash logs a failure instead of rejecting', async () => {
    const provider = await loaded(make);
    serve('h2', { error: 'proxy says no' });
    await expect(provider.getCollectionHash(HASH)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    expect(provider.isEnabled('k')).toBe(true);
  });

  it('accepts an empty group', async () => {
    const provider = await loaded(make);
    serve('h2', { toggles: [] });
    await provider.getCollectionHash(HASH);
    expect(provider.isEnabled('k')).toBe(false);
  });
});
