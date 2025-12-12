import axios from "axios";

import { Feature, FeatureProvider } from "../FeatureToggle";

export class ApiServiceFeatureProvider implements FeatureProvider<Feature> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, Feature> = {};
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
    const feature = this.data[key];

    if (feature === undefined || feature === null) return false;

    // First check: value must be "true"
    if (feature.value !== "true") return false;

    // Second check: if activeAt is set and in future, not yet active
    if (feature.activeAt && feature.activeAt !== "") {
      const activeTime = Date.parse(feature.activeAt);
      if (!isNaN(activeTime) && Date.now() < activeTime) {
        return false;
      }
    }

    // Third check: if disabledAt is set and in past, already disabled
    if (feature.disabledAt && feature.disabledAt !== "") {
      const disabledTime = Date.parse(feature.disabledAt);
      if (!isNaN(disabledTime) && Date.now() >= disabledTime) {
        return false;
      }
    }

    // All checks passed, feature is enabled
    return true;
  }
}
