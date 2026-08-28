locals {
  environment_contract = {
    name            = var.environment_name
    deployment_tier = var.deployment_tier

    boundaries = {
      public_edge = {
        enabled = true
        purpose = "DNS/CDN/WAF boundary"
      }

      private_services = {
        enabled = true
        purpose = "Application and internal service boundary"
      }

      data = {
        enabled = true
        purpose = "Authoritative and persistent data boundary"
      }

      object_storage = {
        enabled = true
        purpose = "Non-sensitive artifact storage boundary"
      }

      identity = {
        enabled = true
        purpose = "Identity and access-control boundary"
      }
    }

    security = {
      secrets_in_repository  = false
      wallet_private_keys    = false
      wallet_seeds           = false
      public_database_access = false
    }

    infrastructure = {
      provider_neutral = true
      paid_resources   = false
      local_first      = true
    }
  }
}
