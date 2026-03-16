#---------------------------------------------------------------
# LiteLLM Proxy - Azure OpenAI Backend
#---------------------------------------------------------------

resource "helm_release" "litellm" {
  name      = "litellm"
  chart     = "oci://ghcr.io/berriai/litellm-helm"
  namespace = kubernetes_namespace_v1.litellm.metadata[0].name

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

  # Azure OpenAI API key (regional endpoint requires key-based auth)
  set_sensitive {
    name  = "proxy_config.model_list[0].litellm_params.api_key"
    value = local.layer1.foundry_api_key
  }

  # Enable dynamic model management via /model/new API
  set {
    name  = "proxy_config.general_settings.store_model_in_db"
    value = "true"
    type  = "string"
  }

  set {
    name  = "envVars.STORE_MODEL_IN_DB"
    value = "True"
  }

}
