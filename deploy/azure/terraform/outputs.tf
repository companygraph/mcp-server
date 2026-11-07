output "service_url" { value = "https://${azurerm_container_app.mcp.ingress[0].fqdn}" }
output "app_host" { value = azurerm_container_app.mcp.ingress[0].fqdn }
output "environment_name" { value = azurerm_container_app_environment.this.name }
output "logs_workspace_name" { value = azurerm_log_analytics_workspace.logs.name }
output "dns_records" {
  description = "What the domain needs before dns_ready; create these at the DNS provider of the deployment's domain"
  value = [
    { name = var.domain, type = "CNAME", value = azurerm_container_app.mcp.ingress[0].fqdn },
    # The id is published in a DNS record, so the mark azurerm puts on it protects nothing and
    # would make every root mark this output sensitive in turn.
    { name = "asuid.${var.domain}", type = "TXT", value = nonsensitive(azurerm_container_app.mcp.custom_domain_verification_id) },
  ]
}
