# A monthly budget of budget_chf in the billing account's currency, three warnings, to the resource
# group's owners. It warns and stops nothing, as the Google budget does.
resource "azurerm_consumption_budget_resource_group" "monthly" {
  name              = "monthly"
  resource_group_id = data.azurerm_resource_group.this.id
  amount            = var.budget_chf
  time_grain        = "Monthly"
  time_period {
    start_date = "${var.budget_start}T00:00:00Z"
  }
  dynamic "notification" {
    for_each = [50, 90, 100]
    content {
      enabled        = true
      threshold      = notification.value
      operator       = "GreaterThanOrEqualTo"
      threshold_type = "Actual"
      contact_roles  = ["Owner"]
    }
  }
}
