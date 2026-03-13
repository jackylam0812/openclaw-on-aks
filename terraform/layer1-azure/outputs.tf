output "cluster_name" {
  value = azurerm_kubernetes_cluster.main.name
}

output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "cluster_host" {
  value     = azurerm_kubernetes_cluster.main.kube_config[0].host
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = azurerm_kubernetes_cluster.main.kube_config[0].cluster_ca_certificate
  sensitive = true
}

output "client_certificate" {
  value     = azurerm_kubernetes_cluster.main.kube_config[0].client_certificate
  sensitive = true
}

output "client_key" {
  value     = azurerm_kubernetes_cluster.main.kube_config[0].client_key
  sensitive = true
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "acr_name" {
  value = azurerm_container_registry.main.name
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

output "foundry_endpoint" {
  value = azurerm_ai_services.foundry.endpoint
}

output "foundry_hub_name" {
  value = azurerm_ai_foundry.main.name
}

output "foundry_project_name" {
  value = azurerm_ai_foundry_project.main.name
}

output "foundry_resource_group" {
  value = azurerm_resource_group.foundry.name
}

output "litellm_db_password" {
  value     = random_password.litellm_db.result
  sensitive = true
}

output "litellm_db_admin_password" {
  value     = random_password.litellm_db_admin.result
  sensitive = true
}

output "litellm_managed_identity_client_id" {
  value = azurerm_user_assigned_identity.litellm.client_id
}

output "openclaw_managed_identity_client_id" {
  value = azurerm_user_assigned_identity.openclaw.client_id
}

output "configure_kubectl" {
  description = "Configure kubectl: run this command to update your kubeconfig"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "grafana_admin_password" {
  value     = random_password.grafana_admin.result
  sensitive = true
}
