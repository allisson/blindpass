locals {
  server_image = "${var.server_image}:${var.image_tag}"
  webapp_image = "${var.webapp_image}:${var.image_tag}"
}

# ── APIs ─────────────────────────────────────────────────────────────────────

resource "google_project_service" "run" {
  project            = var.project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  project            = var.project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

# ── Service accounts ─────────────────────────────────────────────────────────

resource "google_service_account" "blindpass_server_sa" {
  project      = var.project_id
  account_id   = "blindpass-server"
  display_name = "BlindPass Server"

  depends_on = [google_project_service.iam]
}

resource "google_service_account" "blindpass_webapp_sa" {
  project      = var.project_id
  account_id   = "blindpass-webapp"
  display_name = "BlindPass Webapp"

  depends_on = [google_project_service.iam]
}

# ── Secrets ───────────────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "blindpass-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url
}

resource "google_secret_manager_secret" "redis_url" {
  project   = var.project_id
  secret_id = "blindpass-redis-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = var.redis_url
}

resource "google_secret_manager_secret" "totp_key" {
  project   = var.project_id
  secret_id = "blindpass-totp-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "totp_key" {
  secret      = google_secret_manager_secret.totp_key.id
  secret_data = var.totp_encryption_key
}

# ── Secret IAM — server SA ────────────────────────────────────────────────────

resource "google_secret_manager_secret_iam_member" "server_database_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.blindpass_server_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "server_redis_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.redis_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.blindpass_server_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "server_totp_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.totp_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.blindpass_server_sa.email}"
}

# ── Cloud Run: server ─────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "server" {
  project             = var.project_id
  name                = "blindpass-server"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.blindpass_server_sa.email

    scaling {
      min_instance_count = var.server_min_instances
      max_instance_count = var.server_max_instances
    }

    containers {
      image = local.server_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "CORS_ORIGIN"
        value = "https://${var.domain}"
      }

      env {
        name  = "COOKIE_DOMAIN"
        value = var.domain
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "TOTP_SECRET_ENCRYPTION_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.totp_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        failure_threshold     = 3
        period_seconds        = 10
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_iam_member.server_database_url,
    google_secret_manager_secret_iam_member.server_redis_url,
    google_secret_manager_secret_iam_member.server_totp_key,
  ]
}

# This is a public API — access control is handled entirely by the application
# layer (TOTP + session auth). Cloud Run IAM is left open so browsers and
# mobile clients can reach the server without GCP credentials.
resource "google_cloud_run_v2_service_iam_member" "server_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Cloud Run: webapp ─────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "webapp" {
  project             = var.project_id
  name                = "blindpass-webapp"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.blindpass_webapp_sa.email

    scaling {
      min_instance_count = var.webapp_min_instances
      max_instance_count = var.webapp_max_instances
    }

    containers {
      image = local.webapp_image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "SERVER_BASE_URL"
        value = google_cloud_run_v2_service.server.uri
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_cloud_run_v2_service.server,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "webapp_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.webapp.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Domain mapping ────────────────────────────────────────────────────────────

resource "google_cloud_run_domain_mapping" "webapp" {
  project  = var.project_id
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.webapp.name
  }

  depends_on = [google_cloud_run_v2_service.webapp]
}

# ── Migration job ─────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_job" "migrate" {
  project             = var.project_id
  name                = "blindpass-migrate"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.blindpass_server_sa.email

      containers {
        image = local.server_image
        args  = ["node", "dist/index.js", "migrate"]

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "TOTP_SECRET_ENCRYPTION_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.totp_key.secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "REDIS_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.redis_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_iam_member.server_database_url,
    google_secret_manager_secret_iam_member.server_totp_key,
    google_secret_manager_secret_iam_member.server_redis_url,
  ]
}

resource "null_resource" "run_migrations" {
  triggers = {
    image_tag = var.image_tag
    job_name  = google_cloud_run_v2_job.migrate.name
  }

  provisioner "local-exec" {
    command = "gcloud run jobs execute ${self.triggers.job_name} --region ${var.region} --project ${var.project_id} --wait"
  }

  depends_on = [google_cloud_run_v2_job.migrate]
}
