import { Clock, evaluate, systemClock } from "../evaluate";
import { Feature, FeatureProvider } from "../FeatureToggle";

export class LocalStorageFeatureProvider implements FeatureProvider<Feature> {
  data: Record<string, Feature> = {};
  private readonly clock: Clock;

  /**
   * @param configPath path passed to `require()`
   * @param clock source of the current time; override it to evaluate against a
   *              fixed instant in tests
   */
  constructor(configPath: string, clock: Clock = systemClock) {
    this.clock = clock;
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
    return evaluate(this.data[key], this.clock());
  }
}
