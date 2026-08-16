/**
 * PDF WRITER
 * ==========
 * A minimal PDF 1.4 generator — no dependencies, no print dialogue.
 *
 * Uses the base-14 Helvetica faces, which every reader has built in, so no font
 * embedding is required. Text is written in WinAnsiEncoding; the characters the
 * app actually uses beyond ASCII (– — · ° ² ₂ etc.) are mapped explicitly.
 *
 * Supports: paged flow with automatic breaks, wrapped text, tables with
 * repeating headers and wrapped cells, and simple vector charts.
 */

/* ---------- Helvetica metrics (AFM, /1000 em) ---------- */

const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

/** Unicode the UI uses -> WinAnsi byte. Anything else degrades to ASCII. */
const WINANSI = {
  '\u2013': 0x96, '\u2014': 0x97, '\u2018': 0x91, '\u2019': 0x92,
  '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2026': 0x85,
  '\u00b7': 0xb7, '\u00b0': 0xb0, '\u00b2': 0xb2, '\u00b3': 0xb3,
  '\u00bd': 0xbd, '\u00e9': 0xe9, '\u00fc': 0xfc, '\u00f6': 0xf6,
  '\u2192': 0x3e, '\u2264': 0x3c, '\u2265': 0x3e, '\u00d7': 0xd7,
  '\u2082': 0x32, '\u00a0': 0x20, '\u2032': 0x27, '\u2033': 0x22,
};

function toWinAnsi(str) {
  let out = '';
  for (const ch of String(str ?? '')) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) out += ch;
    else if (WINANSI[ch] !== undefined) out += String.fromCharCode(WINANSI[ch]);
    // Pass 0x80-0xFF straight through. This keeps the function idempotent:
    // textWidth() and pdfEsc() both convert, and a second pass over an already
    // mapped byte (em dash -> 0x97) must not degrade it to '?'.
    else if (c >= 128 && c <= 255) out += ch;
    else if (c === 10 || c === 9) out += ' ';
    else out += '?';
  }
  return out;
}

const pdfEsc = (s) => toWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Width of `text` at `size`, in points. */
export function textWidth(text, size, bold = false) {
  const t = toWinAnsi(text);
  const tab = bold ? W_BOLD : W_REG;
  let w = 0;
  for (let i = 0; i < t.length; i += 1) {
    const c = t.charCodeAt(i);
    w += (c >= 32 && c <= 126) ? tab[c - 32] : 556;
  }
  return (w / 1000) * size;
}

/* ---------- document ---------- */

const A4 = { w: 595.28, h: 841.89 };

export class Pdf {
  constructor({ margin = 40, size = A4, title = '', author = '' } = {}) {
    this.size = size;
    this.m = margin;
    this.title = title;
    this.author = author;
    this.pages = [];
    this.ops = null;
    this.y = 0;
    this.pageNo = 0;
    this.onNewPage = null;
    this.addPage();
  }

  get width() { return this.size.w - this.m * 2; }
  get bottom() { return this.m + 28; }   // leaves room for the footer

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.pageNo = this.pages.length;
    this.y = this.size.h - this.m;
    if (this.onNewPage) this.onNewPage(this);
    return this;
  }

  /** Break to a new page when `need` points will not fit. */
  ensure(need) {
    if (this.y - need < this.bottom) { this.addPage(); return true; }
    return false;
  }

  /* ---- primitives ---- */

  rgb(c) {
    // '#rrggbb' -> normalised triple
    const h = c.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }

  rect(x, y, w, h, color, { stroke = false, lw = 0.6 } = {}) {
    const [r, g, b] = this.rgb(color);
    if (stroke) {
      this.ops.push(`${r} ${g} ${b} RG ${lw} w ${x} ${y} ${w} ${h} re S`);
    } else {
      this.ops.push(`${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f`);
    }
    return this;
  }

  line(x1, y1, x2, y2, color = '#cccccc', lw = 0.6) {
    const [r, g, b] = this.rgb(color);
    this.ops.push(`${r} ${g} ${b} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S`);
    return this;
  }

  text(str, x, y, { size = 10, bold = false, color = '#111111', align = 'l', width = 0 } = {}) {
    const [r, g, b] = this.rgb(color);
    let tx = x;
    if (align !== 'l' && width) {
      const w = textWidth(str, size, bold);
      tx = align === 'r' ? x + width - w : x + (width - w) / 2;
    }
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${tx} ${y} Tm (${pdfEsc(str)}) Tj ET`);
    return this;
  }

  /** Greedy wrap; breaks over-long words so nothing escapes its column. */
  wrap(str, maxW, size, bold = false) {
    const words = toWinAnsi(str).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let cur = '';
    const push = () => { if (cur) { lines.push(cur); cur = ''; } };

    words.forEach((word) => {
      let w = word;
      // A single word wider than the column is split by character.
      while (textWidth(w, size, bold) > maxW) {
        let cut = 1;
        while (cut < w.length && textWidth(w.slice(0, cut + 1), size, bold) <= maxW) cut += 1;
        if (cur) push();
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const probe = cur ? `${cur} ${w}` : w;
      if (textWidth(probe, size, bold) <= maxW) cur = probe;
      else { push(); cur = w; }
    });
    push();
    return lines.length ? lines : [''];
  }

  paragraph(str, { size = 10, bold = false, color = '#333333', lead = 1.35, gap = 0, x = null, width = null } = {}) {
    const px = x ?? this.m;
    const pw = width ?? this.width;
    const lines = this.wrap(str, pw, size, bold);
    lines.forEach((ln) => {
      this.ensure(size * lead);
      this.y -= size * lead;
      this.text(ln, px, this.y, { size, bold, color });
    });
    this.y -= gap;
    return this;
  }

  /* ---- table ---- */

  /**
   * Render a table with wrapped cells and a header that repeats on each page.
   * Column widths are proportional to measured content, then clamped to fit.
   */
  table(columns, rows, {
    size = 7.6, headSize = 7.2, pad = 4, rowGap = 3,
    head = '#00693b', headBg = '#eaf7f0', zebra = '#f7f9f8',
    ink = '#242c2e', rule = '#e2e8e6',
  } = {}) {
    const n = columns.length;
    const avail = this.width;

    // Natural width = widest of header/sample cells, capped so one verbose
    // column cannot starve the rest.
    const sample = rows.slice(0, 120);
    const natural = columns.map((c, i) => {
      const cells = sample.map((r) => textWidth(String(r[i] ?? ''), size));
      return Math.max(textWidth(String(c), headSize, true), ...(cells.length ? cells : [0])) + pad * 2;
    });

    const total = natural.reduce((a, b) => a + b, 0);
    let widths;
    if (total <= avail) {
      // Distribute the slack proportionally so the table fills the text block.
      widths = natural.map((w) => w + (avail - total) * (w / total));
    } else {
      // Over budget: shrink the widest columns first, protecting narrow ones.
      // The floor is generous enough that identifier columns (first column) keep
      // most of their content on one line rather than fragmenting.
      const floor = Math.min(58, avail / n);
      widths = natural.slice();
      let over = total - avail;
      for (let guard = 0; guard < 40 && over > 0.5; guard += 1) {
        const shrinkable = widths.map((w, i) => (w > floor ? i : -1)).filter((i) => i >= 0);
        if (!shrinkable.length) break;
        const pool = shrinkable.reduce((a, i) => a + (widths[i] - floor), 0);
        if (pool <= 0) break;
        const take = Math.min(over, pool);
        shrinkable.forEach((i) => { widths[i] -= take * ((widths[i] - floor) / pool); });
        over = widths.reduce((a, b) => a + b, 0) - avail;
      }
    }

    const xs = [];
    let acc = this.m;
    widths.forEach((w) => { xs.push(acc); acc += w; });

    const drawHead = () => {
      const h = headSize + pad * 1.6;
      this.ensure(h + 14);
      this.rect(this.m, this.y - h + headSize * 0.28, avail, h, headBg);
      columns.forEach((c, i) => {
        const lines = this.wrap(String(c), widths[i] - pad * 2, headSize, true);
        this.text(lines[0] + (lines.length > 1 ? '' : ''), xs[i] + pad, this.y - headSize * 0.55,
          { size: headSize, bold: true, color: head });
      });
      this.y -= h;
      this.line(this.m, this.y + headSize * 0.28, this.m + avail, this.y + headSize * 0.28, head, 0.8);
    };

    drawHead();

    rows.forEach((row, ri) => {
      const cellLines = row.map((c, i) => this.wrap(String(c ?? ''), widths[i] - pad * 2, size));
      const lineCount = Math.max(...cellLines.map((l) => l.length));
      const rowH = lineCount * size * 1.28 + rowGap;

      if (this.y - rowH < this.bottom) { this.addPage(); drawHead(); }

      if (ri % 2 === 1) this.rect(this.m, this.y - rowH + size * 0.3, avail, rowH, zebra);

      cellLines.forEach((lines, i) => {
        lines.forEach((ln, li) => {
          this.text(ln, xs[i] + pad, this.y - size * 0.72 - li * size * 1.28,
            { size, color: ink, bold: i === 0 });
        });
      });

      this.y -= rowH;
      this.line(this.m, this.y + size * 0.3, this.m + avail, this.y + size * 0.3, rule, 0.4);
    });

    return this;
  }

  /* ---- charts ---- */

  /**
   * Horizontal bar chart — the shape that suits ranked scores and counts.
   * @param {Array<{label,value,color?}>} data
   */
  barChart(data, { height = null, barH = 11, gap = 6, max = null, valueFmt = (v) => String(v),
    labelW = 104, color = '#00b85e' } = {}) {
    if (!data.length) return this;
    const rows = data.length;
    const h = height || rows * (barH + gap) + 8;
    this.ensure(h + 10);

    const top = this.y;
    const peak = max ?? Math.max(...data.map((d) => d.value), 1);
    const trackX = this.m + labelW;
    const trackW = this.width - labelW - 46;

    data.forEach((d, i) => {
      const y = top - 8 - i * (barH + gap) - barH;
      const w = Math.max(1.2, (d.value / peak) * trackW);
      this.text(String(d.label), this.m, y + barH * 0.28, { size: 7.4, color: '#3d4a4d' });
      this.rect(trackX, y, trackW, barH, '#eef2f1');
      this.rect(trackX, y, w, barH, d.color || color);
      this.text(valueFmt(d.value), trackX + trackW + 6, y + barH * 0.28, { size: 7.4, bold: true, color: '#242c2e' });
    });

    this.y = top - h;
    return this;
  }

  /** Donut-style share ring rendered as stacked segments of a horizontal bar. */
  stackChart(segments, { height = 13, label = true } = {}) {
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    this.ensure(height + (label ? 22 : 6));
    const y = this.y - height;
    let x = this.m;
    segments.forEach((s) => {
      const w = (s.value / total) * this.width;
      if (w > 0.4) this.rect(x, y, w, height, s.color);
      x += w;
    });
    this.y = y - 4;

    if (label) {
      let lx = this.m;
      this.y -= 10;
      segments.forEach((s) => {
        if (!s.value) return;
        const t = `${s.label} ${s.value}`;
        const w = textWidth(t, 7.2) + 16;
        if (lx + w > this.m + this.width) return;
        this.rect(lx, this.y - 0.5, 6, 6, s.color);
        this.text(t, lx + 9, this.y, { size: 7.2, color: '#3d4a4d' });
        lx += w;
      });
      this.y -= 8;
    }
    return this;
  }

  /* ---- output ---- */

  /** Serialise to PDF bytes. */
  build() {
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };  // 1-based

    const fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const pagesId = objs.length + 1 + this.pages.length * 2;

    const kids = [];
    this.pages.forEach((ops) => {
      const stream = ops.join('\n');
      const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.size.w} ${this.size.h}] `
        + `/Resources << /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
      kids.push(pageId);
    });

    add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
    const infoId = add(`<< /Title (${pdfEsc(this.title)}) /Author (${pdfEsc(this.author)}) `
      + `/Creator (Nigeria Mineral Intelligence) /Producer (NMI PDF writer) >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`
      + `startxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
