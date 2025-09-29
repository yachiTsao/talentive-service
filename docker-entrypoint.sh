#!/usr/bin/env bash
set -euo pipefail

# 將環境變數轉換為 CLI 參數
ARGS=()

if [[ -n "${KEYWORD:-}" ]]; then ARGS+=("--keyword=${KEYWORD}"); fi
if [[ -n "${PAGES:-}" ]]; then ARGS+=("--pages=${PAGES}"); fi
if [[ -n "${PROVIDERS:-}" ]]; then ARGS+=("--providers=${PROVIDERS}"); fi
if [[ -n "${DELAY:-}" ]]; then ARGS+=("--delay=${DELAY}"); fi
if [[ -n "${OUTPUT:-}" ]]; then ARGS+=("--output=${OUTPUT}"); fi

# DEBUG 為 true / 1 / yes 時加入 --debug
LOWER=$(echo "${DEBUG:-false}" | tr '[:upper:]' '[:lower:]')
if [[ "$LOWER" == "true" || "$LOWER" == "1" || "$LOWER" == "yes" ]]; then
  ARGS+=("--debug")
fi

echo "[ENTRYPOINT] node dist/crawler.js ${ARGS[*]}"
exec node dist/crawler.js "${ARGS[@]}" "$@"
