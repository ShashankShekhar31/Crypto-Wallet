module "environment_contract" {
  source = "../../modules/environment-contract"

  environment_name = var.environment_name
  deployment_tier  = var.deployment_tier
}
