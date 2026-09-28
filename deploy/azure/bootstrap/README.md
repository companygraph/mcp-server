# Bootstrap on Azure

What GitHub Actions needs before it can authenticate and push on Azure: the resource group, the state's storage account and container, the image registry, and three user-assigned identities. `terraform` applies on main, with Contributor and Role Based Access Control Administrator on the resource group. `terraform-plan` plans a pull request as Reader. `deploy` pushes images with AcrPush. The owner applies it once, under their own `az login`, with local state kept outside the repository, and again only when a repository joins.

Each identity's federated credential names GitHub's immutable subject, `repo:OWNER@OWNER_ID/REPO@REPO_ID:…`, so a repository name freed by a delete or a rename is worth nothing to whoever takes it. A repository created after 2026-07-15 has that subject by default. An older one opts in once, before the bootstrap: `gh api -X PUT repos/<owner>/<repo>/actions/oidc/customization/sub -F use_default=true -F use_immutable_subject=true`. The ids come from `gh api repos/<owner>/<repo> --jq '.id, .owner.id'`. Before the first workflow run, decode one token's `sub` in a throwaway step and compare it with the subject here, because a credential that does not match fails without saying why.

A module cannot configure its own provider and still be called for more than one deployment, so the calling root holds the provider block. That block also registers the resource providers the modules use, since registering one is a subscription's right that no identity made here holds:

    provider "azurerm" {
      features {}
      subscription_id                 = local.d.subscription_id
      storage_use_azuread             = true
      resource_provider_registrations = "none"
      resource_providers_to_register = [
        "Microsoft.App", "Microsoft.OperationalInsights", "Microsoft.ContainerRegistry", "Microsoft.Storage",
        "Microsoft.ManagedIdentity", "Microsoft.Insights", "Microsoft.Consumption",
      ]
    }

    module "bootstrap" {
      source              = "git::https://github.com/companygraph/mcp-server.git//deploy/azure/bootstrap?ref=<tag>"
      resource_group_name = local.d.resource_group
      location            = local.d.location
      state_account       = local.d.state_account
      registry_name       = local.d.container_registry
      repository          = local.d.repository
      repository_id       = local.d.repository_id
      owner_id            = local.d.owner_id
    }

where `local.d = jsondecode(file("${path.module}/../../deployment.json"))`. The outputs `tenant_id`, `terraform_client_id`, `plan_client_id` and `deploy_client_id` go into `deployment.json`. None of them is a secret: only a token GitHub signs for this repository passes a credential.
