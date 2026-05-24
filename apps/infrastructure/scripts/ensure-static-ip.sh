#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${CONFIG_PATH:-$SCRIPT_DIR/../config.example.env}"

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

if ! aws lightsail get-static-ip --region "$AWS_REGION" --static-ip-name "$STATIC_IP_NAME" >/dev/null 2>&1; then
  echo "Allocating static IP $STATIC_IP_NAME..."
  aws lightsail allocate-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$STATIC_IP_NAME" \
    >/dev/null
else
  echo "Static IP $STATIC_IP_NAME already exists."
fi

attached_to="$(aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --query "staticIp.attachedTo" \
  --output text)"

if [[ "$attached_to" == "$INSTANCE_NAME" ]]; then
  echo "Static IP already attached to $INSTANCE_NAME."
elif [[ "$attached_to" == "None" || -z "$attached_to" ]]; then
  echo "Attaching static IP to $INSTANCE_NAME..."
  aws lightsail attach-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$STATIC_IP_NAME" \
    --instance-name "$INSTANCE_NAME" \
    >/dev/null
else
  echo "Static IP $STATIC_IP_NAME is attached to $attached_to, expected $INSTANCE_NAME." >&2
  exit 1
fi
