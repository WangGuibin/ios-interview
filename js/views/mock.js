/* iOS 题宝库 · views/mock.js:限时模拟面试(抽题 → 限时作答 → 自评 → 追问 → 评分报告) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.mock = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  const DURATIONS = [[15, '15 分钟'], [30, '30 分钟'], [45, '45 分钟']];
  const SCORES = { good: 2, ok: 1, bad: 0 };      // 答得好 / 一般 / 答不上
  const SCORE_LABEL = { good: '答得好', ok: '一般', bad: '答不上' };

  let cfg = { minutes: 30, scope: 'weak', count: 8 };
  let S = null;      // 会话
  let ticker = null;

  /* ---------- 组卷 ---------- */
  function buildQueue() {
    const store = App.store;
    let pool = QB.questions.slice();
    if (cfg.scope.startsWith('cat:')) pool = QB.ofCat(cfg.scope.slice(4));
    else if (cfg.scope === 'weak') {
      // 薄弱优先:未掌握的排前面,必考优先
      pool = pool.filter((q) => store.statusOf(q.id) !== 'mastered');
    } else if (cfg.scope === 'hot') {
      pool = pool.filter((q) => q.fq === 3);
    }
    // 真实面试的节奏:高频题占多数,难度递增
    const weighted = shuffle(pool).sort((a, b) => b.fq - a.fq).slice(0, Math.max(cfg.count * 2, 20));
    return shuffle(weighted).slice(0, cfg.count).sort((a, b) => a.lv - b.lv);
  }

  function newSession() {
    const qs = buildQueue();
    S = {
      qs,
      idx: 0,
      phase: 'thinking',              // thinking → revealed → deep(可选)
      results: [],                    // [{qid, score, deepAsked, ms}]
      startedAt: Date.now(),
      endsAt: Date.now() + cfg.minutes * 60000,
      qStartedAt: Date.now(),
      done: false,
      logged: false,
    };
  }

  const remainMs = () => Math.max(0, S.endsAt - Date.now());
  const fmtClock = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  /* ---------- 渲染 ---------- */
  function render(el) {
    stopTicker();
    if (S && !S.done) { renderRun(el); return; }
    if (S && S.done) { renderReport(el); return; }
    renderSetup(el);
    if (!el._bound_mock) {
      el._bound_mock = true;
      el.addEventListener('click', onClick);
    }
  }

  function renderSetup(el) {
    const t = App.store.totals();
    const log = App.store.mockLog;
    el.innerHTML = `
      <div class="col gap-4" style="max-width:720px;margin:0 auto">
        <div class="card pad">
          <h2 class="h-1">${icon('mic')} 模拟面试</h2>
          <p class="t-2 small mt-2">按真实面试节奏走:限时、连续出题、口头作答后自评,命中带追问的题会<b>自动追问</b>。结束给一份薄弱点报告。全程本地,不联网。</p>
        </div>

        <div class="card pad col gap-4">
          <div>
            <div class="small t-2" style="margin-bottom:8px">时长</div>
            <div class="seg" id="durSeg">
              ${DURATIONS.map(([v, l]) => `<button data-dur="${v}" class="${cfg.minutes === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <div>
            <div class="small t-2" style="margin-bottom:8px">出题范围</div>
            <div class="seg wrap" id="scopeSeg">
              <button data-scope="weak" class="${cfg.scope === 'weak' ? 'on' : ''}">薄弱优先</button>
              <button data-scope="hot" class="${cfg.scope === 'hot' ? 'on' : ''}">只考必考题</button>
              <button data-scope="all" class="${cfg.scope === 'all' ? 'on' : ''}">全部(${t.total})</button>
              ${QB.cats.filter((c) => QB.ofCat(c.key).length > 0)
                .map((c) => `<button data-scope="cat:${c.key}" class="${cfg.scope === 'cat:' + c.key ? 'on' : ''}">${esc(c.name)}</button>`).join('')}
            </div>
          </div>
          <div>
            <div class="small t-2" style="margin-bottom:8px">题量</div>
            <div class="seg" id="cntSeg">
              ${[5, 8, 12].map((n) => `<button data-cnt="${n}" class="${cfg.count === n ? 'on' : ''}">${n} 题</button>`).join('')}
            </div>
          </div>
        </div>

        <button class="btn primary lg" data-start>${icon('play')} 开始模拟面试</button>

        ${log.length ? `
        <div class="card pad">
          <h3 class="h-3">历史记录</h3>
          <div class="mt-2">
            ${log.slice(-8).reverse().map((r) => {
              const pct = r.total ? Math.round((r.score / (r.total * 2)) * 100) : 0;
              return `<div class="between" style="padding:8px 0;border-bottom:1px solid var(--line)">
                <span class="small">${fmtMD(r.ts)} · ${esc(r.scopeName || '综合')} · ${r.total} 题 · ${Math.round((r.durationMs || 0) / 60000)} 分钟</span>
                <span class="small num" style="font-weight:650;color:${pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)'}">${pct} 分</span>
              </div>`;
            }).join('')}
          </div>
          <button class="btn sm ghost mt-3" data-clear-mock>清空历史</button>
        </div>` : ''}
      </div>`;
  }

  function renderRun(el) {
    const q = S.qs[S.idx];
    if (!q) { finish(el); return; }
    const pct = S.idx / S.qs.length;
    const over = remainMs() <= 0;

    el.innerHTML = `
      <div class="quiz-card" style="max-width:720px;margin:0 auto">
        <div class="stage-head">
          <button class="icon-btn" data-exit aria-label="结束面试">${icon('x')}</button>
          <div class="stage-progress">${ui.bar(pct)}</div>
          <span class="timer-bar">${icon('clock')}<span class="timer-num" id="mockClock">${fmtClock(remainMs())}</span></span>
          <span class="small t-3 num">${S.idx + 1}/${S.qs.length}</span>
        </div>

        ${over ? `<div class="quiz-feedback bad" style="margin-bottom:12px"><div class="qf-title">时间到</div>可以继续答完,也可以直接看报告。</div>` : ''}

        <div class="card pad">
          <div class="row wrap gap-2" style="margin-bottom:10px">
            ${ui.catBadge(q.cat)}${ui.lvBadge(q.lv)}${ui.fqBadge(q.fq)}
            ${S.phase === 'deep' ? '<span class="badge fq3">追问</span>' : ''}
          </div>

          ${S.phase === 'deep'
            ? `<div class="h-2" style="font-size:16px;line-height:1.6">面试官继续追问:</div>
               <div class="md mt-3">${MD.render(q.deep)}</div>
               <div class="self-check-actions">
                 <button class="btn grade-btn yes" data-deep-done="good"><span>接住了<span class="sub">继续</span></span></button>
                 <button class="btn grade-btn no" data-deep-done="bad"><span>没接住<span class="sub">记入薄弱</span></span></button>
               </div>`
            : `<div class="h-2" style="font-size:17px;line-height:1.6">${esc(q.t)}</div>
               ${S.phase === 'thinking'
                 ? `<div class="flip-face" style="position:static;min-height:110px;background:var(--surface-2);border-style:dashed;margin-top:16px">
                      <div class="ff-hint" style="margin:0">${icon('info')} 像面试一样<b>开口说</b>出来:结论 → 原理 → 实战。说完再看参考答案。</div>
                    </div>
                    <button class="btn primary btn-block mt-4" data-reveal>${icon('chevD')} 我说完了,看参考答案</button>`
                 : `<div class="mt-4">${ui.answerHtml(q)}</div>
                    ${ui.noteBlock(q.id)}
                    <div class="self-check-actions">
                      <button class="btn grade-btn yes" data-score="good"><span>答得好<span class="sub">要点齐全</span></span></button>
                      <button class="btn grade-btn fuzzy" data-score="ok"><span>一般<span class="sub">有遗漏</span></span></button>
                      <button class="btn grade-btn no" data-score="bad"><span>答不上<span class="sub">进错题本</span></span></button>
                    </div>`}`}
        </div>
      </div>`;

    startTicker();
  }

  function renderReport(el) {
    stopTicker();
    const total = S.results.length;
    const maxScore = total * 2;
    const got = S.results.reduce((s, r) => s + SCORES[r.score], 0);
    const pct = maxScore ? got / maxScore : 0;
    const durationMs = Date.now() - S.startedAt;

    if (!S.logged && total) {
      S.logged = true;
      App.store.pushMock({
        scope: cfg.scope, scopeName: scopeName(), total, score: got,
        durationMs, weak: S.results.filter((r) => r.score !== 'good').map((r) => r.qid),
      });
    }

    // 分类得分
    const byCat = {};
    S.results.forEach((r) => {
      const q = QB.get(r.qid);
      if (!q) return;
      byCat[q.cat] = byCat[q.cat] || { got: 0, max: 0 };
      byCat[q.cat].got += SCORES[r.score];
      byCat[q.cat].max += 2;
    });
    const weakCats = Object.entries(byCat)
      .map(([k, v]) => ({ k, rate: v.max ? v.got / v.max : 1 }))
      .sort((a, b) => a.rate - b.rate).slice(0, 3);
    const avgSec = total ? Math.round(S.results.reduce((s, r) => s + r.ms, 0) / total / 1000) : 0;

    el.innerHTML = `
      <div class="session-done">
        ${ui.ring(pct, 128, 12, pct >= 0.75 ? 'var(--ok)' : pct >= 0.5 ? 'var(--warn)' : 'var(--danger)')}
        <div>
          <div class="h-1">模拟面得分 ${got} / ${maxScore}</div>
          <div class="t-2 small mt-2">
            ${total} 题 · 用时 ${Math.round(durationMs / 60000)} 分钟 · 平均每题 ${avgSec} 秒 ·
            ${pct >= 0.75 ? '状态不错,可以去约面了' : pct >= 0.5 ? '及格线附近,薄弱区再过一轮' : '暴露得越早越好,照着下面的薄弱点补'}
          </div>
        </div>

        ${weakCats.length ? `
        <div class="card pad" style="width:100%;text-align:left">
          <h3 class="h-3">薄弱点 TOP${weakCats.length}</h3>
          <div class="mt-3">
            ${weakCats.map((w) => {
              const c = QB.cat(w.k);
              return `<div class="cat-bar-row">
                <span class="cb-name">${ui.catIcon(w.k)}<span class="truncate">${esc(c ? c.name : w.k)}</span></span>
                <span class="cb-track">${ui.bar(w.rate, w.rate >= 0.75 ? 'var(--ok)' : w.rate >= 0.5 ? 'var(--warn)' : 'var(--danger)')}</span>
                <span class="cb-num">${Math.round(w.rate * 100)}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <div class="card pad" style="width:100%;text-align:left">
          ${S.results.map((r) => {
            const q = QB.get(r.qid);
            const good = r.score === 'good';
            return `<div class="review-row">
              <span class="review-ic ${good ? 'ok' : 'bad'}">${icon(good ? 'check' : 'x')}</span>
              <span class="grow" style="font-size:14px;line-height:1.5">${esc(q ? q.t : '(已删除)')}</span>
              <span class="small t-3" style="flex:none">${SCORE_LABEL[r.score]}${r.deepAsked ? ' · 追问' : ''} · ${Math.round(r.ms / 1000)}s</span>
            </div>`;
          }).join('')}
        </div>

        <div class="row wrap center gap-3">
          <button class="btn primary" data-restart>${icon('refresh')} 再来一场</button>
          ${App.store.totals().wrong ? `<button class="btn" data-go-wrong>${icon('wrong')} 攻克错题(${App.store.totals().wrong})</button>` : ''}
          <button class="btn ghost" data-go-dash>回到首页</button>
        </div>
      </div>`;
  }

  function scopeName() {
    if (cfg.scope === 'weak') return '薄弱优先';
    if (cfg.scope === 'hot') return '必考题';
    if (cfg.scope === 'all') return '综合';
    const c = QB.cat(cfg.scope.slice(4));
    return c ? c.name : '综合';
  }

  /* ---------- 计时器 ---------- */
  function startTicker() {
    stopTicker();
    ticker = setInterval(() => {
      const elx = $('#mockClock');
      if (!elx || !S || S.done || App.router.current !== 'mock') { stopTicker(); return; }
      const ms = remainMs();
      elx.textContent = fmtClock(ms);
      elx.className = 'timer-num' + (ms <= 60000 ? ' danger' : ms <= 300000 ? ' warn' : '');
      if (ms <= 0) { stopTicker(); renderRun($('#view')); }
    }, 1000);
  }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

  /* ---------- 交互 ---------- */
  function onClick(e) {
    if (App.router.current !== 'mock') return;
    const view = $('#view');

    const dur = e.target.closest('[data-dur]');
    if (dur) { cfg.minutes = Number(dur.dataset.dur); $$('#durSeg button').forEach((b) => b.classList.toggle('on', b === dur)); return; }
    const sc = e.target.closest('[data-scope]');
    if (sc) { cfg.scope = sc.dataset.scope; $$('#scopeSeg button').forEach((b) => b.classList.toggle('on', b === sc)); return; }
    const cnt = e.target.closest('[data-cnt]');
    if (cnt) { cfg.count = Number(cnt.dataset.cnt); $$('#cntSeg button').forEach((b) => b.classList.toggle('on', b === cnt)); return; }

    if (e.target.closest('[data-clear-mock]')) {
      ui.confirmDialog('清空模拟面试历史?', '只清除历史记录,不影响学习进度。', {
        okLabel: '清空', danger: true, onOk: () => { App.store.clearMock(); renderSetup(view); ui.toast('已清空', 'ok'); },
      });
      return;
    }

    if (e.target.closest('[data-start]')) {
      newSession();
      if (!S.qs.length) { S = null; ui.toast('这个范围没有可用题目,换个条件', 'info'); return; }
      renderRun(view);
      return;
    }

    if (e.target.closest('[data-reveal]')) { S.phase = 'revealed'; renderRun(view); return; }

    const score = e.target.closest('[data-score]');
    if (score) {
      const q = S.qs[S.idx];
      const g = score.dataset.score;
      // 自评同步进 SRS:答得好=掌握,一般=模糊,答不上=不会(自动进错题本)
      App.store.grade(q.id, g === 'good' ? 'known' : g === 'ok' ? 'fuzzy' : 'again');
      S.results.push({ qid: q.id, score: g, deepAsked: false, ms: Date.now() - S.qStartedAt });
      // 有追问且没答好 → 面试官追问
      if (q.deep && g !== 'bad') { S.phase = 'deep'; renderRun(view); return; }
      next(view);
      return;
    }

    const deepDone = e.target.closest('[data-deep-done]');
    if (deepDone) {
      const last = S.results[S.results.length - 1];
      if (last) {
        last.deepAsked = true;
        if (deepDone.dataset.deepDone === 'bad' && last.score === 'good') last.score = 'ok';
      }
      next(view);
      return;
    }

    if (e.target.closest('[data-exit]')) {
      ui.confirmDialog('结束这场模拟面试?', '已作答的题目会计入报告与学习记录。', {
        okLabel: '结束并看报告', onOk: () => finish(view),
      });
      return;
    }
    if (e.target.closest('[data-restart]')) { S = null; renderSetup(view); return; }
    if (e.target.closest('[data-go-wrong]')) { App.router.go('#/wrong'); return; }
    if (e.target.closest('[data-go-dash]')) { App.router.go('#/dash'); return; }
  }

  function next(view) {
    S.idx++;
    S.phase = 'thinking';
    S.qStartedAt = Date.now();
    if (S.idx >= S.qs.length) { finish(view); return; }
    renderRun(view);
  }

  function finish(view) {
    stopTicker();
    S.done = true;
    renderReport(view);
  }

  /** 供外部(导入/重置/删题)作废进行中的会话,避免持有已失效的 qid */
  function abortSession() { stopTicker(); S = null; }

  return { render, abortSession };
})();
