output "webapp_url" {
  description = "Cloud Run webapp service URL"
  value       = google_cloud_run_v2_service.webapp.uri
}

output "server_url" {
  description = "Cloud Run server service URL"
  value       = google_cloud_run_v2_service.server.uri
}

output "domain_mapping_records" {
  description = "DNS resource records to add at your DNS provider"
  value = [
    for r in flatten(google_cloud_run_domain_mapping.webapp.status[*].resource_records) : {
      name   = r.name
      type   = r.type
      rrdata = r.rrdata
    }
  ]
}

output "dns_setup_instructions" {
  description = "Human-readable DNS setup instructions"
  value = <<-EOT
    Add the following DNS records at your provider to point ${var.domain} to Cloud Run:

    ${join("\n    ", [
  for r in flatten(google_cloud_run_domain_mapping.webapp.status[*].resource_records) :
  "${r.type}\t${r.name != "" ? r.name : "@"}\t${r.rrdata}"
])}

    DNS propagation may take up to 24 hours. Cloud Run will provision a managed
    TLS certificate automatically once the records resolve.
  EOT
}
