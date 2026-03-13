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
    name                = "system"
    vm_size             = var.system_node_vm_size
    vnet_subnet_id      = azurerm_subnet.system.id
    auto_scaling_enabled = true
    min_count           = 1
    max_count           = 3
    os_disk_size_gb     = 100
    os_sku              = "AzureLinux"

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

    load_balancer_profile {
      managed_outbound_ip_count = 1
    }
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
  # Note: workload_runtime is not used for Kata Containers node pools.
  # Kata isolation is configured via the kata-mshv-vm-isolation RuntimeClass
  # and node labels/taints. The azurerm provider only accepts OCIContainer
  # or WasmWasi for this field.
  os_sku                = "AzureLinux"

  auto_scaling_enabled = true
  min_count            = var.kata_node_min_count
  max_count            = var.kata_node_max_count
  os_disk_size_gb      = 200

  node_labels = {
    "workload-type"                    = "kata"
    "katacontainers.io/kata-runtime"   = "true"
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

#---------------------------------------------------------------
# Namespaces
#---------------------------------------------------------------
resource "kubernetes_namespace_v1" "kata_system" {
  metadata {
    name = local.kata_namespace
    labels = {
      name = local.kata_namespace
    }
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}

resource "kubernetes_namespace_v1" "openclaw" {
  metadata {
    name = local.openclaw_namespace
    labels = {
      name = local.openclaw_namespace
    }
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}
