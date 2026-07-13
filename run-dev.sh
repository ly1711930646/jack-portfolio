#!/bin/bash
# jack-portfolio 开发服务器常驻脚本（看门狗）
# 由 launchd 拉起，崩溃/退出后自动重启；启动前清理端口占用
PORT=5175
APP_DIR="/Users/yang.li/WorkBuddy/2026-07-07-16-00-06/jack-portfolio"
NODE_BIN="/Users/yang.li/.workbuddy/binaries/node/versions/22.22.2/bin/node"
VITE_BIN="$APP_DIR/node_modules/vite/bin/vite.js"
LOG="$APP_DIR/dev-watchdog.log"

cd "$APP_DIR" || exit 1

while true; do
  # 清理可能占用端口的残留监听进程
  PIDS=$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null)
  if [ -n "$PIDS" ]; then
    kill -9 $PIDS 2>/dev/null
    sleep 1
  fi

  echo "[$(date)] starting vite on :$PORT" >> "$LOG"
  "$NODE_BIN" "$VITE_BIN" --host --port $PORT --strictPort >> "$LOG" 2>&1
  CODE=$?
  echo "[$(date)] vite exited (code $CODE), restart in 3s" >> "$LOG"
  sleep 3
done
