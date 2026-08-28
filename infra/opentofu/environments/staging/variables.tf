variable "environment_name" {
  description = "Logical environment name."
  type        = string
  default     = "staging"
}

variable "deployment_tier" {
  description = "Deployment tier."
  type        = string
  default     = "pre-production"
}
