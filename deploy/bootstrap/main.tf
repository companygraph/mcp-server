# What has to exist before GitHub Actions can authenticate and push: applied once by the owner
# under their own login, with local state, and changed only when a repository joins. Everything
# below the project that CI can create lives in ../ and is applied by CI.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project" { type = string }
variable "region" { type = string }
variable "repository" { type = string }
variable "billing_account" { type = string }

# Enabling an API already on is a no-op; disabling one on destroy never happens.
resource "google_project_service" "bootstrap" {
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "orgpolicy.googleapis.com",
    "cloudbilling.googleapis.com",
  ])
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_storage_bucket" "state" {
  name                        = "${var.project}-tfstate"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  versioning { enabled = true }
  lifecycle_rule {
    condition { num_newer_versions = 10 }
    action { type = "Delete" }
  }
  depends_on = [google_project_service.bootstrap]
}

resource "google_artifact_registry_repository" "mcp" {
  location      = var.region
  repository_id = "mcp"
  format        = "DOCKER"
  depends_on    = [google_project_service.bootstrap]
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  depends_on                = [google_project_service.bootstrap]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  attribute_condition = "assertion.repository == \"${var.repository}\""
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

locals {
  principal = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.repository}"
}

# The project sits under the flatland.ch organization, whose domain-restricted sharing refuses
# a binding to allUsers, and a public MCP server is nothing but such a binding. This override
# on the project alone lets ../ grant allUsers the invoker role on the service; setting it
# needs the Organization Policy Administrator role, which the owner holds and CI never does.
resource "google_org_policy_policy" "allow_public_members" {
  name   = "projects/${var.project}/policies/iam.allowedPolicyMemberDomains"
  parent = "projects/${var.project}"
  spec {
    rules {
      allow_all = "TRUE"
    }
  }
  depends_on = [google_project_service.bootstrap]
}

# Applies ../: Cloud Run, Firebase, Hosting, the budget, the APIs it needs.
resource "google_service_account" "terraform" {
  account_id   = "terraform"
  display_name = "Terraform, run by GitHub Actions"
  depends_on   = [google_project_service.bootstrap]
}

resource "google_project_iam_member" "terraform" {
  for_each = toset([
    "roles/run.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/firebase.admin",
    "roles/firebasehosting.admin",
    "roles/artifactregistry.reader",
  ])
  project    = var.project
  role       = each.value
  member     = "serviceAccount:${google_service_account.terraform.email}"
  depends_on = [google_project_service.bootstrap]
}

# The budget in ../ is a resource of the billing account, not of the project, and only a
# billing administrator can grant the role that creates it. The owner is one; the terraform
# account is not and must not be, which is why this grant lives here and not in ../.
resource "google_billing_account_iam_member" "terraform_budgets" {
  billing_account_id = var.billing_account
  role               = "roles/billing.costsManager"
  member             = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_storage_bucket_iam_member" "terraform_state" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "terraform_wif" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal
}

# Pushes images and nothing else.
resource "google_service_account" "deploy" {
  account_id   = "deploy"
  display_name = "Image push, run by GitHub Actions"
  depends_on   = [google_project_service.bootstrap]
}

resource "google_artifact_registry_repository_iam_member" "deploy" {
  location   = google_artifact_registry_repository.mcp.location
  repository = google_artifact_registry_repository.mcp.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal
}

output "workload_identity_provider" { value = google_iam_workload_identity_pool_provider.github.name }
output "terraform_service_account" { value = google_service_account.terraform.email }
output "deploy_service_account" { value = google_service_account.deploy.email }
output "registry" { value = "${var.region}-docker.pkg.dev/${var.project}/${google_artifact_registry_repository.mcp.repository_id}" }
output "state_bucket" { value = google_storage_bucket.state.name }
