/* iOS 题宝库 · Service Worker —— 离线支持
 *
 * 设计要点(每一条都在防一类具体事故):
 * 1. VERSION 是缓存名与预缓存 URL 的唯一来源,bump-version.sh 统一同步。
 * 2. index.html 走**网络优先**。它是所有 ?v= 指针的载体,一旦被缓存锁死,
 *    用户永远拿不到新版本号 → 所有资源永远命中旧缓存,形成死锁。
 * 3. 带 ?v= 的资源走**缓存优先**。版本号变 = URL 变 = 必然未命中,天然安全,
 *    不需要 SWR 那种多余的网络往返与竞态。
 * 4. install 用 {cache:'reload'} 绕过 HTTP 缓存,防止托管方的长 max-age
 *    把刚 bump 的 URL 喂回旧内容。
 * 5. activate 删除所有非当前版本的 cache,旧字节不可能存活。
 * 6. 不自动 skipWaiting:新版本就绪时由页面提示用户,确认后才接管,
 *    避免"新 worker 接管了还在跑旧 JS 的页面"这种混版状态。
 * 7. 支持 UNREGISTER 消息 —— 万一还是卡住,设置页有一键逃生出口。
 */
'use strict';

const VERSION = '2.0.4';
const CACHE = 'iosih-' + VERSION;

/* 需要离线可用的全部资源(与 index.html 的 script/link 一一对应,
   tests.html 里有自动交叉校验,漏写会被测出来) */
const ASSETS = [
  'css/base.css', 'css/components.css', 'css/views.css', 'css/forms.css',
  'js/version.js', 'js/util.js', 'js/md.js', 'js/icons.js', 'js/data.js',
  'js/data/swift.js', 'js/data/swift-concurrency.js', 'js/data/memory.js',
  'js/data/objc.js', 'js/data/runtime.js', 'js/data/runloop.js', 'js/data/gcd.js',
  'js/data/uikit.js', 'js/data/swiftui.js', 'js/data/combine.js', 'js/data/network.js',
  'js/data/storage.js', 'js/data/architecture.js', 'js/data/performance.js',
  'js/data/engineering.js', 'js/data/algorithm.js', 'js/data/strategy.js',
  'js/data/custom.js',
  'js/store.js', 'js/router.js', 'js/ui.js',
  'js/views/dashboard.js', 'js/views/bank.js', 'js/views/cards.js', 'js/views/quiz.js',
  'js/views/wrongbook.js', 'js/views/stats.js', 'js/views/settings.js',
  'js/views/composer.js', 'js/views/mock.js',
  'js/app.js',
];

/* 版本化 URL + 不带版本号的入口文档与图标 */
const PRECACHE = ASSETS.map((u) => `${u}?v=${VERSION}`)
  .concat(['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg']);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个 put 而非 addAll:addAll 走 HTTP 缓存,可能拿到陈旧字节
    await Promise.all(PRECACHE.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error('预缓存失败: ' + url);
      await cache.put(url, res);
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('iosih-') && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;   // 跨域完全不接管

  // ① 文档:网络优先,断网才回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // ② 带版本号的资源:缓存优先(URL 即版本,命中必然是对的那一份)
  if (url.searchParams.has('v')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // ③ 其余(图标、manifest):网络优先,失败回退
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'UNREGISTER') {
    // 逃生出口:清空全部缓存并注销自己
    e.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('iosih-')).map((k) => caches.delete(k)));
      await self.registration.unregister();
    })());
  }
});
