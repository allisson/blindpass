output "webapp_url" {
  description = "Cloud Run webapp service URL"
  value       = module.blindpass.webapp_url
}

output "server_url" {
  description = "Cloud Run server service URL"
  value       = module.blindpass.server_url
}

output "domain_mapping_records" {
  description = "DNS resource records to add at your DNS provider"
  value       = module.blindpass.domain_mapping_records
}

output "dns_setup_instructions" {
  description = "Human-readable DNS setup instructions"
  value       = module.blindpass.dns_setup_instructions
}
