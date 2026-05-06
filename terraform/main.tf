module "blindpass" {
  source = "./modules/blindpass"

  project_id   = var.project_id
  region       = var.region
  domain       = var.domain
  image_tag    = var.image_tag
  server_image = var.server_image
  webapp_image = var.webapp_image

  database_url        = var.database_url
  redis_url           = var.redis_url
  totp_encryption_key = var.totp_encryption_key

  server_min_instances = var.server_min_instances
  server_max_instances = var.server_max_instances
  webapp_min_instances = var.webapp_min_instances
  webapp_max_instances = var.webapp_max_instances
}
