output "configure_kubectl" {
  description = "Configure kubectl: run this command to update your kubeconfig"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "cluster_name" {
  description = "AKS cluster name"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_endpoint" {
  description = "AKS cluster API server URL"
  value       = azurerm_kubernetes_cluster.main.kube_config[0].host
  sensitive   = true
}

output "resource_group" {
  description = "Azure resource group name"
  value       = azurerm_resource_group.main.name
}

output "kata_namespace" {
  description = "Kata system namespace"
  value       = local.kata_namespace
}

output "openclaw_namespace" {
  description = "OpenClaw namespace"
  value       = local.openclaw_namespace
}

output "key_vault_name" {
  description = "Azure Key Vault name"
  value       = azurerm_key_vault.main.name
}

output "acr_login_server" {
  description = "Azure Container Registry login server"
  value       = azurerm_container_registry.main.login_server
}

output "foundry_endpoint" {
  description = "Azure AI Services endpoint URL (used by LiteLLM for gpt-5.4)"
  value       = azurerm_ai_services.foundry.endpoint
}

output "foundry_hub_name" {
  description = "Azure AI Foundry Hub name"
  value       = azurerm_ai_foundry.main.name
}

output "foundry_project_name" {
  description = "Azure AI Foundry Project name"
  value       = azurerm_ai_foundry_project.main.name
}

output "foundry_resource_group" {
  description = "Azure AI Foundry resource group"
  value       = azurerm_resource_group.foundry.name
}
