#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN_DIR="/home/shimdx/.nvm/versions/node/v24.14.1/bin"

export PATH="${NODE_BIN_DIR}:${PATH}"
export NODE_ENV=production

cd "${ROOT_DIR}"
exec npm run build
