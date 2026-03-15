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

  # Enable Azure Disk CSI driver (Azure Files not used)
  storage_profile {
    disk_driver_enabled = true
    file_driver_enabled = false
  }

  tags = local.tags
}

#---------------------------------------------------------------
# Kata Node Pool with AKS native Kata/Mshv isolation
#
# Uses azapi_resource because the azurerm provider validation
# only accepts OCIContainer and WasmWasi for workload_runtime.
# The Azure REST API accepts KataMshvVmIsolation directly.
#---------------------------------------------------------------
resource "azapi_resource" "kata_node_pool" {
  type      = "Microsoft.ContainerService/managedClusters/agentPools@2024-09-01"
  name      = "kata"
  parent_id = azurerm_kubernetes_cluster.main.id

  body = {
    properties = {
      vmSize            = var.kata_node_vm_size
      vnetSubnetID      = azurerm_subnet.kata.id
      osType            = "Linux"
      osSKU             = "AzureLinux"
      mode              = "User"
      enableAutoScaling = true
      minCount          = var.kata_node_min_count
      maxCount          = var.kata_node_max_count
      osDiskSizeGB      = 200
      workloadRuntime   = "KataMshvVmIsolation"

      nodeLabels = {
        "workload-type"                  = "kata"
        "katacontainers.io/kata-runtime" = "true"
      }

      nodeTaints = [
        "kata=true:NoSchedule"
      ]
    }
  }
}

#---------------------------------------------------------------
# Role Assignment: AKS cluster identity -> VNet
#---------------------------------------------------------------
resource "azurerm_role_assignment" "aks_network_contributor" {
  scope                = azurerm_virtual_network.main.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_kubernetes_cluster.main.identity[0].principal_id
}
