#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${OUTPUT:-}" ]]; then
  mkdir -p "$(dirname "$OUTPUT")"
fi

echo "[ENTRYPOINT] exec $*"
exec "$@"
