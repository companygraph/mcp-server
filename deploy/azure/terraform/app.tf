# The environment the server and the chat share, and the workspace that keeps its general logs
# thirty days. The environment writes to Azure Monitor rather than to one workspace, so the chat's
# module can send its kept questions to a workspace of their own through a second diagnostic
# setting; a transformation the chat's module sets on this workspace keeps them out of it.
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "logs"
  location            = data.azurerm_resource_group.this.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  lifecycle {
    ignore_changes = [data_collection_rule_id]
  }
}

resource "azurerm_container_app_environment" "this" {
  name                = "apps"
  location            = data.azurerm_resource_group.this.location
  resource_group_name = var.resource_group_name
  logs_destination    = "azure-monitor"
}

resource "azurerm_monitor_diagnostic_setting" "logs" {
  name                       = "logs"
  target_resource_id         = azurerm_container_app_environment.this.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  enabled_log { category = "ContainerAppConsoleLogs" }
  enabled_log { category = "ContainerAppSystemLogs" }
}

# The service's own identity, which may pull its image and holds nothing else.
resource "azurerm_user_assigned_identity" "run" {
  name                = "mcp-run"
  location            = data.azurerm_resource_group.this.location
  resource_group_name = var.resource_group_name
}

resource "azurerm_role_assignment" "pull" {
  scope                = data.azurerm_container_registry.this.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.run.principal_id
}

locals {
  app_host = var.app_host
}

resource "azurerm_container_app" "mcp" {
  name                         = "mcp"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.run.id]
  }

  registry {
    server   = data.azurerm_container_registry.this.login_server
    identity = azurerm_user_assigned_identity.run.id
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 3
    http_scale_rule {
      name                = "http"
      concurrent_requests = "20"
    }
    container {
      name   = "mcp"
      image  = var.image
      cpu    = 0.25
      memory = "0.5Gi"
      env {
        name  = "MCP_ALLOWED_HOSTS"
        value = join(",", compact([var.domain, local.app_host]))
      }
    }
  }

  depends_on = [azurerm_role_assignment.pull]
}

check "app_host" {
  assert {
    condition     = azurerm_container_app.mcp.ingress[0].fqdn == local.app_host
    error_message = "The app's host name is not the app_host in MCP_ALLOWED_HOSTS; a POST to /mcp on that name will be refused until deployment.json names the host this app carries as app_host."
  }
}
