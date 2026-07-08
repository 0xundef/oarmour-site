#!/usr/bin/env bash
# Smoke-run the detection pipeline against the DeepSeek Anthropic endpoint.
# Set ANTHROPIC_API_KEY in your env (do not commit keys here).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY must be set in your env}"
: "${ANTHROPIC_BASE_URL:=https://api.deepseek.com/anthropic}"
export NODE_OPTIONS='--conditions react-server'
export ANTHROPIC_API_KEY ANTHROPIC_BASE_URL
RD="$(node -e "console.log(require('os').tmpdir())")/agent-queue/pipeline-runs/smoke-test"
rm -rf "$RD" 2>/dev/null || true
npx tsx scripts/run-detection-pipeline.ts smoke-test 1.0.0 --source general 2>&1 \
  | grep -E "model:|stage agent done|run complete|recon:|find:|dedupe:|report:|Error|400|401|fail" | head -40
