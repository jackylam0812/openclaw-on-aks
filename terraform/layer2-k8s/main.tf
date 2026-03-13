terraform {
  required_version = ">= 1.3.2"

  backend "local" {
    path = "../../terraform-states/layer2/terraform.tfstate"
  }

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.10"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = ">= 2.0"
    }
  }
}

data "terraform_remote_state" "layer1" {
  backend = "local"
  config = {
    path = "../../terraform-states/layer1/terraform.tfstate"
  }
}

locals {
  layer1                 = data.terraform_remote_state.layer1.outputs
  cluster_host           = local.layer1.cluster_host
  cluster_ca_certificate = base64decode(local.layer1.cluster_ca_certificate)
  client_certificate     = base64decode(local.layer1.client_certificate)
  client_key             = base64decode(local.layer1.client_key)
}

provider "kubernetes" {
  host                   = local.cluster_host
  client_certificate     = local.client_certificate
  client_key             = local.client_key
  cluster_ca_certificate = local.cluster_ca_certificate
}

provider "helm" {
  kubernetes {
    host                   = local.cluster_host
    client_certificate     = local.client_certificate
    client_key             = local.client_key
    cluster_ca_certificate = local.cluster_ca_certificate
  }
}

provider "kubectl" {
  apply_retry_count      = 30
  host                   = local.cluster_host
  client_certificate     = local.client_certificate
  client_key             = local.client_key
  cluster_ca_certificate = local.cluster_ca_certificate
  load_config_file       = false
}
