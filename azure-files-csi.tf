#---------------------------------------------------------------
# Azure Files CSI - Premium StorageClass for shared storage
# AKS ships with azure-file-csi built-in; we create a custom
# StorageClass with Premium settings for OpenClaw sandboxes.
#---------------------------------------------------------------

resource "kubernetes_storage_class_v1" "azure_files_premium" {
  metadata {
    name = "azure-files-premium"
  }

  storage_provisioner    = "file.csi.azure.com"
  reclaim_policy         = "Delete"
  allow_volume_expansion = true

  parameters = {
    skuName = "Premium_LRS"
  }

  mount_options = ["dir_mode=0700", "file_mode=0700", "uid=1000", "gid=1000"]

  depends_on = [azurerm_kubernetes_cluster.main]
}
