#!/bin/bash
# 版本号同步脚本 —— 版本号的唯一入口
#
# 为什么需要它:?v= 版本号散落在 index.html(35 处)、tests.html、sw.js、
# js/version.js 四个地方,手改必然漏,漏了就会出现"浏览器跑旧文件"的幽灵 bug。
# 改完任何 JS/CSS 后执行:  ./bump-version.sh 2.0.1
set -euo pipefail
cd "$(dirname "$0")"

NEW="${1:-}"
if [ -z "$NEW" ]; then
  echo "用法: ./bump-version.sh <新版本号>   例: ./bump-version.sh 2.0.1"
  echo "当前版本: $(grep -oE "APP_VERSION = '[^']+'" js/version.js | grep -oE "[0-9.]+")"
  exit 1
fi

OLD=$(grep -oE "APP_VERSION = '[^']+'" js/version.js | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
echo "版本 $OLD → $NEW"

# 1. 唯一来源
perl -i -pe "s/APP_VERSION = '[^']+'/APP_VERSION = '$NEW'/" js/version.js
# 2. 资源查询串
perl -i -pe "s/\?v=[0-9]+\.[0-9]+\.[0-9]+/?v=$NEW/g" index.html tests.html
# 3. Service Worker 缓存版本
perl -i -pe "s/const VERSION = '[^']+'/const VERSION = '$NEW'/" sw.js
# 4. 设置页"关于"里的展示版本
perl -i -pe "s/版本 v[0-9]+\.[0-9]+\.[0-9]+/版本 v$NEW/" js/views/settings.js

echo "已同步:"
printf '  js/version.js  %s\n' "$(grep -oE "APP_VERSION = '[^']+'" js/version.js)"
printf '  index.html     %s 处 ?v=%s\n' "$(grep -c "?v=$NEW" index.html)" "$NEW"
printf '  tests.html     %s 处\n' "$(grep -c "?v=$NEW" tests.html || echo 0)"
printf '  sw.js          %s\n' "$(grep -oE "const VERSION = '[^']+'" sw.js)"
echo "别忘了重载页面时硬刷新(⌘⇧R),或用设置页的「清除离线缓存」。"
