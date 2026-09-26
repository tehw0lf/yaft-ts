import { FeatureProvider } from "../FeatureToggle";
import { normaliseBooleans } from "../mapping";

export class LocalStorageBooleanProvider implements FeatureProvider<boolean> {
  data: Record<string, boolean> = {};

  constructor(configPath: string) {
    this.getConfig(configPath);
  }

  getConfig(configPathOrUrl: string): void {
    try {
      this.data = normaliseBooleans(require(configPathOrUrl));
    } catch (error) {
      console.error("Failed to load configuration from local file:", error);
      this.data = {};
    }
  }

  isEnabled(key: string): boolean {
    return this.data[key] === true;
  }
}
