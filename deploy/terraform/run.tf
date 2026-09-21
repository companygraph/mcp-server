# The service: one container, the snapshot inside it, no role, answering only to its two names.
resource "google_service_account" "run" {
  account_id   = "mcp-run"
  display_name = "Runtime of the MCP service, holding no role"
  depends_on   = [google_project_service.main]
}

locals {
  run_host = var.run_host
}

resource "google_cloud_run_v2_service" "mcp" {
  name                = "mcp"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.run.email
    max_instance_request_concurrency = 20
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image = var.image
      ports { container_port = 8080 }
      resources {
        limits   = { cpu = "1", memory = "256Mi" }
        cpu_idle = true
      }
      env {
        name  = "MCP_ALLOWED_HOSTS"
        value = join(",", compact([var.domain, local.run_host]))
      }
    }
  }
  depends_on = [google_project_service.main]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.mcp.name
  location = google_cloud_run_v2_service.mcp.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

check "run_host" {
  assert {
    condition     = google_cloud_run_v2_service.mcp.uri == "https://${local.run_host}"
    error_message = "The service's URI is not the deterministic host in MCP_ALLOWED_HOSTS; a POST to /mcp on the run.app address will be refused until run.tf names the real host."
  }
}
