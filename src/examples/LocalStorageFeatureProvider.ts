import { Feature, FeatureProvider } from "../FeatureToggle";

export class LocalStorageFeatureProvider implements FeatureProvider<Feature> {
  data: Record<string, Feature> = {};

  constructor(configPath: string) {
    this.getConfig(configPath);
  }

  getConfig(configPathOrUrl: string): void {
    try {
      const configData = require(configPathOrUrl);
      this.data = configData;
    } catch (error) {
      console.error("Failed to load configuration from local file:", error);
      this.data = {};
    }
  }

  isEnabled(key: string): boolean {
    const feature = this.data[key] as Feature;

    if (feature === undefined || feature === null) return false;

    if (Date.now() >= Date.parse(feature.disabledAt)) return false;
    if (Date.now() >= Date.parse(feature.activeAt)) return true;

    return JSON.parse(feature.value);
  }
}
