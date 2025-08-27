# Integration Tests

This directory contains integration tests for the browserLegacy repository, specifically testing the build/compression system and HTML page loading functionality.

## Overview

The integration tests validate two main areas:

1. **Build System Tests** (`build.test.js`) - Tests the JavaScript compilation and compression process
2. **HTML Loading Tests** (`html-loading.test.js`) - Tests HTML page structure and configuration

## Running Tests

To run all integration tests:
```bash
npm test
```

To run only integration tests:
```bash
npm run test:integration
```

To run specific test suites:
```bash
# Build system tests only
npx jest tests/integration/build.test.js

# HTML loading tests only
npx jest tests/integration/html-loading.test.js
```

## Test Coverage

### Build System Tests

- **JavaScript Build Process**
  - Validates ThreadEventHandler builds successfully
  - Validates GrfViewer builds successfully
  - Confirms output files are created with expected content

- **JavaScript Compression Process**
  - Tests minification functionality
  - Validates minified output contains required components (headers, require.js)

- **Build Validation**
  - Checks that all application cases exist in builder
  - Validates output file format and structure

### HTML Loading Tests

- **HTML Structure Validation**
  - Validates main index.html structure
  - Tests tool HTML files (action.html, altitude.html, etc.)
  - Checks build tool interface HTML

- **Application Configuration Validation**
  - Validates ROConfig object in index.html
  - Tests RequireJS configurations in test files

- **Resource Loading Validation**
  - Confirms required JavaScript dependencies exist
  - Validates core module AMD structure

## Requirements

The tests require the following dependencies:
- Jest testing framework
- Node.js file system and child process modules

## Test Timeouts

Build tests have extended timeouts (60 seconds) due to the compilation process time. The test framework is configured with a 30-second default timeout.

## Adding New Tests

When adding new tests:

1. Place build-related tests in `build.test.js`
2. Place HTML/page-related tests in `html-loading.test.js`
3. Use appropriate timeouts for build operations
4. Clean up generated files in test cleanup hooks
5. Follow the existing test patterns for consistency