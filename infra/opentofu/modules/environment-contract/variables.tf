variable "environment_name" {
  description = "Logical environment name."
  type        = string

  validation {
    condition     = contains(["development", "staging", "demo"], var.environment_name)
    error_message = "Environment must be development, staging, or demo."
  }
}

variable "deployment_tier" {
  description = "Deployment tier represented by this environment."
  type        = string

  validation {
    condition     = contains(["development", "pre-production", "demo"], var.deployment_tier)
    error_message = "Deployment tier must be development, pre-production, or demo."
  }
}
