#---------------------------------------------------------------
# Prometheus and Grafana for monitoring
#---------------------------------------------------------------

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace_v1.monitoring.metadata[0].name
  version    = "65.0.0"

  values = [
    yamlencode({
      prometheus = {
        prometheusSpec = {
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "azure-disk-premium"
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = "50Gi"
                  }
                }
              }
            }
          }
          retention = "15d"
          resources = {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2000m"
              memory = "4Gi"
            }
          }
        }
      }
      grafana = {
        enabled       = true
        adminPassword = local.layer1.grafana_admin_password
        persistence = {
          enabled          = true
          storageClassName = "azure-disk-premium"
          size             = "10Gi"
        }
        service = {
          type = "ClusterIP"
        }
      }
      alertmanager = {
        enabled = false
      }
    })
  ]

  depends_on = [
    kubernetes_storage_class_v1.azure_disk_premium,
  ]
}

# Custom ServiceMonitor with correct path
resource "kubectl_manifest" "litellm_servicemonitor" {
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "litellm"
      namespace = kubernetes_namespace_v1.litellm.metadata[0].name
      labels = {
        release = "kube-prometheus-stack"
      }
    }
    spec = {
      selector = {
        matchLabels = {
          "app.kubernetes.io/name"     = "litellm"
          "app.kubernetes.io/instance" = "litellm"
        }
      }
      endpoints = [{
        port          = "http"
        path          = "/metrics"
        interval      = "30s"
        scrapeTimeout = "10s"
      }]
    }
  })

  depends_on = [
    helm_release.litellm,
    helm_release.kube_prometheus_stack,
  ]
}
