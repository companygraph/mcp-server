# What has to exist before GitHub Actions can authenticate and push, on Azure: applied once by the
# owner under their own login, with local state, and changed only when a repository joins.
# Everything CI can create lives in ../terraform and is applied by CI. The caller holds the
# provider block, and registers there the resource providers the modules use, since registering
# one is a subscription's right that no identity made here holds.
terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 5.7" }
  }
}

variable "resource_group_name" { type = string }
variable "location" { type = string }
# The state's storage account and the image registry: both names are global across Azure, so the
# deployment chooses them.
variable "state_account" { type = string }
variable "registry_name" { type = string }
# The repository's owner and name, and GitHub's numeric ids for both. The subjects below name the
# ids, the immutable form GitHub gives a repository created after 2026-07-15 or one that opted
# in, so a name freed by a delete or a rename is worth nothing to whoever takes it:
# `gh api repos/<owner>/<name> --jq '.id, .owner.id'`.
variable "repository" { type = string }
variable "repository_id" { type = string }
variable "owner_id" { type = string }

locals {
  owner   = split("/", var.repository)[0]
  name    = split("/", var.repository)[1]
  subject = "repo:${local.owner}@${var.owner_id}/${local.name}@${var.repository_id}"
  issuer  = "https://token.actions.githubusercontent.com"
  aud     = ["api://AzureADTokenExchange"]
}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_storage_account" "state" {
  name                            = var.state_account
  resource_group_name             = azurerm_resource_group.this.name
  location                        = azurerm_resource_group.this.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  blob_properties {
    versioning_enabled = true
  }
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

resource "azurerm_container_registry" "this" {
  name                = var.registry_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Basic"
  admin_enabled       = false
}

# Applies ../terraform and the chat's module: everything in the resource group, and the role
# assignments that give the apps' own identities their few rights. A run on main only.
resource "azurerm_user_assigned_identity" "terraform" {
  name                = "terraform"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_federated_identity_credential" "terraform" {
  name                      = "github-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.terraform.id
  issuer                    = local.issuer
  audience                  = local.aud
  subject                   = "${local.subject}:ref:refs/heads/main"
}

resource "azurerm_role_assignment" "terraform" {
  for_each             = toset(["Contributor", "Role Based Access Control Administrator"])
  scope                = azurerm_resource_group.this.id
  role_definition_name = each.value
  principal_id         = azurerm_user_assigned_identity.terraform.principal_id
}

resource "azurerm_role_assignment" "terraform_state" {
  scope                = azurerm_storage_container.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.terraform.principal_id
}

# Plans a pull request: reads the resource group and the state, and can change neither.
# -lock=false in the plan is what lets it do without write on the container.
resource "azurerm_user_assigned_identity" "plan" {
  name                = "terraform-plan"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_federated_identity_credential" "plan" {
  name                      = "github-pull-request"
  user_assigned_identity_id = azurerm_user_assigned_identity.plan.id
  issuer                    = local.issuer
  audience                  = local.aud
  subject                   = "${local.subject}:pull_request"
}

resource "azurerm_role_assignment" "plan" {
  scope                = azurerm_resource_group.this.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
}

resource "azurerm_role_assignment" "plan_state" {
  scope                = azurerm_storage_container.state.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
}

# Pushes images and nothing else. A run on main only.
resource "azurerm_user_assigned_identity" "deploy" {
  name                = "deploy"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_federated_identity_credential" "deploy" {
  name                      = "github-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.deploy.id
  issuer                    = local.issuer
  audience                  = local.aud
  subject                   = "${local.subject}:ref:refs/heads/main"
}

resource "azurerm_role_assignment" "deploy" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.deploy.principal_id
}

output "tenant_id" { value = azurerm_user_assigned_identity.terraform.tenant_id }
output "terraform_client_id" { value = azurerm_user_assigned_identity.terraform.client_id }
output "plan_client_id" { value = azurerm_user_assigned_identity.plan.client_id }
output "deploy_client_id" { value = azurerm_user_assigned_identity.deploy.client_id }
output "registry" { value = azurerm_container_registry.this.login_server }
output "state_account" { value = azurerm_storage_account.state.name }
