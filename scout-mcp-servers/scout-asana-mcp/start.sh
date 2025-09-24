#!/bin/sh
set -e

REMOTE_URL="${ASANA_MCP_URL:-https://mcp.asana.com/sse}"

set -- "$REMOTE_URL"

if [ -n "${ASANA_CLIENT_ID}" ]; then
  set -- "$@" "--client-id" "${ASANA_CLIENT_ID}"
fi

if [ -n "${ASANA_CLIENT_SECRET}" ]; then
  set -- "$@" "--client-secret" "${ASANA_CLIENT_SECRET}"
fi

if [ -n "${ASANA_REDIRECT_URI}" ]; then
  set -- "$@" "--redirect-uri" "${ASANA_REDIRECT_URI}"
fi

if [ -n "${ASANA_SCOPES}" ]; then
  set -- "$@" "--scopes" "${ASANA_SCOPES}"
fi

echo "Launching Asana MCP remote against ${REMOTE_URL}" >&2

exec npx --yes --package mcp-remote mcp-remote "$@"
