/* iOS 题宝库 · views/settings.js:设置与数据管理 */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.settings = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  function render(el) {
    const s = App.store.settings;
    const t = App.store.totals();
    const plan = App.store.plan || {};
    const swSupported = location.protocol !== 'file:' && 'serviceWorker' in navigator;

    el.innerHTML = `
      <div class="col gap-4" style="max-width:680px;margin:0 auto">
        <div class="card pad">
          <h3 class="h-2">外观</h3>
          <div class="set-row">
            <div><div class="sr-title">主题</div><div class="sr-desc">跟随系统,或固定浅色 / 深色</div></div>
            <span class="seg" id="themeSeg">
              ${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]
                .map(([v, l]) => `<button data-theme="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}
            </span>
          </div>
        </div>

        <div class="card pad">
          <h3 class="h-2">学习</h3>
          <div class="set-row">
            <div><div class="sr-title">每日目标</div><div class="sr-desc">首页"今日进度"的目标题量</div></div>
            <span class="seg" id="goalSeg">
              ${[10, 20, 30, 50].map((n) => `<button data-goal="${n}" class="${s.goal === n ? 'on' : ''}">${n} 题</button>`).join('')}
            </span>
          </div>
          <div class="set-row">
            <div><div class="sr-title">闪卡默认组大小</div><div class="sr-desc">每组闪卡默认抽多少题</div></div>
            <span class="seg" id="cardSeg">
              ${[[10, '10'], [20, '20'], [50, '50'], [0, '全部']].map(([v, l]) => `<button data-cards="${v}" class="${s.cardCount === v ? 'on' : ''}">${l}</button>`).join('')}
            </span>
          </div>
        </div>

        <div class="card pad">
          <h3 class="h-2">备考计划</h3>
          <p class="small t-3" style="margin-top:2px">填上面试日期,首页会显示倒计时与每日需要攻克的题量。</p>
          <div class="set-row">
            <div class="grow"><div class="sr-title">面试日期</div><div class="sr-desc">留空表示暂不设置</div></div>
            <input class="input" type="date" data-plan-date style="max-width:170px" value="${esc(plan.interviewDate || '')}">
          </div>
          <div class="set-row">
            <div class="grow"><div class="sr-title">目标公司 / 岗位</div><div class="sr-desc">只用于首页展示</div></div>
            <input class="input" data-plan-company placeholder="例:大疆" style="max-width:120px" value="${esc(plan.company || '')}">
            <input class="input" data-plan-role placeholder="例:iOS 高级" style="max-width:130px" value="${esc(plan.role || '')}">
          </div>
          ${plan.interviewDate ? `
          <div class="set-row">
            <div><div class="sr-title">清除计划</div><div class="sr-desc">移除倒计时,不影响学习进度</div></div>
            <button class="btn sm ghost" data-clear-plan>清除</button>
          </div>` : ''}
        </div>

        <div class="card pad">
          <h3 class="h-2">数据</h3>
          <div class="set-row">
            <div><div class="sr-title">导出学习数据</div><div class="sr-desc">进度、收藏、错题、笔记、自建题、计划打包为 JSON</div></div>
            <button class="btn sm" data-export>${icon('download')} 导出</button>
          </div>
          <div class="set-row">
            <div><div class="sr-title">导入学习数据</div><div class="sr-desc">学习记录会被替换;<b>笔记与自建题按条目合并,不会覆盖本机内容</b></div></div>
            <label class="btn sm" style="cursor:pointer">${icon('upload')} 导入<input type="file" accept="application/json,.json" data-import hidden></label>
          </div>
          <div class="set-row">
            <div><div class="sr-title">重置学习记录</div><div class="sr-desc">清空进度、错题与统计;<b>笔记、自建题、备考计划会保留</b></div></div>
            <button class="btn sm danger" data-reset>${icon('refresh')} 重置</button>
          </div>
          <div class="set-row">
            <div><div class="sr-title">删除我的内容</div><div class="sr-desc">永久删除自建题目、笔记与备考计划;学习进度保留</div></div>
            <button class="btn sm danger" data-clear-content>${icon('trash')} 删除</button>
          </div>
        </div>

        <div class="card pad">
          <h3 class="h-2">离线</h3>
          <div class="set-row">
            <div>
              <div class="sr-title">离线可用 <span class="badge ${swSupported ? 'ok' : ''}" id="swState">${swSupported ? '检测中…' : '当前环境不支持'}</span></div>
              <div class="sr-desc">${swSupported
                ? '已缓存全部题库与界面,断网也能刷题。手机上用 Safari 打开后「分享 → 添加到主屏幕」即可当 App 用。'
                : 'Service Worker 需要 https 或 localhost。双击打开文件时不支持离线安装,但功能完全可用。'}</div>
            </div>
          </div>
          <div class="set-row">
            <div><div class="sr-title">清除离线缓存</div><div class="sr-desc">页面加载异常或版本卡住时使用;会注销离线支持并重新加载</div></div>
            <button class="btn sm" data-clear-sw ${swSupported ? '' : 'disabled'}>${icon('cloudOff')} 清除并重载</button>
          </div>
        </div>

        <div class="card pad">
          <div class="between">
            <h3 class="h-2">快捷键</h3>
            <span class="small t-3">随时按 <kbd style="font-family:var(--font);font-size:11px;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:1px 6px">?</kbd> 呼出</span>
          </div>
          <table class="shortcut-table mt-2">
            <tr><td class="t-2">聚焦全局搜索</td><td style="text-align:right"><kbd>/</kbd></td></tr>
            <tr><td class="t-2">快捷键面板</td><td style="text-align:right"><kbd>?</kbd></td></tr>
            <tr><td class="t-2">跳转(g + 首字母)</td><td style="text-align:right"><kbd>g</kbd><kbd>d</kbd> 首页 · <kbd>g</kbd><kbd>b</kbd> 题库 · <kbd>g</kbd><kbd>m</kbd> 模拟面</td></tr>
            <tr><td class="t-2">题库:上下移动 / 展开</td><td style="text-align:right"><kbd>j</kbd> <kbd>k</kbd> <kbd>Enter</kbd></td></tr>
            <tr><td class="t-2">闪卡翻面</td><td style="text-align:right"><kbd>空格</kbd></td></tr>
            <tr><td class="t-2">闪卡评分:不会 / 模糊 / 掌握</td><td style="text-align:right"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td></tr>
            <tr><td class="t-2">测验选择选项 / 下一题</td><td style="text-align:right"><kbd>1</kbd>–<kbd>4</kbd> <kbd>Enter</kbd></td></tr>
          </table>
        </div>

        <div class="card pad">
          <h3 class="h-2">关于题宝库</h3>
          <div class="md small mt-2">
            <p>收录 <b>${t.total}</b> 道 iOS 面试题${App.store.customList.length ? `(含你自建的 ${App.store.customList.length} 道)` : ''},覆盖 ${QB.cats.length} 个分类,从 Swift 语言一直到备考话术。</p>
            <p>内容整理自公开社区题库与一线面试实录,答案按"面试可直接复述"的口径撰写。学习数据全部保存在浏览器本地,不联网、不上传。</p>
            <p class="t-3">版本 v2.0.4 · 间隔重复:记忆盒子法(1 / 2 / 4 / 8 / 16 / 32 天)</p>
          </div>
        </div>
      </div>`;

    // 探测离线支持状态
    if (swSupported) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        const chip = $('#swState');
        if (!chip) return;
        const ready = reg && (reg.active || reg.waiting);
        chip.textContent = ready ? '已就绪' : '首次加载后生效';
        chip.className = 'badge ' + (ready ? 'ok' : 'info');
      }).catch(() => {});
    }

    if (!el._bound_settings) {
      el._bound_settings = true;
      el.addEventListener('click', onClick);
      el.addEventListener('change', onChange);
    }
  }

  function segSync(id, btn, attr) {
    $$(`#${id} button`).forEach((b) => b.classList.toggle('on', b === btn));
  }

  function onClick(e) {
    if (App.router.current !== 'settings') return;
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) {
      App.store.setSetting('theme', themeBtn.dataset.theme);
      segSync('themeSeg', themeBtn);
      App.applyTheme(themeBtn.dataset.theme);
      return;
    }
    const goalBtn = e.target.closest('[data-goal]');
    if (goalBtn) {
      App.store.setSetting('goal', Number(goalBtn.dataset.goal));
      segSync('goalSeg', goalBtn);
      ui.toast(`每日目标已设为 ${goalBtn.dataset.goal} 题`, 'ok', 1400);
      return;
    }
    const cardBtn = e.target.closest('[data-cards]');
    if (cardBtn) {
      App.store.setSetting('cardCount', Number(cardBtn.dataset.cards));
      segSync('cardSeg', cardBtn);
      return;
    }
    if (e.target.closest('[data-export]')) {
      downloadFile(`iosih-backup-${dayKey()}.json`, App.store.exportJSON());
      ui.toast('已导出学习数据', 'ok');
      return;
    }
    if (e.target.closest('[data-clear-plan]')) {
      App.store.clearPlan();
      ui.toast('已清除备考计划', 'ok', 1400);
      render($('#view'));
      return;
    }

    if (e.target.closest('[data-reset]')) {
      const t = App.store.totals();
      const st = App.store;
      // 如实列出清空与保留的项,带真实数字 —— 破坏性操作不该让人猜
      ui.confirmDialog('重置学习记录?', `
        <b style="color:var(--danger)">会被清空</b>
        <ul style="margin:6px 0 10px;padding-left:18px;line-height:1.9">
          <li>学习进度 ${t.studied} 题 · 错题本 ${t.wrong} 题 · 收藏 ${t.fav} 题</li>
          <li>打卡与热力图 ${Object.keys(st.daysMap).length} 天 · 测验 ${st.quizLog.length} 次 · 模拟面 ${st.mockLog.length} 次</li>
        </ul>
        <b style="color:var(--ok)">会被保留</b>
        <ul style="margin:6px 0 10px;padding-left:18px;line-height:1.9">
          <li>我的题目 ${st.customList.length} 道 · 笔记 ${Object.keys(st.notesMap).length} 条</li>
          <li>备考计划${st.plan && st.plan.interviewDate ? '(' + st.plan.interviewDate + ')' : ''} · 外观与目标设置</li>
        </ul>
        此操作不可撤销,建议先导出备份。`, {
        okLabel: '全部重置',
        danger: true,
        onOk: () => {
          App.store.resetAll();
          if (App.shell && App.shell.invalidateSessions) App.shell.invalidateSessions();
          ui.toast('已重置学习记录,你的内容都还在', 'ok');
          render($('#view'));
        },
      });
      return;
    }

    if (e.target.closest('[data-clear-content]')) {
      const st = App.store;
      ui.confirmDialog('删除我的内容?', `
        将<b style="color:var(--danger)">永久删除</b>:自建题目 ${st.customList.length} 道、笔记 ${Object.keys(st.notesMap).length} 条、备考计划。<br>
        学习进度与统计会保留。此操作不可撤销,建议先导出备份。`, {
        okLabel: '永久删除',
        danger: true,
        onOk: () => {
          App.store.clearContent();
          if (App.shell && App.shell.invalidateSessions) App.shell.invalidateSessions();
          ui.toast('已删除自建内容', 'ok');
          render($('#view'));
        },
      });
      return;
    }

    if (e.target.closest('[data-clear-sw]')) {
      ui.confirmDialog('清除离线缓存?', '会注销离线支持并重新加载页面。学习数据不受影响,重新加载后离线支持会自动重建。', {
        okLabel: '清除并重载',
        onOk: async () => {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.active) reg.active.postMessage({ type: 'UNREGISTER' });
            if (window.caches) {
              const keys = await caches.keys();
              await Promise.all(keys.filter((k) => k.startsWith('iosih-')).map((k) => caches.delete(k)));
            }
            if (reg) await reg.unregister();
          } catch (err) { /* 忽略,直接重载 */ }
          location.reload();
        },
      });
    }
  }

  async function onChange(e) {
    if (App.router.current !== 'settings') return;

    // 备考计划:日期/公司/岗位任一变更即保存
    const planField = e.target.closest('[data-plan-date], [data-plan-company], [data-plan-role]');
    if (planField) {
      const patch = {};
      const d = $('[data-plan-date]'); const c = $('[data-plan-company]'); const r = $('[data-plan-role]');
      patch.interviewDate = d ? d.value : '';
      patch.company = c ? c.value.trim() : '';
      patch.role = r ? r.value.trim() : '';
      if (!patch.interviewDate) { App.store.clearPlan(); ui.toast('已清除备考计划', 'info', 1400); render($('#view')); return; }
      App.store.setPlan(patch);
      const left = App.store.planDaysLeft();
      ui.toast(left >= 0 ? `已设定,距面试 ${left} 天` : '日期已过,建议更新', 'ok', 1800);
      return;
    }

    const fileInput = e.target.closest('[data-import]');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    try {
      const text = await readFileText(fileInput.files[0]);
      const res = App.store.importJSON(text);
      if (App.shell && App.shell.invalidateSessions) App.shell.invalidateSessions();
      const extra = [];
      if (res && res.customAdded) extra.push(`新增自建题 ${res.customAdded} 道`);
      if (res && res.noteAdded) extra.push(`新增笔记 ${res.noteAdded} 条`);
      ui.toast(extra.length ? `导入成功 · ${extra.join(' · ')}` : '导入成功', 'ok', 3200);
      render($('#view'));
    } catch (err) {
      ui.toast('导入失败:文件格式不正确', 'warn', 3200);
    } finally {
      fileInput.value = '';
    }
  }

  return { render };
})();
