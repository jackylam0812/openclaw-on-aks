variable "name" {
  description = "Name prefix for all resources (used as AKS cluster name and resource prefix)"
  default     = "openclaw-kata-aks"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group for AKS and core resources. Defaults to <name>-rg if empty."
  type        = string
  default     = ""
}

variable "location" {
  description = "Azure region for AKS and core resources"
  type        = string
  default     = "southeastasia"
}

variable "kubernetes_version" {
  description = "AKS Kubernetes version"
  default     = "1.32"
  type        = string
}

variable "vnet_cidr" {
  description = "VNet address space"
  default     = "10.1.0.0/16"
  type        = string
}

variable "system_node_vm_size" {
  description = "VM size for the system node pool"
  type        = string
  default     = "Standard_D4as_v7"
}

variable "kata_node_vm_size" {
  description = "VM size for Kata node pool (must support nested virtualization, e.g. Dsv5 series)"
  type        = string
  default     = "Standard_D4s_v5"
}

variable "kata_node_min_count" {
  description = "Minimum number of Kata nodes (must be >= 1; autoscaler cannot scale from 0 for kata workloads)"
  type        = number
  default     = 1
}

variable "kata_node_max_count" {
  description = "Maximum number of Kata nodes"
  type        = number
  default     = 10
}

variable "foundry_location" {
  description = "Azure region for AI Foundry + gpt-5.4. Supported: eastus2, swedencentral, polandcentral, southcentralus"
  type        = string
  default     = "eastus2"

  validation {
    condition     = contains(["eastus2", "swedencentral", "polandcentral", "southcentralus"], var.foundry_location)
    error_message = "foundry_location must be one of: eastus2, swedencentral, polandcentral, southcentralus (regions that support gpt-5.4)."
  }
}

variable "microsoft_internal" {
  description = "Set to true if deploying in a Microsoft internal subscription. Adds SecurityControl=Ignore tag to all resources."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
