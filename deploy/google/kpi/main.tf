# Where an organization's KPI values are kept, and the one account that writes them. The values
# quote nobody and form a series that must outlive the chat's eighty-three-day reports, so they
# get a bucket of their own with no deletion rule, and versioning keeps the earlier object when a
# week is written again. The module sits beside the service's rather than inside it, since a KPI
# is the organization's and not the server's.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 8.0" }
  }
}

# The bootstrap's pool provider admits only the host repository's tokens, its attribute condition
# naming the repository id, so this set is that repository's runs on main and nothing else: a
# pull request from a fork, or any other branch, cannot act as the writer.
locals {
  main_runs = "principalSet://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/github/attribute.ref/refs/heads/main"
}

resource "google_storage_bucket" "kpi" {
  project                     = var.project
  name                        = "kpi-reports-${var.project}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  versioning {
    enabled = true
  }
}

# The writer holds the bucket and nothing else in the project; the weekly workflow acts as it
# through the pool the bootstrap made.
resource "google_service_account" "reporter" {
  project      = var.project
  account_id   = "kpi-reporter"
  display_name = "Writer of the organization's KPI values"
}

resource "google_storage_bucket_iam_member" "reporter" {
  bucket = google_storage_bucket.kpi.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.reporter.email}"
}

resource "google_service_account_iam_member" "reporter_wif" {
  service_account_id = google_service_account.reporter.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.main_runs
}
