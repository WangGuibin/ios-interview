/* iOS 题宝库 · md.js:面试答案专用的轻量 Markdown 渲染
   支持:段落、**加粗**、`行内代码`、```代码块```、####/### 标题、
   - 无序列表(含两空格缩进子项)、1. 有序列表、GFM 表格、> 引用、--- 分隔线、[文字](链接)
   安全:先整体转义 HTML,再按语法切片,代码块走占位符。 */
'use strict';

window.MD = (() => {
  const PLACEHOLDER = '\u0001';

  function renderTable(rows) {
    const cells = (line) =>
      line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => inline(c.trim()));
    const head = cells(rows[0]);
    const body = rows.slice(2); // 第 2 行是分隔行
    let html = '<table><thead><tr>';
    head.forEach((h) => (html += `<th>${h}</th>`));
    html += '</tr></thead><tbody>';
    body.forEach((line) => {
      html += '<tr>';
      cells(line).forEach((c) => (html += `<td>${c}</td>`));
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  function renderLists(lines) {
    // 把连续的列表行组装成 ul/ol,支持 2 空格缩进的子项(平级加 .sub)
    let html = '';
    let open = null; // 'ul' | 'ol'
    const close = () => {
      if (open) {
        html += open === 'ul' ? '</ul>' : '</ol>';
        open = null;
      }
    };
    for (const line of lines) {
      let m = line.match(/^(\s*)-\s+(.*)$/);
      if (m) {
        if (open !== 'ul') {
          close();
          html += '<ul>';
          open = 'ul';
        }
        const sub = m[1].length >= 2 ? ' class="sub"' : '';
        html += `<li${sub}>${m[2]}</li>`;
        continue;
      }
      m = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (m) {
        if (open !== 'ol') {
          close();
          html += '<ol>';
          open = 'ol';
        }
        const sub = m[1].length >= 2 ? ' class="sub"' : '';
        html += `<li${sub}>${m[2]}</li>`;
        continue;
      }
      close();
      html += line; // 已包含块级标签或 <p>
    }
    close();
    return html;
  }

  function inline(s) {
    // 行内语法:代码、加粗、链接(在转义后的文本上执行)
    return s
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function render(src) {
    if (!src) return '';
    let text = esc(String(src).trim());

    // 1. 代码块占位
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      codeBlocks.push({ lang: lang || 'code', code: code.replace(/\n$/, '') });
      return `${PLACEHOLDER}${codeBlocks.length - 1}${PLACEHOLDER}`;
    });

    // 2. 逐行切块
    const blocks = [];
    const lines = text.split('\n');
    let para = [];
    let quote = [];
    let table = [];

    const flushPara = () => {
      if (para.length) {
        blocks.push(`<p>${inline(para.join('<br>'))}</p>`);
        para = [];
      }
    };
    const flushQuote = () => {
      if (quote.length) {
        blocks.push(`<blockquote>${inline(quote.join('<br>'))}</blockquote>`);
        quote = [];
      }
    };
    const flushTable = () => {
      if (table.length) {
        blocks.push(renderTable(table));
        table = [];
      }
    };

    for (const raw of lines) {
      const line = raw;
      const trimmed = line.trim();

      if (trimmed === '') {
        flushPara();
        flushQuote();
        flushTable();
        blocks.push('');
        continue;
      }
      if (trimmed.startsWith(PLACEHOLDER) && trimmed.endsWith(PLACEHOLDER)) {
        flushPara();
        flushQuote();
        flushTable();
        blocks.push(trimmed);
        continue;
      }
      if (/^\|.*\|?$/.test(trimmed) && (table.length || lines.length)) {
        // 表格行(前一行是表头或分隔行时持续收集)
        if (table.length || /^\|/.test(trimmed)) {
          flushPara();
          flushQuote();
          // 分隔行 |---|---| 直接收入,renderTable 跳过
          table.push(trimmed);
          continue;
        }
      }
      flushTable();
      if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
        flushPara();
        quote.push(trimmed.replace(/^(&gt;|>)\s?/, ''));
        continue;
      }
      flushQuote();
      const h4 = trimmed.match(/^####\s+(.*)$/);
      if (h4) {
        flushPara();
        blocks.push(`<h5>${inline(h4[1])}</h5>`);
        continue;
      }
      const h3 = trimmed.match(/^###\s+(.*)$/);
      if (h3) {
        flushPara();
        blocks.push(`<h4>${inline(h3[1])}</h4>`);
        continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        flushPara();
        blocks.push('<hr>');
        continue;
      }
      const isListLine = /^(\s*)(-|\d+\.)\s+/.test(line);
      para.push(isListLine ? line.trimEnd() : trimmed);
    }
    flushPara();
    flushQuote();
    flushTable();

    // 3. 列表组装(对连续的 <li> 片段无效,这里直接让 renderLists 处理原始行更稳)
    // 上面的逐行处理里列表行混在 para 中了,换个方式:回到行级,先切列表。
    return postProcess(blocks.join('\n'), codeBlocks);
  }

  /* 第二阶段:把 para triple 中含列表的段落拆开,替换占位符 */
  function postProcess(html, codeBlocks) {
    // 段落内若包含列表语法行,说明第一阶段的 para 合并把它们卷进来了;
    // 用行级重写:把 <p>...</p> 内含 "- " 或 "n. " 开头的行拆成列表。
    html = html.replace(/<p>([\s\S]*?)<\/p>/g, (m, inner) => {
      const parts = inner.split('<br>');
      const hasList = parts.some((p) => /^(\s*)(-|\d+\.)\s+/.test(p));
      if (!hasList) return m;
      let out = '';
      let buf = [];
      const flushBuf = () => {
        if (buf.length) {
          out += `<p>${buf.join('<br>')}</p>`;
          buf = [];
        }
      };
      let listBuf = [];
      const flushList = () => {
        if (listBuf.length) {
          out += renderLists(listBuf);
          listBuf = [];
        }
      };
      for (const p of parts) {
        if (/^(\s*)(-|\d+\.)\s+/.test(p)) {
          flushBuf();
          listBuf.push(p);
        } else {
          flushList();
          buf.push(p);
        }
      }
      flushBuf();
      flushList();
      return out;
    });

    // 还原代码块
    html = html.replace(new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'), (m, i) => {
      const b = codeBlocks[Number(i)];
      if (!b) return m;
      return `<pre><span class="c-lang">${esc(b.lang)}</span><code>${b.code}</code></pre>`;
    });

    // 清理空行块
    return html.replace(/\n{2,}/g, '\n');
  }

  return { render };
})();
