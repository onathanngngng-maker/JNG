function protectDelimitedMath(text: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const hold = (match: string) => {
    const token = `\u0000M${slots.length}\u0000`;
    slots.push(match);
    return token;
  };
  let saved = text;
  saved = saved.replace(/\\\[[\s\S]+?\\\]/g, hold);
  saved = saved.replace(/\\\([\s\S]+?\\\)/g, hold);
  saved = saved.replace(/\$\$[\s\S]+?\$\$/g, hold);
  saved = saved.replace(/\$[^$\n]+?\$/g, hold);
  return { text: saved, slots };
}

function restoreDelimitedMath(text: string, slots: string[]): string {
  return text.replace(/\u0000M(\d+)\u0000/g, (_, index: string) => slots[Number(index)] ?? "");
}

/** Fix split exponents, nested delimiters, and leaked TeX so units render like the original paper. */
export function tidyGeneratedMath(text: string): string {
  const protectedMath = protectDelimitedMath(text.replace(/\r\n/g, "\n"));
  let s = protectedMath.text;
  s = s.replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "");
  s = repairVisibleNotation(s);

  s = s.replace(/emitted\.\s*7\s*\n?\s*7\s*/gi, "emitted. ");
  s = s.replace(/\n\s*7\s*\n\s*7\s*\n/g, "\n");
  s = s.replace(/\s*in_\{2\}/g, " ");
  s = s.replace(/\s*direction\._\{-1\}/g, " direction");
  s = s.replace(/I_\{2\}\s*\^\{p\}/g, "I_{p}");
  s = s.replace(/[μµ]_\{-1\}\^\{1\}/g, "\\mu_{1}");
  s = s.replace(/\(\s*IO\s*\)/g, "(I_{0})");
  s = s.replace(/\bIt1\b/g, "I_{t1}");
  s = s.replace(/\bIt2\b/g, "I_{t2}");
  s = s.replace(/\bI0\b/g, "I_{0}");
  s = s.replace(/\bIt\b(?=\s+in\s+terms)/g, "I_{t}");

  s = s.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\\times\s*10\s*\^\{?(\d+)\}?/g,
    "$1\\times 10^{$2}",
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\s*10(?!\s*[\^\{])\s*(?:m\s*s\s*(?:\^\{?-1\}?|⁻¹)|m\s*\/\s*s|\\mathrm\{m\\,s\^\{-1\}\}|\\mathrm\{m\/s\})/g,
    "$1\\times 10^{7}\\,\\mathrm{m/s}",
  );
  s = s.replace(/\\mathrm\{m\\,s\^\{-1\}\}/g, "\\mathrm{m/s}");
  s = s.replace(/\\mathrm\{W\\,cm\^\{-2\}\}/g, "\\mathrm{W/cm^{2}}");
  s = s.replace(/W\s*\/\s*cm(?:\^\{?\s*-?2\s*\}?|2)?(?![²⁻])/g, "W/cm²");

  s = flattenNestedMath(s);
  s = wrapLooseSymbols(s);
  s = flattenNestedMath(s);
  s = repairVisibleNotation(s);
  return restoreDelimitedMath(s, protectedMath.slots);
}

const SUPERSCRIPT: Record<string, string> = {
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

const SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  P: "ₚ",
  s: "ₛ",
  t: "ₜ",
  T: "ₜ",
  x: "ₓ",
};

function toMarks(value: string, table: Record<string, string>): string {
  return [...value].map((char) => table[char] || char).join("");
}

/** Turn leftover TeX carets and underscores into the superscripts and subscripts used on the original paper. */
function repairVisibleNotation(text: string): string {
  let s = text.replace(/(\^\{?\s*|10)[−–]/g, (match) => match.replace(/[−–]/, "-"));
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(?:\\times|[x×])\s*10(?:\^\{(-?\d+)\}|\^(-?\d+)|-(\d+)|(\d{1,2})(?!\d))/g,
    (
      _,
      coefficient: string,
      braced: string | undefined,
      caret: string | undefined,
      minusExp: string | undefined,
      plainExp: string | undefined,
    ) => {
      const exponent = braced ?? caret ?? (minusExp != null ? `-${minusExp}` : plainExp || "");
      return `${coefficient} × 10${toMarks(exponent, SUPERSCRIPT)}`;
    },
  );
  s = s.replace(/m\s*\*\s*s\s*(?:\^\{?\s*-1\s*\}?|-1)/g, "m s⁻¹");
  s = s.replace(/m\s*s\s*(?:\^\{?\s*-1\s*\}?|-1)/g, "m s⁻¹");
  s = s.replace(/\^\{?\s*1\/2\s*\}?/g, "½");
  s = s.replace(/v\^\{?\s*2\s*\}?/g, "v²");
  s = s.replace(/\^(?:\{(\d+)\}|(\d+))/g, (_, braced: string | undefined, plain: string | undefined) =>
    toMarks(braced || plain || "", SUPERSCRIPT),
  );
  s = s.replace(/W\/cm(?:\^\{?\s*-?2\s*\}?|2)?(?![²⁻])/g, "W/cm²");
  s = s.replace(/\\,?\s*\\mathrm\{cm\^\{-1\}\}/g, " cm⁻¹");
  s = s.replace(/cm\^\{?\s*-1\s*\}?/g, "cm⁻¹");
  s = s.replace(/cm-1\b/g, "cm⁻¹");
  s = s.replace(/cm\^\{?\s*2\s*\}?\s*\/\s*g/g, "cm²/g");
  s = s.replace(/cm2\/g/g, "cm²/g");
  s = s.replace(/\\mu_\{([^}]+)\}/g, (_, sub: string) => `μ${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/\\mu_([0-9A-Za-z]+)/g, (_, sub: string) => `μ${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/[μµ]_\{([^}]+)\}/g, (_, sub: string) => `μ${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/[μµ]_([0-9A-Za-z]+)/g, (_, sub: string) => `μ${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/I_\{([^}]+)\}/g, (_, sub: string) => `I${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/(?<![A-Za-z\\])I_([A-Za-z0-9]+)/g, (_, sub: string) => `I${toMarks(sub, SUBSCRIPT)}`);
  s = s.replace(/Δ\s*Ip([0-9])/g, (_, digit: string) => `ΔIₚ${toMarks(digit, SUBSCRIPT)}`);
  s = s.replace(/Δ\s*I([0-9])/g, (_, digit: string) => `ΔI${toMarks(digit, SUBSCRIPT)}`);
  return s;
}

function flattenNestedMath(text: string): string {
  let s = text.replace(/\\\(\s*\\\(/g, "\\(").replace(/\\\)\s*\\\)/g, "\\)");
  s = s.replace(/\\Delta\s*\\\(\s*I_\{([^}]+)\}\s*\\\)/g, "\\(\\Delta I_{$1}\\)");
  s = s.replace(/\\\(\s*([^()]*?)\\\(\s*(\\mathrm\{[^}]+\})\s*\\\)\s*\\\)/g, "\\($1$2\\)");
  return s;
}

function wrapLooseSymbols(text: string): string {
  const patterns = [
    /\d+(?:\.\d+)?\\times 10\^\{-?\d+\}(?:\\,\\mathrm\{(?:[^{}]|\{[^{}]*\})*\})?/g,
    /\\mathrm\{(?:[^{}]|\{[^{}]*\})*\}/g,
    /\\Delta\s*I_\{[^}]+\}/g,
    /\\mu_\{[^}]+\}/g,
    /I_\{[^}]+\}/g,
  ];

  let out = text;
  for (const pattern of patterns) {
    out = out.replace(pattern, (match, offset: number) => {
      if (insideMath(out, offset)) return match;
      return `\\(${match}\\)`;
    });
  }
  return out;
}

function insideMath(text: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i += 1) {
    if (text.startsWith("\\(", i)) {
      depth += 1;
      i += 1;
    } else if (text.startsWith("\\)", i)) {
      depth = Math.max(0, depth - 1);
      i += 1;
    } else if (text[i] === "$" && text[i + 1] !== "$") {
      depth = depth ? depth - 1 : depth + 1;
    }
  }
  return depth > 0;
}
