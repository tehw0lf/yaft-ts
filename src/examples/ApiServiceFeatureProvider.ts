import axios from "axios";

import { Clock, evaluate, systemClock } from "../evaluate";
import { collectionHashOf, normaliseGroup } from "../mapping";
import { Feature, FeatureProvider } from "../FeatureToggle";

export class ApiServiceFeatureProvider implements FeatureProvider<Feature> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, Feature> = {};
  collectionHash = "";
  private refreshing: Promise<unknown> = Promise.resolve();
  private readonly clock: Clock;

  /**
   * @param clock source of the current time; override it to evaluate against a
   *              fixed instant in tests
   */
  constructor(apiUrl: string, baseUUID: string, clock: Clock = systemClock) {
    this.clock = clock;
    this.apiUrl = apiUrl;
    this.baseUUID = baseUUID;
    this.getCollectionHash(`${this.apiUrl}/collectionHash/${this.baseUUID}`);
  }

  /**
   * Fetches the group if it changed since the last successful refresh.
   *
   * Resolves to `true` when new data was loaded and `false` when the group was
   * unchanged. Rejects when the backend cannot be reached or sends something
   * that is not a hash or not a toggle group; the previous data stays (R32).
   */
  async refresh(): Promise<boolean> {
    return this.refreshFrom(`${this.apiUrl}/collectionHash/${this.baseUUID}`);
  }

  /**
   * Like {@link refresh}, but logs a failure instead of rejecting, for use
   * from a timer. The previous data stays in place.
   */
  async getCollectionHash(configPathOrUrl: string): Promise<void> {
    try {
      await this.refreshFrom(configPathOrUrl);
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  async getConfig(configPathOrUrl: string): Promise<void> {
    try {
      this.data = await this.fetchGroup(configPathOrUrl);
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  /**
   * Runs refreshes one after another. The constructor starts one without
   * waiting, so a caller's refresh() right after it ran alongside: the older
   * one could finish last and overwrite the newer data and hash.
   */
  private refreshFrom(hashUrl: string): Promise<boolean> {
    const run = this.refreshing.then(() => this.refreshNow(hashUrl));
    this.refreshing = run.catch(() => undefined);
    return run;
  }

  private async refreshNow(hashUrl: string): Promise<boolean> {
    const newHash = collectionHashOf((await axios.get(hashUrl)).data);
    if (newHash === undefined) throw new Error(`GET ${hashUrl} sent no collectionHash`);
    if (newHash === this.collectionHash) return false;
    // The hash is recorded only once the group has loaded. Recording it
    // first meant one failed fetch stopped every later refresh until the
    // backend changed again.
    this.data = await this.fetchGroup(`${this.apiUrl}/features/${this.baseUUID}`);
    this.collectionHash = newHash;
    return true;
  }

  /** Fetches the group, or rejects if the response is not one. */
  private async fetchGroup(configPathOrUrl: string): Promise<Record<string, Feature>> {
    const response = await axios.get(configPathOrUrl);
    // The mapping rules live in the core, next to the evaluation rules,
    // rather than being reimplemented per provider.
    const group = normaliseGroup(response.data);
    if (group === undefined) {
      throw new Error(`GET ${configPathOrUrl} sent a body that is not a toggle group`);
    }
    return group;
  }

  isEnabled(key: string): boolean {
    return evaluate(this.data[key], this.clock());
  }
}
