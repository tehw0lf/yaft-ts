import axios from "axios";

import { Clock, evaluate, systemClock } from "../evaluate";
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
      // Handle Go backend response format
      const featuresArray = response.data.toggles || response.data.value || [];
      
      // Convert array to keyed object and handle capitalized field names
      this.data = {};
      if (Array.isArray(featuresArray)) {
        featuresArray.forEach((feature: any) => {
          const normalizedFeature = {
            key: feature.key || feature.Key,
            value: feature.value || feature.Value,
            activeAt: feature.activeAt || feature.ActiveAt,
            disabledAt: feature.disabledAt || feature.DisabledAt,
            tags: feature.tags || feature.Tags || [],
          };
          if (normalizedFeature.key) {
            this.data[normalizedFeature.key] = normalizedFeature;
          }
        });
      } else {
        // Fallback for object format
        this.data = featuresArray;
      }
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  isEnabled(key: string): boolean {
    return evaluate(this.data[key], this.clock());
  }
}
