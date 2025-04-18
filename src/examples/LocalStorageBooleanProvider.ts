import { FeatureProvider } from "../FeatureToggle";

export class LocalStorageBooleanProvider implements FeatureProvider<boolean> {
  data: Record<string, boolean> = {};

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
    const feature = this.data[key];
    if (feature === undefined || feature === null) return false;
    return feature;
  }
}
