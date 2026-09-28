output "service_url" { value = "https://${azurerm_container_app.mcp.ingress[0].fqdn}" }
output "app_host" { value = azurerm_container_app.mcp.ingress[0].fqdn }
output "environment_name" { value = azurerm_container_app_environment.this.name }
output "logs_workspace_name" { value = azurerm_log_analytics_workspace.logs.name }
output "dns_records" {
  description = "What the domain needs before dns_ready; create these at the DNS provider of the deployment's domain"
  value = [
    { name = var.domain, type = "CNAME", value = azurerm_container_app.mcp.ingress[0].fqdn },
    { name = "asuid.${var.domain}", type = "TXT", value = azurerm_container_app.mcp.custom_domain_verification_id },
  ]
}
