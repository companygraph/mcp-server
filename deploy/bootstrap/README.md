# Bootstrap

What GitHub Actions needs before it can authenticate and push, for one deployment of the server: the state bucket its own root writes to, the workload identity pool and its GitHub provider, the `terraform` and `deploy` service accounts, the image registry, and the organization policy override that lets a later apply grant `allUsers` the invoker role on a public Cloud Run service. The owner applies it once, locally, under their own login, with state that stays on their machine and never in the bucket it creates; a later apply only when the deployment's GitHub repository changes.

A module cannot configure its own provider and still be called for more than one deployment, so the calling root holds the `provider "google"` block, with `user_project_override = true` and `billing_project` set to the project: the Organization Policy API bills its calls to a quota project, and a user's local credentials name none. The root reads the values one deployment owns from its own `deployment.json`, the way `deploy/terraform`'s caller does, and states its GitHub repository directly, because that string names the root's own repository rather than anything the deployment's project carries.

```hcl
locals {
  d = jsondecode(file("../../deployment.json"))
}

provider "google" {
  project               = local.d.project
  region                = local.d.region
  user_project_override = true
  billing_project       = local.d.project
}

module "bootstrap" {
  source          = "git::https://github.com/companygraph/mcp-server.git//deploy/bootstrap?ref=<tag>"
  project         = local.d.project
  region          = local.d.region
  billing_account = local.d.billing_account
  repository      = "<owner>/<name>"
}
```
