import katex from "katex";
import { splitSolutionHeading } from "@/lib/pageLayout";
import { tidyGeneratedMath } from "@/lib/tidyMath";

function renderLatex(source: string, display: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode: display,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return source;
  }
}

function wrapMath(html: string): string {
  return `<span class="exam-math">${html}</span>`;
}

const NEW_LINE = /^(?:[-•*]|\d+\.|[a-z]\.|solution|submit|phy\d|---|\[FIGURE)/i;

function flowParagraphs(text: string): string {
  const blocks: string[] = [];
  let current = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      if (current) blocks.push(current);
      current = "";
      continue;
    }
    if (!current || NEW_LINE.test(line)) {
      if (current) blocks.push(current);
      current = line;
    } else {
      current = `${current} ${line}`;
    }
  }
  if (current) blocks.push(current);
  return blocks.join("\n\n");
}

export function latexToHtml(text: string, flow = false): string {
  const slots: string[] = [];
  const hold = (tex: string, display: boolean) => {
    const i = slots.length;
    slots.push(wrapMath(renderLatex(tex.trim(), display)));
    return `%%MATH${i}%%`;
  };

  let out = tidyGeneratedMath(text);
  if (flow) out = flowParagraphs(out);
  out = out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, src) => hold(src, true));
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, src) => hold(src, true));
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_, src) => hold(src, false));
  out = out.replace(/\$([^$\n]+?)\$/g, (_, src) => hold(src, false));
  if (flow) {
    const paragraphs = out
      .split(/\n{2,}/)
      .map((part) => part.replace(/\n+/g, " ").trim())
      .filter(Boolean);
    out = paragraphs
      .map((part) => {
        const centered = /^(?:phy\d|submit via)/i.test(part);
        return `<p${centered ? ` class="exam-center"` : ""}>${part}</p>`;
      })
      .join("");
  } else {
    out = out.replace(/\n/g, "<br/>");
  }
  out = out.replace(/%%MATH(\d+)%%/g, (_, index) => slots[Number(index)] || "");
  return out;
}

const QUESTION_BOUNDARY = /(?=(?:^|<p[^>]*>|<br\s*\/?>)\s*\d{1,2}\.\s+[A-Za-z])/g;

/** Split a page into one .question-block per question (1., 2., 3.…). */
export function questionBlockHtml(inner: string): string {
  const parts = inner.split(QUESTION_BOUNDARY);
  if (parts.length <= 1) {
    const trimmed = inner.trim();
    return trimmed ? `<div class="question-block">${trimmed}</div>` : "";
  }
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      const isQuestion = /^(?:<p[^>]*>|<br\s*\/?>)?\s*\d{1,2}\.\s+[A-Za-z]/.test(trimmed);
      return isQuestion ? `<div class="question-block">${trimmed}</div>` : trimmed;
    })
    .join("");
}

/** Put a figure inside the question it belongs to, not after the page. */
export function injectFigureIntoQuestion(html: string, img: string, questionNumber?: number): string {
  const marker = /\[FIGURE FROM ORIGINAL PAGE \d+\]/i;
  const blocks = [...html.matchAll(/<div class="question-block">[\s\S]*?<\/div>/g)];
  const targetIndex = (() => {
    if (!questionNumber || !blocks.length) return blocks.length - 1;
    const found = blocks.findIndex((block) =>
      new RegExp(`(^|>|\\s)${questionNumber}\\.\\s+[A-Za-z]`).test(block[0]),
    );
    return found >= 0 ? found : blocks.length - 1;
  })();

  if (marker.test(html)) {
    const inside = blocks.find((block) => marker.test(block[0]));
    if (inside && inside.index != null) {
      const updated = inside[0].replace(marker, img);
      return html.slice(0, inside.index) + updated + html.slice(inside.index + inside[0].length);
    }
    return injectFigureIntoQuestion(html.replace(marker, ""), img, questionNumber);
  }

  if (targetIndex < 0 || !blocks[targetIndex] || blocks[targetIndex].index == null) {
    return `${html}${img}`;
  }
  const block = blocks[targetIndex];
  const start = block.index ?? 0;
  const updated = block[0].replace(/<\/div>$/, `${img}</div>`);
  return html.slice(0, start) + updated + html.slice(start + block[0].length);
}

const SOLUTION_BANNER =
  /^\s*(?:#{1,6}\s*)?(?:---\s*)?page\s+\d+\s*(?:of\s+\d+\s*)?(?:[·•|–—-]\s*questions?\s+[\d,\sand]+)?\s*(?:---)?\s*$/i;

const FROM_SUPER: Record<string, string> = {
  "⁻": "-",
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

const FROM_SUB: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scriptsFromUnicode(text: string): string {
  return text
    .replace(/½/g, "\\frac{1}{2}")
    .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => `^{${[...run].map((char) => FROM_SUPER[char] || char).join("")}}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (run) => `_{${[...run].map((char) => FROM_SUB[char] || char).join("")}}`);
}

/** Turn a plain equation line into KaTeX source. */
export function plainToLatex(input: string): string {
  let s = scriptsFromUnicode(input.trim());
  const command = (name: string) => (_match: string, offset: number, full: string) =>
    /[A-Za-z]/.test(full[offset + _match.length] || "") ? `\\${name}{}` : `\\${name}`;
  s = s.replace(/θ/g, command("theta"));
  s = s.replace(/μ|µ/g, command("mu"));
  s = s.replace(/Δ/g, command("Delta"));
  s = s.replace(/π/g, command("pi"));
  s = s.replace(/°/g, "^{\\circ}");
  s = s.replace(/≤/g, "\\leq");
  s = s.replace(/≥/g, "\\geq");
  s = s.replace(/×|✕/g, "\\times");
  s = s.replace(/e\s*\^\s*\(([^)]+)\)/gi, (_, inner: string) => `e^{${inner}}`);
  s = s.replace(/\^\(([^)]+)\)/g, "^{$1}");
  s = s.replace(/\^(-?\d+)/g, "^{$1}");
  s = s.replace(/\bIt1\b/g, "I_{t1}");
  s = s.replace(/\bIt2\b/g, "I_{t2}");
  s = s.replace(/\bIp1\b/g, "I_{p1}");
  s = s.replace(/\bIp2\b/g, "I_{p2}");
  s = s.replace(/\bI0\b/g, "I_{0}");
  s = s.replace(/\\Delta\s*I(\d+)/g, "\\Delta I_{$1}");
  s = s.replace(/(?<![A-Za-z0-9\\{])([A-Za-z])(\d+)\b/g, "$1_{$2}");
  s = s.replace(/_([A-Za-z0-9]+)/g, "_{$1}");
  s = s.replace(/(\d|[A-Za-z)}])\s*\*\s*(?=[\dA-Za-z(\\])/g, "$1 \\times ");
  s = s.replace(/(\d|[A-Za-z)}])\s+x\s+(?=[\dA-Za-z(\\])/gi, "$1 \\times ");
  s = s.replace(/\b(and|or|where|with)\b/g, "\\mathrm{$1}");
  s = s.replace(/\batan\b/g, "\\arctan");
  s = s.replace(/\basin\b/g, "\\arcsin");
  s = s.replace(/\bacos\b/g, "\\arccos");
  s = s.replace(/\bln\b/g, "\\ln");
  s = s.replace(/\blog\b/g, "\\log");
  s = s.replace(/\bsin\b/g, "\\sin");
  s = s.replace(/\bcos\b/g, "\\cos");
  s = s.replace(/\btan\b/g, "\\tan");

  const units: [RegExp, string][] = [
    [/W\/cm(?:\^\{?2\}?|²|\^\{2\})/g, "\\mathrm{W/cm^{2}}"],
    [/m\/s(?:\^\{?2\}?|²)/g, "\\mathrm{m/s^{2}}"],
    [/cm(?:\^\{?-1\}?|\^\{-1\}|⁻¹)/g, "\\mathrm{cm^{-1}}"],
    [/cm(?:\^\{?2\}?|²)\/g/g, "\\mathrm{cm^{2}/g}"],
    [/Gy\/s/g, "\\mathrm{Gy/s}"],
    [/keV/g, "\\mathrm{keV}"],
    [/MeV/g, "\\mathrm{MeV}"],
    [/m\/s/g, "\\mathrm{m/s}"],
    [/\bGy\b/g, "\\mathrm{Gy}"],
    [/\bcm\b/g, "\\mathrm{cm}"],
    [/\bmm\b/g, "\\mathrm{mm}"],
    [/\bkg\b/g, "\\mathrm{kg}"],
    [/\beV\b/g, "\\mathrm{eV}"],
    [/\bBq\b/g, "\\mathrm{Bq}"],
    [/\bJ\b/g, "\\mathrm{J}"],
    [/(?<![A-Za-z])C\b/g, "\\mathrm{C}"],
    [/(?<![A-Za-z\\])g\b/g, "\\mathrm{g}"],
  ];
  const slots: string[] = [];
  for (const [pattern, latex] of units) {
    s = s.replace(pattern, () => {
      const token = `§${slots.length}§`;
      slots.push(latex);
      return token;
    });
  }
  s = s.replace(/\(([A-Za-z0-9.]+)\/([A-Za-z0-9.]+)\)/g, "(\\frac{$1}{$2})");
  s = s.replace(/(?<![A-Za-z0-9.\\])([A-Za-z])\/([A-Za-z])(?![A-Za-z0-9])/g, "\\frac{$1}{$2}");
  s = s.replace(/(?<![A-Za-z0-9.\\])(\d+)\/(\d+)(?![A-Za-z0-9])/g, "\\frac{$1}{$2}");
  s = s.replace(/§(\d+)§/g, (_, index: string) => slots[Number(index)] ?? "");
  const equalsAt = s.indexOf("=");
  if (equalsAt > 0) {
    const left = s.slice(0, equalsAt).trim();
    if (/^[A-Za-z][A-Za-z\s]*$/.test(left) && left.replace(/\s/g, "").length > 1) {
      s = `\\mathrm{${left}} ${s.slice(equalsAt)}`;
    }
  }
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

function isMathy(text: string): boolean {
  return /[=^]/.test(text) || /e\s*\^\s*\(/i.test(text) || /10\s*[⁻^]/.test(text);
}

function isEquationLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (/^solution\s+\d+\s*:?\s*$/i.test(text)) return false;
  if (/^\[FIGURE FROM ORIGINAL PAGE \d+\]$/i.test(text)) return false;
  if (/^\d{1,2}\.\s+[A-Za-z]/.test(text)) return false;
  if (!isMathy(text)) return false;
  const longWords = text.split(/\s+/).filter((word) => /^[A-Za-z]{5,}$/.test(word.replace(/[^A-Za-z]/g, "")));
  if (longWords.length >= 8 && (text.match(/=/g) || []).length <= 1 && !/e\s*\^\s*\(/i.test(text)) return false;
  return true;
}

const INLINE_SNIPPET =
  /e\s*\^\s*\([^)\n]+\)|(?:(?:\d+(?:\.\d+)?)|(?:[A-Za-z]))\s*\^\s*(?:\([^)\n]+\)|-?\d+)|(?:\d+(?:\.\d+)?)\s*[x×]\s*10\s*(?:\^\{?-?\d+\}?|[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi;

function promoteInlineExponents(line: string): string {
  if (/\\\(|\\\[|\$/.test(line)) return line;
  return line.replace(INLINE_SNIPPET, (match) => `\\(${plainToLatex(match)}\\)`);
}

function renderProse(line: string): string {
  return latexToHtml(promoteInlineExponents(line), false);
}

function mathSpan(source: string, original: string): string {
  try {
    const html = katex.renderToString(source, {
      displayMode: true,
      throwOnError: true,
      output: "html",
    });
    return `<span class="exam-math math">${html}</span>`;
  } catch {
    return `<p>${escapeHtml(original)}</p>`;
  }
}

function displayMath(equation: string): string {
  const wrapped = equation.trim().match(/^(?:\\\[|\\\()([\s\S]+)(?:\\\]|\\\))$/);
  if (wrapped) return mathSpan(wrapped[1].trim(), equation);
  if (/\\\(|\\\[|\\[a-zA-Z]+/.test(equation)) {
    const html = latexToHtml(equation, false);
    if (html.includes("katex")) return `<span class="exam-math math">${html}</span>`;
  }
  return mathSpan(plainToLatex(equation), equation);
}

function prepareSolutionMath(line: string): string {
  let source = line.replace(/\\mathrm\{([^}\\]*?)\\\]/g, "\\mathrm{$1}\\]");
  const opened = (source.match(/\\\[/g) || []).length;
  const closed = (source.match(/\\\]/g) || []).length;
  if (opened > closed) source += "\\]".repeat(opened - closed);
  return source;
}

/** Keep words inside a math block as text, so KaTeX does not delete the spaces. */
function wrapProseInText(src: string): string {
  const repaired = src.replace(/\\mathrm\{([^}]*)$/g, "\\mathrm{$1}");
  return repaired.replace(
    /\\[a-zA-Z]+\{[^}]*\}|\\[a-zA-Z]+|(?<![\\A-Za-z])([A-Za-z]{2,}(?:\s+[A-Za-z]+)*)/g,
    (match, words: string | undefined) => (words ? `\\text{${words}}` : match),
  );
}

function inlineFormula(src: string): string {
  const prepared = wrapProseInText(src.trim());
  try {
    return `<span class="exam-math">${katex.renderToString(prepared, {
      displayMode: false,
      throwOnError: true,
      output: "html",
    })}</span>`;
  } catch {
    return escapeHtml(src);
  }
}

const PLAIN_SUPER: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function plainWorkingHtml(text: string): string {
  const slots: string[] = [];
  let saved = text.replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, (match) => {
    const token = `\u0000${slots.length}\u0000`;
    slots.push(match);
    return token;
  });
  saved = saved.replace(/e\s*\^\s*\(([^)\n]+)\)/gi, (_, inner: string) => `\\(e^{${inner}}\\)`);
  saved = saved.replace(/\^(-?\d+)/g, (_, digits: string) =>
    [...digits].map((digit) => PLAIN_SUPER[digit] || digit).join(""),
  );
  return saved.replace(/\u0000(\d+)\u0000/g, (_, index: string) => slots[Number(index)] ?? "");
}

function renderSolutionInline(line: string): string {
  const source = plainWorkingHtml(prepareSolutionMath(line));
  const re = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let html = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    if (match.index > last) html += escapeHtml(source.slice(last, match.index));
    html += inlineFormula(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
    last = match.index + match[0].length;
  }
  if (last < source.length) html += escapeHtml(source.slice(last));
  return html || escapeHtml(line);
}

function solutionHeader(number: number): string {
  return `<p class="solution-header">Solution ${number}:</p>`;
}

/** One solution-block. The heading is always the template Solution n:. */
export function renderSolutionPage(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let open = false;
  let hasHeader = false;
  const close = () => {
    if (!open) return;
    html += "</div>";
    open = false;
    hasHeader = false;
  };
  const ensure = () => {
    if (open) return;
    html += '<div class="solution-block">';
    open = true;
  };

  for (const raw of lines) {
    const text = raw.trim();
    if (!text || SOLUTION_BANNER.test(text) || /^---\s*page\s+\d+\s*---$/i.test(text)) continue;
    const heading = splitSolutionHeading(text);
    if (heading) {
      if (hasHeader) close();
      ensure();
      html += solutionHeader(heading.number);
      hasHeader = true;
      if (heading.rest) html += `<p>${renderSolutionInline(heading.rest)}</p>`;
      continue;
    }
    ensure();
    if (/^\[FIGURE FROM ORIGINAL PAGE \d+\]$/i.test(text)) {
      html += text;
      continue;
    }
    html += `<p>${renderSolutionInline(text)}</p>`;
  }
  close();
  return html;
}

/** Put a figure inside the solution block, not after the page. */
export function injectFigureIntoSolution(html: string, img: string): string {
  const marker = /\[FIGURE FROM ORIGINAL PAGE \d+\]/i;
  if (marker.test(html)) return html.replace(marker, img);
  const blocks = [...html.matchAll(/<div class="solution-block">[\s\S]*?<\/div>/g)];
  const block = blocks[blocks.length - 1];
  if (!block || block.index == null) return `${html}${img}`;
  const start = block.index;
  const updated = block[0].replace(/<\/div>$/, `${img}</div>`);
  return html.slice(0, start) + updated + html.slice(start + block[0].length);
}
