/* 数据层校验脚本(Node):题库完整性 + 自建题不变式
   用法:node check-data.js
   为什么必须 eval 全量数据文件:答案模板字符串里的裸反引号会劈断字符串,
   但劈断后往往仍是合法语法,node --check 抓不到,只有真正求值才暴露。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const sandbox = { console, Date, Math, JSON, RegExp, String, Number, Array, Object, Set, Map };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

const run = (rel) => vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });

run('js/util.js');
run('js/data.js');
// 跳过 custom.js:它是运行期从 localStorage 引导自建题的,本脚本单独校验其不变式
fs.readdirSync(path.join(root, 'js/data')).sort()
  .filter((f) => f !== 'custom.js')
  .forEach((f) => run('js/data/' + f));

const QB = sandbox.QB;
const fail = [];
const ok = [];
const assert = (cond, label) => (cond ? ok : fail).push(label);

/* ---- 题库完整性 ---- */
const ids = new Set();
let mcq = 0, deep = 0;
for (const q of QB.questions) {
  if (ids.has(q.id)) fail.push('id 重复: ' + q.id);
  ids.add(q.id);
  if (!q.t || !q.a || q.a.length < 20) fail.push('内容过短: ' + q.id);
  if (![1, 2, 3].includes(q.lv) || ![1, 2, 3].includes(q.fq)) fail.push('难度/频率非法: ' + q.id);
  if (!Array.isArray(q.key) || !q.key.length) fail.push('缺速记要点: ' + q.id);
  if (q.opt) {
    mcq++;
    if (!Array.isArray(q.opt) || q.opt.length < 2) fail.push('选项过少: ' + q.id);
    else if (q.ans == null || q.ans < 0 || q.ans >= q.opt.length) fail.push('正确答案下标越界: ' + q.id);
  }
  if (q.deep) deep++;
}
assert(ids.size === QB.questions.length, `题目 id 全部唯一 (${ids.size})`);

/* ---- 自建题不变式 ---- */
const arrRef = QB.questions;
const catsBefore = QB.cats.length;
QB.defineCustomCat();
assert(QB.cats.length === catsBefore + 1, '首次调用创建「我的题目」分类');
QB.defineCustomCat();
assert(QB.cats.length === catsBefore + 1, 'defineCustomCat 幂等,不重复注册');
assert(QB.ofCat('custom').length === 0, '自建分类允许 0 题存在');

const id1 = QB.mintCustomId();
QB.syncCustom([{ id: id1, t: '我的自建题', a: '这是一段足够长的答案内容用于校验', key: ['要点'], lv: 2, fq: 3 }]);
assert(arrRef === QB.questions, 'questions 数组身份不变(原地修改,消费者不脱钩)');
assert(QB.ofCat('custom').length === 1, 'syncCustom 注册成功');
assert(QB.byId[id1] && QB.byId[id1].custom === true, '自建题带 custom 标记');
assert(!QB.questions.filter((q) => !q.custom).some((q) => q.id === id1), '自建 id 与内置题零冲突');
assert(QB.isCustom(id1) && !QB.isCustom('swift-abc1234'), 'isCustom 前缀判定正确');

QB.syncCustom([{ id: id1, t: '题干改过了', a: '这是一段足够长的答案内容用于校验', key: ['要点'] }]);
assert(QB.ofCat('custom').length === 1, '重复 sync 幂等,不产生重复题');
assert(QB.byId[id1] && QB.byId[id1].t === '题干改过了', '改题干后 id 不变(进度不会成孤儿)');

QB.syncCustom([]);
assert(!!QB.cat('custom'), '清空自建题后分类仍存在');
assert(QB.ofCat('custom').length === 0 && !QB.byId[id1], '清空后 byId 无残留');
assert(QB.questions.filter((q) => q.custom).length === 0, '清空后 questions 无残留自建题');

/* ---- 输出 ---- */
const builtin = QB.questions.length;
console.log(`题目 ${builtin} | 分类 ${catsBefore} | 选择题 ${mcq} (${Math.round(mcq / builtin * 100)}%) | 追问 ${deep}`);
console.log(`每类题量: ${QB.cats.filter((c) => c.key !== 'custom').map((c) => c.key + '=' + QB.ofCat(c.key).length).join(' ')}`);
ok.forEach((o) => console.log('  ✓ ' + o));
if (fail.length) {
  console.log('\n✗ 失败 ' + fail.length + ' 项:');
  fail.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('\n全部校验通过 ✓');
