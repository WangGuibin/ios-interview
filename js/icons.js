/* iOS 题宝库 · icons.js:全文统一的几何图标(SF Symbols 风格,stroke 图标) */
'use strict';

window.ICON = (() => {
  // 每个图标是 viewBox="0 0 24 24" 内的 inner SVG;默认 stroke 当前色
  const P = {
    /* ---- 导航 ---- */
    dash: '<path d="M4.5 10.8 12 4.5l7.5 6.3V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-5v5H6A1.5 1.5 0 0 1 4.5 19v-8.2Z"/>',
    bank: '<path d="M4.8 4.2h3.4v15.6H4.8zM9.8 4.2h3.4v15.6H9.8zM14.4 5.6l3.2-1 3.1 14.5-3.2 1z"/>',
    cards: '<rect x="4" y="7" width="16" height="12.5" rx="2"/><path d="M7 4.2h10M9.3 1.8h5.4"/>',
    quiz: '<circle cx="12" cy="12" r="8.3"/><path d="m8.6 12.2 2.3 2.3 4.5-4.8"/>',
    wrong: '<path d="M6 3.5V20M6 4.5h10.5l-2.6 3.7 2.6 3.8H6"/>',
    stats: '<path d="M4 20h16M6.5 16.5v-4M11 16.5V6.5M15.5 16.5v-6M20 9"/>' ,
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>',

    /* ---- UI ---- */
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/>',
    flame: '<path d="M12 3.2c.8 2.8-4.6 4.7-4.6 9a4.7 4.7 0 0 0 9.4 0c0-1.9-1-3.1-2-4.1-.6 1.1-1.4 1.7-2.3 1.6.7-1.5.7-3.6-.5-6.5Z"/>',
    moon: '<path d="M20 13.2A8.2 8.2 0 1 1 10.8 4a6.6 6.6 0 0 0 9.2 9.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
    star: '<path d="m12 4 2.2 4.9 5.3.5-4 3.6 1.2 5.2L12 15.4l-4.7 2.8L8.5 13l-4-3.6 5.3-.5Z"/>',
    starFill: '<path d="m12 4 2.2 4.9 5.3.5-4 3.6 1.2 5.2L12 15.4l-4.7 2.8L8.5 13l-4-3.6 5.3-.5Z" fill="currentColor" stroke="none"/>',
    chevR: '<path d="m9.5 6 6 6-6 6"/>',
    chevL: '<path d="M14.5 6l-6 6 6 6"/>',
    chevD: '<path d="m6 9.5 6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M19.5 9A8 8 0 0 0 6 6.2L4 8m0-4v4h4M4.5 15a8 8 0 0 0 13.5 2.8l2-1.8m0 4v-4h-4"/>',
    info: '<circle cx="12" cy="12" r="8.3"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/>',
    keyboard: '<rect x="2.8" y="6.5" width="18.4" height="11" rx="2"/><path d="M6.5 10h.8M10.2 10h.8M13.9 10h.8M17.6 10h.8M6.5 13.5h.8M17.6 13.5h.8M9.5 13.5h5"/>',
    zap: '<path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5Z"/>',
    clock: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.5V12l3.2 2"/>',
    target: '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.8A1.8 1.8 0 0 0 5 20.3V4.5Z"/><path d="M5 19V4.5M8 7h7M8 10.5h5"/>',
    trophy: '<path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z"/><path d="M7 5.5H4v2a3 3 0 0 0 3 3M17 5.5h3v2a3 3 0 0 1-3 3M12 14.5V17M8.5 20h7"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/>',
    download: '<path d="M12 4v10.5M7.5 10.8 12 15.3l4.5-4.5M4.5 19.5h15"/>',
    upload: '<path d="M12 15V4.5M7.5 9 12 4.5 16.5 9M4.5 19.5h15"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6V4.2A1.2 1.2 0 0 1 10.7 3h2.6a1.2 1.2 0 0 1 1.2 1.2V6M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5M10 10.5v6.5M14 10.5v6.5"/>',
    play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.4-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z"/>',
    layers: '<path d="m12 3.5 8.5 4.7L12 12.9 3.5 8.2 12 3.5Z"/><path d="m4.6 12.3 7.4 4.1 7.4-4.1M4.6 16.3l7.4 4.1 7.4-4.1"/>',
    external: '<path d="M9.5 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-3.5M14 4.5h5.5V10M19.3 4.7l-8.6 8.6"/>',
    grad: '<path d="m12 4.5 9.5 4.5L12 13.5 2.5 9 12 4.5Z"/><path d="M6.5 11.5V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.5M21.5 9v5"/>',

    /* ---- 分类字形 ---- */
    cSwift: '<path d="M8.5 4.5c-1.4 0-2 .8-2 1.9v2.6c0 1.2-.6 1.9-1.8 2.1 1.2.2 1.8.9 1.8 2.1v2.6c0 1.1.6 1.9 2 1.9M15.5 4.5c1.4 0 2 .8 2 1.9v2.6c0 1.2.6 1.9 1.8 2.1-1.2.2-1.8.9-1.8 2.1v2.6c0 1.1-.6 1.9-2 1.9"/>',
    cConc: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    cMemory: '<rect x="4.5" y="4" width="15" height="4.6" rx="1.4"/><rect x="4.5" y="9.7" width="15" height="4.6" rx="1.4"/><rect x="4.5" y="15.4" width="15" height="4.6" rx="1.4"/>',
    cObjc: '<path d="M6.5 3.8 19 11.2l-6.4 1.6-2.5 6.2-3.6-15.2Z"/>',
    cRuntime: '<circle cx="5.5" cy="12" r="2"/><circle cx="18.5" cy="6.5" r="2"/><circle cx="18.5" cy="17.5" r="2"/><path d="M7.3 10.9l9-3.3M7.3 13.1l9 3.3"/>',
    cRunloop: '<path d="M19.3 8.2A8 8 0 1 0 20 13"/><path d="M20 4.5v3.9h-3.9"/>',
    cGcd: '<circle cx="6" cy="6" r="1.6"/><path d="M10.5 6h8"/><circle cx="6" cy="12" r="1.6"/><path d="M10.5 12h8"/><circle cx="6" cy="18" r="1.6"/><path d="M10.5 18h8"/>',
    cUikit: '<rect x="3.5" y="4.5" width="17" height="14.5" rx="2"/><path d="M3.5 8.5h17"/><circle cx="6.2" cy="6.5" r="0.55" fill="currentColor"/><circle cx="8.6" cy="6.5" r="0.55" fill="currentColor"/>',
    cSwiftui: '<rect x="7" y="7" width="10" height="10" rx="2.2" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.2"/>',
    cCombine: '<path d="M4.5 6.5c4.8.2 5.9 4.3 7 5.5-1.1 1.2-2.2 5.3-7 5.5M11.5 12H19"/><path d="m16 8.8 3.2 3.2-3.2 3.2"/>',
    cNetwork: '<circle cx="12" cy="12" r="8.3"/><ellipse cx="12" cy="12" rx="3.6" ry="8.3"/><path d="M3.9 9.7h16.2M3.9 14.3h16.2"/>',
    cStorage: '<ellipse cx="12" cy="5.8" rx="7.3" ry="2.8"/><path d="M4.7 5.8V18c0 1.5 3.3 2.8 7.3 2.8s7.3-1.3 7.3-2.8V5.8M4.7 12c0 1.5 3.3 2.8 7.3 2.8s7.3-1.3 7.3-2.8"/>',
    cArch: '<rect x="9" y="3.5" width="6" height="4.5" rx="1.2"/><rect x="3" y="15.5" width="6" height="4.5" rx="1.2"/><rect x="15" y="15.5" width="6" height="4.5" rx="1.2"/><path d="M12 8v3.5M12 11.5H6v4M12 11.5h6v4"/>',
    cPerf: '<path d="M4.5 15.5a8 8 0 1 1 15 0"/><path d="M12 15.5 15.5 9"/><circle cx="12" cy="15.5" r="1.4"/>',
    cEng: '<path d="M12 3.2 19 5.7v4.9c0 4.8-3 8.6-7 10.2-4-1.6-7-5.4-7-10.2V5.7l7-2.5Z"/><path d="m8.7 11.8 2.2 2.2 4.2-4.4"/>',
    cAlgo: '<path d="m9 7.5-4.5 4.5L9 16.5M15 7.5l4.5 4.5-4.5 4.5M13.2 4.5l-2.4 15"/>',
    cStrategy: '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    cReview: '<path d="M4.5 4.5h15v11h-9l-4 3.6v-3.6h-2z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/>',
    cCustom: '<path d="M12 4.5v15M4.5 12h15"/><rect x="3" y="3" width="18" height="18" rx="4.5"/>',

    /* ---- v2 新增 ---- */
    pencil: '<path d="m4.5 19.5 4.4-1 9.4-9.4a2.1 2.1 0 0 0 0-3l-.9-.9a2.1 2.1 0 0 0-3 0L5 14.6l-.5 4.9Z"/><path d="m14.8 6.7 2.5 2.5"/>',
    note: '<path d="M6 3.5h9l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5Z"/><path d="M14.5 3.5V8h4.7M8 12.5h8M8 16h5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
    plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/><path d="m9 14 2 2 4-4"/>',
    cloudOff: '<path d="M6.8 18.5A4.3 4.3 0 0 1 6 10a6 6 0 0 1 .5-1.6M9.6 5.6A6 6 0 0 1 18 10.4a3.8 3.8 0 0 1 1.7 6.6"/><path d="m3.5 3.5 17 17"/>',
    bolt: '<path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5Z"/>',
    filter: '<path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 2v-7.4L4 5.5Z"/>',
  };

  const svg = (inner, vb) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  function icon(name) {
    const inner = P[name] || P.info;
    return svg(inner);
  }

  return { icon, P };
})();
