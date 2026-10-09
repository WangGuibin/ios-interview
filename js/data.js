/* iOS 题宝库 · data.js:题库注册表与查询
   数据文件通过 QB.add(meta, questions) 注册;
   题目 id 由 分类 + 题干哈希 派生,插入新题不影响既有学习记录。 */
'use strict';

window.QB = (() => {
  const cats = [];          // [{key,name,icon,tint,desc}]
  const catByKey = {};
  const questions = [];      // 全部题目
  const byId = {};
  const byCat = {};          // catKey -> [q]

  /**
   * 题目结构:
   * { t: 题干, a: 答案(markdown), key: [速记要点], lv: 1|2|3, fq: 1|2|3,
   *   tags: [..], opt?: [选项A..D], ans?: 正确下标, deep?: 深挖/追问(markdown) }
   */
  function add(meta, list) {
    // 防御:重复注册(脚本顺序出错时)会导致侧栏重复行与统计翻倍
    if (catByKey[meta.key]) {
      console.warn('[QB] 分类重复注册,已忽略:', meta.key);
      return catByKey[meta.key];
    }
    const cat = { key: meta.key, name: meta.name, icon: meta.icon, tint: meta.tint, desc: meta.desc || '' };
    cats.push(cat);
    catByKey[cat.key] = cat;
    byCat[cat.key] = [];

    list.forEach((q, i) => {
      const id = `${cat.key}-${fnv(cat.key + '|' + q.t)}`;
      const item = {
        id,
        cat: cat.key,
        idx: i,
        t: q.t.trim(),
        a: q.a,
        key: q.key || [],
        lv: q.lv || 1,
        fq: q.fq || 2,
        tags: q.tags || [],
        opt: q.opt || null,
        ans: q.opt ? (q.ans ?? 0) : null,
        deep: q.deep || null,
      };
      questions.push(item);
      byId[id] = item;
      byCat[cat.key].push(item);
    });
    return cat;
  }

  const get = (id) => byId[id];
  const ofCat = (key) => byCat[key] || [];
  const cat = (key) => catByKey[key];

  /* ==================== 自建题目 ====================
     id 在创建时一次性生成并写入存储,**永不**由题干推导,
     因此编辑题干不会让已有的学习进度/笔记成为孤儿。 */

  const CUSTOM_KEY = 'custom';
  const CUSTOM_META = {
    key: CUSTOM_KEY,
    name: '我的题目',
    icon: 'cCustom',
    tint: '#8E8E93',
    desc: '你自己录入的题目,与内置题库同等参与闪卡、测验与统计',
  };

  const isCustom = (id) => typeof id === 'string' && id.indexOf(CUSTOM_KEY + '-') === 0;

  /** 生成不可能与内置题(固定 7 位 fnv)冲突的 id */
  const mintCustomId = () =>
    `${CUSTOM_KEY}-u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  /** 惰性创建「我的题目」分类;允许 0 题存在 */
  function defineCustomCat() {
    if (catByKey[CUSTOM_KEY]) return catByKey[CUSTOM_KEY];
    return add(CUSTOM_META, []);
  }

  /**
   * 用存储里的自建题全量重建 custom 分类。
   * 关键:questions / byCat 必须**原地**修改(splice/push/length=0),
   * 因为它们是按引用导出的,重新赋值会让所有消费者读到脱钩的旧数组。
   */
  function syncCustom(list) {
    defineCustomCat();
    // 倒序 splice,移除旧的自建题,保持数组身份不变
    for (let i = questions.length - 1; i >= 0; i--) {
      if (questions[i].cat === CUSTOM_KEY) {
        delete byId[questions[i].id];
        questions.splice(i, 1);
      }
    }
    byCat[CUSTOM_KEY].length = 0;

    (list || []).forEach((rec, i) => {
      if (!rec || !rec.id || !rec.t || byId[rec.id]) return; // 防脏数据与重复 id
      const hasOpt = Array.isArray(rec.opt) && rec.opt.filter(Boolean).length >= 2;
      const item = {
        id: rec.id,
        cat: CUSTOM_KEY,
        idx: i,
        t: String(rec.t).trim(),
        a: rec.a || '',
        key: Array.isArray(rec.key) ? rec.key : [],
        lv: rec.lv || 1,
        fq: rec.fq || 2,
        tags: Array.isArray(rec.tags) ? rec.tags : [],
        opt: hasOpt ? rec.opt : null,
        ans: hasOpt ? (rec.ans ?? 0) : null,
        deep: rec.deep || null,
        custom: true,
        createdAt: rec.createdAt || 0,
        updatedAt: rec.updatedAt || 0,
      };
      questions.push(item);
      byId[item.id] = item;
      byCat[CUSTOM_KEY].push(item);
    });
    return byCat[CUSTOM_KEY].length;
  }

  /** 内置题数量(不含自建),用于"每日一题"等需要稳定集合的场景 */
  const builtinCount = () => questions.filter((q) => !q.custom).length;

  /** 全文搜索:题干 + 标签 + 答案;返回按相关度排序的结果 */
  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const item of questions) {
      const title = item.t.toLowerCase();
      const tags = item.tags.join(' ').toLowerCase();
      const answer = String(item.a).toLowerCase();
      let score = 0;
      let allHit = true;
      for (const term of terms) {
        let s = 0;
        if (title.includes(term)) s += 10;
        if (tags.includes(term)) s += 6;
        if (answer.includes(term)) s += 2;
        if (s === 0) { allHit = false; break; }
        score += s;
      }
      if (allHit) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }

  /* ---- 展示用常量 ---- */
  const LV = { 1: '基础', 2: '进阶', 3: '高级' };
  const FQ = { 3: '必考', 2: '高频', 1: '了解' };
  const BOX_NAME = ['重学中', '第 1 盒', '第 2 盒', '第 3 盒', '第 4 盒', '第 5 盒', '第 6 盒'];

  return {
    cats, catByKey, questions, byId, byCat, add, get, ofCat, cat, search, LV, FQ, BOX_NAME,
    CUSTOM_KEY, CUSTOM_META, isCustom, mintCustomId, defineCustomCat, syncCustom, builtinCount,
  };
})();
