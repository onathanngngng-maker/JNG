import type { PDFPageProxy } from "pdfjs-dist";
import { questionNumbersInText } from "@/lib/pageLayout";
import { figureBoxesFromPixels, type TextBox } from "@/lib/pdfFigures";
import type { ExtractedDocument, PageLayout } from "@/lib/types";

export async function extractFileText(file: File): Promise<string> {
  const extracted = await extractDocument(file);
  return extracted.text;
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    const text = await file.text();
    return {
      text,
      pages: [{ page: 1, questionNumbers: questionNumbersInText(text), images: [] }],
    };
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfDocument(file);
  }

  throw new Error(
    `Cannot extract text from ${file.name}. Use a .txt file, or paste the text into the box below.`,
  );
}

async function extractPdfDocument(file: File): Promise<ExtractedDocument> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageLayouts: PageLayout[] = [];
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const text = await pageText(page);
      const figures = await pageFigures(page);
      pageTexts.push(`--- PAGE ${i} ---\n${text}`);
      pageLayouts.push({
        page: i,
        questionNumbers: questionNumbersInText(text),
        images: figures.map((figure) => figure.src),
        imageAnchors: figures.map((figure) => figure.anchor),
      });
    }

    const text = pageTexts.join("\n\n").trim();
    if (!text.replace(/--- PAGE \d+ ---/g, "").trim()) {
      throw new Error("No selectable text in this PDF. Paste the text manually (scanned papers need OCR).");
    }
    return { text, pages: pageLayouts };
  } catch (error) {
    if (error instanceof Error && error.message.includes("selectable")) throw error;
    throw new Error(
      "PDF extraction is limited. Paste the past paper / solution text into the textarea, or upload a .txt file.",
    );
  }
}

type Glyph = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

async function pageText(page: {
  getTextContent: () => Promise<{ items: unknown[] }>;
}): Promise<string> {
  const content = await page.getTextContent();
  const glyphs: Glyph[] = [];
  for (const item of content.items) {
    if (!isTextItem(item) || !item.str) continue;
    glyphs.push({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: glyphHeight(item),
    });
  }
  glyphs.sort((a, b) => (Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x));

  const lines: Glyph[][] = [];
  let current: Glyph[] = [];
  let lineY: number | null = null;
  let lineHeight = 10;

  for (const glyph of glyphs) {
    const script =
      lineY !== null && glyph.height < lineHeight * 0.88 && Math.abs(glyph.y - lineY) < lineHeight * 1.05;
    if (lineY === null || script || Math.abs(glyph.y - lineY) <= Math.max(3, lineHeight * 0.32)) {
      current.push(glyph);
      if (!script) {
        lineY = glyph.y;
        lineHeight = Math.max(lineHeight, glyph.height);
      }
    } else {
      if (current.length) lines.push(current);
      current = [glyph];
      lineY = glyph.y;
      lineHeight = glyph.height || 10;
    }
  }
  if (current.length) lines.push(current);
  return lines
    .map(formatLine)
    .filter((line) => !/^Page\s+\d+\s+of\s+\d+$/i.test(line))
    .join("\n");
}

function glyphHeight(item: { transform: number[]; height: number }): number {
  return Math.max(item.height || 0, Math.hypot(item.transform[2] || 0, item.transform[3] || 0), 1);
}

function formatLine(glyphs: Glyph[]): string {
  const sorted = [...glyphs].sort((a, b) => a.x - b.x);
  const body = median(sorted.map((glyph) => glyph.height)) || 10;
  let out = "";
  let prev: Glyph | null = null;
  for (const glyph of sorted) {
    const token = glyph.str;
    if (!prev) {
      out = token;
      prev = glyph;
      continue;
    }
    const raised = glyph.y > prev.y + body * 0.12 && glyph.height < body * 0.88;
    const lowered = glyph.y < prev.y - body * 0.1 && glyph.height < body * 0.88;
    if (raised) {
      out += `^{${token}}`;
    } else if (lowered) {
      out += `_{${token}}`;
    } else {
      const gap = glyph.x - (prev.x + prev.width);
      if (gap > Math.max(1.1, body * 0.12)) out += " ";
      out += token;
    }
    prev = glyph;
  }
  return out.replace(/\s+/g, " ").replace(/\s([.,;:)])/g, "$1").trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function isTextItem(item: unknown): item is { str: string; transform: number[]; width: number; height: number } {
  return Boolean(item && typeof item === "object" && "str" in item && "transform" in item);
}

async function pageFigures(page: PDFPageProxy): Promise<Array<{ src: string; anchor: string }>> {
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const textPromise = page.getTextContent();
  await page.render({ canvas, viewport, recordImages: true }).promise;
  const text = await textPromise;
  const width = canvas.width;
  const height = canvas.height;
  const raster = rasterBoxes(page.imageCoordinates, width, height);
  const drawings = figureBoxesFromPixels(
    ctx.getImageData(0, 0, width, height).data,
    width,
    height,
    textBoxes(text.items, viewport),
  ).filter((box) => !raster.some((image) => overlapRatio(box, image) > 0.45));
  const lines = textLines(text.items, viewport);

  return [...raster, ...drawings]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 6)
    .map((box) => {
      const src = cropBox(canvas, box);
      return src ? { src, anchor: anchorAbove(box, lines) } : null;
    })
    .filter((figure): figure is { src: string; anchor: string } => Boolean(figure));
}

function textLines(
  items: unknown[],
  viewport: { scale: number; convertToViewportPoint: (x: number, y: number) => number[] },
): Array<{ text: string; bottom: number }> {
  const glyphs: Array<{ text: string; x: number; bottom: number }> = [];
  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    glyphs.push({ text: item.str, x, bottom: y + 3 });
  }
  glyphs.sort((a, b) => (Math.abs(a.bottom - b.bottom) > 4 ? a.bottom - b.bottom : a.x - b.x));
  const lines: Array<{ text: string; bottom: number }> = [];
  for (const glyph of glyphs) {
    const current = lines[lines.length - 1];
    if (!current || Math.abs(current.bottom - glyph.bottom) > 4) {
      lines.push({ text: glyph.text, bottom: glyph.bottom });
    } else {
      current.text = `${current.text} ${glyph.text}`.replace(/\s+/g, " ").trim();
    }
  }
  return lines;
}

/** Part label, such as (d), of the line sitting just above the figure. */
function anchorAbove(
  box: { y: number },
  lines: Array<{ text: string; bottom: number }>,
): string {
  const above = lines.filter((line) => line.bottom <= box.y + 14);
  const closest = above[above.length - 1];
  const previous = above[above.length - 2];
  if (!closest) return "";
  const part = (line: string) => line.match(/^\(([a-z])\)/i)?.[1];
  if (closest.text.trim().length < 40 && previous && part(previous.text)) {
    return `(${part(previous.text)!.toLowerCase()})`;
  }
  const own = part(closest.text);
  if (own) return `(${own.toLowerCase()})`;
  return closest.text.trim().slice(0, 80);
}

function rasterBoxes(coords: ArrayLike<number> | null | undefined, width: number, height: number) {
  if (!coords?.length) return [];
  const boxes = [];
  for (let i = 0; i + 5 < coords.length; i += 6) {
    const points = [
      [coords[i] * width, coords[i + 1] * height],
      [coords[i + 2] * width, coords[i + 3] * height],
      [coords[i + 4] * width, coords[i + 5] * height],
    ];
    points.push([
      points[1][0] + points[2][0] - points[0][0],
      points[1][1] + points[2][1] - points[0][1],
    ]);
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    if (w < 36 || h < 36) continue;
    if (w > width * 0.92 && h > height * 0.85) continue;
    boxes.push({ x, y, w, h });
  }
  return boxes;
}

function overlapRatio(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  return intersection / Math.min(a.w * a.h, b.w * b.h);
}

function cropBox(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
): string | null {
  const pad = 4;
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const w = Math.min(canvas.width - x, Math.ceil(box.w + pad * 2));
  const h = Math.min(canvas.height - y, Math.ceil(box.h + pad * 2));
  if (w < 8 || h < 8) return null;
  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  const cropCtx = crop.getContext("2d");
  if (!cropCtx) return null;
  cropCtx.fillStyle = "#ffffff";
  cropCtx.fillRect(0, 0, w, h);
  cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return crop.toDataURL("image/png");
}

function textBoxes(
  items: unknown[],
  viewport: { scale: number; convertToViewportPoint: (x: number, y: number) => number[] },
): TextBox[] {
  const boxes: TextBox[] = [];
  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const height = Math.max(item.height || 0, Math.hypot(item.transform[2] || 0, item.transform[3] || 0)) * viewport.scale;
    const width = item.width * viewport.scale;
    boxes.push({
      left: x - 2,
      top: y - height - 2,
      right: x + width + 2,
      bottom: y + 3,
    });
  }
  return boxes;
}
