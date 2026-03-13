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
  default     = "1.31"
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

variable "azure_openai_endpoint" {
  description = "Azure OpenAI endpoint URL (e.g. https://YOUR_NAME.openai.azure.com/)"
  type        = string
  default     = "https://YOUR_AZURE_OPENAI_ENDPOINT.openai.azure.com/"
}

variable "azure_openai_api_key" {
  description = "Azure OpenAI API key (leave empty to use Key Vault)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
