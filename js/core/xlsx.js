/**
 * XLSX WRITER
 * ===========
 * Produces a genuine Office Open XML workbook — a ZIP container of XML parts —
 * with no third-party library.
 *
 * The previous implementation emitted SpreadsheetML 2003 under an .xls
 * extension. Modern Excel treats that as a format/extension mismatch and warns
 * the file is corrupt, so this writes the real thing instead.
 *
 * ZIP entries are STORED (no compression). Deflate is optional in the spec and
 * every reader accepts stored entries, which keeps this dependency-free.
 */

const enc = new TextEncoder();

/* ------------------------------------------------------------------ *
 * ZIP
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS date/time stamp for the ZIP directory. */
function dosStamp(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * Build a ZIP archive from `[{ name, data:Uint8Array }]`.
 * @returns {Uint8Array}
 */
function zip(files) {
  const { time, date } = dosStamp();
  const chunks = [];
  const central = [];
  let offset = 0;

  files.forEach((f) => {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);      // version needed
    lv.setUint16(6, 0, true);       // flags
    lv.setUint16(8, 0, true);       // method: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);   // compressed
    lv.setUint32(22, size, true);   // uncompressed
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, f.data);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);      // version made by
    cv.setUint16(6, 20, true);      // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);      // extra
    cv.setUint16(32, 0, true);      // comment
    cv.setUint16(34, 0, true);      // disk
    cv.setUint16(36, 0, true);      // internal attrs
    cv.setUint32(38, 0, true);      // external attrs
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);

    offset += local.length + size;
  });

  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const total = all.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  all.forEach((c) => { out.set(c, p); p += c.length; });
  return out;
}

/* ------------------------------------------------------------------ *
 * Workbook
 * ------------------------------------------------------------------ */

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  // Control characters are illegal in XML and will corrupt the part.
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

/** 0 -> A, 25 -> Z, 26 -> AA */
function colName(i) {
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

const NUMERIC = /^-?[\d,]*\.?\d+%?$/;

/** Excel sheet names: 31 chars, no []:*?/\ and must be unique. */
function sheetName(raw, used) {
  let base = String(raw).replace(/[\\/?*[\]:]/g, '-').slice(0, 31).trim() || 'Sheet';
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function sheetXml(section) {
  const rows = [];
  let r = 1;

  const row = (cells, style) => {
    const xml = cells.map((c, i) => {
      const ref = `${colName(i)}${r}`;
      const s = style ? ` s="${style}"` : '';
      const raw = c ?? '';
      // Strip formatting so Excel receives a real number it can total and chart.
      const plain = String(raw).replace(/,/g, '').replace(/%$/, '');
      if (raw !== '' && NUMERIC.test(String(raw)) && Number.isFinite(Number(plain))) {
        return `<c r="${ref}"${s}><v>${Number(plain)}</v></c>`;
      }
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(raw)}</t></is></c>`;
    }).join('');
    rows.push(`<row r="${r}">${xml}</row>`);
    r += 1;
  };

  row([section.title], 2);
  if (section.subtitle) row([section.subtitle], 3);
  row([]);
  row(section.columns, 1);
  section.rows.forEach((x) => row(x));
  if (section.notes) { row([]); row([section.notes], 3); }

  // Width the columns to their content so nothing shows as ####.
  const widths = section.columns.map((c, i) => {
    const longest = Math.max(
      String(c).length,
      ...section.rows.slice(0, 200).map((x) => String(x[i] ?? '').length),
    );
    return Math.min(60, Math.max(9, longest + 2));
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
<autoFilter ref="A4:${colName(Math.max(0, section.columns.length - 1))}${4 + section.rows.length}"/>
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF04120B"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><color rgb="FF00693B"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF6B7A7D"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF9BF2C4"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF00693B"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

/**
 * Build a .xlsx workbook: one worksheet per report section.
 * @returns {Uint8Array} raw bytes ready for a Blob download
 */
export function buildXlsx(sections, meta = {}) {
  const used = new Set();
  const sheets = sections.map((s, i) => ({
    name: sheetName(`${i + 1}. ${s.title}`, used),
    xml: sheetXml(s),
  }));

  const parts = [
    { name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>` },

    { name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>` },

    { name: 'docProps/core.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(meta.title || 'NMI report')}</dc:title>
<dc:creator>${esc(meta.author || 'Nigeria Mineral Intelligence')}</dc:creator>
<cp:lastModifiedBy>${esc(meta.author || 'Nigeria Mineral Intelligence')}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>` },

    { name: 'docProps/app.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Nigeria Mineral Intelligence</Application>
</Properties>` },

    { name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>` },

    { name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },

    { name: 'xl/styles.xml', data: STYLES },

    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml })),
  ];

  return zip(parts.map((p) => ({ name: p.name, data: enc.encode(p.data) })));
}
