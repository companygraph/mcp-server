# The domain in three steps, because azurerm adds a host name and issues a free certificate for it
# but cannot bind the one to the other (hashicorp/terraform-provider-azurerm#27362): the host
# name is added unbound, the certificate is issued against a CNAME that points straight at the
# app, and one PATCH of the app's custom domains binds them. The binding's two fields change
# under the custom domain once the PATCH lands, so they are ignored there.
resource "azurerm_container_app_custom_domain" "this" {
  count            = var.dns_ready ? 1 : 0
  name             = var.domain
  container_app_id = azurerm_container_app.mcp.id
  lifecycle {
    ignore_changes = [certificate_binding_type, container_app_environment_certificate_id]
  }
}

resource "azurerm_container_app_environment_managed_certificate" "this" {
  count                        = var.dns_ready ? 1 : 0
  name                         = "mcp"
  container_app_environment_id = azurerm_container_app_environment.this.id
  subject_name                 = var.domain
  domain_control_validation    = "CNAME"
  depends_on                   = [azurerm_container_app_custom_domain.this]
}

resource "azapi_resource_action" "bind" {
  count       = var.dns_ready ? 1 : 0
  type        = "Microsoft.App/containerApps@2025-07-01"
  resource_id = azurerm_container_app.mcp.id
  method      = "PATCH"
  body = {
    properties = {
      configuration = {
        ingress = {
          customDomains = [{
            name          = var.domain
            bindingType   = "SniEnabled"
            certificateId = azurerm_container_app_environment_managed_certificate.this[0].id
          }]
        }
      }
    }
  }
}
