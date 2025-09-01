import "reflect-metadata";

class EmptyClass {
  constructor() {}
}

export type Feature = {
  key: string;
  value: string;
  activeAt: string;
  disabledAt: string;
  tags?: string[];
};

export interface FeatureProvider<T> {
  apiUrl?: string;
  baseUUID?: string;
  data: Record<string, T>;
  getCollectionHash?(configPathOrUrl: string): void;
  getConfig(configPathOrUrl: string): void;
  isEnabled(key: string): boolean;
}

export function FeatureToggle(key: string, fallback?: any) {
  if (!FeatureToggleBase.featureProvider) {
    throw new Error("FeatureToggleProvider not set");
  }
  const isEnabled = FeatureToggleBase.featureProvider.isEnabled(key);
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ) => {
    if (propertyKey && descriptor) {
      // Method
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        if (isEnabled) {
          return originalMethod.apply(this, args);
        } else {
          return fallback !== undefined
            ? fallback.apply(this, args)
            : (() => {}).apply(this, args);
        }
      };
      return descriptor;
    } else {
      // Class
      const originalConstructor = target;
      let newConstructor: any;

      if (isEnabled) {
        newConstructor = originalConstructor;
      } else {
        newConstructor = fallback !== undefined ? fallback : EmptyClass;
        if (fallback) newConstructor.__proto__ = fallback.__proto__;

        if (newConstructor === EmptyClass) {
          Object.getOwnPropertyNames(originalConstructor.prototype).forEach(
            (name: string) => {
              if (name === "constructor") return;
              if (typeof originalConstructor.prototype[name] === "function")
                newConstructor.prototype[name] = () => {};
              if (
                originalConstructor.prototype[name][Symbol.toStringTag] ===
                "AsyncFunction"
              )
                newConstructor.prototype[name] = async () => {};
            }
          );
        }
      }
      return newConstructor;
    }
  };
}

export abstract class FeatureToggleBase {
  static featureProvider: FeatureProvider<any>;
}
