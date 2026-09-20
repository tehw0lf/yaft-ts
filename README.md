# YaFT for TypeScript

<div align="center">
  <img src="./logo.svg" alt="YaFT Logo" width="140">
</div>

---

This provides a client for YaFT which aims to bring simple feature toggles for Methods and Classes to Typescript.

---

## Installation

`npm install --save @tehw0lf/yaft`

## Initialization

To be able to use YaFT, implement and set a `FeatureProvider` on the abstract Base Class, or copy and adapt one of the example providers.

In this example a local json file with the `Feature` data type is used, but in theory any data type can be used since the Provider implements the isEnabled function which can be overridden as necessary.

```ts
import { FeatureToggleBase } from "@tehw0lf/yaft";
import { LocalStorageFeatureProvider } from "./provider";

FeatureToggleBase.featureProvider = new LocalStorageFeatureProvider(
  "./test-feature.json"
);
```

This repo contains examples for two provider types: API Providers for `boolean` and `Feature` and LocalStorage Providers for `boolean` and `Feature`. The APi providers are designed to work with the default Go implementation of YaFT, but can be implemented through their interface:

```ts
export interface FeatureProvider<T> {
  apiUrl?: string;
  baseUUID?: string;
  data: Record<string, T>;
  initConfig(configPathOrUrl: string): void;
  isEnabled(key: string): boolean;
}
```

## Usage

To manage anything with a feature toggle, decorate it with the feature's key:

```ts
import { FeatureToggle } from "@tehw0lf/yaft";

@FeatureToggle("myKey")
class MyClass {}
```

```ts
import { FeatureToggle } from "@tehw0lf/yaft";

@FeatureToggle("myKey")
myMethod() {}
```

If the feature is enabled, the original class/method will be used.

If the feature is disabled, a fallback can be provided:

```ts
import { FeatureToggle } from "@tehw0lf/yaft";

@FeatureToggle("myKey", MyFallbackClass)
class MyClass {}
```

```ts
import { FeatureToggle } from "@tehw0lf/yaft";

@FeatureToggle("myKey", myFallbackMethod)
myMethod() {}
```

Otherwise, or if the feature does not exist, the class/method gets replaced with an empty object/an empty function.

## Collection Hash

The default YaFT API provides a collection hash to efficiently check whether the locally cached features are still up to date. See API provider examples for details.
This can be scheduled to automatically update feature data in the background.

## Feature Data Type

The default data type for YaFT is `Feature`. A feature has a key string, a value string representing a boolean and optional activeAt and disabledAt date strings.

```ts
export type Feature = {
  key: string;
  value: string;
  activeAt: string;
  disabledAt: string;
  tags?: string[];
};
```

## Evaluation rules

A feature is on when all of the following hold. `evaluate` is exported, so the
rules can be applied directly to a feature without going through a provider.

- The value is exactly `"true"`. `"TRUE"`, `"1"` and `""` are off -- the value
  is stored as a string, and anything else would be a silent disagreement
  between backend and client.
- `activeAt` has passed, if set. The bound is inclusive: at exactly `activeAt`
  the feature is on.
- `disabledAt` has not been reached, if set. This bound is exclusive: at
  exactly `disabledAt` the feature is off.

A missing feature is off. Unset, `null` or unparseable dates are ignored rather
than treated as an error, and never throw.

### Date format

Dates must be **RFC 3339 with an offset** (`2026-09-18T15:00:00Z` or
`2026-09-18T15:00:00+02:00`). Anything else -- a bare date such as
`2026-09-18`, or a timestamp without an offset -- is ignored and logged as a
warning.

This is stricter than `Date.parse`, on purpose: JavaScript reads a bare date as
UTC midnight and an offset-less timestamp as local time, while most other
languages read both as local. Accepting them would make a feature flip at a
different instant depending on which client evaluated it.

## Testing with a fixed time

Both `Feature` providers take an optional clock, so a test can evaluate against
a fixed instant instead of the current time:

```ts
import { LocalStorageFeatureProvider } from "./provider";

const provider = new LocalStorageFeatureProvider(
  "./test-feature.json",
  () => Date.parse("2026-09-18T12:00:00Z")
);
```

The clock defaults to the system time, so existing code needs no change.

# Licenses

- Code: MIT License
- Logo/Branding: All rights reserved