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

get_ssh_key

echo "Waiting for Docker on $PUBLIC_IP..."
for _ in $(seq 1 60); do
  if ssh \
    -i "$KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o LogLevel=ERROR \
    -o ConnectTimeout=10 \
    "ec2-user@$PUBLIC_IP" \
    "test -f /var/lib/pixel-frame-ready && command -v docker" \
    >/dev/null 2>&1; then
    break
  fi
  sleep 10
done

ECR_PASSWORD="$(aws ecr get-login-password --region "$AWS_REGION")"

echo "Deploying $IMAGE_URI to $PUBLIC_IP..."
ssh \
  -i "$KEY_PATH" \
  -o StrictHostKeyChecking=no \
  -o LogLevel=ERROR \
  "ec2-user@$PUBLIC_IP" \
  "set -euo pipefail
   echo '$ECR_PASSWORD' | sudo docker login --username AWS --password-stdin '$ECR_REGISTRY'
   sudo docker pull '$IMAGE_URI'
   sudo docker rm -f '$CONTAINER_NAME' 2>/dev/null || true
   sudo docker run -d \
     --name '$CONTAINER_NAME' \
     --restart unless-stopped \
     -p ${CONTAINER_PORT}:8000 \
     '$IMAGE_URI'
   curl -sf http://127.0.0.1:${CONTAINER_PORT}/"

echo ""
echo "Deploy complete."
echo "  Image:     $IMAGE_URI"
echo "  Health:    http://${PUBLIC_IP}:${CONTAINER_PORT}/"
echo "  WebSocket: ws://${PUBLIC_IP}:${CONTAINER_PORT}/api/ws/canvas"
