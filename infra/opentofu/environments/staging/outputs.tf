output "environment_contract" {
  description = "Provider-neutral contract for the staging environment."
  value       = module.environment_contract.environment_contract
}
