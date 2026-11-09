import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

async function waitForImages(node: HTMLElement) {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try {
        await img.decode();
      } catch {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
    }),
  );
}

const CAPTURE_FONT = "Georgia, 'Times New Roman', Times, serif";

function paintLikeScreen(src: HTMLElement, dest: HTMLElement, isRoot = false) {
  if (!isRoot && (src.classList.contains("katex") || src.classList.contains("exam-math"))) return;
  const style = getComputedStyle(src);
  // The page font is a variable webfont. The PDF redraw measures it differently from
  // the screen, so words overlap and spaces disappear. A system font keeps both in step.
  dest.style.fontFamily = CAPTURE_FONT;
  dest.style.fontSize = style.fontSize;
  dest.style.fontWeight = style.fontWeight;
  dest.style.lineHeight = style.lineHeight;
  dest.style.letterSpacing = "0px";
  dest.style.wordSpacing = "0px";
  dest.style.setProperty("font-kerning", "none");
  dest.style.setProperty("font-variant-ligatures", "none");
  dest.style.color = style.color;
  dest.style.textAlign = style.textAlign === "justify" ? "left" : style.textAlign;
  dest.style.whiteSpace = "normal";
  dest.style.hyphens = "manual";

  const block = isRoot || (style.display !== "inline" && style.display !== "contents");
  if (block) {
    dest.style.boxSizing = "border-box";
    dest.style.display = style.display;
    dest.style.flexDirection = style.flexDirection;
    dest.style.flex = style.flex;
    dest.style.alignItems = style.alignItems;
    dest.style.justifyContent = style.justifyContent;
    dest.style.marginTop = style.marginTop;
    dest.style.marginRight = style.marginRight;
    dest.style.marginBottom = style.marginBottom;
    dest.style.marginLeft = style.marginLeft;
    dest.style.paddingTop = style.paddingTop;
    dest.style.paddingRight = style.paddingRight;
    dest.style.paddingBottom = style.paddingBottom;
    dest.style.paddingLeft = style.paddingLeft;
    if (style.backgroundColor !== "rgba(0, 0, 0, 0)") dest.style.backgroundColor = style.backgroundColor;
    if (style.borderBottomWidth !== "0px") {
      dest.style.borderBottom = `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`;
    }
  }
  if (isRoot) {
    dest.style.width = `${src.offsetWidth}px`;
    dest.style.height = `${src.offsetHeight}px`;
    dest.style.overflow = "hidden";
    dest.style.backgroundColor = "#ffffff";
  }
  if (src.tagName === "IMG") {
    dest.style.display = "block";
    dest.style.width = style.width;
    dest.style.maxWidth = style.maxWidth;
    dest.style.height = "auto";
    dest.style.objectFit = "contain";
  }

  const srcChildren = [...src.children];
  const destChildren = [...dest.children];
  srcChildren.forEach((child, index) => {
    const copy = destChildren[index];
    if (child instanceof HTMLElement && copy instanceof HTMLElement) paintLikeScreen(child, copy);
  });
}

async function capturePage(node: HTMLElement) {
  await waitForImages(node);
  if (document.fonts?.ready) await document.fonts.ready;
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: node.offsetWidth,
    height: node.offsetHeight,
    windowWidth: node.offsetWidth,
    onclone: (_doc, element) => {
      paintLikeScreen(node, element, true);
    },
  });
}

export async function downloadPdfFromPages(filename: string, pageNodes: HTMLElement[]) {
  if (!pageNodes.length) {
    throw new Error("Nothing on the page to export.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  for (let i = 0; i < pageNodes.length; i += 1) {
    if (i > 0) doc.addPage("a4", "portrait");
    const canvas = await capturePage(pageNodes[i]);
    const imageRatio = canvas.width / canvas.height;
    const pageRatio = A4_WIDTH_MM / A4_HEIGHT_MM;
    let drawWidth = A4_WIDTH_MM;
    let drawHeight = A4_HEIGHT_MM;
    if (imageRatio > pageRatio) {
      drawHeight = A4_WIDTH_MM / imageRatio;
    } else {
      drawWidth = A4_HEIGHT_MM * imageRatio;
    }
    const x = (A4_WIDTH_MM - drawWidth) / 2;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", x, 0, drawWidth, drawHeight);
  }

  const safe = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(safe);
}

export async function downloadPreviewPdf(filename: string, root: HTMLElement | null) {
  if (!root) throw new Error("The preview is not ready yet.");
  const pages = [...root.querySelectorAll<HTMLElement>(".pdf-page")];
  await downloadPdfFromPages(filename, pages.length ? pages : [root]);
}
