#---------------------------------------------------------------
# Azure OpenAI (AI Foundry) - GPT-5.4 deployment
# Supported regions: eastus2, swedencentral, polandcentral, southcentralus
#---------------------------------------------------------------

resource "azurerm_resource_group" "openai" {
  name     = "${var.name}-openai-rg"
  location = var.openai_location
  tags     = local.tags
}

resource "azurerm_cognitive_account" "openai" {
  name                = replace("${var.name}-aoai", "-", "")
  location            = azurerm_resource_group.openai.location
  resource_group_name = azurerm_resource_group.openai.name
  kind                = "OpenAI"
  sku_name            = "S0"

  custom_subdomain_name         = replace("${var.name}-aoai", "-", "")
  public_network_access_enabled = true

  tags = local.tags
}

resource "azurerm_cognitive_deployment" "gpt54" {
  name                 = "gpt-5.4"
  cognitive_account_id = azurerm_cognitive_account.openai.id

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

# Grant LiteLLM Managed Identity access to this specific OpenAI account
resource "azurerm_role_assignment" "litellm_openai_scoped" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.litellm.principal_id
}

# Grant openclaw-sandbox Managed Identity access too
resource "azurerm_role_assignment" "openclaw_openai_scoped" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.openclaw.principal_id
}
