# AWS Lightsail backend infrastructure

Deploys the pixel-frame FastAPI/WebSocket backend to a **$5/month** Lightsail instance (nano bundle) running Docker.

## Layout

```
apps/infrastructure/
  config.example.env      # Copy to config.env (gitignored)
  scripts/
    provision.ps1         # Create Lightsail instance + static IP + firewall (Windows)
    provision.sh          # Same as above (Linux/macOS/CI)
    deploy.ps1            # Build Docker image and deploy to instance (Windows)
    deploy.sh             # Same as above (Linux/macOS/CI)
    destroy.ps1           # Tear down Lightsail resources
    user-data.sh          # Installs Docker on first boot
  terraform/              # Optional IaC equivalent of provision.ps1
```

## CI/CD

Pushes to `main` that touch `apps/backend/**` or `apps/infrastructure/**` trigger [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml), which:

1. Ensures Lightsail infrastructure exists (idempotent provision)
2. Builds the backend Docker image
3. Deploys it to the instance
4. Verifies the public health endpoint

### GitHub secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key for deployment |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

The IAM user/role needs Lightsail permissions to create/manage instances, static IPs, open ports, and download the default SSH key pair. The workflow uses `config.example.env` defaults (no extra secrets required for host/port names).

You can also trigger a deploy manually from the **Actions** tab via **workflow_dispatch**.

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) authenticated (`aws sts get-caller-identity`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for deploy)
- OpenSSH client (`ssh`, `scp`) — included on Windows 10+

## Quick start

```powershell
cd apps/infrastructure
Copy-Item config.example.env config.env

# Create Lightsail instance (~$5/mo)
.\scripts\provision.ps1

# Build backend image and deploy
.\scripts\deploy.ps1
```

After deploy, update `apps/firmware/secrets.h`:

```cpp
#define WS_HOST "<public-ip-from-output>"
#define WS_PORT 8000
#define WS_PATH "/api/ws/canvas"
```

## Terraform (optional)

If you prefer Terraform over the PowerShell provision script:

```bash
cd apps/infrastructure/terraform
terraform init
terraform apply
cd ../scripts
./deploy.ps1
```

## Cost

| Resource | Price |
|----------|-------|
| Lightsail nano (`nano_3_0`) | $5/mo |
| Static IP (attached) | Included |
| Data transfer | 1 TB/mo included |

## Destroy

```powershell
.\scripts\destroy.ps1
```

Or with Terraform: `terraform destroy` in the `terraform/` directory.
