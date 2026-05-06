# BlindPass on GCP Cloud Run

Deploy BlindPass to GCP Cloud Run using the free tier. No VM required.

## Prerequisites

1. **GCP project** with billing enabled
2. **gcloud CLI** installed and authenticated:
   ```bash
   gcloud auth application-default login
   ```
3. **Supabase project** — [supabase.com](https://supabase.com) → New project → copy the Transaction pooler connection string from Settings → Database
4. **Upstash Redis** — [upstash.com](https://upstash.com) → New database → copy the `REDIS_URL`
5. **Terraform** ≥ 1.5 — [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)

## Quickstart

```bash
cd terraform

# 1. Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 2. Initialise providers
terraform init

# 3. Preview changes
terraform plan

# 4. Apply (creates all resources + runs migrations)
terraform apply
```

After apply, Terraform prints `dns_setup_instructions`. Add those DNS records at your registrar.

Cloud Run provisions a managed TLS certificate automatically once DNS propagates (up to 24 hours).

## Verify

```bash
curl https://blindpass.example.com/health
# {"status":"ok","db":"ok"}
```

## Update to a new image tag

```bash
terraform apply -var="image_tag=1.2.3"
```

This updates both services and re-runs the migration job automatically.

## Destroy

```bash
terraform destroy
```

**Warning:** This deletes all Cloud Run services, secrets, and service accounts. Your Supabase database and Upstash Redis are not affected (they are not managed by this module).

## Variables

See [modules/blindpass/README.md](modules/blindpass/README.md) for the full variable reference.

## GCS state backend (recommended for production)

Add to `versions.tf` before running `terraform init`:

```hcl
terraform {
  backend "gcs" {
    bucket = "my-tf-state-bucket"
    prefix = "blindpass"
  }
}
```

Create the bucket first:

```bash
gcloud storage buckets create gs://my-tf-state-bucket \
  --location=us-east1 \
  --uniform-bucket-level-access
```
