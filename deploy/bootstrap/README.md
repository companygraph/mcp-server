# Bootstrap

What GitHub Actions needs before it can authenticate and push, for one deployment of the server: the state bucket its own root writes to, the workload identity pool and its GitHub provider, the `terraform`, `terraform-plan` and `deploy` service accounts, the image registry and the organization policy override that lets a later apply grant `allUsers` the invoker role on a public Cloud Run service. The owner applies it once, locally, under their own login, with state that stays on their machine and never in the bucket it creates; a later apply only when the deployment's GitHub repository changes, or when the deployment adds the chat from `companygraph/chat-server` beside the server, whose module needs the `terraform` identity to own the project's Firestore database, to grant the chat runtime its two project roles, to write the logging configuration that keeps the chat's questions and to make the reports bucket, and the `terraform-plan` identity to read that bucket and the policies on it and on the analyst's account, since a pull request's plan refreshes them once they exist.

The provider accepts a token only from the repository whose numeric id is `repository_id`, never by its name, because a name freed by a delete or a rename can be taken by anyone. Within that repository, a run on any ref may sign in as `terraform-plan`, which reads everything the root declares and changes none of it, and only a run on `main` may sign in as `terraform` or `deploy`. So a pull request, Dependabot's included, plans and never applies, and the reusable `deployment.yml` picks the account by the event that started it.

The override lifts the domain restriction on the project as a whole, not only for `allUsers`. Google's managed constraint `iam.managed.allowedPolicyMembers` cannot narrow it back, because it does not accept `allUsers`, the one principal a public server needs; only a custom constraint defined on the organization could, and that belongs to the organization rather than to one deployment's bootstrap.

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
  billing_account = local.d.billing_account
  repository      = local.d.repository
  repository_id   = local.d.repository_id
}
```
