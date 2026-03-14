#---------------------------------------------------------------
# Azure Disk CSI - Premium SSD StorageClass (default)
#---------------------------------------------------------------

resource "kubernetes_storage_class_v1" "azure_disk_premium" {
  metadata {
    name = "azure-disk-premium"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "disk.csi.azure.com"
  reclaim_policy         = "Delete"
  allow_volume_expansion = true
  volume_binding_mode    = "WaitForFirstConsumer"

  parameters = {
    skuName = "Premium_LRS"
  }
}
