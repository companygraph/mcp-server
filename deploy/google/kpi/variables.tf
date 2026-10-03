# The deployment's own values, which the caller reads from its deployment.json as it does for
# the service's module.
variable "project" { type = string }
variable "project_number" { type = string }
variable "region" { type = string }
