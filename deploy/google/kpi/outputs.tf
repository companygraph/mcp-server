output "bucket" { value = google_storage_bucket.kpi.name }
output "service_account" { value = google_service_account.reporter.email }
