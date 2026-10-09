/* iOS 题宝库 · views/wrongbook.js:错题本(查漏补缺的主战场) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.wrong = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  function entries() {
    const map = App.store.wrongMap;
    return Object.entries(map)
      .map(([qid, meta]) => ({ q: QB.get(qid), meta }))
      .filter((x) => x.q)
      .sort((a, b) => b.meta.n - a.meta.n || b.meta.ts - a.meta.ts);
  }

  function render(el) {
    const list = entries();
    if (!list.length) {
      el.innerHTML = ui.empty('check', '错题本空空如也',
        '闪卡评"不会"、测验答错的题会自动收进来。题题当日清,面试自然稳。',
        `<a class="btn primary" href="#/quiz">${icon('quiz')} 去测一组看看</a>`);
      return;
    }

    el.innerHTML = `
      <div class="between wrap gap-3">
        <div>
          <h2 class="h-1">${list.length} 道错题待消灭</h2>
          <p class="small t-3">按错误次数排序。评"掌握"自动移出;面试前把这一页清零。</p>
        </div>
        <div class="row">
          <button class="btn" data-drill>${icon('cards')} 逐题强化</button>
          <button class="btn ghost" data-clear>${icon('trash')} 清空</button>
        </div>
      </div>
      <div class="col gap-2 mt-4" id="wrongList">
        ${list.map(({ q, meta }) => rowHtml(q, meta)).join('')}
      </div>`;

    if (!el._bound_wrong) {
      el._bound_wrong = true;
      el.addEventListener('click', onClick);
    }
  }

  function rowHtml(q, meta) {
    const st = App.store.statusOf(q.id);
    return `
    <div class="card q-row" data-qid="${q.id}">
      <button class="q-head" data-toggle>
        <span class="dot wrong"></span>
        <span class="qt">${esc(q.t)}</span>
        <span class="wrong-meta" style="flex:none">
          <span>错 <b class="wrong-n">${meta.n}</b> 次</span>
          <span>·</span><span>${relTime(meta.ts)}</span>
        </span>
        ${ui.catBadge(q.cat)}
        <span class="chev">${icon('chevR')}</span>
      </button>
      <div class="q-body"><div>
        <div class="q-detail">
          ${ui.answerHtml(q)}
          ${ui.noteBlock(q.id)}
          <div class="q-actions">
            <span class="small t-3">当前状态:${ui.statusDot(st, true)}</span>
            <span style="flex:1"></span>
            <button class="btn sm fuzzy" data-again-one="${q.id}">${icon('target')} 还不熟</button>
            <button class="btn sm yes" data-know-one="${q.id}">${icon('check')} 已掌握,移出</button>
          </div>
        </div>
      </div></div>
    </div>`;
  }

  function onClick(e) {
    if (App.router.current !== 'wrong') return;
    const view = $('#view');
    if (e.target.closest('[data-drill]')) {
      App.views.cards.setScope('wrong');
      App.router.go('#/cards');
      ui.toast('已切换为错题强化模式', 'info', 1600);
      return;
    }
    if (e.target.closest('[data-clear]')) {
      App.ui.confirmDialog('清空错题本?', '会删除全部错题记录,但保留每题的学习进度。', {
        okLabel: '清空',
        danger: true,
        onOk: () => {
          App.store.clearWrong();
          render(view);
          ui.toast('已清空错题本', 'ok');
        },
      });
      return;
    }
    const knowBtn = e.target.closest('[data-know-one]');
    if (knowBtn) {
      const qid = knowBtn.dataset.knowOne;
      App.store.grade(qid, 'known'); // grade 内部会自动移出错题本
      ui.toast(`已掌握,下次复习:${dueText(App.store.progressMap[qid].due)}`, 'ok');
      const row = knowBtn.closest('.q-row');
      row.style.opacity = '0.4';
      setTimeout(() => render(view), 450);
      return;
    }
    const againBtn = e.target.closest('[data-again-one]');
    if (againBtn) {
      const qid = againBtn.dataset.againOne;
      App.store.grade(qid, 'again');
      ui.toast('已标记不熟,闪卡会优先抽到它', 'warn');
      return;
    }
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const row = toggle.closest('.q-row');
      const open = !row.classList.contains('open');
      row.classList.toggle('open', open);
      row.querySelector('.q-head').setAttribute('aria-expanded', String(open));
    }
  }

  return { render };
})();
