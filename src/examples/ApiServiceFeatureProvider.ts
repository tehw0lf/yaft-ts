import axios from "axios";

import { Clock, evaluate, systemClock } from "../evaluate";
import { normaliseCollection } from "../mapping";
import { Feature, FeatureProvider } from "../FeatureToggle";

export class ApiServiceFeatureProvider implements FeatureProvider<Feature> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, Feature> = {};
  collectionHash = "";
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
      // The mapping rules live in the core, next to the evaluation rules,
      // rather than being reimplemented per provider.
      this.data = normaliseCollection(response.data);
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  isEnabled(key: string): boolean {
    return evaluate(this.data[key], this.clock());
  }
}
