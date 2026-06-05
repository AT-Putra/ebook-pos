#!/usr/bin/env bash
# Run before pushing to catch issues before they hit the server.
# Usage: npm run check
set -euo pipefail

echo ""
echo "=== 1/3 Tests ==="
npm test

echo ""
echo "=== 2/3 TypeScript ==="
npx tsc --noEmit

echo ""
echo "=== 3/3 Docker build ==="
docker compose build --progress=plain

echo ""
echo "✓ All checks passed — safe to push."
