import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentProblems, platformOf } from "../deploy/build/config.mjs";

// A Google deployment.json exactly as the three live deployments have one.
const google = {
  project: "guestgraph-io-mcp", project_number: "763196875331", billing_account: "011DEB-4A45A0-3A52BB", region: "europe-west6",
  domain: "mcp.guestgraph.io", site_id: "mcp-guestgraph-io", repository: "guestgraph/mcp-guestgraph-io", repository_id: "1385958042",
  registry_name: "io.guestgraph/mental-model", registry_domain: "guestgraph.io", budget_chf: 40, run_host: "mcp-pmjo63xwja-oa.a.run.app",
};
const id = "11111111-2222-3333-4444-555555555555";
const azure = {
  platform: "azure", tenant_id: id, subscription_id: id, resource_group: "companygraph-azure", location: "switzerlandnorth",
  container_registry: "cgazureregistry", state_account: "cgazurestate", domain: "mcp.azure.companygraph.io", budget_chf: 40, budget_start: "2026-10-01",
  repository: "companygraph/mcp-azure-example", repository_id: "123456789", owner_id: "987654", registry_name: "io.companygraph/azure-example",
  terraform_client_id: id, plan_client_id: id, deploy_client_id: id,
};

test("the platform is google when deployment.json names none, and any other name is refused", () => {
  assert.equal(platformOf(google), "google");
  assert.equal(platformOf(azure), "azure");
  assert.throws(() => platformOf({ platform: "aws" }), /^Error: deployment.json names platform aws, which is not one of google azure$/);
});

test("a live Google deployment.json and a sound Azure one have no problem", () => {
  assert.deepEqual(deploymentProblems(google), []);
  assert.deepEqual(deploymentProblems(azure), []);
  assert.deepEqual(deploymentProblems({ ...azure, app_host: "mcp.x.azurecontainerapps.io", dns_ready: false }), []);
});

test("each platform names what it lacks and refuses the other's fields", () => {
  const { site_id, ...noSite } = google;
  assert.deepEqual(deploymentProblems(noSite), ["deployment.json has no site_id"]);
  assert.deepEqual(deploymentProblems({ ...google, tenant_id: id }), ["tenant_id is for a deployment on Azure"]);
  const { state_account, ...noState } = azure;
  assert.deepEqual(deploymentProblems(noState), ["deployment.json has no state_account"]);
  assert.deepEqual(deploymentProblems({ ...azure, project: "p", run_host: "r" }), ["project is for a deployment on Google", "run_host is for a deployment on Google"]);
  assert.deepEqual(deploymentProblems({ ...azure, tenant_id: "t", budget_start: "2026-10-02", dns_ready: "yes" }), ["tenant_id is a GUID", "budget_start is the first of a month, YYYY-MM-01", "dns_ready is true or false"]);
});
