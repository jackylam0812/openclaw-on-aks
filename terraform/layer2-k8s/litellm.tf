#---------------------------------------------------------------
# LiteLLM Proxy - Azure OpenAI Backend
#---------------------------------------------------------------

resource "helm_release" "litellm" {
  name      = "litellm"
  chart     = "oci://ghcr.io/berriai/litellm-helm"
  namespace = kubernetes_namespace_v1.litellm.metadata[0].name

  # Let Helm manage the ServiceAccount; inject workload identity via annotations
  set {
    name  = "serviceAccount.create"
    value = "true"
    type  = "string"
  }

  set {
    name  = "serviceAccount.name"
    value = "litellm"
  }

  set {
    name  = "serviceAccount.annotations.azure\\.workload\\.identity/client-id"
    value = local.layer1.litellm_managed_identity_client_id
  }

  # Inject Workload Identity label so AKS mutating webhook injects
  # AZURE_CLIENT_ID / AZURE_FEDERATED_TOKEN_FILE into the pod
  set {
    name  = "podLabels.azure\\.workload\\.identity/use"
    value = "true"
    type  = "string"
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
    type  = "string"
  }

  set_sensitive {
    name  = "postgresql.auth.password"
    value = local.layer1.litellm_db_password
  }

  set_sensitive {
    name  = "postgresql.auth.postgres-password"
    value = local.layer1.litellm_db_admin_password
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
    value = local.layer1.foundry_endpoint
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
    helm_release.kube_prometheus_stack,
  ]
}
