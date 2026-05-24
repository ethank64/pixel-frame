#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONFIG_PATH="${CONFIG_PATH:-$SCRIPT_DIR/../config.example.env}"
BACKEND_DIR="$REPO_ROOT/apps/backend"
IMAGE_TAR="${RUNNER_TEMP:-/tmp}/pixel-frame-backend.tar"
KEY_PATH="$HOME/.ssh/lightsail-default-key.pem"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Missing config file: $CONFIG_PATH" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

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

wait_for_instance_ready() {
  local public_ip="$1"
  echo "Waiting for Docker on $public_ip..."
  for _ in $(seq 1 60); do
    if ssh \
      -i "$KEY_PATH" \
      -o StrictHostKeyChecking=no \
      -o LogLevel=ERROR \
      -o ConnectTimeout=10 \
      "ec2-user@$public_ip" \
      "test -f /var/lib/pixel-frame-ready && command -v docker" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 10
  done
  echo "Instance did not become ready for deployment." >&2
  return 1
}

public_ip="$(aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --query "staticIp.ipAddress" \
  --output text)"

if [[ -z "$public_ip" || "$public_ip" == "None" ]]; then
  echo "Static IP not found. Run provision first." >&2
  exit 1
fi

get_ssh_key
wait_for_instance_ready "$public_ip"

echo "Building Docker image from $BACKEND_DIR..."
docker build -t "$IMAGE_NAME" "$BACKEND_DIR"

echo "Saving image to $IMAGE_TAR..."
rm -f "$IMAGE_TAR"
docker save "$IMAGE_NAME" -o "$IMAGE_TAR"

echo "Uploading image to $public_ip..."
scp \
  -i "$KEY_PATH" \
  -o StrictHostKeyChecking=no \
  -o LogLevel=ERROR \
  "$IMAGE_TAR" \
  "ec2-user@${public_ip}:/tmp/pixel-frame-backend.tar"

remote_script="sudo docker load -i /tmp/pixel-frame-backend.tar && sudo docker rm -f $CONTAINER_NAME 2>/dev/null || true && sudo docker run -d --name $CONTAINER_NAME --restart unless-stopped -p ${CONTAINER_PORT}:8000 $IMAGE_NAME && rm -f /tmp/pixel-frame-backend.tar && curl -sf http://127.0.0.1:${CONTAINER_PORT}/"

echo "Starting container on instance..."
ssh \
  -i "$KEY_PATH" \
  -o StrictHostKeyChecking=no \
  -o LogLevel=ERROR \
  "ec2-user@$public_ip" \
  "$remote_script"

rm -f "$IMAGE_TAR"

echo ""
echo "Deploy complete."
echo "  Health:    http://${public_ip}:${CONTAINER_PORT}/"
echo "  WebSocket: ws://${public_ip}:${CONTAINER_PORT}/api/ws/canvas"
