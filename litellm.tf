#---------------------------------------------------------------
# LiteLLM Proxy - Azure OpenAI Backend
#---------------------------------------------------------------

resource "kubernetes_namespace_v1" "litellm" {
  metadata {
    name = "litellm"
  }
}

resource "kubernetes_service_account_v1" "litellm" {
  metadata {
    name      = "litellm"
    namespace = kubernetes_namespace_v1.litellm.metadata[0].name
    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.litellm.client_id
    }
    labels = {
      "azure.workload.identity/use" = "true"
    }
  }
}

resource "helm_release" "litellm" {
  name      = "litellm"
  chart     = "oci://ghcr.io/berriai/litellm-helm"
  namespace = kubernetes_namespace_v1.litellm.metadata[0].name

  set {
    name  = "serviceAccount.create"
    value = "false"
  }

  set {
    name  = "serviceAccount.name"
    value = kubernetes_service_account_v1.litellm.metadata[0].name
  }

  # Use latest stable image
  set {
    name  = "image.tag"
    value = "main-latest"
  }

  # Database
  set {
    name  = "db.deployStandalone"
    value = "true"
  }

  set_sensitive {
    name  = "postgresql.auth.password"
    value = random_password.litellm_db.result
  }

  set_sensitive {
    name  = "postgresql.auth.postgres-password"
    value = random_password.litellm_db_admin.result
  }

  # Azure OpenAI model - GPT-5.4 (mapped as gpt-5.4 for OpenClaw compatibility)
  set {
    name  = "proxy_config.model_list[0].model_name"
    value = "gpt-5.4"
  }

  set {
    name  = "proxy_config.model_list[0].litellm_params.model"
    value = "azure/gpt-5.4"
  }

  set {
    name  = "proxy_config.model_list[0].litellm_params.api_base"
    value = var.azure_openai_endpoint
  }

  set {
    name  = "proxy_config.model_list[0].litellm_params.api_version"
    value = "2025-04-01-preview"
  }

  # Enable Prometheus metrics
  set {
    name  = "proxy_config.litellm_settings.callbacks[0]"
    value = "prometheus"
  }

  # Monitoring - disable built-in ServiceMonitor, we create our own
  set {
    name  = "serviceMonitor.enabled"
    value = "false"
  }

  depends_on = [
    azurerm_kubernetes_cluster.main,
    helm_release.kube_prometheus_stack,
    azurerm_federated_identity_credential.litellm,
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

resource "random_password" "litellm_db" {
  length  = 32
  special = true
}

resource "random_password" "litellm_db_admin" {
  length  = 32
  special = true
}

output "litellm_db_password" {
  value     = random_password.litellm_db.result
  sensitive = true
}

output "litellm_db_admin_password" {
  value     = random_password.litellm_db_admin.result
  sensitive = true
}
