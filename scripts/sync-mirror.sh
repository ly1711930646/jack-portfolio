#!/usr/bin/env bash
# ============================================================
# sync-mirror.sh —— 把 GitHub 仓库最新内容同步到本地 dist
# 用途：让 CloudStudio 国内镜像跟上 GitHub 上的最新图片/内容
# 健壮性：
#   - 每个文件先下到 .tmp，仅当 curl 成功(退出码0)才落盘；
#     超大文件(>~9MB)经代理易超时 → curl 失败 → 跳过并告警，绝不留下半截/损坏文件。
#   - 同步后扫描 content.json：凡引用了 dist 中不存在的 uploads/* 文件，
#     自动替换为占位图，保证部署出去永远不会出现"破图"。
# 用法：bash scripts/sync-mirror.sh
# 注意：本脚本只负责把最新文件拉进 dist/。拉完后需用 WorkBuddy
#       的 CloudStudio 部署能力把 dist/ 重新部署到镜像（见底部说明）。
# ============================================================
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 读取 .env（含 VITE_GH_* 配置与令牌）
set -a
[ -f .env ] && . ./.env
set +a

: "${VITE_GH_TOKEN:?未找到 VITE_GH_TOKEN，请检查 .env}"
: "${VITE_GH_REPO:?未找到 VITE_GH_REPO，请检查 .env}"
BRANCH="${VITE_GH_BRANCH:-main}"
API="https://api.github.com/repos/$VITE_GH_REPO"
AUTH="Authorization: Bearer $VITE_GH_TOKEN"
# 单文件超时 300s（代理对 >9MB 会在 ~250s 掐断，留余量）
RC="--retry 3 --retry-delay 2 --max-time 300"
PY=python3
PLACEHOLDER="assets/remote/placeholder-banner.svg"

mkdir -p dist/data dist/assets/uploads

echo "==> 同步 content.json"
curl -fsSL $RC -H "$AUTH" -H "Accept: application/vnd.github.raw" \
  "$API/contents/public/data/content.json?ref=$BRANCH" -o dist/data/content.json.tmp
mv -f dist/data/content.json.tmp dist/data/content.json
echo "    $(wc -c < dist/data/content.json) B"

echo "==> 同步 assets/uploads/*"
LIST_TMP="$(mktemp)"
curl -fsSL $RC -H "$AUTH" -H "Accept: application/vnd.github+json" \
  "$API/contents/public/assets/uploads?ref=$BRANCH" \
  | $PY -c "import sys,json; d=json.load(sys.stdin); [print(x['name']) for x in d]" > "$LIST_TMP" || true

if [ ! -s "$LIST_TMP" ]; then
  echo "    （uploads 目录为空，无文件可同步）"
else
  while read -r name; do
    name="${name:-}"
    [ -z "$name" ] && continue
    tmp="dist/assets/uploads/.$name.tmp"
    if curl -fsSL $RC -H "$AUTH" -H "Accept: application/vnd.github.raw" \
        "$API/contents/public/assets/uploads/$name?ref=$BRANCH" -o "$tmp"; then
      mv -f "$tmp" "dist/assets/uploads/$name"
      echo "    ✅ $name  $(wc -c < "dist/assets/uploads/$name") B"
    else
      rm -f "$tmp"
      echo "    ⚠️ 跳过 $name：下载失败（可能过大/代理超时，请压缩后重传）"
    fi
  done < "$LIST_TMP"
fi
rm -f "$LIST_TMP"

echo "==> 把缺失的 uploads 引用替换为占位图（避免部署出破图）"
$PY - <<'PY'
import json, os, re
p = 'dist/data/content.json'
s = open(p, encoding='utf-8').read()
def repl(m):
    ref = m.group(0)
    base = ref.split('/')[-1]
    if ref.startswith('assets/uploads/') and not os.path.exists('dist/assets/uploads/' + base):
        return 'assets/remote/placeholder-banner.svg'
    return ref
s2 = re.sub(r'assets/uploads/[A-Za-z0-9_.-]+', repl, s)
if s2 != s:
    open(p, 'w', encoding='utf-8').write(s2)
    print('    ✅ 已把缺失的 uploads 引用替换为占位图')
else:
    print('    （无需替换）')
PY

echo "==> 同步完成 ✅"
echo "    下一步：用 WorkBuddy 的 CloudStudio 部署能力重新部署 dist/ 目录（entry=index.html）以更新国内镜像。"
