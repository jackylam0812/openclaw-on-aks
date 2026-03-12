#---------------------------------------------------------------
# Azure Container Registry (ACR)
# Replaces AWS ECR
#---------------------------------------------------------------

resource "azurerm_container_registry" "main" {
  name                = replace("${local.name}acr", "-", "")
  location            = local.location
  resource_group_name = local.resource_group
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

# Grant AKS kubelet identity pull access to ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
}
