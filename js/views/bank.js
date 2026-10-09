/* iOS 题宝库 · views/bank.js:题库浏览(分类 + 筛选 + 搜索 + 展开学习) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.bank = (() => {
  const { icon } = ICON;
  const ui = App.ui;
  const PAGE = 40;
  const LV_DEFS = [[0, '全部'], [1, '基础'], [2, '进阶'], [3, '高级']];
  const FQ_DEFS = [[0, '全部'], [3, '必考'], [2, '高频'], [1, '了解']];
  const ST_DEFS = [
    ['all', '全部'], ['new', '未学'], ['learning', '学习中'], ['due', '待复习'],
    ['mastered', '已掌握'], ['weak', '薄弱/错题'], ['fav', '已收藏'],
  ];

  let state = freshState();
  let listEl = null;

  function freshState() {
    return { cat: 'all', lv: 0, fq: 0, st: 'all', q: '', shown: PAGE, openId: null };
  }

  function render(el, params, query) {
    state = freshState();
    if (query.cat) state.cat = query.cat;
    if (query.lv) state.lv = Number(query.lv);
    if (query.fq) state.fq = Number(query.fq);
    if (query.q) state.q = query.q;
    if (query.st) state.st = query.st;
    if (query.open) state.openId = query.open;

    el.innerHTML = `
      <div class="bank-layout">
        <div class="bank-rail" id="bankRail"></div>
        <div class="col gap-3" style="min-width:0">
          <div class="filter-bar">
            <div class="search" style="max-width:none">
              ${icon('search')}<input id="bankSearch" type="search" placeholder="在当前题库中搜索题目 / 标签 / 答案关键词" value="${esc(state.q)}">
            </div>
            <div class="filter-row">
              <span class="fl">难度</span>${chips('lv', LV_DEFS)}
            </div>
            <div class="filter-row">
              <span class="fl">频率</span>${chips('fq', FQ_DEFS)}
            </div>
            <div class="filter-row">
              <span class="fl">状态</span>${chips('st', ST_DEFS)}
            </div>
          </div>
          <div id="bankList"></div>
        </div>
      </div>`;

    listEl = $('#bankList', el);
    renderRail();
    renderList();

    const input = $('#bankSearch', el);
    input.addEventListener('input', debounce(() => {
      state.q = input.value;
      state.shown = PAGE;
      renderList();
    }, 180));

    if (!el._bound_bank) {
      el._bound_bank = true;
      el.addEventListener('click', onClick);
    }
  }

  function chips(kind, defs) {
    return defs
      .map(([v, label]) => `<button class="chip${state[kind] === v ? ' on' : ''}" data-chip="${kind}" data-v="${v}">${label}</button>`)
      .join('');
  }

  /* 重绘筛选区,保证按钮高亮与 state 永远一致(单一数据源) */
  function renderFilters() {
    const rows = $$('.filter-row', $('#view'));
    if (rows.length < 3) return;
    rows[0].innerHTML = `<span class="fl">难度</span>${chips('lv', LV_DEFS)}`;
    rows[1].innerHTML = `<span class="fl">频率</span>${chips('fq', FQ_DEFS)}`;
    rows[2].innerHTML = `<span class="fl">状态</span>${chips('st', ST_DEFS)}`;
  }

  /** 当前生效的筛选条件描述(用于空状态说明) */
  function activeFilterText() {
    const parts = [];
    if (state.cat !== 'all') parts.push(`分类「${QB.cat(state.cat)?.name || state.cat}」`);
    if (state.lv) parts.push(`难度「${QB.LV[state.lv]}」`);
    if (state.fq) parts.push(`频率「${QB.FQ[state.fq]}」`);
    const stName = (ST_DEFS.find((d) => d[0] === state.st) || [])[1];
    if (state.st !== 'all') parts.push(`状态「${stName}」`);
    if (state.q.trim()) parts.push(`关键词「${state.q.trim()}」`);
    return parts;
  }

  function renderRail() {
    const rail = $('#bankRail');
    const mk = (key, name, iconName, count, tint) => `
      <button class="rail-item ${state.cat === key ? 'active' : ''}" data-rail="${key}">
        ${key === 'all' ? `<span class="cat-icon" style="--cat:var(--accent)">${icon('layers')}</span>` : ui.catIcon(key)}
        <span class="truncate">${name}</span><span class="n">${count}</span>
      </button>`;
    const items = [
      mk('all', '全部题目', 'layers', QB.questions.length),
      ...QB.cats.map((c) => mk(c.key, c.name, c.icon, QB.ofCat(c.key).length)),
    ];
    rail.innerHTML = items.join('');
  }

  function filtered() {
    let list = state.q.trim() ? QB.search(state.q) : QB.questions.slice();
    if (state.cat !== 'all') list = list.filter((q) => q.cat === state.cat);
    if (state.lv) list = list.filter((q) => q.lv === state.lv);
    if (state.fq) list = list.filter((q) => q.fq === state.fq);
    const store = App.store;
    switch (state.st) {
      case 'new': list = list.filter((q) => store.statusOf(q.id) === 'new'); break;
      case 'learning': list = list.filter((q) => store.statusOf(q.id) === 'learning'); break;
      case 'mastered': list = list.filter((q) => store.statusOf(q.id) === 'mastered'); break;
      case 'due': list = list.filter((q) => store.isDue(q.id)); break;
      case 'weak': list = list.filter((q) => store.statusOf(q.id) === 'wrong' || store.inWrong(q.id)); break;
      case 'fav': list = list.filter((q) => store.isFav(q.id)); break;
    }
    return list;
  }

  function renderList() {
    const all = filtered();
    const shown = all.slice(0, state.shown);
    const store = App.store;

    // 「我的题目」空分类:给出建题入口而不是通用空态
    if (!all.length && state.cat === QB.CUSTOM_KEY && !store.customList.length) {
      listEl.innerHTML = ui.empty(
        'cCustom', '还没有自己的题目',
        '把面试中真实被问到的问题录进来,它们会和内置题库一样参与闪卡、测验、错题本与统计。',
        `<a class="btn primary mt-3" href="#/composer?new=1">${icon('plus')} 新建第一道题</a>`
      );
      return;
    }

    if (!all.length) {
      const conds = activeFilterText();
      listEl.innerHTML = ui.empty(
        'search',
        '当前筛选没有匹配的题目',
        conds.length
          ? `正在同时生效:${conds.join(' + ')}。题库里共有 ${QB.questions.length} 道题,放宽条件就能看到。`
          : '换个关键词试试',
        `<button class="btn primary mt-3" data-clear-filter>${icon('refresh')} 清空筛选,看全部题目</button>`
      );
      return;
    }

    const rows = shown.map((q) => rowHtml(q, store)).join('');
    const more = all.length > state.shown
      ? `<button class="btn load-more" data-more>加载更多(还有 ${all.length - state.shown} 题)</button>`
      : '';

    listEl.innerHTML = `
      ${ui.filterSummary(activeFilterText(), all.length)}
      <div class="result-meta">共 ${all.length} 题${state.q ? ` · “${esc(state.q)}”的搜索结果` : ''}</div>
      <div id="rows">${rows}</div>${more}`;

    if (state.openId) {
      const target = $(`[data-qid="${CSS.escape(state.openId)}"]`, listEl);
      state.openId = null;
      if (target) {
        toggleRow(target, true);
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    }
  }

  function rowHtml(q, store) {
    const st = store.statusOf(q.id);
    const fav = store.isFav(q.id);
    const wrong = store.inWrong(q.id);
    const note = store.getNote(q.id);
    return `
    <div class="card q-row" data-qid="${q.id}">
      <button class="q-head" data-toggle="${q.id}" aria-expanded="false">
        ${ui.statusDot(st)}
        <span class="qt">${esc(q.t)}</span>
        ${note ? `<span class="note-dot" title="有笔记">${icon('note')}</span>` : ''}
        ${wrong ? `<span class="badge fq3" title="在错题本中">${icon('wrong')} 错题</span>` : ''}
        ${fav ? `<span style="color:var(--warn);flex:none">${icon('starFill')}</span>` : ''}
        <span class="row gap-1 wrap" style="flex:none;justify-content:flex-end">
          ${ui.lvBadge(q.lv)}${ui.fqBadge(q.fq)}
          <span class="cat-icon" style="--cat:${QB.cat(q.cat).tint};width:24px;height:24px;border-radius:6px" title="${esc(QB.cat(q.cat).name)}">${icon(QB.cat(q.cat).icon)}</span>
        </span>
        <span class="chev">${icon('chevR')}</span>
      </button>
      <div class="q-body"><div>
        <div class="q-detail">
          ${ui.answerHtml(q)}
          ${q.tags.length ? `<div class="tags-line">${q.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${ui.noteBlock(q.id)}
          <div class="q-actions">
            <span class="small t-3">学过了,自评:</span>
            <button class="btn sm grade-mini no" data-grade="again" data-q="${q.id}">${icon('x')} 不熟</button>
            <button class="btn sm grade-mini fuzzy" data-grade="fuzzy" data-q="${q.id}">${icon('target')} 模糊</button>
            <button class="btn sm grade-mini yes" data-grade="known" data-q="${q.id}">${icon('check')} 掌握</button>
            <span style="flex:1"></span>
            ${q.custom
              ? `<a class="btn sm" href="#/composer?edit=${q.id}">${icon('pencil')} 编辑</a>`
              : `<a class="btn sm ghost" href="#/composer?fork=${q.id}" title="用自己的话改写这道题的答案">${icon('pencil')} 改写成我的版本</a>`}
            <button class="icon-btn ${fav ? 'on' : ''}" data-fav="${q.id}" aria-label="收藏" title="收藏">${icon(fav ? 'starFill' : 'star')}</button>
          </div>
        </div>
      </div></div>
    </div>`;
  }

  function toggleRow(row, forceOpen) {
    const open = forceOpen === true ? true : !row.classList.contains('open');
    row.classList.toggle('open', open);
    $('.q-head', row).setAttribute('aria-expanded', String(open));
  }

  function onClick(e) {
    if (App.router.current !== 'bank') return;
    const rail = e.target.closest('[data-rail]');
    if (rail) {
      state.cat = rail.dataset.rail;
      state.shown = PAGE;
      renderRail();
      renderList();
      return;
    }
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const kind = chip.dataset.chip;
      const v = kind === 'lv' || kind === 'fq' ? Number(chip.dataset.v) : chip.dataset.v;
      // 再次点击已选中的条件 = 取消该条件,避免"选了就取消不掉"
      const isSame = state[kind] === v;
      state[kind] = isSame ? (kind === 'st' ? 'all' : 0) : v;
      state.shown = PAGE;
      renderFilters();
      renderList();
      return;
    }
    if (e.target.closest('[data-clear-filter]')) {
      // 一键回到"全部题目"的干净状态(含分类与搜索词)
      state = freshState();
      const input = $('#bankSearch');
      if (input) input.value = '';
      renderFilters();
      renderRail();
      renderList();
      ui.toast('已清空全部筛选', 'ok', 1400);
      return;
    }
    if (e.target.closest('[data-more]')) {
      state.shown += PAGE;
      renderList();
      return;
    }
    const gradeBtn = e.target.closest('[data-grade]');
    if (gradeBtn) {
      const qid = gradeBtn.dataset.q;
      const g = gradeBtn.dataset.grade;
      const p = App.store.grade(qid, g);
      const q = QB.get(qid);
      const msgs = {
        again: '已标记不熟,稍后会再次出现',
        fuzzy: `已标记模糊,下次复习:${dueText(p.due)}`,
        known: `已掌握,下次复习:${dueText(p.due)}`,
      };
      ui.toast(msgs[g], g === 'known' ? 'ok' : g === 'fuzzy' ? 'warn' : 'info');
      // 只更新状态点,不打断阅读流
      const row = gradeBtn.closest('.q-row');
      const dot = $('.dot', row);
      const st = App.store.statusOf(qid);
      dot.className = `dot ${({ new: 'new', learning: 'learning', mastered: 'mastered', wrong: 'wrong' })[st]}`;
      return;
    }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      const on = App.store.toggleFav(favBtn.dataset.fav);
      favBtn.classList.toggle('on', on);
      favBtn.innerHTML = icon(on ? 'starFill' : 'star');
      ui.toast(on ? '已收藏' : '已取消收藏', on ? 'ok' : 'info', 1200);
      return;
    }
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      toggleRow(toggle.closest('.q-row'));
    }
  }

  function el_root() { return $('#view'); }

  return { render };
})();
