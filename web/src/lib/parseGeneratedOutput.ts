import { tidyGeneratedMath } from "@/lib/tidyMath";
import type { ParsedOutput } from "@/lib/types";

const PAPER_ALIASES = ["GENERATED PAST PAPER", "PAST PAPER", "GENERATED PAPER"];
const SOLUTION_ALIASES = [
  "GENERATED SUGGESTED SOLUTION",
  "SUGGESTED SOLUTION",
  "GENERATED SOLUTION",
  "WORKED SOLUTION",
];
const SCHEME_ALIASES = ["GENERATED MARKING SCHEME", "MARKING SCHEME", "MARK SCHEME"];

function headingPattern(alias: string): RegExp {
  const body = alias.replace(/\s+/g, "\\s+");
  return new RegExp(`^[#>*\\s-]*\\*{0,2}${body}\\*{0,2}\\s*:?\\s*$`, "im");
}

function headingIndex(raw: string, aliases: string[]): number {
  for (const alias of aliases) {
    const match = headingPattern(alias).exec(raw);
    if (match && match.index != null) return match.index;
  }
  for (const alias of aliases) {
    const loose = new RegExp(`\\*{0,2}${alias.replace(/\s+/g, "\\s+")}\\*{0,2}\\s*:`, "i");
    const match = loose.exec(raw);
    if (match && match.index != null) return match.index;
  }
  return -1;
}

function headingLength(raw: string, start: number): number {
  const lineEnd = raw.indexOf("\n", start);
  return (lineEnd < 0 ? raw.length : lineEnd) - start;
}

function sliceSection(raw: string, aliases: string[], nextAliasGroups: string[][]): string {
  const start = headingIndex(raw, aliases);
  if (start < 0) return "";
  const after = start + headingLength(raw, start);
  let end = raw.length;
  for (const group of nextAliasGroups) {
    const next = headingIndex(raw.slice(after), group);
    if (next >= 0 && after + next < end) end = after + next;
  }
  return raw.slice(after, end).trim();
}

const SECTION_HEADING =
  /^(?:[#>*\s-]*\*{0,2})(?:generated\s+)?(?:past\s+paper|suggested\s+solution|worked\s+solution|generated\s+solution|marking\s+scheme|mark\s+scheme|generated\s+paper)\*{0,2}\s*:?\s*$/i;

const CODE_LINE =
  /^\s*(?:import |from |def |class |print\(|return |#|\/\/|sympy|numpy|np\.|math\.|for |while |if __name__)/;

function toSuperscript(digits: string): string {
  const marks: Record<string, string> = {
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
  return digits
    .split("")
    .map((digit) => marks[digit] || digit)
    .join("");
}

export function asExamWorking(text: string): string {
  const withoutFences = text.replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1");
  const cleaned = withoutFences
    .split("\n")
    .filter((line) => !CODE_LINE.test(line))
    .join("\n")
    .replace(/(?<=[\w)])\*\*\{?(-?\d+)\}?/g, (_, digits: string) => toSuperscript(digits))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length < 40 && text.trim().length >= 40) return text.trim();
  return cleaned;
}

export function substantiveText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !SECTION_HEADING.test(line.trim()))
    .join("\n")
    .replace(/\[FIGURE FROM ORIGINAL PAGE \d+\]/gi, "")
    .replace(/^\s*---\s*PAGE\s+\d+\s*---\s*$/gim, "")
    .trim();
}

export function parseGeneratedOutput(raw: string): ParsedOutput {
  const text = raw.trim();
  const foundPaperHeading = headingIndex(text, PAPER_ALIASES) >= 0;
  let pastPaper = tidyGeneratedMath(sliceSection(text, PAPER_ALIASES, [SOLUTION_ALIASES, SCHEME_ALIASES]));
  const suggestedSolution = sliceSection(text, SOLUTION_ALIASES, [SCHEME_ALIASES]);
  const markingScheme = tidyGeneratedMath(sliceSection(text, SCHEME_ALIASES, []));
  if (!pastPaper && !foundPaperHeading && text) pastPaper = tidyGeneratedMath(text);
  return {
    pastPaper,
    suggestedSolution,
    markingScheme,
    raw: text,
  };
}
