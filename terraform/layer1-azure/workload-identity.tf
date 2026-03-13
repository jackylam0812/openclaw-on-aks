#---------------------------------------------------------------
# Azure Workload Identity - Azure resources only
# (Kubernetes ServiceAccounts are in layer2-k8s)
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

# Managed Identity for LiteLLM (Azure OpenAI access)
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

# Role assignments for OpenAI access are in azure-openai.tf
# (azurerm_role_assignment.litellm_openai_scoped and openclaw_openai_scoped)
