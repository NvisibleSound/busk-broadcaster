#!/bin/bash
#
# Deploy script - run on the server after git pull
# Usage: ./scripts/deploy.sh
# Or from project root: ./test.buskplayer.com/scripts/deploy.sh
#

set -e

# Get script directory and project root (test.buskplayer.com)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Deploying from: $PROJECT_DIR"
echo ""

echo "Pulling latest code..."
git pull

echo ""
echo "Rebuilding and restarting services..."
docker compose up -d --build

echo ""
echo "Done. Services restarted."
