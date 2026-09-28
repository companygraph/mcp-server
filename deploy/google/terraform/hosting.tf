# Firebase Hosting in front of the service: the attachment, the site, one version whose only
# rule sends every path to the service and marks the whole site uncacheable, its release, and
# the domain.
#
# Every path and not only /mcp. With one rule for /mcp, the host answered everything else
# itself — a person who typed the domain into a browser got Firebase's "Site Not Found", and
# /health returned 404 in public while returning 200 on the service behind it. Routing the lot
# here means the server owns its own paths and its own 404, and a path it grows later needs no
# apply.
resource "google_firebase_project" "this" {
  provider   = google-beta
  project    = var.project
  depends_on = [google_project_service.main]
}

resource "google_firebase_hosting_site" "this" {
  provider   = google-beta
  project    = var.project
  site_id    = var.site_id
  depends_on = [google_firebase_project.this]
}

resource "google_firebase_hosting_version" "this" {
  provider = google-beta
  site_id  = google_firebase_hosting_site.this.site_id
  config {
    rewrites {
      glob = "**"
      run {
        service_id = google_cloud_run_v2_service.mcp.name
        region     = google_cloud_run_v2_service.mcp.location
      }
    }
    headers {
      glob    = "**"
      headers = { "Cache-Control" = "no-store" }
    }
  }
}

resource "google_firebase_hosting_release" "this" {
  provider     = google-beta
  site_id      = google_firebase_hosting_site.this.site_id
  version_name = google_firebase_hosting_version.this.name
  message      = "Every path rewritten to Cloud Run"
}

resource "google_firebase_hosting_custom_domain" "this" {
  provider              = google-beta
  project               = var.project
  site_id               = google_firebase_hosting_site.this.site_id
  custom_domain         = var.domain
  wait_dns_verification = false
}
