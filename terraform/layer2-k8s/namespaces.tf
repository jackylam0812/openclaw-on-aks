#---------------------------------------------------------------
# Kubernetes Namespaces
#---------------------------------------------------------------

resource "kubernetes_namespace_v1" "kata_system" {
  metadata {
    name = "kata-system"
    labels = {
      name = "kata-system"
    }
  }
}

resource "kubernetes_namespace_v1" "openclaw" {
  metadata {
    name = "openclaw"
    labels = {
      name = "openclaw"
    }
  }
}

resource "kubernetes_namespace_v1" "litellm" {
  metadata {
    name = "litellm"
  }
}
