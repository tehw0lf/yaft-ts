import axios from "axios";

import { FeatureProvider } from "../FeatureToggle";
import { normaliseCollection } from "../mapping";

export class ApiServiceBooleanProvider implements FeatureProvider<boolean> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, boolean> = {};
  collectionHash = "";

  constructor(apiUrl: string, baseUUID: string) {
    this.apiUrl = apiUrl;
    this.baseUUID = baseUUID;
    this.getCollectionHash(`${this.apiUrl}/collectionHash/${this.baseUUID}`);
  }

  async getCollectionHash(configPathOrUrl: string): Promise<void> {
    try {
      const response = await axios.get(configPathOrUrl);
      const newHash = response.data.collectionHash || response.data.value;
      if (this.collectionHash !== newHash) {
        this.collectionHash = newHash;
        await this.getConfig(`${this.apiUrl}/features/${this.baseUUID}`);
      }
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  async getConfig(configPathOrUrl: string): Promise<void> {
    try {
      const response = await axios.get(configPathOrUrl);

      // A keyed boolean object is already in this provider's shape and is
      // taken as-is; anything else is a feature-shaped response and goes
      // through the core normaliser, so the two providers cannot disagree
      // about what a response means.
      if (isKeyedBooleans(response.data)) {
        this.data = response.data;
        return;
      }

      // Only the value matters here. The boolean shape has no time logic by
      // design (R21), so a feature collapses to whether its value is exactly
      // "true" -- activeAt and disabledAt are dropped.
      //
      // That is a real trap when this provider is pointed at a backend that
      // schedules toggles: the window is then enforced only by the backend's
      // cron job, which lags by up to a minute, instead of being evaluated
      // locally. Use ApiServiceFeatureProvider when the toggles carry dates.
      const features = normaliseCollection(response.data);
      this.data = {};
      for (const [key, feature] of Object.entries(features)) {
        this.data[key] = feature.value === 'true';
      }
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  isEnabled(key: string): boolean {
    const feature = this.data[key];
    if (feature === undefined || feature === null) return false;
    return feature;
  }
}

/**
 * True when the payload is already `{ "myToggle": true }`.
 *
 * Distinguishing this from a feature-shaped response matters: running a keyed
 * boolean object through the feature normaliser would look for a `key` field,
 * find none and discard every entry.
 */
function isKeyedBooleans(data: unknown): data is Record<string, boolean> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  const values = Object.values(data as Record<string, unknown>);
  return values.length > 0 && values.every((v) => typeof v === 'boolean');
}
