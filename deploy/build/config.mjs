// A deployment's own values and its model pin, read from the directory the command runs in.
import fs from "node:fs";
import path from "node:path";
export const ROOT = process.cwd();
export const DIST = path.join(ROOT, "dist");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
export const source = () => read("source.json");
export const deployment = () => read("deployment.json");
export const snapshot = () => JSON.parse(fs.readFileSync(path.join(DIST, "snapshot.json"), "utf8"));

// deployment.json as its platform needs it: the fields every deployment names, its platform's own,
// and none of the other platform's, since a field Terraform does not read would deploy as a
// missing one. A deployment that names no platform is on Google, as every deployment before the
// field was. registry_name is the MCP Registry's name on both platforms.
export const PLATFORMS = ["google", "azure"];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NEEDS = {
  google: ["project", "project_number", "region", "domain", "site_id", "budget_chf"],
  azure: ["tenant_id", "subscription_id", "resource_group", "location", "container_registry", "state_account", "domain", "budget_chf", "budget_start", "repository", "repository_id", "owner_id", "terraform_client_id", "plan_client_id", "deploy_client_id"],
};
const ONLY = {
  google: ["project", "project_number", "billing_account", "region", "site_id", "run_host"],
  azure: ["tenant_id", "subscription_id", "resource_group", "location", "container_registry", "state_account", "budget_start", "owner_id", "terraform_client_id", "plan_client_id", "deploy_client_id", "app_host", "dns_ready"],
};
const NAME = { google: "Google", azure: "Azure" };

export function platformOf(d) {
  const p = d.platform ?? "google";
  if (!PLATFORMS.includes(p)) throw new Error(`deployment.json names platform ${p}, which is not one of ${PLATFORMS.join(" ")}`);
  return p;
}

export function deploymentProblems(d) {
  const platform = platformOf(d);
  const other = platform === "google" ? "azure" : "google";
  const problems = NEEDS[platform].filter((k) => !(k in d)).map((k) => `deployment.json has no ${k}`);
  for (const k of ONLY[other]) if (k in d && !ONLY[platform].includes(k)) problems.push(`${k} is for a deployment on ${NAME[other]}`);
  if (platform === "azure") {
    for (const k of ["tenant_id", "subscription_id", "terraform_client_id", "plan_client_id", "deploy_client_id"]) if (k in d && !GUID.test(d[k])) problems.push(`${k} is a GUID`);
    if ("budget_start" in d && !/^\d{4}-\d{2}-01$/.test(d.budget_start)) problems.push("budget_start is the first of a month, YYYY-MM-01");
    if ("dns_ready" in d && typeof d.dns_ready !== "boolean") problems.push("dns_ready is true or false");
  }
  return problems;
}
