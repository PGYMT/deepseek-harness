#!/bin/sh
set -eu

# 仅做一件事：停止旧版 dsh web（端口 3081），并用源码版 Harness 替换启动。
# 在 WSL 终端中运行：sh start-src-web.sh

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

echo "==> 停止旧版 dsh web (port 3081) ..."
pkill -f "dsh web --port 3081" || true
sleep 1

echo "==> 启动源码版 dsh web (port 3081) ..."
cd "$ROOT"
exec env \
  XDG_CACHE_HOME="$ROOT/.xdg-cache" \
  XDG_DATA_HOME="$ROOT/.xdg-data" \
  pnpm dsh web --port 3081 --no-open
