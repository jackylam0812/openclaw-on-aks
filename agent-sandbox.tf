#---------------------------------------------------------------
# Agent Sandbox Installation
#---------------------------------------------------------------

# Apply core manifest
resource "null_resource" "agent_sandbox_core" {
  provisioner "local-exec" {
    command = <<-EOT
      az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name} --overwrite-existing
      kubectl apply -f ${path.module}/agent-sandbox/manifest.yaml
    EOT
  }

  depends_on = [
    azurerm_kubernetes_cluster.main,
    azurerm_kubernetes_cluster_node_pool.kata,
  ]
}

# Apply extensions manifest
resource "null_resource" "agent_sandbox_extensions" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/extensions.yaml"
  }

  depends_on = [null_resource.agent_sandbox_core]
}
