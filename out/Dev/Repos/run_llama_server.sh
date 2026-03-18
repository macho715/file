#!/usr/bin/env bash
set -euo pipefail

# SSOT config (Surface ARM64 / CPU-only)
PORT=8080
HOST=0.0.0.0
CTX=2048
THREADS=5   # Stable default for WSL processors=6 (cores-1)
REPO="itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF"
FILE="qwen2-1.5b-instruct-q4_k_m.gguf"

LLAMA_SERVER="$HOME/llama.cpp/build/bin/llama-server"
LOGDIR="$HOME/svc/logs"
LOGFILE="$LOGDIR/llama-server.log"

mkdir -p "$LOGDIR"

# Skip if port already listening
if ss -ltn | grep -q ":${PORT} "; then
  echo "[INFO] llama-server already listening on ${PORT}" | tee -a "$LOGFILE"
  exit 0
fi

# Binary must exist
if [ ! -x "$LLAMA_SERVER" ]; then
  echo "[ERROR] llama-server not found or not executable: $LLAMA_SERVER" | tee -a "$LOGFILE"
  exit 2
fi

# Start server and append log
echo "[INFO] starting llama-server on ${HOST}:${PORT} CTX=${CTX} THREADS=${THREADS}" | tee -a "$LOGFILE"
exec "$LLAMA_SERVER" \
  --host "$HOST" \
  --port "$PORT" \
  --hf-repo "$REPO" \
  --hf-file "$FILE" \
  -c "$CTX" \
  -t "$THREADS" \
  2>&1 | tee -a "$LOGFILE"
