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
      const newHash = response.data.value;
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
      this.data = response.data.value;
    } catch (error) {
      console.error("Failed to fetch feature toggle from API:", error);
    }
  }

  isEnabled(key: string): boolean {
    const feature = this.data[key];

    if (feature === undefined || feature === null) return false;

    if (Date.now() >= Date.parse(feature.disabledAt)) return false;
    if (Date.now() >= Date.parse(feature.activeAt)) return true;

    return JSON.parse(feature.value);
  }
}
