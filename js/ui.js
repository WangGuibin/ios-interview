/* iOS 题宝库 · ui.js:共享 UI 片段(toast / modal / 徽章 / 环 / 题解卡) */
'use strict';

window.App = window.App || {};

App.ui = (() => {
  const { icon } = ICON;

  /* ---------- 文本片段 ---------- */
  const catIcon = (catKey, cls = '') => {
    const c = QB.cat(catKey);
    if (!c) return '';
    return `<span class="cat-icon ${cls}" style="--cat:${c.tint}">${icon(c.icon)}</span>`;
  };

  const lvBadge = (lv) => `<span class="badge lv${lv}">${QB.LV[lv]}</span>`;
  const fqBadge = (fq) => `<span class="badge fq${fq}">${QB.FQ[fq]}</span>`;
  const catBadge = (catKey) => {
    const c = QB.cat(catKey);
    // 防御:会话里可能残留刚被删除的自建题,不能让整个视图崩掉
    if (!c) return '<span class="badge">已删除</span>';
    return `<span class="badge cat" style="--cat:${c.tint}">${esc(c.name)}</span>`;
  };

  const STATUS_META = {
    new: { dot: 'new', text: '未学习' },
    learning: { dot: 'learning', text: '学习中' },
    mastered: { dot: 'mastered', text: '已掌握' },
    wrong: { dot: 'wrong', text: '薄弱' },
  };
  const statusDot = (status, showText = false) => {
    const m = STATUS_META[status] || STATUS_META.new;
    return `<span class="dot ${m.dot}" title="${m.text}"></span>${showText ? `<span class="status-text">${m.text}</span>` : ''}`;
  };

  /* ---------- 进度环 ---------- */
  function ring(pct, size = 64, stroke = 7, color) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - clamp(pct, 0, 1));
    const label = `${Math.round(pct * 100)}<tspan style="font-size:.62em">%</tspan>`;
    return `<span class="ring" style="--ring-c:${color || 'var(--accent)'};width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <span class="ring-num">${label}</span>
    </span>`;
  }

  function bar(pct, color) {
    return `<span class="bar"><i style="width:${clamp(pct * 100, 0, 100)}%;--bar-c:${color || 'var(--accent)'}"></i></span>`;
  }

  /** 三段堆叠条:未学灰 / 学习琥珀 / 掌握绿 */
  function stackedBar(pNew, pLearning, pMastered) {
    const t = pNew + pLearning + pMastered || 1;
    const w = (v) => ((v / t) * 100).toFixed(1) + '%';
    return `<span class="bar stacked">
      <i style="width:${w(pMastered)};--bar-c:var(--ok)"></i>
      <i style="width:${w(pLearning)};--bar-c:var(--warn)"></i>
      <i style="width:${w(pNew)};--bar-c:var(--surface-3)"></i>
    </span>`;
  }

  /* ---------- 空状态 ---------- */
  const empty = (iconName, title, desc, actionHtml = '') => `
    <div class="empty">
      ${icon(iconName)}
      <div class="empty-title">${esc(title)}</div>
      ${desc ? `<p>${esc(desc)}</p>` : ''}
      ${actionHtml}
    </div>`;

  /** 顶部筛选摘要条:让"为什么只有这些题"一眼可见 */
  const filterSummary = (parts, total) => {
    if (!parts.length) return '';
    return `<div class="filter-summary">
      <span class="fs-label">${icon('search')} 已筛选</span>
      ${parts.map((p) => `<span class="fs-tag">${esc(p)}</span>`).join('')}
      <span class="grow"></span>
      <span class="small t-3 num">${total} 题</span>
      <button class="btn sm ghost" data-clear-filter>清空</button>
    </div>`;
  };

  /* ---------- Toast ---------- */
  let toastBox = null;
  function toast(msg, type = 'info', ms = 2200) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toasts';
      document.body.appendChild(toastBox);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(type === 'ok' ? 'check' : type === 'warn' ? 'info' : 'info')}<span>${esc(msg)}</span>`;
    toastBox.appendChild(el);
    setTimeout(() => {
      el.classList.add('bye');
      setTimeout(() => el.remove(), 240);
    }, ms);
  }

  /* ---------- Modal ---------- */
  function modal({ title, body, actions = [] }) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `
      <h3>${esc(title)}</h3>
      <div class="modal-body">${body}</div>
      <div class="modal-actions"></div>`;
    const actionsEl = $('.modal-actions', box);
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.kind || ''}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        if (a.onClick) a.onClick(close);
        else close();
      });
      actionsEl.appendChild(btn);
    });
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const first = $('.modal-actions .btn', box);
    if (first) first.focus();
    return { close, overlay };
  }

  function confirmDialog(title, body, { okLabel = '确认', danger = false, onOk } = {}) {
    return modal({
      title,
      body: `<p>${body}</p>`,
      actions: [
        { label: '取消', kind: 'ghost' },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: (close) => { onOk && onOk(); close(); } },
      ],
    });
  }

  /* ---------- 题解主体(答案 + 要点 + 深挖) ---------- */
  function answerHtml(q) {
    const kp = q.key && q.key.length
      ? `<ul class="keypoints"><li class="kp-title">${icon('zap')} 速记要点</li>${q.key.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>`
      : '';
    const deepId = `deep-${q.id}`;
    const deep = q.deep
      ? `<div>
          <button class="deep-toggle press" data-deep-toggle="${deepId}" aria-expanded="false">${icon('grad')} 面试官追问 / 深挖 ${icon('chevD')}</button>
          <div class="deep-body" id="${deepId}"><div><div class="deep-card md">${MD.render(q.deep)}</div></div></div>
        </div>`
      : '';
    return `<div class="md">${MD.render(q.a)}</div>${kp}${deep}`;
  }

  /* 深挖折叠的全局事件代理(一次注册) */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-deep-toggle]');
    if (!t) return;
    const body = document.getElementById(t.dataset.deepToggle);
    if (!body) return;
    const open = body.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });

  /* ---------- 笔记块(题库 / 闪卡 / 错题本共用) ---------- */
  function noteBlock(qid) {
    const rec = App.store.getNote(qid);
    return `<div class="note-block" data-note-for="${qid}">
      <div class="nb-head">${icon('note')} 我的笔记</div>
      <textarea data-note-input="${qid}" rows="2"
        placeholder="写下你自己的话术、被问崩的经历、或对这题的独家理解…">${esc(rec ? rec.text : '')}</textarea>
      <div class="nb-foot">
        <span data-note-status="${qid}">${rec ? '已保存 · ' + relTime(rec.ts) : '自动保存,只存在你本机'}</span>
        ${rec ? `<button class="btn sm ghost" data-note-clear="${qid}">清除</button>` : ''}
      </div>
    </div>`;
  }

  /* 笔记的全局事件代理:一次注册,所有视图通用(与 deep-toggle 同模式) */
  const saveNote = debounce((qid, text, statusEl) => {
    const ok = App.store.setNote(qid, text);
    if (statusEl) statusEl.textContent = ok ? (text.trim() ? '已保存 · 刚刚' : '自动保存,只存在你本机') : '⚠️ 存储空间不足,未能保存';
    if (!ok) toast('存储空间不足,笔记未能保存', 'warn', 4000);
  }, 600);

  document.addEventListener('input', (e) => {
    const ta = e.target.closest('[data-note-input]');
    if (!ta) return;
    const qid = ta.dataset.noteInput;
    const status = document.querySelector(`[data-note-status="${CSS.escape(qid)}"]`);
    if (status) status.textContent = '输入中…';
    saveNote(qid, ta.value, status);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-note-clear]');
    if (!btn) return;
    const qid = btn.dataset.noteClear;
    App.store.setNote(qid, '');
    const ta = document.querySelector(`[data-note-input="${CSS.escape(qid)}"]`);
    if (ta) ta.value = '';
    const status = document.querySelector(`[data-note-status="${CSS.escape(qid)}"]`);
    if (status) status.textContent = '自动保存,只存在你本机';
    btn.remove();
    toast('笔记已清除', 'info', 1400);
  });

  /* ---------- 新版本提示条 ---------- */
  function updateBanner(onUpdate) {
    if ($('.update-banner')) return;
    const el = document.createElement('div');
    el.className = 'update-banner';
    el.innerHTML = `<span>${icon('refresh')} 有新版本可用</span>
      <button class="btn press" data-do-update>立即更新</button>
      <button class="icon-btn ub-close" data-dismiss-update aria-label="稍后">${icon('x')}</button>`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-do-update]')) { onUpdate(); el.remove(); }
      else if (e.target.closest('[data-dismiss-update]')) el.remove();
    });
    document.body.appendChild(el);
  }

  return { catIcon, lvBadge, fqBadge, catBadge, statusDot, ring, bar, stackedBar, empty, filterSummary, toast, modal, confirmDialog, answerHtml, noteBlock, updateBanner };
})();
