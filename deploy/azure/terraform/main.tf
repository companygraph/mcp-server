# The resources every deployment of the server runs on Azure: the Container Apps environment the
# chat joins, its general log workspace, the service and its domain, and the budget. The caller
# holds the backend and the providers; the resource group, the registry and the identities CI
# acts as are the bootstrap's.
terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 5.7" }
    azapi   = { source = "Azure/azapi", version = "~> 2.13" }
  }
}

data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

data "azurerm_container_registry" "this" {
  name                = var.registry_name
  resource_group_name = var.resource_group_name
}
