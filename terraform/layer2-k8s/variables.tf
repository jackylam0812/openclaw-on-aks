variable "name" {
  description = "Name prefix (must match layer1)"
  type        = string
  default     = "openclaw-kata-aks"
}

variable "azure_openai_endpoint" {
  description = "Azure OpenAI endpoint from layer1"
  type        = string
  default     = ""
}
