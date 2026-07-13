#!/bin/bash
# 启动 Jack 作品集开发服务器（常驻）
cd "$(dirname "$0")" || exit 1
echo "启动中... 访问地址："
echo "  http://192.168.1.9:5175/"
echo "  http://localhost:5175/  (若走代理报 502，请用上面的 IP 地址)"
exec npm run dev -- --host --port 5175
