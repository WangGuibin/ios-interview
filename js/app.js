/* iOS 题宝库 · app.js:应用外壳、主题、全局搜索与路由装配 */
'use strict';

(() => {
  const { icon } = ICON;
  const ui = App.ui;

  /* ---------- 主题 ---------- */
  function applyTheme(theme) {
    const dark =
      theme === 'dark' ||
      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.getElementById('metaTheme');
    if (meta) meta.setAttribute('content', dark ? '#141416' : '#F5F5F7');
    const btn = $('#themeBtn');
    if (btn) btn.innerHTML = icon(dark ? 'sun' : 'moon');
    btn && btn.setAttribute('aria-label', dark ? '切换为浅色模式' : '切换为深色模式');
  }

  function cycleTheme() {
    const cur = App.store.settings.theme;
    const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
    App.store.setSetting('theme', next);
    applyTheme(next === 'auto' ? 'auto' : next);
    ui.toast(next === 'auto' ? '外观:跟随系统' : next === 'light' ? '外观:浅色' : '外观:深色');
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (App.store.settings.theme === 'auto') applyTheme('auto');
  });

  /* ---------- 导航定义 ---------- */
  const NAV = [
    { name: 'dash', label: '首页', icon: 'dash', hash: '#/dash' },
    { name: 'bank', label: '题库', icon: 'bank', hash: '#/bank' },
    { name: 'cards', label: '闪卡记忆', icon: 'cards', hash: '#/cards', badge: () => App.store.totals().due, badgeKind: 'due' },
    { name: 'quiz', label: '模拟测验', icon: 'quiz', hash: '#/quiz' },
    { name: 'wrong', label: '错题本', icon: 'wrong', hash: '#/wrong', badge: () => App.store.totals().wrong, badgeKind: 'hot' },
    { name: 'stats', label: '学习统计', icon: 'stats', hash: '#/stats' },
  ];

  /* 「冲刺」分组:模拟面试 / 我的题目 / 备考攻略 */
  const SPRINT_NAV = [
    { name: 'mock', label: '模拟面试', icon: 'mic', hash: '#/mock' },
    { name: 'composer', label: '我的题目', icon: 'cCustom', hash: '#/composer', badge: () => App.store.customList.length },
    { name: 'strategy', label: '备考攻略', icon: 'cStrategy', hash: '#/bank?cat=strategy', match: (q) => q.cat === 'strategy' },
  ];
  const ALL_NAV = NAV.concat(SPRINT_NAV);

  const TABS = ['dash', 'bank', 'cards', 'mock', 'stats'];

  function navBadgesHtml(item) {
    if (!item.badge) return '';
    const n = item.badge();
    if (!n) return '';
    return `<span class="nav-count ${item.badgeKind || ''}">${n > 99 ? '99+' : n}</span>`;
  }

  /* ---------- 外壳 ---------- */
  function buildShell() {
    const appEl = $('#app');
    appEl.innerHTML = `
      <aside class="side" aria-label="主导航">
        <div class="brand">
          <span class="brand-icon">题</span>
          <div>
            <div class="brand-name">iOS 题宝库</div>
            <div class="brand-sub">Interview Vault</div>
          </div>
        </div>
        <nav>
          <div class="nav-label">学习</div>
          ${NAV.map((n) => `
            <button class="nav-item press" data-nav="${n.name}" data-hash="${n.hash}">
              <span class="nav-glyph">${icon(n.icon)}</span>${n.label}
            </button>`).join('')}
          <div class="nav-label">冲刺</div>
          ${SPRINT_NAV.map((n) => `
            <button class="nav-item press" data-nav="${n.name}" data-hash="${n.hash}">
              <span class="nav-glyph">${icon(n.icon)}</span>${n.label}
            </button>`).join('')}
          <button class="nav-item press" data-nav="settings" data-hash="#/settings">
            <span class="nav-glyph">${icon('settings')}</span>设置
          </button>
        </nav>
        <div class="side-foot">
          <span class="small t-3" id="sideStat"></span>
          <button class="icon-btn" id="themeBtn" aria-label="切换主题">${icon('moon')}</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <h2 class="h-2" id="viewTitle">首页</h2>
          <div class="search" role="search">
            ${icon('search')}
            <input id="globalSearch" type="search" placeholder="搜索题目、标签、知识点" autocomplete="off" aria-label="全局搜索">
            <kbd>/</kbd>
          </div>
          <div class="row gap-1" style="margin-left:auto">
            <span class="offline-chip" id="offlineChip" style="display:none" title="当前离线,题库与进度照常可用">${icon('cloudOff')} 离线</span>
            <span class="badge ok" id="streakChip" title="连续学习天数" style="display:none">${icon('flame')} <span class="num">0</span></span>
          </div>
        </header>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="移动端标签栏">
        ${TABS.map((name) => {
          const n = ALL_NAV.find((x) => x.name === name);
          return `<button class="tab-item" data-nav="${n.name}" data-hash="${n.hash}">${icon(n.icon)}${n.label.replace('记忆', '').replace('模拟', '')}</button>`;
        }).join('')}
      </nav>`;

    // 导航点击
    appEl.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-hash]');
      if (nav) {
        App.router.go(nav.dataset.hash);
      }
    });
    $('#themeBtn').addEventListener('click', cycleTheme);

    initSearch();
    refreshChrome();
  }

  /* ---------- 顶栏边角数据 ---------- */
  function refreshChrome() {
    const t = App.store.totals();
    const sideStat = $('#sideStat');
    if (sideStat) sideStat.textContent = `${t.mastered}/${t.total} 已掌握`;
    const streak = App.store.streak();
    const chip = $('#streakChip');
    if (chip) {
      chip.style.display = streak > 0 ? '' : 'none';
      chip.querySelector('.num').textContent = streak;
    }
    // 侧栏徽标(待复习 / 错题 / 我的题目)
    ALL_NAV.forEach((n) => {
      const btn = $(`[data-nav="${n.name}"]`);
      if (!btn || !n.badge) return;
      const old = btn.querySelector('.nav-count');
      if (old) old.remove();
      const html = navBadgesHtml(n);
      if (html) btn.insertAdjacentHTML('beforeend', html);
    });
  }

  /* ---------- 全局搜索 ---------- */
  function initSearch() {
    const input = $('#globalSearch');
    let popEl = null;
    let cursor = -1;

    const closePop = () => {
      if (popEl) { popEl.remove(); popEl = null; }
      cursor = -1;
    };

    const openQuestion = (qid) => {
      const q = QB.get(qid);
      closePop();
      input.value = '';
      input.blur();
      App.router.go(`#/bank?cat=${q.cat}&open=${qid}`);
    };

    const doSearch = debounce(() => {
      const q = input.value.trim();
      if (!q) { closePop(); return; }
      const hits = QB.search(q).slice(0, 8);
      if (popEl) { popEl.remove(); popEl = null; }
      popEl = document.createElement('div');
      popEl.className = 'search-pop';
      popEl.innerHTML = hits.length
        ? hits.map((item, i) => {
            const title = esc(item.t).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
            return `<button class="search-hit" data-hit="${item.id}" data-i="${i}">
              ${ui.catIcon(item.cat)}<span class="grow"><span class="t">${title}</span></span>
              ${ui.fqBadge(item.fq)}
            </button>`;
          }).join('')
        : ui.empty('search', '没有找到相关题目', '换个关键词试试,比如 KVO、离屏渲染、actor');
      $('.topbar').appendChild(popEl);
      popEl.addEventListener('click', (e) => {
        const hit = e.target.closest('[data-hit]');
        if (hit) openQuestion(hit.dataset.hit);
      });
    }, 160);

    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', (e) => {
      const items = popEl ? $$('[data-hit]', popEl) : [];
      if (e.key === 'Escape') { closePop(); input.blur(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        cursor = e.key === 'ArrowDown' ? Math.min(cursor + 1, items.length - 1) : Math.max(cursor - 1, 0);
        items.forEach((el, i) => el.classList.toggle('cursor', i === cursor));
      } else if (e.key === 'Enter') {
        if (cursor >= 0 && items[cursor]) openQuestion(items[cursor].dataset.hit);
        else if (items[0]) openQuestion(items[0].dataset.hit);
        else if (input.value.trim()) { closePop(); App.router.go(`#/bank?q=${encodeURIComponent(input.value.trim())}`); }
      }
    });
    document.addEventListener('click', (e) => {
      if (popEl && !e.target.closest('.search') && !e.target.closest('.search-pop')) closePop();
    });

    // "/" 聚焦搜索
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- 视图路由 ---------- */
  const VIEWS = {
    dash: { title: '首页', pattern: /^\/dash$/ },
    bank: { title: '题库', pattern: /^\/bank$/ },
    cards: { title: '闪卡记忆', pattern: /^\/cards$/ },
    quiz: { title: '模拟测验', pattern: /^\/quiz$/ },
    wrong: { title: '错题本', pattern: /^\/wrong$/ },
    stats: { title: '学习统计', pattern: /^\/stats$/ },
    mock: { title: '模拟面试', pattern: /^\/mock$/ },
    composer: { title: '我的题目', pattern: /^\/composer$/ },
    settings: { title: '设置', pattern: /^\/settings$/ },
  };

  function registerRoutes() {
    Object.entries(VIEWS).forEach(([name, def]) => {
      App.router.register(name, def.pattern, (params, query) => {
        const viewEl = $('#view');
        viewEl.scrollTop = 0;
        window.scrollTo({ top: 0 });
        $('#viewTitle').textContent = def.title;
        viewEl.innerHTML = '';
        App.views[name].render(viewEl, params, query);
      });
    });
    App.router.onNotFound(() => App.router.go('#/dash', true));
  }

  /* ---------- 导航高亮 ---------- */
  App.applyTheme = applyTheme;
  App.shell = {
    syncNav(name) {
      const q = App.router.parse().query;
      $$('[data-nav]').forEach((el) => {
        const n = ALL_NAV.find((x) => x.name === el.dataset.nav);
        let active = el.dataset.nav === name;
        if (n && n.match) active = name === 'bank' && n.match(q);
        if (el.dataset.nav === 'bank' && q.cat === 'strategy') active = false;
        el.classList.toggle('active', active);
      });
    },
    refreshChrome,
    /** 作废所有进行中的会话:导入/重置/删题后调用,防止会话持有已失效的 qid */
    invalidateSessions() {
      ['cards', 'quiz', 'mock'].forEach((k) => {
        const v = App.views[k];
        if (v && typeof v.abortSession === 'function') v.abortSession();
      });
    },
  };

  /* ---------- 全站键盘流 ----------
     纪律:与 cards/quiz/mock 的数字键不冲突 —— 那些监听器各自有路由守卫,
     这里只处理"不属于任何进行中会话"的全局动作。 */
  const GOTO = { d: '#/dash', b: '#/bank', c: '#/cards', q: '#/quiz', w: '#/wrong', s: '#/stats', m: '#/mock', n: '#/composer' };

  function initKeyboard() {
    let awaitingGoto = false;
    let gotoTimer = null;

    const inField = () => {
      const el = document.activeElement;
      if (!el) return false;
      return /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
    };

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inField()) return;

      // g 前缀跳转:g d / g b / g c …
      if (awaitingGoto) {
        awaitingGoto = false;
        clearTimeout(gotoTimer);
        const dest = GOTO[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); App.router.go(dest); }
        return;
      }
      if (e.key === 'g') {
        awaitingGoto = true;
        gotoTimer = setTimeout(() => { awaitingGoto = false; }, 1200);
        return;
      }

      // ? 呼出快捷键面板
      if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

      // Esc 关闭浮层
      if (e.key === 'Escape') {
        const banner = $('.update-banner');
        if (banner) banner.remove();
        return;
      }

      // j / k 在题库列表里上下移动,Enter 展开
      if (App.router.current !== 'bank' && App.router.current !== 'wrong') return;
      if (!['j', 'k', 'Enter'].includes(e.key)) return;
      const rows = $$('.q-row');
      if (!rows.length) return;
      let idx = rows.findIndex((r) => r.classList.contains('kb-cursor'));

      if (e.key === 'Enter') {
        if (idx < 0) return;
        e.preventDefault();
        rows[idx].querySelector('.q-head').click();
        return;
      }
      e.preventDefault();
      if (idx < 0) idx = e.key === 'j' ? -1 : rows.length;
      const next = clamp(e.key === 'j' ? idx + 1 : idx - 1, 0, rows.length - 1);
      rows.forEach((r) => r.classList.remove('kb-cursor'));
      rows[next].classList.add('kb-cursor');
      rows[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function showShortcuts() {
    App.ui.modal({
      title: '键盘快捷键',
      body: `<div class="kbd-panel">
        <div class="kbd-group">
          <h4>全局</h4>
          <div class="kbd-row"><span>搜索</span><kbd>/</kbd></div>
          <div class="kbd-row"><span>快捷键面板</span><kbd>?</kbd></div>
          <div class="kbd-row"><span>跳转:首页 / 题库</span><span><kbd>g</kbd><kbd>d</kbd> <kbd>g</kbd><kbd>b</kbd></span></div>
          <div class="kbd-row"><span>跳转:闪卡 / 测验</span><span><kbd>g</kbd><kbd>c</kbd> <kbd>g</kbd><kbd>q</kbd></span></div>
          <div class="kbd-row"><span>跳转:模拟面 / 我的题</span><span><kbd>g</kbd><kbd>m</kbd> <kbd>g</kbd><kbd>n</kbd></span></div>
          <div class="kbd-row"><span>跳转:错题 / 统计</span><span><kbd>g</kbd><kbd>w</kbd> <kbd>g</kbd><kbd>s</kbd></span></div>
        </div>
        <div class="kbd-group">
          <h4>题库 / 错题本</h4>
          <div class="kbd-row"><span>上下移动</span><span><kbd>j</kbd> <kbd>k</kbd></span></div>
          <div class="kbd-row"><span>展开 / 收起</span><kbd>Enter</kbd></div>
          <h4 style="margin-top:14px">闪卡</h4>
          <div class="kbd-row"><span>翻面</span><kbd>空格</kbd></div>
          <div class="kbd-row"><span>不会 / 模糊 / 掌握</span><span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span></div>
          <div class="kbd-row"><span>上一张 / 下一张</span><span><kbd>←</kbd> <kbd>→</kbd></span></div>
          <h4 style="margin-top:14px">测验</h4>
          <div class="kbd-row"><span>选择选项</span><span><kbd>1</kbd>…<kbd>4</kbd></span></div>
          <div class="kbd-row"><span>下一题</span><kbd>Enter</kbd></div>
        </div>
      </div>`,
      actions: [{ label: '知道了', kind: 'primary' }],
    });
  }

  /* ---------- 离线支持(Service Worker) ---------- */
  async function initSW() {
    // file:// 下不存在 serviceWorker,静默跳过 —— 双击打开仍然完全可用
    if (location.protocol === 'file:' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',   // 否则 sw.js 自身可能被 HTTP 缓存最多 24 小时
      });

      const promptUpdate = () => {
        if (!reg.waiting) return;
        App.ui.updateBanner(() => reg.waiting.postMessage({ type: 'SKIP_WAITING' }));
      };
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate();
        });
      });

      let reloading = false;   // 防刷新死循环
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });

      // 长期驻留的 PWA:回前台时检查更新,最多每小时一次
      let lastCheck = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - lastCheck < 3600e3) return;
        lastCheck = Date.now();
        reg.update().catch(() => {});
      });
    } catch (e) {
      /* 注册失败不影响任何功能,应用照常在线运行 */
    }
  }

  /* 网络状态提示 */
  function initNetworkChip() {
    const sync = () => {
      const chip = $('#offlineChip');
      if (chip) chip.style.display = navigator.onLine ? 'none' : '';
    };
    window.addEventListener('online', () => { sync(); App.ui.toast('已恢复联网', 'ok', 1600); });
    window.addEventListener('offline', () => { sync(); App.ui.toast('已离线,题库与进度照常可用', 'info', 2600); });
    sync();
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(App.store.settings.theme);
    App.store.pruneCustomOrphans();   // 自愈:清理指向已删除自建题的残留记录
    buildShell();
    registerRoutes();
    App.router.start('#/dash');
    App.store.onChange(() => refreshChrome());
    $('#app').setAttribute('aria-busy', 'false');
    initKeyboard();
    initNetworkChip();
    initSW();
  });
})();
