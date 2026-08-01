#!/usr/bin/env bash
# ============================================================
# mirror-hash.sh —— 检测 dist/ 相对上一次部署是否发生变化
# 用途：自动同步任务先跑 sync-mirror.sh 把 GitHub 最新内容拉进 dist，
#       再跑本脚本判断“是否值得重新部署”。
# 输出（供自动任务判断）：
#   CHANGED    —— 内容有变化，需要重新部署
#   NO_CHANGE  —— 与上次部署一致，跳过部署
# 状态文件：.mirror-hash（存上一次部署时的指纹）
# 用法：bash scripts/mirror-hash.sh
# ============================================================
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE=".mirror-hash"
TMP="$(mktemp)"

# 指纹 = content.json 内容 + uploads 目录(文件名+大小) 拼接后的 sha256
{
  if [ -f dist/data/content.json ]; then
    cat dist/data/content.json
  fi
  if [ -d dist/assets/uploads ]; then
    ls -l dist/assets/uploads 2>/dev/null | awk '{print $5, $9}'
  fi
} | sha256sum > "$TMP"

NEW="$(awk '{print $1}' "$TMP")"

if [ ! -f "$STATE" ]; then
  echo "CHANGED"          # 首次运行，无历史指纹，视为有变化
  cp -f "$TMP" "$STATE"
  exit 0
fi

OLD="$(awk '{print $1}' "$STATE" 2>/dev/null || echo "")"

if [ "$NEW" != "$OLD" ]; then
  echo "CHANGED"
  cp -f "$TMP" "$STATE"
else
  echo "NO_CHANGE"
fi
