import axios from "axios";

import { FeatureProvider } from "../FeatureToggle";
import { collectionHashOf, normaliseBooleans, normaliseGroup } from "../mapping";

export class ApiServiceBooleanProvider implements FeatureProvider<boolean> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, boolean> = {};
  collectionHash = "";
  private refreshing: Promise<unknown> = Promise.resolve();

  constructor(apiUrl: string, baseUUID: string) {
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

  /** Runs refreshes one after another; see ApiServiceFeatureProvider. */
  private refreshFrom(hashUrl: string): Promise<boolean> {
    const run = this.refreshing.then(() => this.refreshNow(hashUrl));
    this.refreshing = run.catch(() => undefined);
    return run;
  }

  private async refreshNow(hashUrl: string): Promise<boolean> {
    const newHash = collectionHashOf((await axios.get(hashUrl)).data);
    if (newHash === undefined) throw new Error(`GET ${hashUrl} sent no collectionHash`);
    if (newHash === this.collectionHash) return false;
    // Recorded only once the group has loaded, so a failed fetch is retried.
    this.data = await this.fetchGroup(`${this.apiUrl}/features/${this.baseUUID}`);
    this.collectionHash = newHash;
    return true;
  }

  /** Fetches the group, or rejects if the response is not one. */
  private async fetchGroup(configPathOrUrl: string): Promise<Record<string, boolean>> {
    const response = await axios.get(configPathOrUrl);

    // A keyed boolean object is already in this provider's shape and is
    // taken as-is; anything else is a feature-shaped response and goes
    // through the core normaliser, so the two providers cannot disagree
    // about what a response means.
    if (isKeyedBooleans(response.data)) {
      return normaliseBooleans(response.data);
    }

    // Only the value matters here. The boolean shape has no time logic by
    // design (R21), so a feature collapses to whether its value is exactly
    // "true" -- activeAt and disabledAt are dropped.
    //
    // That is a real trap when this provider is pointed at a backend that
    // schedules toggles: the window is then enforced only by the backend's
    // cron job, which lags by up to a minute, instead of being evaluated
    // locally. Use ApiServiceFeatureProvider when the toggles carry dates.
    const features = normaliseGroup(response.data);
    if (features === undefined) {
      throw new Error(`GET ${configPathOrUrl} sent a body that is not a toggle group`);
    }
    const data: Record<string, boolean> = {};
    for (const [key, feature] of Object.entries(features)) {
      data[key] = feature.value === 'true';
    }
    return data;
  }

  isEnabled(key: string): boolean {
    return this.data[key] === true;
  }
}

/**
 * True when the payload is in the boolean shape, `{ "myToggle": true }`.
 *
 * Distinguishing this from a feature-shaped response matters: running a keyed
 * boolean object through the feature normaliser would look for a `key` field,
 * find none and discard every entry.
 *
 * One boolean value is enough. A mixed payload such as
 * `{ "a": true, "b": "x" }` is still the boolean shape; normaliseBooleans then
 * drops `b` and keeps `a` (R29), exactly as the local provider does. Requiring
 * every value to be boolean sent it to the feature normaliser instead, which
 * lost `a` as well. Feature responses never carry a boolean -- `value` is a
 * string -- so they are not caught by this.
 */
function isKeyedBooleans(data: unknown): boolean {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  return Object.values(data as Record<string, unknown>).some(
    (v) => typeof v === 'boolean'
  );
}
