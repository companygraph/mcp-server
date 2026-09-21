# Every value that is one deployment's own. The caller reads them from its deployment.json.
variable "project" { type = string }
variable "project_number" { type = string }
variable "billing_account" { type = string }
variable "region" { type = string }
variable "domain" { type = string }
variable "site_id" { type = string }
variable "budget_chf" { type = number }
variable "image" {
  description = "The image to run, pushed by the same workflow run"
  type        = string
}
# Cloud Run gives a service the hashed form of its URL, which is not knowable before it exists,
# and the service's own environment needs it, so it cannot be read from the service's uri:
# that is a cycle. Empty on a deployment's first apply; the check in run.tf then names it.
variable "run_host" {
  type    = string
  default = ""
}
