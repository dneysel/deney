#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"
PYTHON="$SCRIPT_DIR/.venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  printf 'Kurulum bulunamadi. Once sh install.sh calistirin.\n' >&2
  exit 1
fi

OVERRIDE_CHATBOT_API_TOKEN=${CHATBOT_API_TOKEN:-}
OVERRIDE_MODEL_PROVIDER=${MODEL_PROVIDER:-}
OVERRIDE_MODEL_NAME=${MODEL_NAME:-}
OVERRIDE_UI_AUTO_AUTH=${UI_AUTO_AUTH:-}
OVERRIDE_HOST=${HOST:-}
OVERRIDE_PORT=${PORT:-}
OVERRIDE_INFERENCE_URL=${INFERENCE_URL:-}
OVERRIDE_LLAMACPP_URL=${LLAMACPP_URL:-}

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  . "$SCRIPT_DIR/.env"
  set +a
fi

if [ -n "$OVERRIDE_CHATBOT_API_TOKEN" ]; then CHATBOT_API_TOKEN=$OVERRIDE_CHATBOT_API_TOKEN; fi
if [ -n "$OVERRIDE_MODEL_PROVIDER" ]; then MODEL_PROVIDER=$OVERRIDE_MODEL_PROVIDER; fi
if [ -n "$OVERRIDE_MODEL_NAME" ]; then MODEL_NAME=$OVERRIDE_MODEL_NAME; fi
if [ -n "$OVERRIDE_UI_AUTO_AUTH" ]; then UI_AUTO_AUTH=$OVERRIDE_UI_AUTO_AUTH; fi
if [ -n "$OVERRIDE_HOST" ]; then HOST=$OVERRIDE_HOST; fi
if [ -n "$OVERRIDE_PORT" ]; then PORT=$OVERRIDE_PORT; fi
if [ -n "$OVERRIDE_INFERENCE_URL" ]; then INFERENCE_URL=$OVERRIDE_INFERENCE_URL; fi
if [ -n "$OVERRIDE_LLAMACPP_URL" ]; then LLAMACPP_URL=$OVERRIDE_LLAMACPP_URL; fi

CHATBOT_API_TOKEN=${CHATBOT_API_TOKEN:-}
INFERENCE_SERVICE_TOKEN=${INFERENCE_SERVICE_TOKEN:-$($PYTHON -c 'import secrets; print(secrets.token_urlsafe(32))')}
MODEL_PROVIDER=${MODEL_PROVIDER:-simulation}
UI_AUTO_AUTH=${UI_AUTO_AUTH:-true}
if [ -z "$CHATBOT_API_TOKEN" ]; then
  MODEL_PROVIDER=simulation
fi
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
INFERENCE_HOST=${INFERENCE_HOST:-127.0.0.1}
INFERENCE_PORT=${INFERENCE_PORT:-8001}

export CHATBOT_API_TOKEN INFERENCE_SERVICE_TOKEN MODEL_PROVIDER UI_AUTO_AUTH
export INFERENCE_URL="${INFERENCE_URL:-http://${INFERENCE_HOST}:${INFERENCE_PORT}}"
export LLAMACPP_URL=${LLAMACPP_URL:-http://127.0.0.1:8080}
export MODEL_NAME=${MODEL_NAME:-local-model}

"$PYTHON" -m uvicorn inference.main:app --host "$INFERENCE_HOST" --port "$INFERENCE_PORT" &
INFERENCE_PID=$!

cleanup() {
  kill "$INFERENCE_PID" 2>/dev/null || true
  wait "$INFERENCE_PID" 2>/dev/null || true
}

trap cleanup 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Yerel Sohbet: http://localhost:%s\n' "$PORT"
printf 'Mod: %s\n' "$MODEL_PROVIDER"
if [ "$UI_AUTO_AUTH" = "true" ]; then
  if [ -z "$CHATBOT_API_TOKEN" ]; then
    printf 'Gateway tokeni yok; simule modda ayni-origin istekleri kabul edilir.\n'
  else
    printf 'UI oturumu HttpOnly cookie ile arka planda dogrulanir.\n'
  fi
else
  if [ -n "$CHATBOT_API_TOKEN" ]; then
    printf 'Gateway tokeni: %s\n' "$CHATBOT_API_TOKEN"
  else
    printf 'Gateway tokeni ayarlanmamis; simule mod etkin.\n'
  fi
fi
printf 'Durdurmak icin Ctrl+C\n'

"$PYTHON" -m uvicorn gateway.main:app --host "$HOST" --port "$PORT"