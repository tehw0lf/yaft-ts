import {
  FeatureProvider,
  FeatureToggle,
  FeatureToggleBase,
} from '../../FeatureToggle';
import { DecoratorCase, decoratorCases, title, unsupported } from './cases';

/**
 * Runs the shared decorator cases against this port.
 *
 * Unlike the evaluation cases these are not input/output pairs -- "the
 * fallback receives the same receiver" cannot be expressed as JSON. Each case
 * names a scenario and an outcome in port-neutral terms, and this file maps
 * those onto TypeScript decorators.
 *
 * The mapping is deliberately explicit: an unknown `target`, `toggle` or
 * `expected` throws rather than being skipped, because a silently skipped case
 * is a rule nothing enforces.
 */

const KEY = 'conformanceToggle';

/** A provider whose answer can be changed between decoration and call. */
class SwitchableProvider implements FeatureProvider<boolean> {
  data: Record<string, boolean> = {};
  constructor(private enabled: boolean) {}
  getConfig(): void {
    /* nothing to load */
  }
  isEnabled(): boolean {
    return this.enabled;
  }
  set(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Installs a provider and returns it, or clears the provider entirely for the
 * `no-provider` case.
 *
 * `toggle` also encodes when the value changes: `on-then-off` is on while the
 * class or method is decorated and off by the time it is used, which is what
 * separates "evaluated once" from "evaluated per call".
 */
function setUp(toggle: DecoratorCase['toggle'], caseName: string) {
  switch (toggle) {
    case 'on':
    case 'on-then-off':
      return install(true);
    case 'off':
    case 'off-then-on':
      return install(false);
    case 'no-provider':
      // The abstract base holds the provider statically; clearing it is how a
      // misconfigured application looks.
      (FeatureToggleBase as { featureProvider?: unknown }).featureProvider =
        undefined;
      return undefined;
    default:
      return unsupported('toggle', toggle, caseName);
  }
}

function install(enabled: boolean): SwitchableProvider {
  const provider = new SwitchableProvider(enabled);
  FeatureToggleBase.featureProvider = provider;
  return provider;
}

/** Applies the flip that `on-then-off` / `off-then-on` describe. */
function flipIfTwoPhase(
  toggle: DecoratorCase['toggle'],
  provider: SwitchableProvider | undefined
): void {
  if (toggle === 'on-then-off') provider?.set(false);
  if (toggle === 'off-then-on') provider?.set(true);
}

const ORIGINAL = 'original';
const FALLBACK = 'fallback';

describe('conformance: decorator', () => {
  const cases = decoratorCases();
  let savedProvider: FeatureProvider<unknown>;

  beforeAll(() => {
    savedProvider = FeatureToggleBase.featureProvider;
  });

  afterEach(() => {
    FeatureToggleBase.featureProvider = savedProvider;
  });

  it('loads the suite', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(title(c), async () => {
      switch (c.target) {
        case 'method':
          await runMethodCase(c);
          break;
        case 'async-method':
          await runAsyncMethodCase(c);
          break;
        case 'class':
          runClassCase(c);
          break;
        default:
          unsupported('target', c.target, c.name);
      }
    });
  }
});

async function runMethodCase(c: DecoratorCase): Promise<void> {
  if (c.toggle === 'no-provider') {
    expectDecorationError(c);
    return;
  }

  const provider = setUp(c.toggle, c.name) as SwitchableProvider;

  // Recorded by whichever implementation runs, so the assertions can tell them
  // apart and check what the fallback was handed.
  let ran = '';
  let sawArgs: unknown[] = [];
  let sawThis: unknown;

  function fallbackMethod(this: unknown, ...args: unknown[]) {
    ran = FALLBACK;
    sawArgs = args;
    sawThis = this;
    return FALLBACK;
  }

  const fallback = c.fallback === 'method' ? fallbackMethod : undefined;
  if (c.fallback === 'class') {
    unsupported('fallback', 'class on a method target', c.name);
  }

  class Subject {
    marker = 'subject';

    @FeatureToggle(KEY, fallback)
    run(..._args: unknown[]) {
      ran = ORIGINAL;
      return ORIGINAL;
    }
  }

  flipIfTwoPhase(c.toggle, provider);

  const instance = new Subject();
  const result = instance.run('a', 1);

  switch (c.expected) {
    case 'original':
      expect(ran).toBe(ORIGINAL);
      expect(result).toBe(ORIGINAL);
      break;

    case 'fallback':
      expect(ran).toBe(FALLBACK);
      expect(result).toBe(FALLBACK);
      break;

    case 'nothing':
      // The language's empty result; in TypeScript that is undefined.
      expect(ran).toBe('');
      expect(result).toBeUndefined();
      break;

    default:
      unsupported('expected', c.expected, c.name);
  }

  for (const assertion of c.assertions ?? []) {
    switch (assertion) {
      case 'same-arguments':
        expect(sawArgs).toEqual(['a', 1]);
        break;
      case 'same-receiver':
        expect(sawThis).toBe(instance);
        break;
      default:
        unsupported('assertion', assertion, c.name);
    }
  }
}

async function runAsyncMethodCase(c: DecoratorCase): Promise<void> {
  if (c.toggle === 'no-provider') {
    expectDecorationError(c);
    return;
  }

  const provider = setUp(c.toggle, c.name) as SwitchableProvider;
  let ran = '';

  class Subject {
    @FeatureToggle(KEY)
    async run() {
      ran = ORIGINAL;
      return ORIGINAL;
    }
  }

  flipIfTwoPhase(c.toggle, provider);

  const result = new Subject().run();

  switch (c.expected) {
    case 'original':
      await expect(result).resolves.toBe(ORIGINAL);
      expect(ran).toBe(ORIGINAL);
      break;

    case 'resolved-nothing':
      // An await at the call site must not break, so the empty result has to
      // be an already-resolved promise rather than a null value.
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
      expect(ran).toBe('');
      break;

    default:
      unsupported('expected', c.expected, c.name);
  }
}

function runClassCase(c: DecoratorCase): void {
  if (c.toggle === 'no-provider') {
    expectDecorationError(c);
    return;
  }

  const provider = setUp(c.toggle, c.name) as SwitchableProvider;

  class FallbackClass {
    which() {
      return FALLBACK;
    }
  }

  const fallback = c.fallback === 'class' ? FallbackClass : undefined;
  if (c.fallback === 'method') {
    unsupported('fallback', 'method on a class target', c.name);
  }

  @FeatureToggle(KEY, fallback)
  class Subject {
    which() {
      return ORIGINAL;
    }
  }

  // A class is decided at decoration time, so this flip must have no effect --
  // that is exactly what the two-phase cases check.
  flipIfTwoPhase(c.toggle, provider);

  const instance = new (Subject as unknown as new () => { which(): unknown })();

  switch (c.expected) {
    case 'original':
      expect(instance.which()).toBe(ORIGINAL);
      break;

    case 'fallback':
      expect(instance.which()).toBe(FALLBACK);
      break;

    case 'empty-shell':
      // The shell still answers every method of the original, each returning
      // nothing, so calling into a disabled class does not throw.
      expect(instance.which()).toBeUndefined();
      break;

    default:
      unsupported('expected', c.expected, c.name);
  }
}

/**
 * Cases the shared suite does not cover yet.
 *
 * R18 says an async method switched off must still return a promise, but the
 * suite only states that for the no-fallback path. A synchronous fallback on
 * an async method has the same problem -- the signature promises a promise and
 * the caller gets a plain value -- so it is pinned down here until the suite
 * grows a case for it.
 */
describe('async fallback keeps the promise contract', () => {
  let saved: FeatureProvider<unknown>;

  beforeAll(() => {
    saved = FeatureToggleBase.featureProvider;
  });
  afterAll(() => {
    FeatureToggleBase.featureProvider = saved;
  });

  it('wraps a synchronous fallback for an async method', async () => {
    install(false);

    function syncFallback() {
      return FALLBACK;
    }

    class Subject {
      @FeatureToggle(KEY, syncFallback)
      async run() {
        return ORIGINAL;
      }
    }

    const result = new Subject().run();

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(FALLBACK);
  });

  it('passes an async fallback through without double-wrapping', async () => {
    install(false);

    async function asyncFallback() {
      return FALLBACK;
    }

    class Subject {
      @FeatureToggle(KEY, asyncFallback)
      async run() {
        return ORIGINAL;
      }
    }

    await expect(new Subject().run()).resolves.toBe(FALLBACK);
  });

  it('leaves the fallback of a synchronous method untouched', () => {
    install(false);

    function syncFallback() {
      return FALLBACK;
    }

    class Subject {
      @FeatureToggle(KEY, syncFallback)
      run() {
        return ORIGINAL;
      }
    }

    // Not a promise: wrapping here would change the contract of every
    // synchronous fallback.
    expect(new Subject().run()).toBe(FALLBACK);
  });
});

/**
 * The provider is missing, so decorating itself must fail.
 *
 * Deferring the error to the first call would turn a startup misconfiguration
 * into a surprise in whichever code path happens to run first.
 */
function expectDecorationError(c: DecoratorCase): void {
  setUp('no-provider', c.name);

  if (c.expected !== 'decoration-error') {
    unsupported('expected', c.expected, c.name);
  }

  expect(() => FeatureToggle(KEY)).toThrow('FeatureToggleProvider not set');
}
