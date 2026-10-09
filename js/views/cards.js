/* iOS 题宝库 · views/cards.js:闪卡记忆(间隔重复 + 3D 翻面 + 智能队列) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.cards = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  let cfg = { scope: 'smart', count: App.store.settings.cardCount || 20 };
  let S = null; // session

  /* ---------- 队列构建 ---------- */
  function buildQueue() {
    const store = App.store;
    const now = Date.now();
    let pool = QB.questions;
    if (cfg.scope.startsWith('cat:')) pool = QB.ofCat(cfg.scope.slice(4));
    if (cfg.scope === 'wrong') pool = Object.keys(store.wrongMap).map((id) => QB.get(id)).filter(Boolean);
    if (cfg.scope === 'fav') pool = QB.questions.filter((q) => store.isFav(q.id));
    if (cfg.scope === 'new') pool = pool.filter((q) => store.statusOf(q.id) === 'new');

    const due = [], weak = [], fresh = [], rest = [];
    for (const q of pool) {
      const st = store.statusOf(q.id);
      if (store.isDue(q.id, now)) due.push(q);
      else if (st === 'wrong') weak.push(q);
      else if (st === 'new') fresh.push(q);
      else rest.push(q);
    }
    due.sort((a, b) => (store.progressMap[a.id]?.due || 0) - (store.progressMap[b.id]?.due || 0));
    weak.sort((a, b) => (store.wrongMap[b.id]?.n || 0) - (store.wrongMap[a.id]?.n || 0));
    fresh.sort((a, b) => b.fq - a.fq);
    const ordered = cfg.scope === 'random'
      ? shuffle(pool)
      : [...due, ...weak, ...fresh, ...shuffle(rest)];
    const limit = cfg.count === 0 ? ordered.length : cfg.count;
    return ordered.slice(0, limit);
  }

  function newSession() {
    const queue = buildQueue().map((q) => q.id);
    S = {
      queue,
      idx: 0,
      maxIdx: -1,
      flipped: false,
      graded: {},            // qid -> grade
      counts: { again: 0, fuzzy: 0, known: 0, skipped: 0 },
      appearances: {},       // qid -> n
      done: false,
    };
  }

  /* ---------- 渲染:选择器 ---------- */
  function render(el) {
    if (S && !S.done && S.queue.length) { renderSession(el); return; }
    renderPicker(el);
    if (!el._bound_cards) {
      el._bound_cards = true;
      el.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    }
  }

  function renderPicker(el) {
    const store = App.store;
    const t = store.totals();
    const scopes = [
      { key: 'smart', name: '智能复习', sub: `${t.due ? t.due + ' 题到期 · ' : ''}待复习优先,兼顾薄弱与新题`, icon: 'zap', tint: '#0A84FF' },
      { key: 'new', name: '学习新题', sub: `${t.total - t.studied} 题未开始,按必考优先`, icon: 'book', tint: '#30B0C7' },
      { key: 'wrong', name: '错题强化', sub: `${t.wrong} 题在错题本`, icon: 'wrong', tint: '#E8590C' },
      { key: 'fav', name: '收藏夹', sub: `${t.fav} 题已收藏`, icon: 'star', tint: '#F0A13C' },
      { key: 'random', name: '全部随机', sub: `${t.total} 题随机抽`, icon: 'refresh', tint: '#7D7AFF' },
      ...QB.cats.map((c) => {
        const s = store.catStats(c.key);
        return { key: 'cat:' + c.key, name: c.name, sub: `${s.total} 题 · 待复习 ${s.due} · 掌握 ${s.mastered}`, icon: c.icon, tint: c.tint };
      }),
    ];

    el.innerHTML = `
      <div class="col gap-4" style="max-width:820px;margin:0 auto">
        <div class="card pad">
          <h2 class="h-1">选择复习范围</h2>
          <p class="t-2 small mt-2">评分采用记忆盒子法:不会退回第 1 盒马上重学,模糊停留观察,掌握则升盒、按 1 / 2 / 4 / 8 / 16 / 32 天递增间隔复习。</p>
        </div>
        <div class="pick-grid" id="pickGrid">
          ${scopes.map((s) => `
            <button class="pick-cat${cfg.scope === s.key ? ' on' : ''}" data-scope="${s.key}">
              <span class="cat-icon" style="--cat:${s.tint}">${icon(s.icon)}</span>
              <span class="grow" style="text-align:left">
                <span class="pc-name">${s.name}</span><br><span class="pc-sub">${s.sub}</span>
              </span>
            </button>`).join('')}
        </div>
        <div class="card pad row between wrap gap-3">
          <div class="row gap-3 wrap">
            <span class="small t-2">本组题量</span>
            <span class="seg" id="countSeg">
              ${[[10, '10'], [20, '20'], [50, '50'], [0, '全部']].map(([v, l]) =>
                `<button data-count="${v}" class="${cfg.count === v ? 'on' : ''}">${l}</button>`).join('')}
            </span>
          </div>
          <button class="btn primary lg" data-start>${icon('play')} 开始本组闪卡</button>
        </div>
        <div class="kbd-hints" style="justify-content:flex-start">
          <span><kbd>空格</kbd>翻面</span><span><kbd>1</kbd>不会</span><span><kbd>2</kbd>模糊</span><span><kbd>3</kbd>掌握</span><span><kbd>←</kbd><kbd>→</kbd>翻页</span>
        </div>
      </div>`;
  }

  /* ---------- 渲染:进行中的会话 ---------- */
  function renderSession(el) {
    if (S.idx >= S.queue.length) { finishSession(el); return; }
    const qid = S.queue[S.idx];
    const q = QB.get(qid);
    // 仅向前推进时记出场次;回退浏览不重复计数
    if (S.idx > S.maxIdx) {
      S.maxIdx = S.idx;
      S.appearances[qid] = (S.appearances[qid] || 0) + 1;
    }
    const alreadyGraded = S.graded[qid];
    S.flipped = !!alreadyGraded;

    const pct = S.idx / S.queue.length;
    el.innerHTML = `
      <div style="max-width:860px;margin:0 auto">
        <div class="stage-head">
          <button class="icon-btn" data-exit aria-label="退出本组">${icon('x')}</button>
          <div class="stage-progress">${ui.bar(pct)}</div>
          <span class="small t-3 num">${S.idx + 1} / ${S.queue.length}</span>
          <button class="icon-btn ${App.store.isFav(qid) ? 'on' : ''}" data-fav="${qid}" aria-label="收藏">${icon(App.store.isFav(qid) ? 'starFill' : 'star')}</button>
        </div>
        <div class="flip-zone">
          <button class="flip-side-btn prev" data-prev aria-label="上一张" ${S.idx === 0 ? 'disabled' : ''}>${icon('chevL')}</button>
          <div class="flip-wrap">
            <div class="flip-card${S.flipped ? ' flipped' : ''}" id="flipCard" data-flip>
              <div class="flip-face front">
                <div class="ff-top">${ui.catBadge(q.cat)}${ui.lvBadge(q.lv)}${ui.fqBadge(q.fq)}
                  ${S.appearances[qid] > 1 ? '<span class="badge fq3">重来一次</span>' : ''}
                </div>
                <div class="ff-q">${esc(q.t)}</div>
                <div class="ff-hint">${icon('info')} 想好答案后点击卡片翻面,然后按熟练度自评</div>
              </div>
              <div class="flip-face back">
                <div class="ff-a">${ui.answerHtml(q)}${ui.noteBlock(q.id)}</div>
              </div>
            </div>
          </div>
          <button class="flip-side-btn next" data-next aria-label="下一张">${icon('chevR')}</button>
        </div>
        <div class="grade-row">
          ${alreadyGraded
            ? `<div class="btn yes btn-block" style="pointer-events:none">${icon('check')} 本题已作答:${gradeName(alreadyGraded)}</div>`
            : S.flipped
              ? `<button class="btn grade-btn no" data-grade="again"><span>不会<span class="sub">重来</span></span></button>
                 <button class="btn grade-btn fuzzy" data-grade="fuzzy"><span>模糊<span class="sub">明天再看</span></span></button>
                 <button class="btn grade-btn yes" data-grade="known"><span>掌握<span class="sub">间隔翻倍</span></span></button>`
              : `<button class="btn primary btn-block lg" data-flip>${icon('chevD')} 显示答案</button>`}
        </div>
        <div class="kbd-hints">
          <span><kbd>空格</kbd>${S.flipped ? '' : '翻面'}</span><span><kbd>1</kbd>不会</span><span><kbd>2</kbd>模糊</span><span><kbd>3</kbd>掌握</span>
        </div>
      </div>`;
    const prog = $('.stage-progress .bar > i', el);
    if (prog) requestAnimationFrame(() => { prog.style.width = `${pct * 100}%`; });
  }

  const gradeName = (g) => ({ again: '不会', fuzzy: '模糊', known: '掌握' })[g] || g;

  /* ---------- 交互 ---------- */
  function flip(el, open) {
    const card = $('#flipCard');
    if (!card) return;
    S.flipped = open === undefined ? !S.flipped : open;
    card.classList.toggle('flipped', S.flipped);
    if (S.flipped) renderSessionEl(el); // 翻开后出现评分按钮
  }

  /* 翻面后局部重绘评分区(不重置卡片 DOM,保持 3D 动画) */
  function renderSessionEl(el) {
    const qid = S.queue[S.idx];
    const alreadyGraded = S.graded[qid];
    const rowEl = $('.grade-row', el);
    if (!rowEl) return;
    rowEl.innerHTML = alreadyGraded
      ? `<div class="btn yes btn-block" style="pointer-events:none">${icon('check')} 本题已作答:${gradeName(alreadyGraded)}</div>`
      : `<button class="btn grade-btn no" data-grade="again"><span>不会<span class="sub">重来</span></span></button>
         <button class="btn grade-btn fuzzy" data-grade="fuzzy"><span>模糊<span class="sub">明天再看</span></span></button>
         <button class="btn grade-btn yes" data-grade="known"><span>掌握<span class="sub">间隔翻倍</span></span></button>`;
  }

  function doGrade(el, g) {
    const qid = S.queue[S.idx];
    if (S.graded[qid]) return;
    App.store.grade(qid, g);
    S.graded[qid] = g;
    S.counts[g]++;
    // 不会的题排到队尾再练(每题至多 3 次)
    if (g === 'again' && (S.appearances[qid] || 1) < 3) {
      S.queue.push(qid);
    }
    S.idx++;
    renderSession(el);
  }

  function finishSession(el) {
    S.done = true;
    const { again, fuzzy, known, skipped } = S.counts;
    const total = again + fuzzy + known;
    const rate = total ? known / total : 0;
    el.innerHTML = `
      <div class="session-done">
        ${ui.ring(rate, 120, 11, rate >= 0.8 ? 'var(--ok)' : rate >= 0.5 ? 'var(--warn)' : 'var(--danger)')}
        <div>
          <div class="h-1">本组完成</div>
          <div class="t-2 small mt-2">掌握率 ${Math.round(rate * 100)}% · 共作答 ${total} 题${skipped ? ` · 跳过 ${skipped}` : ''}</div>
        </div>
        <div class="done-grades">
          <span class="done-grade"><span class="dg-n" style="color:var(--ok)">${known}</span><span class="dg-l">掌握</span></span>
          <span class="done-grade"><span class="dg-n" style="color:var(--warn)">${fuzzy}</span><span class="dg-l">模糊</span></span>
          <span class="done-grade"><span class="dg-n" style="color:var(--danger)">${again}</span><span class="dg-l">不会</span></span>
        </div>
        <div class="small t-3">系统已按记忆曲线安排下次复习时间,明天记得回来。</div>
        <div class="row wrap center gap-3">
          <button class="btn primary" data-again-group>${icon('refresh')} 再来一组</button>
          ${App.store.totals().wrong ? `<button class="btn" data-go-wrong>${icon('wrong')} 去看错题(${App.store.totals().wrong})</button>` : ''}
          <button class="btn ghost" data-go-bank>回到题库</button>
        </div>
      </div>`;
  }

  function onClick(e) {
    if (App.router.current !== 'cards') return;
    const scopeBtn = e.target.closest('[data-scope]');
    if (scopeBtn) {
      cfg.scope = scopeBtn.dataset.scope;
      $$('#pickGrid .pick-cat').forEach((b) => b.classList.toggle('on', b === scopeBtn));
      return;
    }
    const countBtn = e.target.closest('[data-count]');
    if (countBtn) {
      cfg.count = Number(countBtn.dataset.count);
      App.store.setSetting('cardCount', cfg.count);
      $$('#countSeg button').forEach((b) => b.classList.toggle('on', b === countBtn));
      return;
    }
    const view = $('#view');
    if (e.target.closest('[data-start]')) {
      newSession();
      if (!S.queue.length) {
        App.ui.toast('这个范围暂时没有可复习的题目', 'info');
        return;
      }
      renderSession(view);
      return;
    }
    if (e.target.closest('[data-flip]')) {
      // 仅正面可点击翻面;背面点击(选词/展开深挖)不触发
      if (S.flipped) return;
      flip(view);
      return;
    }
    if (e.target.closest('[data-prev]')) { if (S.idx > 0) { S.idx--; renderSession(view); } return; }
    if (e.target.closest('[data-next]')) {
      const qid = S.queue[S.idx];
      if (!S.graded[qid]) S.counts.skipped++;
      S.idx++;
      renderSession(view);
      return;
    }
    const g = e.target.closest('[data-grade]');
    if (g) { doGrade(view, g.dataset.grade); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const on = App.store.toggleFav(fav.dataset.fav);
      fav.classList.toggle('on', on);
      fav.innerHTML = icon(on ? 'starFill' : 'star');
      return;
    }
    if (e.target.closest('[data-exit]')) {
      App.ui.confirmDialog('退出本组闪卡?', '已作答的成绩会保留,未作答的题目不记录。', {
        okLabel: '退出',
        onOk: () => { S = null; render(view); },
      });
      return;
    }
    if (e.target.closest('[data-again-group]')) { newSession(); renderSession(view); return; }
    if (e.target.closest('[data-go-wrong]')) { App.router.go('#/wrong'); return; }
    if (e.target.closest('[data-go-bank]')) { App.router.go('#/bank'); return; }
  }

  function onKey(e) {
    if (!S || S.done || App.router.current !== 'cards') return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const onButton = /BUTTON|A/.test(document.activeElement.tagName);
    const view = $('#view');
    if ((e.key === ' ' && !onButton) || (e.key === 'Enter' && !onButton)) {
      e.preventDefault();
      if (!$('#flipCard')) return;
      if (!S.flipped) flip(view);
    } else if (S.flipped && ['1', '2', '3'].includes(e.key)) {
      doGrade(view, { 1: 'again', 2: 'fuzzy', 3: 'known' }[e.key]);
    } else if (e.key === 'ArrowRight') {
      const qid = S.queue[S.idx];
      if (!S.graded[qid]) S.counts.skipped++;
      S.idx++;
      renderSession(view);
    } else if (e.key === 'ArrowLeft' && S.idx > 0) {
      S.idx--;
      renderSession(view);
    }
  }

  function setScope(key) {
    cfg.scope = key;
    S = null;
  }

  /** 供外部(导入/重置/删题)作废进行中的会话 */
  function abortSession() { S = null; }

  return { render, setScope, abortSession };
})();
