#---------------------------------------------------------------
# Azure Workload Identity for OpenClaw Sandboxes
# Replaces AWS EKS Pod Identity with Azure OIDC Federation
#---------------------------------------------------------------

# Managed Identity for OpenClaw workloads
resource "azurerm_user_assigned_identity" "openclaw" {
  name                = "${local.name}-openclaw-identity"
  location            = local.location
  resource_group_name = local.resource_group
  tags                = local.tags
}

# Federated credential: binds the Managed Identity to the
# openclaw-sandbox ServiceAccount in the default namespace
resource "azurerm_federated_identity_credential" "openclaw_sandbox" {
  name      = "${local.name}-openclaw-sandbox-fic"
  parent_id = azurerm_user_assigned_identity.openclaw.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = azurerm_kubernetes_cluster.main.oidc_issuer_url
  subject   = "system:serviceaccount:default:openclaw-sandbox"
}

# Grant Cognitive Services OpenAI User role for Azure OpenAI access
resource "azurerm_role_assignment" "openclaw_openai" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.openclaw.principal_id
}

# Kubernetes ServiceAccount annotated with Workload Identity
resource "kubernetes_service_account_v1" "openclaw_sandbox" {
  metadata {
    name      = "openclaw-sandbox"
    namespace = "default"
    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.openclaw.client_id
    }
    labels = {
      "azure.workload.identity/use" = "true"
    }
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}

#---------------------------------------------------------------
# Managed Identity for LiteLLM (Azure OpenAI access)
#---------------------------------------------------------------
resource "azurerm_user_assigned_identity" "litellm" {
  name                = "${local.name}-litellm-identity"
  location            = local.location
  resource_group_name = local.resource_group
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "litellm" {
  name      = "${local.name}-litellm-fic"
  parent_id = azurerm_user_assigned_identity.litellm.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = azurerm_kubernetes_cluster.main.oidc_issuer_url
  subject   = "system:serviceaccount:litellm:litellm"
}

resource "azurerm_role_assignment" "litellm_openai" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.litellm.principal_id
}
