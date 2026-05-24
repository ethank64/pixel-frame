#!/usr/bin/env bash
set -euo pipefail

# Import Lightsail instance if it was created outside Terraform (safe to re-run).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
CONFIG_PATH="${CONFIG_PATH:-$SCRIPT_DIR/../config.example.env}"

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

cd "$TERRAFORM_DIR"

if terraform state show aws_lightsail_instance.backend >/dev/null 2>&1; then
  echo "Already in state: aws_lightsail_instance.backend"
else
  echo "Importing aws_lightsail_instance.backend ($INSTANCE_NAME)..."
  terraform import aws_lightsail_instance.backend "$INSTANCE_NAME"
fi

echo "Import complete."
