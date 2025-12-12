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
