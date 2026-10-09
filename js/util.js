/* iOS 题宝库 · util.js 通用小工具 */
'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const debounce = (fn, ms = 200) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* FNV-1a 短哈希:用于由题干派生稳定 id(与题目顺序无关) */
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(36)).slice(-7);
};

const DAY_MS = 86400000;

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayKeyOfTs = (ts) => dayKey(new Date(ts));

/** 当天 0 点毫秒 */
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const fmtMD = (ts) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
const fmtFull = (d = new Date()) =>
  `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_CN[d.getDay()]}`;

/** 相对时间:刚刚 / n 分钟前 / n 小时前 / n 天前 */
const relTime = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60e3) return '刚刚';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3600e3)} 小时前`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 30) return `${days} 天前`;
  return fmtMD(ts);
};

/** 到期时间的口语化 */
const dueText = (ts) => {
  const diff = ts - Date.now();
  if (diff <= 0) return '现在';
  if (diff < 3600e3) return `${Math.max(1, Math.round(diff / 60e3))} 分钟后`;
  const dayOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const daysAhead = Math.round((dayOf(ts) - dayOf(Date.now())) / DAY_MS);
  if (daysAhead <= 0) return `${Math.max(1, Math.round(diff / 3600e3))} 小时后`;
  if (daysAhead === 1) return '明天';
  return `${daysAhead} 天后`;
};

/** 触发浏览器下载 */
const downloadFile = (name, text, type = 'application/json') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/** 读取本地文件为文本 */
const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });

/** localStorage JSON 读写(带命名空间与容错) */
const LS = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('iosih:' + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    // 返回是否写入成功:自建题/笔记这类"用户亲手写的内容"必须能感知配额失败,
    // 否则内容只存在于内存,刷新即丢失且毫无提示。
    try {
      localStorage.setItem('iosih:' + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem('iosih:' + key);
    } catch (e) { /* noop */ }
  },
};
