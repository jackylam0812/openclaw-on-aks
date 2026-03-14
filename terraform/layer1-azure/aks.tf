#---------------------------------------------------------------
# AKS Cluster with System + Kata Node Pools
#---------------------------------------------------------------

resource "azurerm_kubernetes_cluster" "main" {
  name                = local.name
  location            = local.location
  resource_group_name = local.resource_group
  dns_prefix          = local.name
  kubernetes_version  = var.kubernetes_version

  # System node pool (default)
  default_node_pool {
    name                 = "system"
    vm_size              = var.system_node_vm_size
    vnet_subnet_id       = azurerm_subnet.system.id
    auto_scaling_enabled = true
    min_count            = 1
    max_count            = 3
    os_disk_size_gb      = 100
    os_sku               = "AzureLinux"

    node_labels = {
      "WorkerType"    = "ON_DEMAND"
      "NodeGroupType" = "core"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  # Azure CNI Overlay for pod networking
  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_policy      = "calico"
    load_balancer_sku   = "standard"
    service_cidr        = "172.16.0.0/16"
    dns_service_ip      = "172.16.0.10"
    pod_cidr            = "10.244.0.0/16"

    # No load_balancer_profile — AKS manages outbound IPs automatically.
    # Do NOT combine with NAT Gateway on the same subnet (causes asymmetric routing).
  }

  # Enable OIDC issuer for Workload Identity
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # Enable Azure Disk and Azure Files CSI drivers
  storage_profile {
    disk_driver_enabled = true
    file_driver_enabled = true
  }

  # Enable Key Vault secrets provider
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "5m"
  }

  tags = local.tags
}

#---------------------------------------------------------------
# Kata Node Pool with AKS native Kata/Mshv isolation
#---------------------------------------------------------------
resource "azurerm_kubernetes_cluster_node_pool" "kata" {
  name                  = "kata"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.kata_node_vm_size
  vnet_subnet_id        = azurerm_subnet.kata.id
  os_sku                = "AzureLinux"

  auto_scaling_enabled = true
  min_count            = var.kata_node_min_count
  max_count            = var.kata_node_max_count
  os_disk_size_gb      = 200
  workload_runtime     = "KataMshvVmIsolation"

  node_labels = {
    "workload-type"                  = "kata"
    "katacontainers.io/kata-runtime" = "true"
  }

  node_taints = [
    "kata=true:NoSchedule"
  ]

  tags = local.tags
}

#---------------------------------------------------------------
# Role Assignment: AKS cluster identity -> VNet
#---------------------------------------------------------------
resource "azurerm_role_assignment" "aks_network_contributor" {
  scope                = azurerm_virtual_network.main.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_kubernetes_cluster.main.identity[0].principal_id
}
