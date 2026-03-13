terraform {
  required_version = ">= 1.3.2"

  backend "local" {
    path = "../../terraform-states/layer1/terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.19"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}

provider "azuread" {}

data "azurerm_subscription" "current" {}
data "azurerm_client_config" "current" {}
data "azuread_client_config" "current" {}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags
}

locals {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name != "" ? var.resource_group_name : "${var.name}-rg"
  resource_group      = azurerm_resource_group.main.name
  kata_namespace      = "kata-system"
  openclaw_namespace  = "openclaw"

  tags = merge(
    var.tags,
    {
      Blueprint  = local.name
      GithubRepo = "github.com/jackylam0812/openclaw-on-aks"
      Workload   = "openclaw-kata"
    },
    var.microsoft_internal ? { SecurityControl = "Ignore" } : {}
  )
}
