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

# Apply subagent RBAC (ServiceAccount, Role, RoleBinding, ClusterRole for TTL controller)
resource "null_resource" "agent_sandbox_subagent_rbac" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/subagent-rbac.yaml"
  }

  depends_on = [null_resource.agent_sandbox_core]
}

# Apply subagent sandbox template ConfigMap
resource "null_resource" "agent_sandbox_subagent_template" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/subagent-sandbox-template.yaml"
  }

  depends_on = [null_resource.agent_sandbox_subagent_rbac]
}

# Apply subagent configuration ConfigMap
resource "null_resource" "agent_sandbox_subagent_config" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/subagent-config.yaml"
  }

  depends_on = [null_resource.agent_sandbox_subagent_rbac]
}

# Apply subagent controller deployment
resource "null_resource" "agent_sandbox_subagent_controller" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/subagent-controller.yaml"
  }

  depends_on = [
    null_resource.agent_sandbox_subagent_template,
    null_resource.agent_sandbox_subagent_config,
  ]
}

# Apply TTL controller CronJob for auto-cleanup of expired subagent sandboxes
resource "null_resource" "agent_sandbox_ttl_controller" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/agent-sandbox/ttl-controller.yaml"
  }

  depends_on = [null_resource.agent_sandbox_subagent_rbac]
}
