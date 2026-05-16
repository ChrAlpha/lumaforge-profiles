// Registers @testing-library/jest-dom matchers for jsdom-based component
// tests. Importing this module only augments Vitest's `expect` and performs no
// DOM access, so it is a no-op for the node-environment `.ts` tests.
import "@testing-library/jest-dom/vitest";

// jsdom does not implement the Pointer Capture API. Radix primitives that use
// pointer/swipe gestures (e.g. Toast) call these on real elements during
// interaction tests, throwing "X is not a function". Provide inert no-op
// stubs so component tests exercise the real Radix code without crashing.
// Guarded so a future jsdom that ships these is not clobbered.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
}
