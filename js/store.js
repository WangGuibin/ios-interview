/* iOS 题宝库 · store.js:学习数据层(localStorage 持久化 + 间隔重复 + 统计)
   全部为不可变式更新:每次写入产生新对象,旧引用不被原地修改。 */
'use strict';

window.App = window.App || {};

App.store = (() => {
  /* 记忆盒子间隔(天):掌握一次升一盒,到期后复习 */
  const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];
  const MAX_BOX = 6;
  const MASTER_BOX = 4; // box >= 4 视为已掌握

  /* ---------- 加载 ----------
     切片分两类,决定"重置学习记录"时的去留:
       学习记录(可重置): progress / favs / wrong / days / quizLog / mock
       用户内容(永久保留): notes / custom / plan / settings          */
  let progress = LS.get('progress', {});   // qid -> {box,due,seen,ok,no,last}
  let favs = LS.get('favs', []);           // [qid]
  let wrong = LS.get('wrong', {});         // qid -> {n, ts}
  let days = LS.get('days', {});           // 'YYYY-MM-DD' -> {n, ok, no}
  let quizLog = LS.get('quizLog', []);     // [{ts, scope, total, ok}]
  let mock = LS.get('mock', []);           // [{ts, scope, total, score, durationMs, weak[]}]
  let notes = LS.get('notes', {});         // qid -> {text, ts}
  let custom = LS.get('custom', []);       // [{id, t, a, key[], lv, fq, tags[], opt, ans, deep, createdAt, updatedAt}]
  let plan = LS.get('plan', null);         // {interviewDate, company, role, createdAt, updatedAt}
  let settings = Object.assign({ theme: 'auto', goal: 20, cardCount: 20, quizCount: 10 }, LS.get('settings', {}));

  const listeners = new Set();
  const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn());

  const save = {
    progress: () => LS.set('progress', progress),
    favs: () => LS.set('favs', favs),
    wrong: () => LS.set('wrong', wrong),
    days: () => LS.set('days', days),
    quizLog: () => LS.set('quizLog', quizLog),
    mock: () => LS.set('mock', mock),
    notes: () => LS.set('notes', notes),
    custom: () => LS.set('custom', custom),
    plan: () => LS.set('plan', plan),
    settings: () => LS.set('settings', settings),
  };

  /** 学习记录类切片(重置时清空);用户内容不在此列 */
  const RECORD_SLICES = ['progress', 'favs', 'wrong', 'days', 'quizLog', 'mock'];

  /* ---------- 间隔重复(纯函数,可测试) ---------- */
  function srsNext(box, grade, now = Date.now()) {
    if (grade === 'again') return { box: 0, due: now + 60e3 };
    if (grade === 'fuzzy') {
      const b = Math.max(1, box - 1);
      return { box: b, due: now + BOX_DAYS[b] * DAY_MS };
    }
    const b = Math.min(MAX_BOX, box + 1);
    return { box: b, due: now + BOX_DAYS[b] * DAY_MS };
  }

  /* 题目掌握状态:new | wrong | learning | mastered */
  function statusOf(qid) {
    const p = progress[qid];
    if (!p || !p.seen) return 'new';
    if (p.box >= MASTER_BOX) return 'mastered';
    if (p.box === 0) return 'wrong';
    return 'learning';
  }

  const isDue = (qid, now = Date.now()) => {
    const p = progress[qid];
    return !!p && p.seen > 0 && p.due <= now;
  };

  /* ---------- 学习记录 ---------- */
  function bumpDay(okDelta, noDelta) {
    const k = dayKey();
    const cur = days[k] || { n: 0, ok: 0, no: 0 };
    days = Object.assign({}, days, {
      [k]: { n: cur.n + 1, ok: cur.ok + (okDelta || 0), no: cur.no + (noDelta || 0) },
    });
    save.days();
  }

  /** 自评成绩(cards 模式):again | fuzzy | known */
  function grade(qid, g) {
    const prev = progress[qid] || { box: 0, due: 0, seen: 0, ok: 0, no: 0, last: 0 };
    const next = srsNext(prev.box, g);
    progress = Object.assign({}, progress, {
      [qid]: {
        box: next.box,
        due: next.due,
        seen: prev.seen + 1,
        ok: prev.ok + (g === 'known' ? 1 : 0),
        no: prev.no + (g === 'again' ? 1 : 0),
        last: Date.now(),
      },
    });
    bumpDay(g === 'known' ? 1 : 0, g === 'again' ? 1 : 0);
    if (g === 'again') addWrong(qid, false);
    if (g === 'known') removeWrong(qid, false);
    save.progress();
    emit();
    return progress[qid];
  }

  /** 测验判定:correct: true/false;等同 known/again */
  function recordQuizAnswer(qid, correct) {
    return grade(qid, correct ? 'known' : 'again');
  }

  function pushQuizLog(entry) {
    quizLog = quizLog.concat([Object.assign({ ts: Date.now() }, entry)]).slice(-60);
    save.quizLog();
  }

  /* ---------- 收藏 ---------- */
  const isFav = (qid) => favs.includes(qid);
  function toggleFav(qid) {
    favs = isFav(qid) ? favs.filter((x) => x !== qid) : favs.concat([qid]);
    save.favs();
    emit();
    return isFav(qid);
  }

  /* ---------- 错题本 ---------- */
  const inWrong = (qid) => qid in wrong;
  function addWrong(qid, fire = true) {
    const cur = wrong[qid] || { n: 0 };
    wrong = Object.assign({}, wrong, { [qid]: { n: cur.n + 1, ts: Date.now() } });
    save.wrong();
    if (fire) emit();
  }
  function removeWrong(qid, fire = true) {
    if (!(qid in wrong)) return;
    const next = Object.assign({}, wrong);
    delete next[qid];
    wrong = next;
    save.wrong();
    if (fire) emit();
  }
  function clearWrong() {
    wrong = {};
    save.wrong();
    emit();
  }

  /* ---------- 设置 ---------- */
  function setSetting(key, value) {
    settings = Object.assign({}, settings, { [key]: value });
    save.settings();
    emit();
  }

  /* ---------- 笔记(用户内容) ---------- */
  const getNote = (qid) => notes[qid] || null;
  function setNote(qid, text) {
    const t = String(text || '').trim();
    if (!t) {
      if (!(qid in notes)) return true;
      const next = Object.assign({}, notes);
      delete next[qid];
      notes = next;
    } else {
      notes = Object.assign({}, notes, { [qid]: { text: t, ts: Date.now() } });
    }
    const ok = save.notes();
    emit();
    return ok;
  }

  /* ---------- 自建题目(用户内容) ---------- */
  const getCustom = (id) => custom.find((c) => c.id === id) || null;

  function addCustom(draft) {
    const t = String(draft.t || '').trim();
    if (!t) return { ok: false, err: '题干不能为空' };
    const now = Date.now();
    const rec = Object.assign({}, draft, { id: QB.mintCustomId(), t, createdAt: now, updatedAt: now });
    custom = custom.concat([rec]);
    QB.syncCustom(custom);
    const ok = save.custom();
    emit();
    return ok ? { ok: true, id: rec.id } : { ok: false, err: '存储空间不足,未能保存' };
  }

  /** 编辑:id 恒定,因此进度/笔记/收藏全部存活 */
  function updateCustom(id, patch) {
    const idx = custom.findIndex((c) => c.id === id);
    if (idx < 0) return { ok: false, err: '题目不存在' };
    const next = custom.slice();
    next[idx] = Object.assign({}, next[idx], patch, { id, updatedAt: Date.now() });
    custom = next;
    QB.syncCustom(custom);
    const ok = save.custom();
    emit();
    return ok ? { ok: true } : { ok: false, err: '存储空间不足,未能保存' };
  }

  /** 内部:批量摘除一组 qid 的全部学习记录与笔记(不 emit) */
  function dropRecordsFor(ids) {
    if (!ids.length) return;
    const dead = new Set(ids);
    const p = Object.assign({}, progress);
    const w = Object.assign({}, wrong);
    const n = Object.assign({}, notes);
    dead.forEach((id) => { delete p[id]; delete w[id]; delete n[id]; });
    progress = p; wrong = w; notes = n;
    favs = favs.filter((id) => !dead.has(id));
    save.progress(); save.wrong(); save.notes(); save.favs();
  }

  /** 删除自建题:级联清理,不留孤儿数据污染统计分母 */
  function removeCustom(id) {
    custom = custom.filter((c) => c.id !== id);
    QB.syncCustom(custom);
    dropRecordsFor([id]);
    save.custom();
    emit();
  }

  /** 自愈:清理指向已不存在的自建题的残留记录。
      只处理 custom- 前缀 —— 内置题 id 消失只可能是数据文件加载失败,
      那种情况下绝不能把用户的学习历史当成"孤儿"抹掉。 */
  function pruneCustomOrphans() {
    const seen = new Set();
    const dead = [];
    const scan = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      if (QB.isCustom(id) && !QB.byId[id]) dead.push(id);
    };
    Object.keys(progress).forEach(scan);
    Object.keys(wrong).forEach(scan);
    Object.keys(notes).forEach(scan);
    favs.forEach(scan);
    if (dead.length) { dropRecordsFor(dead); emit(); }
    return dead.length;
  }

  /* ---------- 备考计划(用户内容) ---------- */
  function setPlan(patch) {
    const now = Date.now();
    plan = Object.assign({ createdAt: now }, plan || {}, patch, { updatedAt: now });
    save.plan();
    emit();
  }
  function clearPlan() { plan = null; save.plan(); emit(); }
  /** 距面试还有几天(含今天);无计划返回 null */
  function planDaysLeft() {
    if (!plan || !plan.interviewDate) return null;
    const target = new Date(plan.interviewDate + 'T00:00:00');
    return Math.ceil((target.getTime() - startOfToday()) / DAY_MS);
  }

  /* ---------- 模拟面试(学习记录) ---------- */
  function pushMock(entry) {
    mock = mock.concat([Object.assign({ ts: Date.now() }, entry)]).slice(-60);
    save.mock();
    emit();
  }
  function clearMock() { mock = []; save.mock(); emit(); }

  /** 只删用户内容(自建题/笔记/计划),学习进度保留 */
  function clearContent() {
    const ids = custom.map((c) => c.id);
    custom = [];
    notes = {};
    plan = null;
    QB.syncCustom(custom);
    dropRecordsFor(ids);
    save.custom(); save.notes(); save.plan();
    emit();
  }

  /* ---------- 派生统计 ---------- */
  function totals() {
    let studied = 0, mastered = 0, due = 0;
    const now = Date.now();
    for (const q of QB.questions) {
      const st = statusOf(q.id);
      if (st !== 'new') studied++;
      if (st === 'mastered') mastered++;
      if (isDue(q.id, now)) due++;
    }
    return {
      total: QB.questions.length,
      studied,
      mastered,
      due,
      fav: favs.length,
      wrong: Object.keys(wrong).length,
    };
  }

  function catStats(key) {
    const list = QB.ofCat(key);
    let studied = 0, mastered = 0, due = 0;
    const now = Date.now();
    for (const q of list) {
      const st = statusOf(q.id);
      if (st !== 'new') studied++;
      if (st === 'mastered') mastered++;
      if (isDue(q.id, now)) due++;
    }
    return { total: list.length, studied, mastered, due };
  }

  function today() {
    return days[dayKey()] || { n: 0, ok: 0, no: 0 };
  }

  /** 连续学习天数(今天没学则以昨天为锚) */
  function streak(now = Date.now()) {
    const anchor = new Date(now);
    const has = (d) => {
      const rec = days[dayKey(d)];
      return rec && rec.n > 0;
    };
    let cursor = new Date(anchor);
    if (!has(cursor)) cursor = new Date(cursor.getTime() - DAY_MS);
    let count = 0;
    while (has(cursor)) {
      count++;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return count;
  }

  /** 最近 weeks 周的活动热力图 [{key, n, level, date}] */
  function heatmap(weeks = 12) {
    const out = [];
    const todayD = new Date(startOfToday());
    const count = weeks * 7;
    // 对齐到周日结尾
    const end = new Date(todayD);
    end.setDate(end.getDate() + (6 - end.getDay()));
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * DAY_MS);
      const rec = days[dayKey(d)];
      const n = rec ? rec.n : 0;
      out.push({ key: dayKey(d), n, future: d.getTime() > todayD.getTime(), date: fmtMD(d.getTime()) });
    }
    return out;
  }

  /** 记忆盒子分布 [box0..6] */
  function boxHist() {
    const hist = [0, 0, 0, 0, 0, 0, 0];
    for (const q of QB.questions) {
      const p = progress[q.id];
      if (p && p.seen) hist[Math.min(p.box, MAX_BOX)]++;
    }
    return hist;
  }

  /* ---------- 数据迁移 ---------- */
  function exportJSON() {
    return JSON.stringify({
      app: 'ios-interview-hub',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: { progress, favs, wrong, days, quizLog, mock, notes, custom, plan, settings },
    }, null, 2);
  }

  /**
   * 导入策略按切片区分:
   *   学习记录 → 整片替换(两份 SRS 历史交织会产生无意义的盒子/到期状态)
   *   notes / custom → **按 id 合并**(导入备份绝不能删掉本机亲手写的内容)
   *   plan / settings → 有则覆盖 / 浅合并
   * 返回本次合并摘要,供 UI 如实告知用户。
   */
  function importJSON(text) {
    const parsed = JSON.parse(text);
    const d = parsed && parsed.data ? parsed.data : parsed;
    if (!d || typeof d !== 'object') throw new Error('无法识别的备份格式');

    if (d.progress && typeof d.progress === 'object') progress = d.progress;
    if (Array.isArray(d.favs)) favs = d.favs;
    if (d.wrong && typeof d.wrong === 'object') wrong = d.wrong;
    if (d.days && typeof d.days === 'object') days = d.days;
    if (Array.isArray(d.quizLog)) quizLog = d.quizLog;
    if (Array.isArray(d.mock)) mock = d.mock;
    if (d.settings && typeof d.settings === 'object') settings = Object.assign({}, settings, d.settings);
    if (d.plan && typeof d.plan === 'object') plan = d.plan;

    // 笔记:按 qid 合并,较新的 ts 胜出
    let noteAdded = 0;
    if (d.notes && typeof d.notes === 'object') {
      const merged = Object.assign({}, notes);
      Object.entries(d.notes).forEach(([qid, rec]) => {
        if (!rec || typeof rec.text !== 'string') return;
        const cur = merged[qid];
        if (!cur || (rec.ts || 0) > (cur.ts || 0)) { if (!cur) noteAdded++; merged[qid] = rec; }
      });
      notes = merged;
    }

    // 自建题:按 id 并集合并,同 id 取 updatedAt 较新者
    let customAdded = 0;
    if (Array.isArray(d.custom)) {
      const byIdMap = new Map(custom.map((c) => [c.id, c]));
      d.custom.forEach((rec) => {
        if (!rec || !rec.id || !rec.t) return;
        const cur = byIdMap.get(rec.id);
        if (!cur) { byIdMap.set(rec.id, rec); customAdded++; }
        else if ((rec.updatedAt || 0) > (cur.updatedAt || 0)) byIdMap.set(rec.id, rec);
      });
      custom = Array.from(byIdMap.values());
    }

    QB.syncCustom(custom);          // 先让合并进来的题目存在
    pruneCustomOrphans();           // 再清理真正的孤儿
    Object.values(save).forEach((fn) => fn());
    emit();
    return { noteAdded, customAdded, customTotal: custom.length };
  }

  /** 重置:只清学习记录;笔记 / 自建题 / 备考计划 / 设置一律保留 */
  function resetAll() {
    progress = {};
    favs = [];
    wrong = {};
    days = {};
    quizLog = [];
    mock = [];
    RECORD_SLICES.forEach((k) => LS.remove(k));
    emit();
  }

  return {
    onChange, emit,
    get settings() { return settings; },
    setSetting,
    srsNext, statusOf, isDue,
    grade, recordQuizAnswer, pushQuizLog,
    isFav, toggleFav,
    inWrong, addWrong, removeWrong, clearWrong,
    get wrongMap() { return wrong; },
    get progressMap() { return progress; },
    get daysMap() { return days; },
    totals, catStats, today, streak, heatmap, boxHist,
    get quizLog() { return quizLog; },
    // 笔记
    getNote, setNote, get notesMap() { return notes; },
    // 自建题目
    get customList() { return custom; },
    getCustom, addCustom, updateCustom, removeCustom, pruneCustomOrphans,
    // 备考计划
    get plan() { return plan; },
    setPlan, clearPlan, planDaysLeft,
    // 模拟面试
    get mockLog() { return mock; },
    pushMock, clearMock,
    clearContent,
    exportJSON, importJSON, resetAll,
    BOX_DAYS, MASTER_BOX,
  };
})();
