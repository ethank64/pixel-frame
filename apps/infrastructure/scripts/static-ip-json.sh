#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
CONFIG_PATH="${CONFIG_PATH:-$SCRIPT_DIR/../config.example.env}"

set -a
# shellcheck disable=SC1090
. "$CONFIG_PATH"
set +a

ip_address="$(aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --query "staticIp.ipAddress" \
  --output text)"

printf '{"ip_address":"%s"}\n' "$ip_address"
