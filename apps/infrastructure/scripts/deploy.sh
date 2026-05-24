#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${CONFIG_PATH:-$SCRIPT_DIR/../config.example.env}"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Missing config file: $CONFIG_PATH" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECR_REPOSITORY_URL:?ECR_REPOSITORY_URL is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

KEY_PATH="$HOME/.ssh/lightsail-default-key.pem"
ECR_REGISTRY="${ECR_REPOSITORY_URL%%/*}"
IMAGE_URI="${ECR_REPOSITORY_URL}:${IMAGE_TAG}"

get_ssh_key() {
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  aws lightsail download-default-key-pair \
    --region "$AWS_REGION" \
    --output json \
    | python3 -c "import json, sys; print(json.load(sys.stdin)['privateKeyBase64'], end='')" \
    > "$KEY_PATH"
  chmod 600 "$KEY_PATH"
}

if [[ -z "${PUBLIC_IP:-}" ]]; then
  PUBLIC_IP="$(aws lightsail get-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$STATIC_IP_NAME" \
    --query "staticIp.ipAddress" \
    --output text)"
fi

if [[ -z "$PUBLIC_IP" || "$PUBLIC_IP" == "None" ]]; then
  echo "Public IP not found. Run terraform apply first." >&2
  exit 1
fi

attached_to="$(aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --query "staticIp.attachedTo" \
  --output text)"
if [[ "$attached_to" != "$INSTANCE_NAME" ]]; then
  echo "Static IP $STATIC_IP_NAME is not attached to $INSTANCE_NAME (attached to: ${attached_to:-none})." >&2
  echo "Run ensure-static-ip.sh before deploying." >&2
  exit 1
fi

get_ssh_key

SSH_OPTS=(
  -i "$KEY_PATH"
  -o StrictHostKeyChecking=no
  -o LogLevel=ERROR
  -o ConnectTimeout=10
)

echo "Waiting for Docker on $PUBLIC_IP..."
ready=false
for _ in $(seq 1 30); do
  if ssh "${SSH_OPTS[@]}" \
    "ec2-user@$PUBLIC_IP" \
    "test -f /var/lib/pixel-frame-ready && command -v docker" \
    >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 10
done

if [[ "$ready" != "true" ]]; then
  echo "Timed out waiting for SSH/Docker on $PUBLIC_IP." >&2
  echo "Check Lightsail firewall allows TCP 22 and the instance is running." >&2
  exit 1
fi

ECR_PASSWORD="$(aws ecr get-login-password --region "$AWS_REGION")"

echo "Deploying $IMAGE_URI to $PUBLIC_IP..."
ssh "${SSH_OPTS[@]}" \
  "ec2-user@$PUBLIC_IP" \
  "set -euo pipefail
   echo '$ECR_PASSWORD' | sudo docker login --username AWS --password-stdin '$ECR_REGISTRY'
   sudo docker pull '$IMAGE_URI'
   sudo docker network create '${DOCKER_NETWORK:-pixel-frame}' 2>/dev/null || true
   sudo docker rm -f '$CONTAINER_NAME' 2>/dev/null || true
   sudo docker run -d \
     --name '$CONTAINER_NAME' \
     --restart unless-stopped \
     --network '${DOCKER_NETWORK:-pixel-frame}' \
     -p ${CONTAINER_PORT}:8000 \
     '$IMAGE_URI'
   ready=false
   for _ in \$(seq 1 30); do
     if curl -sf http://127.0.0.1:${CONTAINER_PORT}/ >/dev/null; then
       ready=true
       break
     fi
     sleep 2
   done
   if [[ \"\$ready\" != \"true\" ]]; then
     echo 'Container failed health check:' >&2
     sudo docker logs '$CONTAINER_NAME' 2>&1 | tail -50 >&2 || true
     exit 1
   fi
   curl -sf http://127.0.0.1:${CONTAINER_PORT}/"

if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "Installing cloudflared tunnel..."
  ssh "${SSH_OPTS[@]}" \
    "ec2-user@$PUBLIC_IP" \
    "CLOUDFLARE_TUNNEL_TOKEN='$CLOUDFLARE_TUNNEL_TOKEN' BACKEND_CONTAINER_NAME='$CONTAINER_NAME' DOCKER_NETWORK='${DOCKER_NETWORK:-pixel-frame}' bash -s" \
    < "$SCRIPT_DIR/install-cloudflared.sh"

  PUBLIC_API_URL="${PUBLIC_API_URL:-https://pixel-frame-api.ethanknotts.com}"
  echo "Waiting for Cloudflare tunnel at $PUBLIC_API_URL..."
  tunnel_ready=false
  for _ in $(seq 1 45); do
    if curl -sf "$PUBLIC_API_URL/" >/dev/null; then
      tunnel_ready=true
      break
    fi
    sleep 2
  done

  if [[ "$tunnel_ready" != "true" ]]; then
    echo "Cloudflare tunnel health check failed after 90s" >&2
    ssh "${SSH_OPTS[@]}" "ec2-user@$PUBLIC_IP" \
      "sudo docker logs cloudflared 2>&1 | tail -30" >&2 || true
    exit 1
  fi
fi

echo ""
echo "Deploy complete."
echo "  Image:     $IMAGE_URI"
echo "  Health:    http://${PUBLIC_IP}:${CONTAINER_PORT}/"
echo "  WebSocket: ws://${PUBLIC_IP}:${CONTAINER_PORT}/api/ws/canvas"
if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "  Public API: ${PUBLIC_API_URL:-https://pixel-frame-api.ethanknotts.com}/"
fi
