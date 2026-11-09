import { questionNumbersInText, splitByPageMarkers, splitQuestions } from "@/lib/pageLayout";
import type { ParsedOutput } from "@/lib/types";

const ELEMENT_NAMES = [
  "hydrogen",
  "helium",
  "lithium",
  "beryllium",
  "boron",
  "carbon",
  "nitrogen",
  "oxygen",
  "fluorine",
  "neon",
  "sodium",
  "magnesium",
  "aluminium",
  "aluminum",
  "silicon",
  "phosphorus",
  "phosphorous",
  "sulfur",
  "sulphur",
  "chlorine",
  "argon",
  "potassium",
  "calcium",
  "iron",
  "copper",
  "zinc",
  "bromine",
  "silver",
  "iodine",
  "gold",
  "lead",
  "palladium",
  "lutetium",
  "uranium",
  "plutonium",
  "cobalt",
  "nickel",
  "tungsten",
  "molybdenum",
];

const ELEMENT_CANONICAL: Record<string, string> = {
  phosphorous: "Phosphorus",
  phosphorus: "Phosphorus",
  sulphur: "Sulphur",
  sulfur: "Sulphur",
  aluminium: "Aluminium",
  aluminum: "Aluminium",
};

const SPECIMEN_WORDS = ["tumor", "tumour", "bone", "muscle", "nucleus"];

export type FigureLock = {
  page: number;
  questionNumbers: number[];
  identities: string[];
  excerpt: string;
};

const FIGURE_CUE = /figure|diagram|shown in the following|the path below|in the figure below/i;

export function figureLocksFromPaper(
  pastPaperText: string,
  pageLayout: Array<{ page: number; questionNumbers: number[]; figureCount?: number }>,
): FigureLock[] {
  const pageBodies = splitByPageMarkers(pastPaperText);
  const pages = pageLayout.length
    ? pageLayout
    : pageBodies.map((body, index) => ({
        page: index + 1,
        questionNumbers: questionNumbersInText(body),
        figureCount: 0,
      }));

  return pages
    .map((page) => {
      const excerpt = (pageBodies[page.page - 1] || "").trim();
      const hasFigure = (page.figureCount || 0) > 0 || FIGURE_CUE.test(excerpt);
      if (!hasFigure) return null;
      return {
        page: page.page,
        questionNumbers: page.questionNumbers,
        identities: identitiesIn(excerpt),
        excerpt: excerpt.slice(0, 1200),
      };
    })
    .filter((lock): lock is FigureLock => Boolean(lock) && (lock.identities.length > 0 || lock.excerpt.length > 0));
}

export function figureLockPromptBlock(locks: FigureLock[]): string {
  if (!locks.length) return "";
  const lines = locks.map((lock) => {
    const qs = lock.questionNumbers.length ? `question ${lock.questionNumbers.join(", ")} only` : `page ${lock.page} only`;
    const names = lock.identities.length
      ? lock.identities.join(", ")
      : "the labels drawn on the figure";
    return `${qs} keep ${names}. Change numbers that are not printed on the figure, such as L and D when the drawing shows only those letters.`;
  });
  return `FIGURE LOCKS (that question only): ${lines.join(" ")}`;
}

export function noFigurePromptBlock(
  pastPaperText: string,
  pageLayout: Array<{ page: number; questionNumbers: number[]; figureCount?: number }>,
): string {
  const lockedPages = new Set(figureLocksFromPaper(pastPaperText, pageLayout).map((lock) => lock.page));
  const pageBodies = splitByPageMarkers(pastPaperText);
  const pages = pageLayout.length
    ? pageLayout
    : pageBodies.map((body, index) => ({
        page: index + 1,
        questionNumbers: questionNumbersInText(body),
        figureCount: 0,
      }));
  const labels = pages
    .filter((page) => (page.figureCount || 0) === 0 && !lockedPages.has(page.page))
    .map((page) => (page.questionNumbers.length ? `question ${page.questionNumbers.join(", ")}` : `page ${page.page}`));
  if (!labels.length) return "";
  return `NO FIGURE (change the named object and the calculation numbers): ${labels.join("; ")}.`;
}

export function figureLocksBroken(output: ParsedOutput, locks: FigureLock[]): FigureLock[] {
  if (!locks.length) return [];
  return locks.filter((lock) => {
    const elements = lock.identities.filter(isChemicalElement);
    if (!elements.length || !lock.questionNumbers.length) return false;
    const paper = questionBodies(output.pastPaper, lock.questionNumbers);
    if (!paper.trim()) return false;
    const solution = questionBodies(output.suggestedSolution, lock.questionNumbers);
    return elements.some(
      (identity) => !containsIdentity(paper, identity) || (solution.trim() && !containsIdentity(solution, identity)),
    );
  });
}

export function repairFigureLocksLocally(output: ParsedOutput, broken: FigureLock[]): ParsedOutput {
  let pastPaper = output.pastPaper;
  let suggestedSolution = output.suggestedSolution;
  let markingScheme = output.markingScheme;

  for (const lock of broken) {
    for (const identity of lock.identities.filter(isChemicalElement)) {
      const swap =
        misplacedElement(questionBodies(pastPaper, lock.questionNumbers), identity) ||
        misplacedElement(questionBodies(suggestedSolution, lock.questionNumbers), identity);
      if (!swap || !isChemicalElement(swap)) continue;
      pastPaper = replaceInQuestions(pastPaper, lock.questionNumbers, swap, identity);
      suggestedSolution = replaceInQuestions(suggestedSolution, lock.questionNumbers, swap, identity);
      markingScheme = replaceInQuestions(markingScheme, lock.questionNumbers, swap, identity);
    }
  }

  return { ...output, pastPaper, suggestedSolution, markingScheme };
}

function identitiesIn(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const name of ELEMENT_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) {
      const canonical = ELEMENT_CANONICAL[name] || titleCase(name);
      if (!found.includes(canonical)) found.push(canonical);
    }
  }
  for (const word of SPECIMEN_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      const canonical = titleCase(word);
      if (!found.includes(canonical)) found.push(canonical);
    }
  }
  return found;
}

function questionBodies(text: string, questionNumbers: number[]): string {
  if (!questionNumbers.length) return "";
  const parts = splitQuestions(text);
  return parts
    .filter((part) => questionNumbers.includes(part.number))
    .map((part) => part.body)
    .join("\n");
}

function replaceInQuestions(text: string, questionNumbers: number[], from: string, to: string): string {
  if (!questionNumbers.length) return text;
  let next = text;
  for (const part of splitQuestions(text)) {
    if (!questionNumbers.includes(part.number)) continue;
    const updated = replaceIdentity(part.body, from, to);
    if (updated !== part.body) next = next.replace(part.body, updated);
  }
  return next;
}

function isChemicalElement(identity: string): boolean {
  const lower = identity.toLowerCase();
  return ELEMENT_NAMES.some((name) => name === lower || (ELEMENT_CANONICAL[name] || titleCase(name)) === identity);
}

function containsIdentity(text: string, identity: string): boolean {
  const aliases = [identity];
  if (identity === "Phosphorus") aliases.push("Phosphorous");
  if (identity === "Sulphur") aliases.push("Sulfur");
  if (identity === "Aluminium") aliases.push("Aluminum");
  if (identity === "Tumor") aliases.push("Tumour");
  return aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(text));
}

function misplacedElement(text: string, locked: string): string | null {
  const canonLocked = ELEMENT_CANONICAL[locked.toLowerCase()] || locked;
  for (const name of ELEMENT_NAMES) {
    const canon = ELEMENT_CANONICAL[name] || titleCase(name);
    if (canon === canonLocked) continue;
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) return canon;
  }
  return null;
}

function replaceIdentity(text: string, from: string, to: string): string {
  const fromAliases = aliasesFor(from);
  const pattern = new RegExp(`\\b(${fromAliases.join("|")})\\b`, "gi");
  return text.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? to : to.toLowerCase()));
}

function aliasesFor(identity: string): string[] {
  if (identity === "Phosphorus") return ["Phosphorus", "Phosphorous"];
  if (identity === "Sulphur") return ["Sulphur", "Sulfur"];
  if (identity === "Aluminium") return ["Aluminium", "Aluminum"];
  if (identity === "Tumor") return ["Tumor", "Tumour"];
  return [identity];
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
