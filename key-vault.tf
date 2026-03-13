#---------------------------------------------------------------
# Azure Key Vault for secrets management
# Replaces AWS Secrets Manager
#---------------------------------------------------------------

resource "azurerm_key_vault" "main" {
  name                       = replace("${local.name}-kv", "-", "")
  location                   = local.location
  resource_group_name        = local.resource_group
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  rbac_authorization_enabled = true

  tags = local.tags
}

# Grant current user Key Vault admin for managing secrets
resource "azurerm_role_assignment" "kv_admin" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Grant AKS Key Vault Secrets User for CSI driver
resource "azurerm_role_assignment" "aks_kv_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_kubernetes_cluster.main.key_vault_secrets_provider[0].secret_identity[0].object_id
}

# Store Azure OpenAI API Key in Key Vault (if provided)
resource "azurerm_key_vault_secret" "azure_openai_api_key" {
  count        = var.azure_openai_api_key != "" ? 1 : 0
  name         = "azure-openai-api-key"
  value        = var.azure_openai_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.kv_admin]
}
