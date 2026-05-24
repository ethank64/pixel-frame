#!/usr/bin/env bash
# Installs cloudflared as a Docker container on the Lightsail instance.
# Requires CLOUDFLARE_TUNNEL_TOKEN to be set in the environment.
set -euo pipefail

: "${CLOUDFLARE_TUNNEL_TOKEN:?CLOUDFLARE_TUNNEL_TOKEN is required}"

CONTAINER_NAME="${CLOUDFLARED_CONTAINER_NAME:-cloudflared}"
BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-pixel-frame-backend}"
DOCKER_NETWORK="${DOCKER_NETWORK:-pixel-frame}"

# Tunnel ingress is configured as http://pixel-frame-backend:8000 in Cloudflare.
sudo docker network create "$DOCKER_NETWORK" 2>/dev/null || true
sudo docker network connect "$DOCKER_NETWORK" "$BACKEND_CONTAINER_NAME" 2>/dev/null || true

sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
sudo docker pull cloudflare/cloudflared:latest
sudo docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$DOCKER_NETWORK" \
  cloudflare/cloudflared:latest \
  tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"

echo "cloudflared running on network '$DOCKER_NETWORK' as '$CONTAINER_NAME'"
