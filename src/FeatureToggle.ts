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
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ) => {
    if (propertyKey && descriptor) {
      // Method
      const originalMethod = descriptor.value;

      // An async method must keep returning a promise when it is switched
      // off, or `await` at the call site breaks on a plain undefined. The
      // empty class shell below already makes this distinction; without it
      // here, turning a feature off would throw inside unrelated code.
      const isAsync =
        originalMethod?.[Symbol.toStringTag] === "AsyncFunction";

      descriptor.value = function (...args: any[]) {
        const isEnabled = FeatureToggleBase.featureProvider.isEnabled(key);
        if (isEnabled) {
          return originalMethod.apply(this, args);
        } else {
          if (fallback !== undefined) {
            const result = fallback.apply(this, args as []);
            // A synchronous fallback on an async method would otherwise hand
            // back a plain value, breaking the promise the signature
            // advertises. Promise.resolve passes an existing promise through
            // unchanged, so an async fallback is unaffected.
            return isAsync ? Promise.resolve(result) : result;
          }
          return isAsync ? Promise.resolve() : undefined;
        }
      };
      return descriptor;
    } else {
      // Class
      const originalConstructor = target;
      let newConstructor: any;

      const isEnabled = FeatureToggleBase.featureProvider.isEnabled(key);
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
