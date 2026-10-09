/* iOS 题宝库 · views/stats.js:学习统计(掌握度、热力图、记忆盒子) */
'use strict';

window.App = window.App || {};
App.views = App.views || {};

App.views.stats = (() => {
  const { icon } = ICON;
  const ui = App.ui;

  function render(el) {
    const store = App.store;
    const t = store.totals();
    const hist = store.boxHist();
    const heat = store.heatmap(12);
    const maxHeat = Math.max(1, ...heat.map((d) => d.n));
    const streak = store.streak();
    const totalCards = Object.values(store.progressMap).reduce((s, p) => s + p.seen, 0);
    const totalOk = Object.values(store.progressMap).reduce((s, p) => s + p.ok, 0);
    const acc = totalCards ? Math.round((totalOk / totalCards) * 100) : 0;

    el.innerHTML = `
      <div class="dash-grid cols-4">
        <div class="card stat-tile"><span class="stat-num num">${t.total}</span><span class="stat-label">题库总量</span></div>
        <div class="card stat-tile"><span class="stat-num num">${t.studied}<span class="small t-3"> / ${Math.round((t.studied / t.total) * 100)}%</span></span><span class="stat-label">已学习</span></div>
        <div class="card stat-tile"><span class="stat-num num">${t.mastered}<span class="small t-3"> / ${Math.round((t.mastered / t.total) * 100)}%</span></span><span class="stat-label">已掌握</span></div>
        <div class="card stat-tile"><span class="stat-num num">${streak}<span class="small t-3"> 天</span></span><span class="stat-label">连续学习</span></div>
      </div>

      <div class="dash-grid mt-3" style="grid-template-columns:1.5fr 1fr">
        <div class="card pad">
          <div class="between">
            <h3 class="h-3">近 12 周学习热力</h3>
            <span class="small t-3">累计作答 ${totalCards} 次 · 正确率 ${acc}%</span>
          </div>
          <div class="heat mt-4" role="img" aria-label="近 12 周学习热力图">
            ${heat.map((d) => `<i class="${heatLevel(d.n, maxHeat)}" title="${d.date}:学习 ${d.n} 题"></i>`).join('')}
          </div>
          <div class="between mt-3 small t-3">
            <span>少</span>
            <span class="row gap-1">
              <i style="width:9px;height:9px;border-radius:2px;background:var(--surface-3)"></i>
              <i style="width:9px;height:9px;border-radius:2px;background:color-mix(in oklab, var(--accent) 32%, var(--surface-3))"></i>
              <i style="width:9px;height:9px;border-radius:2px;background:color-mix(in oklab, var(--accent) 55%, var(--surface-3))"></i>
              <i style="width:9px;height:9px;border-radius:2px;background:color-mix(in oklab, var(--accent) 78%, var(--surface-3))"></i>
              <i style="width:9px;height:9px;border-radius:2px;background:var(--accent)"></i>
              <span>多</span>
            </span>
          </div>
        </div>

        <div class="card pad">
          <h3 class="h-3">记忆盒子分布</h3>
          <p class="small t-3" style="margin-top:2px">盒号越大间隔越长,4 盒以上算掌握</p>
          <div class="box-hist mt-4">
            ${hist.map((n, i) => `
              <span class="bh" title="第 ${i} 盒:${n} 题">
                <i style="height:${Math.max(4, histMax(hist) ? (n / histMax(hist)) * 100 : 4)}%;background:${i >= App.store.MASTER_BOX ? 'var(--ok)' : i === 0 ? 'var(--danger)' : 'var(--warn)'}"></i>
                <span class="num">${n}</span><span>${i === 0 ? '重学' : i + ' 盒'}</span>
              </span>`).join('')}
          </div>
        </div>
      </div>

      <div class="dash-grid mt-3" style="grid-template-columns:1.5fr 1fr">
        <div class="card pad">
          <div class="between">
            <h3 class="h-3">分类掌握度</h3>
            <span class="legend"><span><i style="background:var(--ok)"></i>已掌握</span><span><i style="background:var(--warn)"></i>学习中</span><span><i style="background:var(--surface-3);border:1px solid var(--line)"></i>未学</span></span>
          </div>
          <div class="mt-3">
            ${QB.cats.map((c) => {
              const s = store.catStats(c.key);
              return `<div class="cat-bar-row">
                <span class="cb-name">${ui.catIcon(c.key)}<span class="truncate">${esc(c.name)}</span></span>
                <span class="cb-track">${ui.stackedBar(s.total - s.studied, s.studied - s.mastered, s.mastered)}</span>
                <span class="cb-num">${s.mastered}/${s.studied}/${s.total}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="col gap-3">
          <div class="card pad">
            <h3 class="h-3">最近测验</h3>
            ${quizLogHtml()}
          </div>
          <div class="card pad">
            <h3 class="h-3">学习建议</h3>
            <div class="md small mt-2">${suggestion(t)}</div>
          </div>
        </div>
      </div>`;
  }

  function histMax(hist) { return Math.max(...hist, 0); }

  function heatLevel(n, max) {
    if (!n) return '';
    const r = n / max;
    if (r <= 0.25) return 'l1';
    if (r <= 0.5) return 'l2';
    if (r <= 0.75) return 'l3';
    return 'l4';
  }

  function quizLogHtml() {
    const log = App.store.quizLog.slice(-6).reverse();
    if (!log.length) return `<p class="small t-3 mt-3">还没有测验记录,<a href="#/quiz">去测一组</a>。</p>`;
    return `<div class="mt-2">
      ${log.map((r) => {
        const pct = r.total ? Math.round((r.ok / r.total) * 100) : 0;
        const scopeName = r.scope === 'all' ? '综合' : (QB.cat(r.scope) || {}).name || r.scope;
        return `<div class="between" style="padding:8px 0;border-bottom:1px solid var(--line)">
          <span class="small">${esc(scopeName)} · ${fmtMD(r.ts)}</span>
          <span class="small num" style="font-weight:650;color:${pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)'}">${r.ok}/${r.total}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function suggestion(t) {
    const tips = [];
    if (t.due > 10) tips.push(`今日有 **${t.due}** 题到期,先用闪卡清掉到期题,打断遗忘曲线是最划算的。`);
    if (t.wrong >= 5) tips.push(`错题本有 ${t.wrong} 题,建议本周专门安排一次错题复盘,消灭一个少一个。`);
    if (t.studied / t.total < 0.3) tips.push(`学习覆盖率还不高,优先啃 **必考** 标签的题(红色徽章),性价比最高。`);
    const weakest = QB.cats
      .map((c) => ({ c, s: App.store.catStats(c.key) }))
      .filter((x) => x.s.studied >= 2)
      .sort((a, b) => a.s.mastered / (a.s.studied || 1) - b.s.mastered / (b.s.studied || 1))[0];
    if (weakest) tips.push(`「${weakest.c.name}」当前掌握率最低(${weakest.s.mastered}/${weakest.s.studied}),值得用"分类闪卡"集中突破。`);
    if (!tips.length) tips.push('节奏很好,保持每日复习;面试前把错题本和高频题各过一遍。');
    return `<ul>${tips.map((t) => `<li>${MD.render(t).replace(/<\/?p>/g, '')}</li>`).join('')}</ul>`;
  }

  return { render };
})();
