#---------------------------------------------------------------
# Azure AI Foundry + gpt-5.4 deployment
#
# Architecture:
#   azurerm_ai_services   (AI Services account, OpenAI kind)
#     └── azurerm_cognitive_deployment  (gpt-5.4 model)
#   azurerm_ai_foundry    (Foundry Hub, wraps AI Services)
#     └── azurerm_ai_foundry_project    (Foundry Project)
#
# Supported regions for gpt-5.4:
#   eastus2, swedencentral, polandcentral, southcentralus
#---------------------------------------------------------------

resource "azurerm_resource_group" "foundry" {
  name     = "${var.name}-foundry-rg"
  location = var.foundry_location
  tags     = local.tags
}

#---------------------------------------------------------------
# Storage Account (required by AI Foundry Hub)
#---------------------------------------------------------------
resource "azurerm_storage_account" "foundry" {
  name                     = substr(replace("${var.name}foundry", "-", ""), 0, 24)
  location                 = azurerm_resource_group.foundry.location
  resource_group_name      = azurerm_resource_group.foundry.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = local.tags
}

#---------------------------------------------------------------
# Key Vault (required by AI Foundry Hub)
# Reuse the existing KV from key-vault.tf if same region,
# otherwise create a dedicated one for Foundry
#---------------------------------------------------------------
resource "azurerm_key_vault" "foundry" {
  name                       = substr(replace("${var.name}-fkv", "-", ""), 0, 24)
  location                   = azurerm_resource_group.foundry.location
  resource_group_name        = azurerm_resource_group.foundry.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = true   # required by AI Foundry

  rbac_authorization_enabled = true
  tags                       = local.tags
}

resource "azurerm_role_assignment" "foundry_kv_admin" {
  scope                = azurerm_key_vault.foundry.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

#---------------------------------------------------------------
# Azure AI Services (OpenAI + other AI APIs)
# This is the resource that hosts model deployments
#---------------------------------------------------------------
resource "azurerm_ai_services" "foundry" {
  name                = substr(replace("${var.name}-aisvcs", "-", ""), 0, 24)
  location            = azurerm_resource_group.foundry.location
  resource_group_name = azurerm_resource_group.foundry.name
  sku_name            = "S0"

  tags = local.tags
}

#---------------------------------------------------------------
# GPT-5.4 model deployment
#---------------------------------------------------------------
resource "azurerm_cognitive_deployment" "gpt54" {
  name                 = "gpt-5.4"
  cognitive_account_id = azurerm_ai_services.foundry.id

  model {
    format  = "OpenAI"
    name    = "gpt-5.4"
    version = "2025-04-14"
  }

  sku {
    name     = "GlobalStandard"
    capacity = 50
  }
}

#---------------------------------------------------------------
# AI Foundry Hub
#---------------------------------------------------------------
resource "azurerm_ai_foundry" "main" {
  name                = substr(replace("${var.name}-hub", "-", ""), 0, 32)
  location            = azurerm_resource_group.foundry.location
  resource_group_name = azurerm_resource_group.foundry.name
  storage_account_id  = azurerm_storage_account.foundry.id
  key_vault_id        = azurerm_key_vault.foundry.id

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags

  depends_on = [azurerm_role_assignment.foundry_kv_admin]
}

#---------------------------------------------------------------
# AI Foundry Project
#---------------------------------------------------------------
resource "azurerm_ai_foundry_project" "main" {
  name               = substr(replace("${var.name}-proj", "-", ""), 0, 32)
  location           = azurerm_ai_foundry.main.location
  ai_services_hub_id = azurerm_ai_foundry.main.id

  tags = local.tags
}

#---------------------------------------------------------------
# Role assignments: LiteLLM + OpenClaw sandbox → AI Services
#---------------------------------------------------------------
resource "azurerm_role_assignment" "litellm_openai_scoped" {
  scope                = azurerm_ai_services.foundry.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.litellm.principal_id
}

resource "azurerm_role_assignment" "openclaw_openai_scoped" {
  scope                = azurerm_ai_services.foundry.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.openclaw.principal_id
}
