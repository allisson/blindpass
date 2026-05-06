variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Cloud Run region"
  type        = string
  default     = "us-east1"
}

variable "domain" {
  description = "Custom domain for the webapp (e.g. blindpass.example.com)"
  type        = string
}

variable "image_tag" {
  description = "Docker Hub tag for both images"
  type        = string
  default     = "latest"
}

variable "server_image" {
  description = "Server Docker image (override to use a fork)"
  type        = string
  default     = "docker.io/allisson/blindpass-server"
}

variable "webapp_image" {
  description = "Webapp Docker image (override to use a fork)"
  type        = string
  default     = "docker.io/allisson/blindpass-webapp"
}

variable "database_url" {
  description = "PostgreSQL connection URL (Supabase pooler recommended)"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL with credentials (Upstash recommended)"
  type        = string
  sensitive   = true
}

variable "totp_encryption_key" {
  description = "Base64-encoded 32-byte key for AES-256-GCM TOTP secret encryption. Generate once with: openssl rand -base64 32. Store securely outside Terraform state."
  type        = string
  sensitive   = true
}

variable "server_min_instances" {
  description = "Minimum server instances"
  type        = number
  default     = 0
}

variable "server_max_instances" {
  description = "Maximum server instances"
  type        = number
  default     = 2
}

variable "webapp_min_instances" {
  description = "Minimum webapp instances"
  type        = number
  default     = 0
}

variable "webapp_max_instances" {
  description = "Maximum webapp instances"
  type        = number
  default     = 1
}
