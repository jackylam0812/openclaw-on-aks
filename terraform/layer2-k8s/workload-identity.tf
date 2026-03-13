#---------------------------------------------------------------
# Kubernetes ServiceAccounts for Workload Identity
# (Azure identity resources are in layer1-azure)
#---------------------------------------------------------------

resource "kubernetes_service_account_v1" "openclaw_sandbox" {
  metadata {
    name      = "openclaw-sandbox"
    namespace = "default"
    annotations = {
      "azure.workload.identity/client-id" = local.layer1.openclaw_managed_identity_client_id
    }
    labels = {
      "azure.workload.identity/use" = "true"
    }
  }
}
