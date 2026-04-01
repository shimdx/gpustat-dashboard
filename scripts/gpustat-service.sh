#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="gpustat-dashboard.service"
SYSTEMD_PATH="/etc/systemd/system/${SERVICE_NAME}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_SOURCE="${ROOT_DIR}/systemd/${SERVICE_NAME}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/gpustat-service.sh install
  ./scripts/gpustat-service.sh uninstall
  ./scripts/gpustat-service.sh build
  ./scripts/gpustat-service.sh enable
  ./scripts/gpustat-service.sh disable
  ./scripts/gpustat-service.sh start
  ./scripts/gpustat-service.sh stop
  ./scripts/gpustat-service.sh restart
  ./scripts/gpustat-service.sh status
  ./scripts/gpustat-service.sh logs
EOF
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run with sudo: sudo $0 $*" >&2
    exit 1
  fi
}

cmd="${1:-}"

case "${cmd}" in
  install)
    need_root "$@"
    "${ROOT_DIR}/scripts/build-prod.sh"
    install -D -m 0644 "${UNIT_SOURCE}" "${SYSTEMD_PATH}"
    systemctl daemon-reload
    ;;
  build)
    "${ROOT_DIR}/scripts/build-prod.sh"
    ;;
  uninstall)
    need_root "$@"
    systemctl disable --now "${SERVICE_NAME}" || true
    rm -f "${SYSTEMD_PATH}"
    systemctl daemon-reload
    ;;
  enable)
    need_root "$@"
    systemctl enable "${SERVICE_NAME}"
    ;;
  disable)
    need_root "$@"
    systemctl disable "${SERVICE_NAME}"
    ;;
  start)
    need_root "$@"
    systemctl start "${SERVICE_NAME}"
    ;;
  stop)
    need_root "$@"
    systemctl stop "${SERVICE_NAME}"
    ;;
  restart)
    need_root "$@"
    systemctl restart "${SERVICE_NAME}"
    ;;
  status)
    systemctl status "${SERVICE_NAME}" --no-pager
    ;;
  logs)
    journalctl -u "${SERVICE_NAME}" -n 100 --no-pager
    ;;
  *)
    usage
    exit 1
    ;;
esac
