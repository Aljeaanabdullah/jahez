import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Lang } from "./i18n";
import { detailRows, recordLabels, type EmployeeRecord } from "./employee-record";

// PDF with correct Arabic: fontkit joins the letters, and each line is laid out
// right-to-left by splitting it into Arabic and Latin runs (each with its own font).
// IBM Plex Sans Arabic, SIL Open Font License (src/fonts/OFL.txt).

const fontPath = (name: string) => path.join(process.cwd(), "src", "fonts", `ibm-plex-sans-arabic-${name}-normal.ttf`);
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

type Fonts = { ar: PDFFont; arBold: PDFFont; la: PDFFont; laBold: PDFFont };
type Run = { text: string; arabic: boolean };

/**
 * Splits text into runs of Arabic words and non-Arabic words, in reading order.
 * Punctuation stuck to an Arabic word (":" "." "(" …) goes to the Latin font,
 * because the Arabic font file has no glyphs for it.
 */
export function toRuns(text: string): Run[] {
  const runs: (Run & { closed?: boolean })[] = [];
  const PUNCT = /^[:.,;!?()"'\-]+$/;
  const push = (piece: string, arabic: boolean, joinWithSpace: boolean, closed = false) => {
    const last = runs[runs.length - 1];
    if (last && !last.closed && !closed && last.arabic === arabic) last.text += joinWithSpace ? ` ${piece}` : piece;
    // Punctuation is its own run so it stays right next to the Arabic word it belongs to.
    else runs.push({ text: piece, arabic, closed });
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!ARABIC.test(word)) {
      push(word, false, true);
      continue;
    }
    word
      .split(/([:.,;!?()"'\-]+)/)
      .filter(Boolean)
      .forEach((piece, i) => (PUNCT.test(piece) ? push(piece, false, false, true) : push(piece, true, i === 0)));
  }
  return runs.map(({ text, arabic }) => ({ text, arabic }));
}

class Writer {
  page!: PDFPage;
  y = 0;
  readonly width = 595.28; // A4
  readonly height = 841.89;
  readonly margin = 40;

  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
    private rtl: boolean,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }

  ensure(space: number) {
    if (this.y - space < this.margin) this.newPage();
  }

  private font(run: Run, bold: boolean) {
    return run.arabic ? (bold ? this.fonts.arBold : this.fonts.ar) : bold ? this.fonts.laBold : this.fonts.la;
  }

  textWidth(text: string, size: number, bold = false) {
    const runs = toRuns(text);
    const gaps = Math.max(0, runs.length - 1) * this.fonts.la.widthOfTextAtSize(" ", size);
    return runs.reduce((w, r) => w + this.font(r, bold).widthOfTextAtSize(r.text, size), 0) + gaps;
  }

  /** Shortens text with "…" so it fits in maxWidth. */
  fit(text: string, size: number, maxWidth: number, bold = false) {
    if (this.textWidth(text, size, bold) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && this.textWidth(`${t}…`, size, bold) > maxWidth) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /** Draws one line inside [left, right]: from the right edge in Arabic, from the left in English. */
  line(text: string, left: number, right: number, y: number, size: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) {
    const bold = !!opts.bold;
    const color = rgb(...(opts.color ?? [0.04, 0.12, 0.23]));
    const space = this.fonts.la.widthOfTextAtSize(" ", size);
    const runs = toRuns(this.fit(text, size, right - left, bold));
    let x = this.rtl ? right : left;
    for (const run of runs) {
      const font = this.font(run, bold);
      const w = font.widthOfTextAtSize(run.text, size);
      const at = this.rtl ? x - w : x;
      this.page.drawText(run.text, { x: at, y, size, font, color });
      x = this.rtl ? at - space : at + w + space;
    }
  }

  heading(text: string, size: number) {
    this.ensure(size + 12);
    this.y -= size;
    this.line(text, this.margin, this.width - this.margin, this.y, size, { bold: true, color: [0.08, 0.4, 0.75] });
    this.y -= 10;
  }

  /** A simple table. Columns are given in reading order and mirrored for Arabic. */
  table(columns: { label: string; width: number }[], rows: string[][], emptyText: string, showHeader = true) {
    const size = 9;
    const rowH = 18;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    const scale = (this.width - 2 * this.margin) / totalW;
    const widths = columns.map((c) => c.width * scale);

    const cellBounds = (i: number) => {
      const before = widths.slice(0, i).reduce((s, w) => s + w, 0);
      if (this.rtl) {
        const right = this.width - this.margin - before;
        return [right - widths[i] + 4, right - 4] as const;
      }
      const left = this.margin + before;
      return [left + 4, left + widths[i] - 4] as const;
    };

    const drawHeader = () => {
      this.ensure(rowH * 2);
      this.page.drawRectangle({
        x: this.margin,
        y: this.y - rowH,
        width: this.width - 2 * this.margin,
        height: rowH,
        color: rgb(0.08, 0.4, 0.75),
      });
      columns.forEach((c, i) => {
        const [l, r] = cellBounds(i);
        this.line(c.label, l, r, this.y - rowH + 5, size, { bold: true, color: [1, 1, 1] });
      });
      this.y -= rowH;
    };

    if (showHeader) drawHeader();
    if (rows.length === 0) {
      this.y -= rowH;
      this.line(emptyText, this.margin + 4, this.width - this.margin - 4, this.y + 5, size, { color: [0.35, 0.42, 0.52] });
    }
    rows.forEach((row, ri) => {
      if (this.y - rowH < this.margin) {
        this.newPage();
        if (showHeader) drawHeader();
      }
      if (ri % 2 === 1) {
        this.page.drawRectangle({
          x: this.margin,
          y: this.y - rowH,
          width: this.width - 2 * this.margin,
          height: rowH,
          color: rgb(0.95, 0.97, 0.99),
        });
      }
      row.forEach((cell, i) => {
        const [l, r] = cellBounds(i);
        this.line(cell, l, r, this.y - rowH + 5, size);
      });
      this.y -= rowH;
    });
    this.y -= 16;
  }
}

export async function recordToPdf(record: EmployeeRecord, lang: Lang): Promise<Buffer> {
  const L = recordLabels(lang);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const embed = (name: string) => doc.embedFont(readFileSync(fontPath(name)), { subset: true });
  const fonts: Fonts = {
    ar: await embed("arabic-400"),
    arBold: await embed("arabic-700"),
    la: await embed("latin-400"),
    laBold: await embed("latin-700"),
  };
  doc.setTitle(`${L.title} ${record.employee.file_number}`);
  doc.setCreator("Jahez");

  const w = new Writer(doc, fonts, lang === "ar");
  const name = lang === "ar" ? record.employee.full_name_ar : record.employee.full_name_en;
  w.heading(`${L.title} — ${name} (${record.employee.file_number})`, 16);
  w.y -= 2;
  w.line(`${L.exportedAt}: ${record.exportedAt}`, w.margin, w.width - w.margin, w.y, 9, { color: [0.35, 0.42, 0.52] });
  w.y -= 18;

  w.heading(L.info, 12);
  w.table(
    [
      { label: "", width: 1 },
      { label: "", width: 2 },
    ],
    detailRows(record, lang),
    L.none,
    false,
  );

  w.heading(L.punches, 12);
  const pc = L.punchCols;
  w.table(
    [
      { label: pc.date, width: 1.2 },
      { label: pc.time, width: 0.8 },
      { label: pc.type, width: 0.8 },
      { label: pc.site, width: 2 },
      { label: pc.result, width: 1 },
      { label: pc.reason, width: 1.6 },
    ],
    record.punches.map((p) => [p.date, p.time, p.type, p.site, p.result, p.reason]),
    L.none,
  );

  w.heading(L.requests, 12);
  const rc = L.requestCols;
  w.table(
    [
      { label: rc.created, width: 1.1 },
      { label: rc.type, width: 1.3 },
      { label: rc.date, width: 1.1 },
      { label: rc.status, width: 1.4 },
      { label: rc.reason, width: 2.5 },
    ],
    record.requests.map((r) => [r.created, r.type, r.date, r.status, r.reason]),
    L.none,
  );

  return Buffer.from(await doc.save());
}
