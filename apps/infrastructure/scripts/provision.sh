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

instance_exists() {
  aws lightsail get-instances \
    --region "$AWS_REGION" \
    --query "instances[?name=='$INSTANCE_NAME'].name" \
    --output text | grep -q .
}

static_ip_exists() {
  aws lightsail get-static-ips \
    --region "$AWS_REGION" \
    --query "staticIps[?name=='$STATIC_IP_NAME'].name" \
    --output text | grep -q .
}

echo "Provisioning Lightsail backend in $AWS_REGION..."

if ! instance_exists; then
  echo "Creating instance $INSTANCE_NAME ($BUNDLE_ID)..."
  aws lightsail create-instances \
    --region "$AWS_REGION" \
    --instance-names "$INSTANCE_NAME" \
    --availability-zone "$AWS_AVAILABILITY_ZONE" \
    --blueprint-id "$BLUEPRINT_ID" \
    --bundle-id "$BUNDLE_ID" \
    --user-data "file://$SCRIPT_DIR/user-data.sh" \
    >/dev/null
else
  echo "Instance $INSTANCE_NAME already exists."
fi

echo "Waiting for instance to become running..."
state=""
for _ in $(seq 1 60); do
  state="$(aws lightsail get-instance \
    --region "$AWS_REGION" \
    --instance-name "$INSTANCE_NAME" \
    --query "instance.state.name" \
    --output text)"
  if [[ "$state" == "running" ]]; then
    break
  fi
  sleep 5
done

if [[ "$state" != "running" ]]; then
  echo "Instance did not reach running state (last state: $state)" >&2
  exit 1
fi

if ! static_ip_exists; then
  echo "Allocating static IP $STATIC_IP_NAME..."
  aws lightsail allocate-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$STATIC_IP_NAME" \
    >/dev/null
else
  echo "Static IP $STATIC_IP_NAME already exists."
fi

echo "Attaching static IP to instance..."
aws lightsail attach-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --instance-name "$INSTANCE_NAME" \
  >/dev/null

echo "Opening TCP port $CONTAINER_PORT..."
aws lightsail open-instance-public-ports \
  --region "$AWS_REGION" \
  --instance-name "$INSTANCE_NAME" \
  --port-info "fromPort=$CONTAINER_PORT,toPort=$CONTAINER_PORT,protocol=tcp" \
  >/dev/null

public_ip="$(aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --query "staticIp.ipAddress" \
  --output text)"

echo ""
echo "Provision complete."
echo "  Instance:  $INSTANCE_NAME"
echo "  Public IP: $public_ip"
echo "  API:       http://${public_ip}:${CONTAINER_PORT}/"
echo "  WebSocket: ws://${public_ip}:${CONTAINER_PORT}/api/ws/canvas"
