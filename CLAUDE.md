# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YaFT (Yet another Feature Toggle) is a TypeScript library that provides decorator-based feature toggles for classes and methods. It integrates with backend services (Go/PostgreSQL by default) or local data sources to enable/disable features at runtime.

## Development Commands

### Building
```bash
npm run build                # Compile TypeScript and prepare package for publishing
```

### Testing
```bash
npm test                     # Run Jest tests with ts-jest transform
npx jest                     # Alternative test command
npx jest --watch             # Run tests in watch mode
npx jest --coverage          # Run tests with coverage report
```

### Running Single Tests
```bash
npx jest yaft.spec.ts        # Run specific test file
npx jest -t "test name"      # Run specific test by name pattern
```

## Architecture

### Core Components

**FeatureToggle Decorator (`src/FeatureToggle.ts`)**
- Main decorator function that can be applied to classes or methods
- Evaluates feature state at decoration time using the configured provider
- Returns fallback implementations when features are disabled

**FeatureToggleBase Class**
- Static container for the global `featureProvider` instance
- Must be configured before using any `@FeatureToggle` decorators

**FeatureProvider Interface**
- Defines contract for data sources: `isEnabled(key: string): boolean`
- Optional API integration with `apiUrl`, `baseUUID`, and collection hash support
- Flexible data structure support via generic type parameter

### Provider Implementations

**API Providers** (`src/examples/ApiService*Provider.ts`)
- Integrate with YaFT Go backend via HTTP API
- Support collection hash for efficient cache invalidation
- Handle both boolean and Feature data types
- Include error handling for network failures

**Local Storage Providers** (`src/examples/LocalStorage*Provider.ts`)
- Load configuration from local JSON files using `require()`
- Support both boolean and Feature data types
- Fallback to empty configuration on file load errors

### Feature Data Model

```typescript
type Feature = {
  key: string;       // Unique feature identifier
  value: string;     // Boolean value as string
  activeAt: string;  // ISO date when feature becomes active
  disabledAt: string; // ISO date when feature gets disabled
}
```

Features support time-based activation/deactivation logic evaluated at runtime.

### Decorator Behavior

**Method Decoration:**
- Replaces method implementation based on feature state
- Supports fallback method when feature is disabled
- Returns empty function if no fallback provided

**Class Decoration:**
- Replaces entire class constructor and prototype
- Supports fallback class when feature is disabled
- Creates EmptyClass with stub methods if no fallback provided
- Preserves async method signatures in EmptyClass stubs

## Usage Patterns

### Initialization
```typescript
import { FeatureToggleBase } from "@tehw0lf/yaft";
import { LocalStorageFeatureProvider } from "./examples/LocalStorageFeatureProvider";

FeatureToggleBase.featureProvider = new LocalStorageFeatureProvider("./config.json");
```

### Method Toggle
```typescript
@FeatureToggle("myFeature", fallbackMethod)
myMethod() {
  // Implementation when feature is enabled
}
```

### Class Toggle
```typescript
@FeatureToggle("myFeature", FallbackClass)
class MyClass {
  // Implementation when feature is enabled
}
```

## Testing Strategy

Tests use LocalStorageFeatureProvider with test configuration files (`src/test/test-*.json`). The test suite demonstrates:
- Class decoration with fallback classes
- Method decoration with and without fallbacks
- Async method handling
- Provider configuration and feature evaluation

## Build Configuration

- **TypeScript**: CommonJS output targeting ES2022
- **Decorators**: Experimental decorators enabled for `@FeatureToggle` syntax
- **Output**: Compiled to `dist/yaft/` with declaration files
- **Package**: Strips devDependencies during build process

## Dependencies

- **Runtime**: `reflect-metadata` for decorator metadata
- **Development**: TypeScript, Jest, ts-jest for testing
- **Optional**: `axios` for API provider implementations

## Pre-commit Validation

```bash
npm test && npm run build
```