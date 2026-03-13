variable "name" {
  description = "Name prefix for all resources"
  default     = "openclaw-kata-aks"
  type        = string
}

variable "location" {
  description = "Azure region"
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
  description = "VM size for Kata node pool (must support nested virtualization)"
  type        = string
  default     = "Standard_D4as_v7"
}

variable "kata_node_min_count" {
  description = "Minimum number of Kata nodes"
  type        = number
  default     = 0
}

variable "kata_node_max_count" {
  description = "Maximum number of Kata nodes"
  type        = number
  default     = 10
}

variable "openai_location" {
  description = "Azure region for the OpenAI (AI Foundry) resource. Must support gpt-5.4: eastus2, swedencentral, polandcentral, southcentralus"
  type        = string
  default     = "eastus2"

  validation {
    condition     = contains(["eastus2", "swedencentral", "polandcentral", "southcentralus"], var.openai_location)
    error_message = "openai_location must be one of: eastus2, swedencentral, polandcentral, southcentralus (regions that support gpt-5.4)."
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
