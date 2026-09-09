import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { GeneratedPlan, Phase } from "./types";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.07, 0.13, 0.23); // #12213A
const MUTED = rgb(0.44, 0.46, 0.54); // #70758A
const VIOLET = rgb(0.46, 0.35, 0.96); // #7658F6

const PHASE_TITLES: Record<Phase, string> = {
  foundation: "Этап 1. Фундамент",
  traffic: "Этап 2. Привлечение трафика",
  retention: "Этап 3. Удержание и повторные продажи",
};

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
}

function newPage(cursor: Pick<Cursor, "doc" | "regular" | "bold">): Cursor {
  const page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { ...cursor, page, y: PAGE_HEIGHT - MARGIN };
}

function ensureSpace(cursor: Cursor, needed: number): Cursor {
  if (cursor.y - needed < MARGIN) {
    return newPage(cursor);
  }
  return cursor;
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) {
      current = attempt;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** В используемом шрифте нет глифа ₽ — заменяем на текстовый аналог, чтобы не рисовать пустой квадрат */
function sanitizeForPdf(text: string): string {
  return text.replace(/₽/g, "руб.");
}

function drawParagraph(
  cursor: Cursor,
  rawText: string,
  opts: { font?: PDFFont; size?: number; color?: RGB; lineGap?: number; indent?: number; gapAfter?: number }
): Cursor {
  const text = sanitizeForPdf(rawText);
  const font = opts.font ?? cursor.regular;
  const size = opts.size ?? 11;
  const color = opts.color ?? INK;
  const lineGap = opts.lineGap ?? size * 1.45;
  const indent = opts.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;

  let c = cursor;
  const lines = wrapLines(text, font, size, maxWidth);
  for (const line of lines) {
    c = ensureSpace(c, lineGap);
    c.page.drawText(line, { x: MARGIN + indent, y: c.y - size, size, font, color });
    c = { ...c, y: c.y - lineGap };
  }
  return { ...c, y: c.y - (opts.gapAfter ?? 0) };
}

export async function generatePlanPdf(
  businessName: string,
  plan: GeneratedPlan,
  includeRetention: boolean
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontsDir = path.join(process.cwd(), "lib", "fonts");
  const regular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "NotoSans-Regular.ttf")));
  const bold = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "NotoSans-Bold.ttf")));

  let cursor = newPage({ doc, regular, bold });

  cursor = drawParagraph(cursor, "Ключевое слово — план продвижения", {
    font: regular,
    size: 10,
    color: MUTED,
    gapAfter: 6,
  });
  cursor = drawParagraph(cursor, businessName, { font: bold, size: 20, color: INK, gapAfter: 14 });
  cursor = drawParagraph(cursor, plan.summary, { font: regular, size: 11.5, color: INK, gapAfter: 22 });

  const phases: { phase: Phase; entries: typeof plan.foundation }[] = [
    { phase: "foundation", entries: plan.foundation },
    { phase: "traffic", entries: plan.traffic },
  ];
  if (includeRetention) phases.push({ phase: "retention", entries: plan.retention });

  for (const { phase, entries } of phases) {
    if (entries.length === 0) continue;

    cursor = ensureSpace(cursor, 40);
    cursor = drawParagraph(cursor, PHASE_TITLES[phase], { font: bold, size: 15, color: INK, gapAfter: 4 });

    entries.forEach((entry, i) => {
      cursor = ensureSpace(cursor, 30);
      cursor = drawParagraph(cursor, `${i + 1}. ${entry.module.title}`, {
        font: bold,
        size: 12.5,
        color: INK,
        gapAfter: 2,
      });
      cursor = drawParagraph(cursor, entry.module.timeToResult, {
        font: regular,
        size: 9.5,
        color: MUTED,
        gapAfter: 6,
      });
      cursor = drawParagraph(cursor, entry.reason, {
        font: regular,
        size: 10.5,
        color: INK,
        indent: 14,
        gapAfter: 6,
      });
      for (const step of entry.module.steps) {
        cursor = drawParagraph(cursor, `→  ${step}`, {
          font: regular,
          size: 10.5,
          color: INK,
          indent: 14,
          gapAfter: 3,
        });
      }
      cursor = { ...cursor, y: cursor.y - 10 };
    });

    cursor = { ...cursor, y: cursor.y - 8 };
  }

  if (!includeRetention) {
    cursor = ensureSpace(cursor, 40);
    cursor = drawParagraph(
      cursor,
      "Этап 3 «Удержание и повторные продажи» доступен на тарифах «Бизнес» и «Команда».",
      { font: regular, size: 10, color: VIOLET, gapAfter: 0 }
    );
  }

  return doc.save();
}
