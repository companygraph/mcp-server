// The one call a deployment's own test file makes: every check this package ships for a
// deployment to run over its own snapshot and page, registered on `node:test` when the caller
// imports this module and calls the function — not before, so a deployment controls when its
// suite runs them rather than inheriting them at import time.
import { registerPinTests } from "./pin.mjs";
import { registerToolsTests } from "./tools.mjs";
import { registerPageTests } from "./page.mjs";

export function registerDeploymentTests() {
  registerPinTests();
  registerToolsTests();
  registerPageTests();
}
