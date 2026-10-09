/* iOS 题宝库 · views/quiz.js:模拟测验(选择题 + 回忆自评,错题自动入本) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.quiz = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  let cfg = { cat: 'all', src: 'all', count: 10 };
  let S = null;

  function buildQuestions() {
    const store = App.store;
    let pool = QB.questions.slice();
    if (cfg.cat !== 'all') pool = pool.filter((q) => q.cat === cfg.cat);
    switch (cfg.src) {
      case 'weak':
        pool = pool.filter((q) => store.statusOf(q.id) !== 'mastered');
        break;
      case 'wrong':
        pool = Object.keys(store.wrongMap).map((id) => QB.get(id)).filter(Boolean);
        if (cfg.cat !== 'all') pool = pool.filter((q) => q.cat === cfg.cat);
        break;
      case 'fav':
        pool = pool.filter((q) => store.isFav(q.id));
        break;
    }
    return shuffle(pool).slice(0, cfg.count);
  }

  function newSession(qs) {
    S = { qs: qs || buildQuestions(), idx: 0, results: [], locked: false };
  }

  function render(el) {
    if (S && S.idx < S.qs.length) { renderPlay(el); return; }
    if (S && S.idx >= S.qs.length) { renderResult(el); return; }
    renderSetup(el);
    if (!el._bound_quiz) {
      el._bound_quiz = true;
      el.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    }
  }

  /* ---------- 设置页 ---------- */
  function renderSetup(el) {
    const t = App.store.totals();
    el.innerHTML = `
      <div class="col gap-4" style="max-width:680px;margin:0 auto">
        <div class="card pad">
          <h2 class="h-1">组卷方式</h2>
          <p class="t-2 small mt-2">带选项的题按选择题判分;其余为"回忆自评":先口头作答,再对照标准答案自评对错。答错的题自动进入错题本。</p>
        </div>
        <div class="card pad col gap-4">
          <div>
            <div class="small t-2" style="margin-bottom:8px">范围</div>
            <div class="seg wrap" id="catSeg">
              <button data-cat="all" class="${cfg.cat === 'all' ? 'on' : ''}">全部(${t.total})</button>
              ${QB.cats.map((c) => `<button data-cat="${c.key}" class="${cfg.cat === c.key ? 'on' : ''}">${c.name}</button>`).join('')}
            </div>
          </div>
          <div>
            <div class="small t-2" style="margin-bottom:8px">出题侧重</div>
            <div class="seg" id="srcSeg">
              ${[['all', '全部'], ['weak', '未掌握优先'], ['wrong', `仅错题(${t.wrong})`], ['fav', `仅收藏(${t.fav})`]]
                .map(([v, l]) => `<button data-src="${v}" class="${cfg.src === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <div>
            <div class="small t-2" style="margin-bottom:8px">题量</div>
            <div class="seg" id="nSeg">
              ${[5, 10, 20].map((n) => `<button data-n="${n}" class="${cfg.count === n ? 'on' : ''}">${n} 题</button>`).join('')}
            </div>
          </div>
        </div>
        <button class="btn primary lg" data-start>${icon('play')} 开始测验</button>
      </div>`;
  }

  /* ---------- 答题中 ---------- */
  function renderPlay(el) {
    const q = S.qs[S.idx];
    const isMcq = Array.isArray(q.opt) && q.opt.length >= 2;
    const pct = S.idx / S.qs.length;

    el.innerHTML = `
      <div class="quiz-card">
        <div class="stage-head">
          <button class="icon-btn" data-exit aria-label="退出测验">${icon('x')}</button>
          <div class="stage-progress">${ui.bar(pct)}</div>
          <span class="small t-3 num">${S.idx + 1} / ${S.qs.length}</span>
        </div>
        <div class="card pad">
          <div class="row wrap gap-2" style="margin-bottom:10px">
            ${ui.catBadge(q.cat)}${ui.lvBadge(q.lv)}${ui.fqBadge(q.fq)}
            <span class="badge">${isMcq ? '选择题' : '回忆自评'}</span>
          </div>
          <div class="h-2" style="font-size:17px;line-height:1.6">${esc(q.t)}</div>
          <div id="quizBody" class="mt-4"></div>
          <div id="quizFoot"></div>
        </div>
      </div>`;

    if (isMcq) renderMcq(el, q);
    else renderRecall(el, q);
    S.locked = false;
  }

  function renderMcq(el, q) {
    $('#quizBody', el).innerHTML = `
      <div class="opt-list">
        ${q.opt.map((o, i) => `
          <button class="opt-btn" data-opt="${i}">
            <span class="opt-key">${'ABCD'[i]}</span>
            <span class="grow" style="text-align:left">${esc(o)}</span>
            <span class="mark"></span>
          </button>`).join('')}
      </div>`;
    $('#quizFoot', el).innerHTML = '';
  }

  function renderRecall(el, q) {
    $('#quizBody', el).innerHTML = `
      <div class="flip-face" style="position:static;min-height:120px;background:var(--surface-2);border-style:dashed">
        <div class="ff-hint" style="margin:0">${icon('info')} 先在脑中完整作答(结论 + 原理 + 实战),再显示参考答案对照自评</div>
      </div>`;
    $('#quizFoot', el).innerHTML = `
      <button class="btn primary btn-block mt-4" data-reveal>${icon('chevD')} 显示参考答案</button>`;
  }

  function lockMcq(el, q, picked) {
    S.locked = true;
    const ok = picked === q.ans;
    $$('.opt-btn', el).forEach((btn) => {
      const i = Number(btn.dataset.opt);
      btn.disabled = true;
      if (i === q.ans) {
        btn.classList.add('right');
        $('.mark', btn).innerHTML = icon('check');
      } else if (i === picked) {
        btn.classList.add('bad');
        $('.mark', btn).innerHTML = icon('x');
      }
    });
    finishAnswer(el, q, ok);
  }

  function revealRecall(el, q) {
    $('#quizBody', el).innerHTML = ui.answerHtml(q);
    $('#quizFoot', el).innerHTML = `
      <div class="self-check-actions">
        <button class="btn grade-btn yes" data-self="1"><span>答对了<span class="sub">与要点一致</span></span></button>
        <button class="btn grade-btn no" data-self="0"><span>答错了<span class="sub">收入错题本</span></span></button>
      </div>`;
    S.locked = true;
  }

  function finishAnswer(el, q, ok) {
    App.store.recordQuizAnswer(q.id, ok);
    const st = { qid: q.id, ok };
    S.results.push(st);
    const body = $('#quizBody', el);
    const isMcq = Array.isArray(q.opt);
    // 选择题判分后展示解析;回忆题答案已在屏上
    if (isMcq) {
      body.insertAdjacentHTML('beforeend', `
        <div class="quiz-feedback ${ok ? 'good' : 'bad'}">
          <div class="qf-title">${ok ? '回答正确' : '回答错误'} · 正确答案:${'ABCD'[q.ans]}</div>
          <div class="md">${MD.render(q.a)}</div>
          ${q.key && q.key.length ? `<ul class="keypoints mt-3"><li class="kp-title">${icon('zap')} 速记要点</li>${q.key.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        </div>`);
    }
    $('#quizFoot', el).innerHTML = `
      <button class="btn primary btn-block mt-4" data-next-q>${S.idx + 1 >= S.qs.length ? '查看成绩' : '下一题'} ${icon('chevR')}</button>`;
  }

  /* ---------- 成绩页 ---------- */
  function renderResult(el) {
    const total = S.results.length;
    const okCount = S.results.filter((r) => r.ok).length;
    const rate = total ? okCount / total : 0;
    if (!S.logged && total > 0) {
      S.logged = true;
      App.store.pushQuizLog({ scope: cfg.cat, total, ok: okCount });
    }

    const wrongOnes = S.results.filter((r) => !r.ok);
    el.innerHTML = `
      <div class="session-done">
        ${ui.ring(rate, 120, 11, rate >= 0.8 ? 'var(--ok)' : rate >= 0.5 ? 'var(--warn)' : 'var(--danger)')}
        <div>
          <div class="h-1">得分 ${okCount} / ${total}</div>
          <div class="t-2 small mt-2">${rate >= 0.9 ? '非常漂亮,保持住' : rate >= 0.7 ? '不错,错题及时清零' : rate >= 0.5 ? '及格线附近,错题要当天消化' : '暴露问题是好事,先攻克错题本'}</div>
        </div>
        ${S.results.length ? `
        <div class="card pad" style="width:100%;text-align:left">
          ${S.results.map((r) => {
            const q = QB.get(r.qid);
            return `<div class="review-row">
              <span class="review-ic ${r.ok ? 'ok' : 'bad'}">${icon(r.ok ? 'check' : 'x')}</span>
              <span class="grow" style="font-size:14px;line-height:1.5">${esc(q.t)}</span>
              <button class="icon-btn" data-open-q="${q.id}" aria-label="查看详解">${icon('chevR')}</button>
            </div>`;
          }).join('')}
        </div>` : ''}
        <div class="row wrap center gap-3">
          ${wrongOnes.length ? `<button class="btn danger" data-retry-wrong>${icon('wrong')} 重测错题(${wrongOnes.length})</button>` : ''}
          <button class="btn primary" data-restart>${icon('refresh')} 再来一组</button>
          <button class="btn ghost" data-go-dash>回到首页</button>
        </div>
      </div>`;
  }

  /* ---------- 交互 ---------- */
  function onClick(e) {
    if (App.router.current !== 'quiz') return;
    const view = $('#view');
    if (e.target.closest('[data-cat]')) {
      cfg.cat = e.target.closest('[data-cat]').dataset.cat;
      $$('#catSeg button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cfg.cat));
      return;
    }
    if (e.target.closest('[data-src]')) {
      cfg.src = e.target.closest('[data-src]').dataset.src;
      $$('#srcSeg button').forEach((b) => b.classList.toggle('on', b.dataset.src === cfg.src));
      return;
    }
    if (e.target.closest('[data-n]')) {
      cfg.count = Number(e.target.closest('[data-n]').dataset.n);
      $$('#nSeg button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === cfg.count));
      return;
    }
    if (e.target.closest('[data-start]')) {
      newSession();
      if (!S.qs.length) { ui.toast('当前范围题目不足,换个条件试试', 'info'); S = null; return; }
      renderPlay(view);
      return;
    }
    const optBtn = e.target.closest('[data-opt]');
    if (optBtn && !S.locked) {
      optBtn.classList.add('picked');
      lockMcq(view, S.qs[S.idx], Number(optBtn.dataset.opt));
      return;
    }
    if (e.target.closest('[data-reveal]')) { revealRecall(view, S.qs[S.idx]); return; }
    const selfBtn = e.target.closest('[data-self]');
    if (selfBtn) {
      finishAnswer(view, S.qs[S.idx], selfBtn.dataset.self === '1');
      return;
    }
    if (e.target.closest('[data-next-q]')) {
      S.idx++;
      if (S.idx >= S.qs.length) renderResult(view);
      else renderPlay(view);
      return;
    }
    if (e.target.closest('[data-exit]')) {
      App.ui.confirmDialog('结束本次测验?', '已答题目成绩已记录,未答题目不计入。', {
        okLabel: '结束并看成绩',
        onOk: () => { S.idx = S.qs.length; render(view); },
      });
      return;
    }
    if (e.target.closest('[data-retry-wrong]')) {
      const qs = S.results.filter((r) => !r.ok).map((r) => QB.get(r.qid));
      newSession(qs);
      renderPlay(view);
      return;
    }
    if (e.target.closest('[data-restart]')) { S = null; render(view); return; }
    if (e.target.closest('[data-go-dash]')) { App.router.go('#/dash'); return; }
    const openQ = e.target.closest('[data-open-q]');
    if (openQ) {
      const q = QB.get(openQ.dataset.openQ);
      App.router.go(`#/bank?cat=${q.cat}&open=${q.id}`);
    }
  }

  function onKey(e) {
    if (!S || App.router.current !== 'quiz' || S.idx >= S.qs.length) return;
    if (/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    const q = S.qs[S.idx];
    const view = $('#view');
    if (!S.locked && Array.isArray(q.opt) && ['1', '2', '3', '4'].includes(e.key)) {
      const i = Number(e.key) - 1;
      const btn = $(`[data-opt="${i}"]`);
      if (btn) btn.click();
    } else if (e.key === 'Enter' && S.locked) {
      const next = $('[data-next-q]');
      if (next) next.click();
    }
  }

  /** 供外部(导入/重置/删题)作废进行中的会话 */
  function abortSession() { S = null; }

  return { render, abortSession };
})();
