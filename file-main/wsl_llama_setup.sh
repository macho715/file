#!/usr/bin/env bash
# Run once inside WSL Ubuntu. sudo password may be required.
set -euo pipefail

sudo apt-get update -qq
sudo apt-get install -y -qq git cmake build-essential libssl-dev

if [ ! -d "$HOME/llama.cpp" ]; then
  echo "[ERROR] ~/llama.cpp not found. Clone llama.cpp first."
  exit 2
fi

cd "$HOME/llama.cpp"
cmake -S . -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_OPENSSL=ON \
  -DOPENSSL_INCLUDE_DIR=/usr/include \
  -DOPENSSL_SSL_LIBRARY=/usr/lib/aarch64-linux-gnu/libssl.so \
  -DOPENSSL_CRYPTO_LIBRARY=/usr/lib/aarch64-linux-gnu/libcrypto.so
cmake --build build -j"$(nproc)"

echo "Done. Built binaries under: ~/llama.cpp/build/bin"
