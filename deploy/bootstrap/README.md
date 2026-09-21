# Bootstrap

What GitHub Actions needs before it can authenticate and push, for one deployment of the server: the state bucket its own root writes to, the workload identity pool and its GitHub provider, the `terraform`, `terraform-plan` and `deploy` service accounts, the image registry, the organization policy override that lets a later apply grant `allUsers` the invoker role on a public Cloud Run service, and the managed constraint that narrows that override back to what the server needs. The owner applies it once, locally, under their own login, with state that stays on their machine and never in the bucket it creates; a later apply only when the deployment's GitHub repository changes.

The provider accepts a token only from the repository whose numeric id is `repository_id`, never by its name, because a name freed by a delete or a rename can be taken by anyone. Within that repository, a run on any ref may sign in as `terraform-plan`, which reads everything the root declares and changes none of it, and only a run on `main` may sign in as `terraform` or `deploy`. So a pull request, Dependabot's included, plans and never applies, and the reusable `deployment.yml` picks the account by the event that started it.

The managed constraint `iam.managed.allowedPolicyMembers` is written as a dry run: it logs every grant it would refuse and refuses none. It allows `allUsers`, the organization's own principals and the project's identity pool. It is enforced by moving its rule from `dry_run_spec` to `spec`, and only once its logs have been read and none of the grants it would refuse is one the server needs.

A module cannot configure its own provider and still be called for more than one deployment, so the calling root holds the `provider "google"` block, with `user_project_override = true` and `billing_project` set to the project: the Organization Policy API bills its calls to a quota project, and a user's local credentials name none. The root reads every value one deployment owns, `repository` and `repository_id` included, from its own `deployment.json`, the way `deploy/terraform`'s caller does.

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
  project_number  = local.d.project_number
  organization    = local.d.organization
  billing_account = local.d.billing_account
  repository      = local.d.repository
  repository_id   = local.d.repository_id
}
```
