# AWS Lightsail backend infrastructure

Deploys the pixel-frame FastAPI/WebSocket backend to a **$5/month** Lightsail instance. Infrastructure is managed with **Terraform**; the backend image is built in CI, pushed to **ECR**, and pulled onto the instance over SSH.

## Layout

```
apps/infrastructure/
  config.example.env        # Deploy script defaults
  scripts/
    deploy.sh               # Pull image from ECR and restart container on Lightsail
    ensure-static-ip.sh     # Allocate/attach static IP (not importable into Terraform)
    import-existing.sh      # One-time import of existing Lightsail instance
    static-ip-json.sh       # Reads static IP for Terraform external data source
    user-data.sh            # Installs Docker on first boot
  terraform/
    main.tf                 # Lightsail instance, static IP, firewall, ECR repository
    backend.tf              # S3 remote state backend
    variables.tf
    outputs.tf
```

## CI/CD

Pushes to `main` that touch `apps/backend/**` or `apps/infrastructure/**` run [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml):

1. Ensure static IP is allocated and attached
2. `terraform apply` — Lightsail instance + port rules + ECR
3. Build backend Docker image
4. Push to ECR (tagged with git SHA + `latest`)
5. SSH to Lightsail → `docker pull` → restart container
6. Verify health endpoint

### GitHub secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token for `pixel-frame-backend` (enables HTTPS/WSS at `pixel-frame-api.ethanknotts.com`) |

IAM permissions needed: Lightsail (manage instances, static IPs, download SSH key), ECR (push/pull/create repository), S3 (Terraform state bucket).

## Local deploy

**Prerequisites:** AWS CLI, Docker, Terraform, OpenSSH

```bash
cd apps/infrastructure/terraform
terraform init
terraform apply

ECR_URL=$(terraform output -raw ecr_repository_url)
PUBLIC_IP=$(terraform output -raw public_ip)

# Build and push
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "${ECR_URL%%/*}"
docker build -t "$ECR_URL:latest" ../../backend
docker push "$ECR_URL:latest"

# Deploy to Lightsail
cd ..
ECR_REPOSITORY_URL="$ECR_URL" IMAGE_TAG=latest PUBLIC_IP="$PUBLIC_IP" bash scripts/deploy.sh
```

After deploy, update `apps/firmware/secrets.h`:

```cpp
#define WS_HOST "<public-ip>"
#define WS_PORT 8000
#define WS_PATH "/api/ws/canvas"
```

Get the IP with `terraform output -raw public_ip`.

## First-time setup (existing Lightsail instance)

If the Lightsail instance was created before Terraform (e.g. via CLI scripts), import it once:

```bash
cd apps/infrastructure/terraform
terraform init
bash ../scripts/import-existing.sh
terraform apply
```

## Terraform state

State is stored in `s3://pixel-frame-terraform-state-497449934068`. The bucket was created during initial setup. For a new AWS account, create it first:

```bash
aws s3 mb s3://pixel-frame-terraform-state-<account-id> --region us-east-1
aws s3api put-bucket-versioning \
  --bucket pixel-frame-terraform-state-<account-id> \
  --versioning-configuration Status=Enabled
```

Then update `terraform/backend.tf` with your bucket name.

## Cost

| Resource | Price |
|----------|-------|
| Lightsail nano (`nano_3_0`) | $5/mo |
| Static IP (attached) | Included |
| ECR storage | ~pennies |
| Data transfer | 1 TB/mo included |

## Destroy

```bash
cd apps/infrastructure/terraform
terraform destroy
```
