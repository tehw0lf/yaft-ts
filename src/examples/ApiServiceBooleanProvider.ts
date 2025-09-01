import axios from "axios";

import { FeatureProvider } from "../FeatureToggle";

export class ApiServiceBooleanProvider implements FeatureProvider<boolean> {
  apiUrl: string;
  baseUUID: string;
  data: Record<string, boolean>;
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
      
      // Convert array to keyed boolean object and handle capitalized field names
      this.data = {};
      if (Array.isArray(featuresArray)) {
        featuresArray.forEach((feature: any) => {
          const key = feature.key || feature.Key;
          const value = feature.value || feature.Value;
          if (key) {
            this.data[key] = value === 'true' || value === true;
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
    return feature;
  }
}
