# Every value that is one deployment's own. The caller reads them from its deployment.json.
variable "resource_group_name" { type = string }
variable "registry_name" { type = string }
variable "domain" { type = string }
variable "budget_chf" { type = number }
# The first of the month the budget starts counting from. Azure replaces a budget whose start
# changes, so the date is written down once rather than taken from the clock.
variable "budget_start" {
  type = string
  validation {
    condition     = can(regex("^\\d{4}-\\d{2}-01$", var.budget_start))
    error_message = "budget_start is the first of a month, YYYY-MM-01."
  }
}
variable "image" {
  description = "The image to run, pushed by the same workflow run"
  type        = string
}
# Container Apps gives the app a generated host name that is not knowable before it exists, and
# the service's own environment needs it. Empty on a deployment's first apply; the check in
# app.tf then names it.
variable "app_host" {
  type    = string
  default = ""
}
# Azure checks the domain's two records when the domain is added, so the domain is added only
# once the owner has set them from the dns_records output and said so here.
variable "dns_ready" {
  type    = bool
  default = false
}
