// Registers @testing-library/jest-dom matchers for jsdom-based component
// tests. Importing this module only augments Vitest's `expect` and performs no
// DOM access, so it is a no-op for the node-environment `.ts` tests.
import "@testing-library/jest-dom/vitest";
