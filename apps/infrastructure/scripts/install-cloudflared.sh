#!/usr/bin/env bash
# Installs cloudflared as a Docker container on the Lightsail instance.
# Requires CLOUDFLARE_TUNNEL_TOKEN to be set in the environment.
set -euo pipefail

: "${CLOUDFLARE_TUNNEL_TOKEN:?CLOUDFLARE_TUNNEL_TOKEN is required}"

CONTAINER_NAME="${CLOUDFLARED_CONTAINER_NAME:-cloudflared}"

sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
sudo docker pull cloudflare/cloudflared:latest
sudo docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"

echo "cloudflared running on host network as '$CONTAINER_NAME'"
