// deployment.json names what a deployment on its platform needs and nothing of the other platform.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deployment, deploymentProblems } from "../build/config.mjs";

export function registerConfigTests() {
  test("deployment.json names what its platform needs, and nothing of the other platform", () => {
    assert.deepEqual(deploymentProblems(deployment()), []);
  });
}
