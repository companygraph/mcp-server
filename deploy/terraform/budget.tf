# A monthly budget of budget_chf francs, three warnings, to whoever administers the billing account.
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "${var.domain} monthly"
  budget_filter {
    projects = ["projects/${var.project_number}"]
  }
  amount {
    specified_amount {
      currency_code = "CHF"
      units         = tostring(var.budget_chf)
    }
  }
  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0 }
  depends_on = [google_project_service.main]
}
