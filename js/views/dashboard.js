/* iOS 题宝库 · views/dashboard.js:首页仪表盘 */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.dash = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  };

  /* 每日一题:只从内置题里挑,自建题增删不会打乱当天的题 */
  function dailyPick() {
    const seed = fnv(dayKey());
    const list = QB.questions.filter((q) => !q.custom);
    if (!list.length) return QB.questions[0];
    return list[parseInt(seed, 36) % list.length];
  }

  /** 备考倒计时条:设了面试日期才出现 */
  function countdownHtml() {
    const plan = App.store.plan;
    const left = App.store.planDaysLeft();
    if (!plan || !plan.interviewDate || left === null) return '';
    const t = App.store.totals();
    const remain = t.total - t.mastered;
    const perDay = left > 0 ? Math.ceil(remain / left) : remain;
    const urgent = left <= 7;
    return `
      <div class="countdown ${urgent ? 'urgent' : ''} mt-4">
        <div style="text-align:center">
          <div class="cd-num">${left > 0 ? left : 0}</div>
          <div class="cd-unit">${left > 0 ? '天后面试' : left === 0 ? '今天面试' : '已过期'}</div>
        </div>
        <div class="grow">
          <div class="between small">
            <span class="t-2">${esc(plan.company || '目标公司')}${plan.role ? ' · ' + esc(plan.role) : ''}</span>
            <span class="t-3">${plan.interviewDate}</span>
          </div>
          <div class="mt-2">${ui.bar(t.total ? t.mastered / t.total : 0, urgent ? 'var(--danger)' : 'var(--accent)')}</div>
          <div class="small t-3 mt-2">
            已掌握 ${t.mastered}/${t.total} · 还剩 ${remain} 题${left > 0 ? ` · 按当前节奏每天需 <b>${perDay}</b> 题` : ''}
          </div>
        </div>
        <a class="btn ${urgent ? 'danger' : 'primary'}" href="#/cards">${icon('play')} 开始</a>
      </div>`;
  }

  function render(el) {
    const store = App.store;
    const t = store.totals();
    const today = store.today();
    const streak = store.streak();
    const goal = store.settings.goal;
    const dq = dailyPick();
    const week = last7Days();

    const pctMaster = t.total ? t.mastered / t.total : 0;
    const pctToday = goal ? Math.min(1, today.n / goal) : 0;

    el.innerHTML = `
      <div class="dash-head">
        <div>
          <div class="dash-date">${fmtFull()} · 已连续学习 <b class="num">${streak}</b> 天</div>
          <h1 class="h-display">${greet()},继续保持</h1>
        </div>
        <div class="row">
          <a class="btn ghost sm" href="#/stats">${icon('stats')} 学习统计</a>
          <a class="btn primary" href="#/cards">${icon('play')} 开始复习</a>
        </div>
      </div>

      ${countdownHtml()}

      <div class="dash-grid cols-4 mt-6">
        <div class="card stat-tile">
          <span class="stat-num num">${t.total}</span>
          <span class="stat-label">题库总量</span>
        </div>
        <div class="card stat-tile">
          <span class="stat-num num">${t.studied}</span>
          <span class="stat-label">已学习 ${t.total ? `<span class="t-3 small">(${Math.round((t.studied / t.total) * 100)}%)</span>` : ''}</span>
        </div>
        <div class="card stat-tile">
          <span class="stat-num num">${t.mastered}</span>
          <span class="stat-label">已掌握 ${t.total ? `<span class="t-3 small">(${Math.round((t.mastered / t.total) * 100)}%)</span>` : ''}</span>
        </div>
        <div class="card stat-tile">
          <span class="stat-num num">${t.due}</span>
          <span class="stat-label">今日待复习</span>
        </div>
      </div>

      <div class="dash-grid mt-3" style="grid-template-columns:1.2fr 1fr">
        <div class="card pad col gap-3">
          <div class="between">
            <h3 class="h-3">今日进度</h3>
            <span class="small t-3">目标 ${goal} 题/日</span>
          </div>
          <div class="today-card">
            <div class="today-ring-col">
              ${ui.ring(pctToday, 84, 9)}
              <span class="small t-3">完成度</span>
            </div>
            <div class="col gap-2 grow">
              ${progressLine('今日已学', today.n, goal)}
              ${progressLine('其中答对', today.ok, Math.max(1, today.n), 'var(--ok)')}
              ${progressLine('今日待复习', t.due, Math.max(1, t.studied))}
              <div class="small t-3 mt-2">掌握度:${Math.round(pctMaster * 100)}% · 按记忆曲线安排复习,保持节奏比一次学很多更重要。</div>
            </div>
          </div>
          <div>
            <div class="between" style="margin-bottom:6px"><span class="small t-2">近 7 天学习量</span></div>
            <div class="mini-bars">${week}</div>
          </div>
        </div>

        <div class="card pad col gap-3 daily-q">
          <div class="between">
            <h3 class="h-3">${icon('flame')} 每日一题</h3>
            ${ui.catBadge(dq.cat)}
          </div>
          <div class="h-2" style="font-size:16px;line-height:1.55">${esc(dq.t)}</div>
          <div class="row wrap">${ui.lvBadge(dq.lv)}${ui.fqBadge(dq.fq)}</div>
          <div class="row mt-2">
            <button class="btn primary" data-open-daily="${dq.id}">${icon('chevR')} 查看答案</button>
            <button class="btn ghost" data-reshuffle>${icon('refresh')} 换一题</button>
          </div>
        </div>
      </div>

      <div class="dash-head mt-8">
        <h2 class="h-1">快速开始</h2>
      </div>
      <div class="dash-grid cols-4 mt-3">
        ${quickBtn('cards', 'zap', '#0A84FF', '智能复习', t.due ? `${t.due} 题到期,优先清掉` : '按记忆曲线自动排序')}
        ${quickBtn('mock', 'mic', '#8E44AD', '模拟面试', '限时实战,带追问与评分报告')}
        ${quickBtn('quiz', 'quiz', '#7D7AFF', '快速测验', '随机 10 题,检验掌握程度')}
        ${quickBtn('wrong', 'wrong', '#E8590C', '消灭错题', t.wrong ? `错题本里还有 ${t.wrong} 题` : '错题本当前是空的')}
      </div>

      <div class="dash-head mt-8">
        <h2 class="h-1">分类掌握度</h2>
        <a class="btn ghost sm" href="#/bank">全部题目 ${icon('chevR')}</a>
      </div>
      <div class="dash-grid cols-4 mt-3" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
        ${QB.cats.map(catTile).join('')}
      </div>`;

    if (!el._bound_dash) {
      el._bound_dash = true;
      el.addEventListener('click', onClick);
    }
  }

  function onClick(e) {
    if (App.router.current !== 'dash') return;
      const daily = e.target.closest('[data-open-daily]');
      if (daily) {
        const q = QB.get(daily.dataset.openDaily);
        App.router.go(`#/bank?cat=${q.cat}&open=${q.id}`);
        return;
      }
      if (e.target.closest('[data-reshuffle]')) {
        const n = Math.floor(Math.random() * QB.questions.length);
        const q = QB.questions[n];
        App.router.go(`#/bank?cat=${q.cat}&open=${q.id}`);
        return;
      }
      const quick = e.target.closest('[data-quick]');
      if (quick) App.router.go(quick.dataset.quick);
      const tile = e.target.closest('[data-cat-tile]');
      if (tile) App.router.go(`#/bank?cat=${tile.dataset.catTile}`);
  }

  function progressLine(label, value, max, color) {
    const pct = max ? Math.min(1, value / max) : 0;
    return `<div>
      <div class="between small"><span class="t-2">${label}</span><span class="num" style="font-weight:650">${value}/${max}</span></div>
      ${ui.bar(pct, color)}
    </div>`;
  }

  function quickBtn(hash, ic, color, title, sub) {
    return `<button class="quick-btn" data-quick="#/${hash}">
      <span class="qb-icon" style="background:${color}">${icon(ic)}</span>
      <span class="grow"><span class="qb-title">${title}</span><br><span class="qb-sub">${sub}</span></span>
      <span class="t-3">${icon('chevR')}</span>
    </button>`;
  }

  function catTile(c) {
    const s = App.store.catStats(c.key);
    const pct = s.total ? s.mastered / s.total : 0;
    return `<button class="cat-tile" data-cat-tile="${c.key}">
      ${ui.catIcon(c.key)}
      <span class="grow">
        <span class="ct-name">${esc(c.name)}</span><br>
        <span class="ct-sub">${s.total} 题 · 掌握 ${s.mastered}${s.due ? ` · <span style="color:var(--accent)">${s.due} 待复习</span>` : ''}</span>
      </span>
      <span class="ring small">${ui.ring(pct, 38, 4.5, c.tint)}</span>
    </button>`;
  }

  function last7Days() {
    const days = App.store.heatmap(1).slice(-7);
    const max = Math.max(1, ...days.map((d) => d.n));
    return days
      .map((d) => {
        const h = Math.round((d.n / max) * 100);
        return `<span class="mb${d.future ? ' future' : ''}" title="${d.date} 学习 ${d.n} 题">
          <i style="height:${Math.max(h, d.n ? 12 : 4)}%"></i><span>${d.date.replace('月', '/').replace('日', '')}</span>
        </span>`;
      })
      .join('');
  }

  return { render };
})();
