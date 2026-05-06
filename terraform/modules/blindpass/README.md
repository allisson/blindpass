# blindpass module

Terraform module that deploys BlindPass on GCP Cloud Run.

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated (`gcloud auth application-default login`)
- Supabase project (free tier: [supabase.com](https://supabase.com))
- Upstash Redis database (free tier: [upstash.com](https://upstash.com))

## Usage

```hcl
module "blindpass" {
  source = "github.com/blindpass/blindpass//terraform/modules/blindpass"

  project_id   = "my-gcp-project"
  domain       = "blindpass.example.com"
  database_url = "postgresql://postgres.xxx:pass@pooler.supabase.com:6543/postgres"
  redis_url    = "rediss://default:token@host.upstash.io:6379"
}
```

## Inputs

| Name                           | Type               | Default                                 | Description                                                |
| ------------------------------ | ------------------ | --------------------------------------- | ---------------------------------------------------------- |
| `project_id`                   | string             | —                                       | GCP project ID                                             |
| `region`                       | string             | `"us-east1"`                            | Cloud Run region                                           |
| `domain`                       | string             | —                                       | Custom domain (e.g. `blindpass.example.com`)               |
| `image_tag`                    | string             | `"latest"`                              | Docker Hub tag for both images                             |
| `server_image`                 | string             | `"docker.io/allisson/blindpass-server"` | Server image (override for forks)                          |
| `webapp_image`                 | string             | `"docker.io/allisson/blindpass-webapp"` | Webapp image (override for forks)                          |
| `database_url`                 | string (sensitive) | —                                       | Supabase pooler connection URL                             |
| `redis_url`                    | string (sensitive) | —                                       | Upstash Redis URL with token                               |
| `server_allow_unauthenticated` | bool               | `true`                                  | Grant `allUsers` Cloud Run invoker on server               |
| `server_min_instances`         | number             | `0`                                     | Minimum server replicas (0 = free-tier, cold starts apply) |
| `server_max_instances`         | number             | `2`                                     | Maximum server replicas                                    |
| `webapp_min_instances`         | number             | `0`                                     | Minimum webapp replicas                                    |
| `webapp_max_instances`         | number             | `1`                                     | Maximum webapp replicas                                    |

## Outputs

| Name                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `webapp_url`             | Cloud Run webapp URL (internal `*.run.app`)     |
| `server_url`             | Cloud Run server URL (internal `*.run.app`)     |
| `domain_mapping_records` | List of DNS records to add at your DNS provider |
| `dns_setup_instructions` | Human-readable DNS setup block                  |

## Resources created

- 3× `google_project_service` (Cloud Run, Secret Manager, IAM)
- 2× `google_service_account` (server, webapp)
- 3× `google_secret_manager_secret` + version (database URL, Redis URL, TOTP key)
- 4× `google_secret_manager_secret_iam_member`
- 2× `google_cloud_run_v2_service` (server, webapp)
- 2× `google_cloud_run_v2_service_iam_member`
- 1× `google_cloud_run_domain_mapping`
- 1× `google_cloud_run_v2_job` (migration)
- 1× `null_resource` (runs migration on apply)

## Notes

**TOTP key** — a 32-byte random key is generated at `terraform apply` time and stored in Secret Manager. It is not recoverable after `terraform destroy`; export it first if you need to migrate state.

**State backend** — defaults to local state. For production, configure a GCS backend:

```hcl
terraform {
  backend "gcs" {
    bucket = "my-tf-state-bucket"
    prefix = "blindpass"
  }
}
```

**IAM-protected server** — set `server_allow_unauthenticated = false` if you want to restrict direct access to the server's `*.run.app` URL. The webapp proxy is always public.
