/* iOS 题宝库 · views/composer.js:自建题目(录入面试真题 / 写自己的话术) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.composer = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  let mode = 'list';      // 'list' | 'edit'
  let editingId = null;   // null = 新建
  let draft = null;

  const blank = () => ({ t: '', a: '', key: [], lv: 2, fq: 2, tags: [], opt: null, ans: 0, deep: '' });

  function render(el, params, query) {
    // 支持从题库直接跳来编辑:#/composer?edit=<id> / ?fork=<id>
    if (query && query.edit) { startEdit(query.edit); }
    else if (query && query.fork) { startFork(query.fork); }
    else if (query && query.new === '1') { mode = 'edit'; editingId = null; draft = blank(); }

    if (mode === 'edit') renderEditor(el);
    else renderList(el);

    if (!el._bound_composer) {
      el._bound_composer = true;
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
    }
  }

  function startEdit(id) {
    const rec = App.store.getCustom(id);
    if (!rec) { ui.toast('这道题已不存在', 'warn'); mode = 'list'; return; }
    mode = 'edit';
    editingId = id;
    draft = {
      t: rec.t, a: rec.a || '', key: rec.key || [], lv: rec.lv || 2, fq: rec.fq || 2,
      tags: rec.tags || [], opt: rec.opt, ans: rec.ans ?? 0, deep: rec.deep || '',
    };
  }

  /** 从内置题 fork 一份:保留原题干,答案换成你自己的话术 */
  function startFork(id) {
    const q = QB.get(id);
    if (!q) { ui.toast('原题已不存在', 'warn'); mode = 'list'; return; }
    mode = 'edit';
    editingId = null;
    draft = {
      t: q.t, a: '', key: [], lv: q.lv, fq: q.fq,
      tags: (q.tags || []).concat(['我的版本']), opt: null, ans: 0, deep: '',
    };
  }

  /* ---------- 列表 ---------- */
  function renderList(el) {
    const list = App.store.customList;
    el.innerHTML = `
      <div class="between wrap gap-3">
        <div>
          <h2 class="h-1">我的题目</h2>
          <p class="small t-3">把面试中真实被问到的问题录进来。它们与内置题库同等参与闪卡、测验、错题本与统计。</p>
        </div>
        <button class="btn primary" data-new>${icon('plus')} 新建题目</button>
      </div>
      <div class="mt-4" id="customList">
        ${list.length ? list.map(rowHtml).join('') : ''}
      </div>`;

    if (!list.length) {
      $('#customList', el).innerHTML = ui.empty(
        'cCustom', '还没有自己的题目',
        '面试后趁热把被问到的原题录进来,是最高效的查漏补缺方式。也可以在题库里把某道题「改写成我的版本」。',
        `<button class="btn primary mt-3" data-new>${icon('plus')} 新建第一道题</button>`
      );
    }
  }

  function rowHtml(rec) {
    const q = QB.get(rec.id);
    const st = q ? App.store.statusOf(rec.id) : 'new';
    return `
    <div class="card q-row" data-qid="${rec.id}">
      <button class="q-head" data-toggle>
        ${ui.statusDot(st)}
        <span class="qt">${esc(rec.t)}</span>
        ${rec.opt ? '<span class="badge info">选择题</span>' : ''}
        ${ui.lvBadge(rec.lv || 2)}${ui.fqBadge(rec.fq || 2)}
        <span class="chev">${icon('chevR')}</span>
      </button>
      <div class="q-body"><div>
        <div class="q-detail">
          ${q ? ui.answerHtml(q) : '<p class="t-3">(内容未能载入)</p>'}
          <div class="q-actions">
            <span class="small t-3">${rec.updatedAt ? '更新于 ' + relTime(rec.updatedAt) : ''}</span>
            <span style="flex:1"></span>
            <button class="btn sm" data-edit="${rec.id}">${icon('pencil')} 编辑</button>
            <button class="btn sm danger" data-del="${rec.id}">${icon('trash')} 删除</button>
          </div>
        </div>
      </div></div>
    </div>`;
  }

  /* ---------- 编辑器 ---------- */
  function renderEditor(el) {
    const d = draft;
    const hasOpt = Array.isArray(d.opt) && d.opt.length > 0;
    el.innerHTML = `
      <div class="col gap-4" style="max-width:920px;margin:0 auto">
        <div class="between wrap gap-3">
          <h2 class="h-1">${editingId ? '编辑题目' : '新建题目'}</h2>
          <div class="row">
            <button class="btn ghost" data-cancel>取消</button>
            <button class="btn primary" data-save>${icon('check')} 保存</button>
          </div>
        </div>
        ${editingId ? '<p class="small t-3">修改题干不会影响这道题已有的学习进度、笔记与收藏。</p>' : ''}

        <div class="card pad col gap-4">
          <div class="field">
            <label class="field-label" for="cTitle">题干 <span class="req">*</span></label>
            <input class="input" id="cTitle" data-f="t" value="${esc(d.t)}" placeholder="例:说说你项目里最难排查的一个崩溃?">
          </div>

          <div class="field">
            <label class="field-label">答案 <span class="req">*</span>
              <span class="field-hint">支持 Markdown:**加粗**、\`代码\`、\`\`\`代码块\`\`\`、- 列表、| 表格 |</span>
            </label>
            <div class="md-editor">
              <textarea class="textarea tall mono" data-f="a" placeholder="按面试作答的口径写:先结论,再原理,最后落到实战…">${esc(d.a)}</textarea>
              <div class="md md-preview" id="mdPreview">${MD.render(d.a)}</div>
            </div>
          </div>

          <div class="field">
            <label class="field-label">速记要点 <span class="field-hint">一行一条,闪卡背面会高亮显示</span></label>
            <textarea class="textarea" data-f="key" rows="3" placeholder="一行一条">${esc((d.key || []).join('\n'))}</textarea>
          </div>

          <div class="row wrap gap-4">
            <div class="field grow">
              <span class="field-label">难度</span>
              <div class="seg" id="lvSeg">
                ${[1, 2, 3].map((v) => `<button data-set-lv="${v}" class="${d.lv === v ? 'on' : ''}">${QB.LV[v]}</button>`).join('')}
              </div>
            </div>
            <div class="field grow">
              <span class="field-label">考频</span>
              <div class="seg" id="fqSeg">
                ${[3, 2, 1].map((v) => `<button data-set-fq="${v}" class="${d.fq === v ? 'on' : ''}">${QB.FQ[v]}</button>`).join('')}
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label">标签 <span class="field-hint">逗号分隔,便于搜索</span></label>
            <input class="input" data-f="tags" value="${esc((d.tags || []).join(', '))}" placeholder="例:崩溃, 排查, Instruments">
          </div>
        </div>

        <div class="card pad col gap-3">
          <div class="between">
            <span class="field-label" style="font-size:14px">选择题选项 <span class="field-hint">填了才会在测验里按选择题判分</span></span>
            <button class="btn sm ${hasOpt ? 'danger' : ''}" data-toggle-opt>${hasOpt ? '移除选项' : icon('plus') + ' 添加选项'}</button>
          </div>
          ${hasOpt ? `
          <div class="opt-editor">
            ${[0, 1, 2, 3].map((i) => `
              <div class="opt-editor-row">
                <button class="opt-pick ${d.ans === i ? 'on' : ''}" data-set-ans="${i}" title="设为正确答案">${'ABCD'[i]}</button>
                <input class="input" data-opt-i="${i}" value="${esc(d.opt[i] || '')}" placeholder="选项 ${'ABCD'[i]}">
              </div>`).join('')}
            <p class="field-hint">点左侧字母设为正确答案;至少填 2 个选项。</p>
          </div>` : ''}
        </div>

        <div class="card pad col gap-3">
          <label class="field-label" style="font-size:14px">面试官追问 <span class="field-hint">选填;模拟面试会用它自动追问</span></label>
          <textarea class="textarea mono" data-f="deep" rows="3" placeholder="例:追问,那如果这个崩溃只在 iOS 17 上复现呢?">${esc(d.deep || '')}</textarea>
        </div>

        <div class="row" style="justify-content:flex-end">
          <button class="btn ghost" data-cancel>取消</button>
          <button class="btn primary lg" data-save>${icon('check')} 保存题目</button>
        </div>
      </div>`;
  }

  /* ---------- 交互 ---------- */
  function onInput(e) {
    if (App.router.current !== 'composer' || mode !== 'edit') return;
    const f = e.target.closest('[data-f]');
    if (f) {
      const k = f.dataset.f;
      if (k === 'key') draft.key = f.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (k === 'tags') draft.tags = f.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      else draft[k] = f.value;
      if (k === 'a') {
        const prev = $('#mdPreview');
        if (prev) prev.innerHTML = MD.render(f.value);
      }
      return;
    }
    const opt = e.target.closest('[data-opt-i]');
    if (opt) {
      const i = Number(opt.dataset.optI);
      if (!Array.isArray(draft.opt)) draft.opt = ['', '', '', ''];
      draft.opt[i] = opt.value;
    }
  }

  function onClick(e) {
    if (App.router.current !== 'composer') return;
    const view = $('#view');

    if (e.target.closest('[data-new]')) {
      mode = 'edit'; editingId = null; draft = blank();
      renderEditor(view);
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) { startEdit(edit.dataset.edit); renderEditor(view); return; }

    const del = e.target.closest('[data-del]');
    if (del) {
      const id = del.dataset.del;
      const rec = App.store.getCustom(id);
      ui.confirmDialog('删除这道题?',
        `「${esc((rec && rec.t || '').slice(0, 28))}…」<br>这道题的学习进度、笔记、收藏与错题记录会一并删除,不可撤销。`,
        { okLabel: '删除', danger: true, onOk: () => {
          App.store.removeCustom(id);
          if (App.shell && App.shell.invalidateSessions) App.shell.invalidateSessions();
          ui.toast('已删除', 'ok');
          mode = 'list';
          renderList(view);
        } });
      return;
    }

    if (e.target.closest('[data-cancel]')) { mode = 'list'; editingId = null; renderList(view); return; }

    const lv = e.target.closest('[data-set-lv]');
    if (lv) {
      draft.lv = Number(lv.dataset.setLv);
      $$('#lvSeg button').forEach((b) => b.classList.toggle('on', b === lv));
      return;
    }
    const fq = e.target.closest('[data-set-fq]');
    if (fq) {
      draft.fq = Number(fq.dataset.setFq);
      $$('#fqSeg button').forEach((b) => b.classList.toggle('on', b === fq));
      return;
    }
    const ans = e.target.closest('[data-set-ans]');
    if (ans) {
      draft.ans = Number(ans.dataset.setAns);
      $$('[data-set-ans]').forEach((b) => b.classList.toggle('on', b === ans));
      return;
    }
    if (e.target.closest('[data-toggle-opt]')) {
      draft.opt = Array.isArray(draft.opt) && draft.opt.length ? null : ['', '', '', ''];
      renderEditor(view);
      return;
    }
    if (e.target.closest('[data-save]')) { save(view); return; }

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const row = toggle.closest('.q-row');
      const open = !row.classList.contains('open');
      row.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
  }

  function save(view) {
    const d = draft;
    if (!String(d.t || '').trim()) { ui.toast('题干不能为空', 'warn'); return; }
    if (!String(d.a || '').trim()) { ui.toast('答案不能为空', 'warn'); return; }

    const payload = {
      t: d.t.trim(), a: d.a.trim(), key: d.key || [], lv: d.lv, fq: d.fq, tags: d.tags || [],
      deep: String(d.deep || '').trim() || null,
    };
    // 选项:至少 2 个非空才算有效选择题
    const filled = Array.isArray(d.opt) ? d.opt.map((s) => String(s || '').trim()) : [];
    if (filled.filter(Boolean).length >= 2) {
      payload.opt = filled;
      payload.ans = clamp(d.ans || 0, 0, filled.length - 1);
      if (!filled[payload.ans]) { ui.toast('正确答案对应的选项是空的', 'warn'); return; }
    } else if (filled.some(Boolean)) {
      ui.toast('选择题至少要填 2 个选项', 'warn');
      return;
    } else {
      payload.opt = null;
      payload.ans = null;
    }

    const res = editingId ? App.store.updateCustom(editingId, payload) : App.store.addCustom(payload);
    if (!res.ok) { ui.toast(res.err || '保存失败', 'warn', 4000); return; }
    ui.toast(editingId ? '已更新' : '已添加到「我的题目」', 'ok');
    mode = 'list';
    editingId = null;
    renderList(view);
  }

  return { render };
})();
