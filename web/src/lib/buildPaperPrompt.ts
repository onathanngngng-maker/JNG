import { figureLockPromptBlock, figureLocksFromPaper, noFigurePromptBlock } from "@/lib/figureLocks";
import { checkedWorking } from "@/lib/checkedWorking";
import { buildVariantPlan } from "@/lib/variantNumbers";

type PromptInput = {
  pastPaperText: string;
  solutionText?: string;
  subject?: string;
  academicLevel?: string;
  extraInstructions?: string;
  pageLayout?: Array<{ page: number; questionNumbers: number[]; figureCount?: number }>;
};

const PAPER_CHAR_CAP = 9000;
const SOLUTION_CHAR_CAP = 6000;

export function buildPaperPrompt(input: PromptInput): string {
  const subject = input.subject?.trim();
  const level = input.academicLevel?.trim();
  const extra = input.extraInstructions?.trim();
  const paper = clip(input.pastPaperText.trim(), PAPER_CHAR_CAP);
  const solution = input.solutionText?.trim()
    ? clip(input.solutionText.trim(), SOLUTION_CHAR_CAP)
    : "(No solution uploaded. Match the paper: full working if calculation-heavy, brief answers if short-answer.)";

  const layoutLines = (input.pageLayout || [])
    .map((page) => {
      const qs = page.questionNumbers.length ? `Q${page.questionNumbers.join(",")}` : "continue";
      const figures = (page.figureCount || 0) > 0 ? ` +${page.figureCount} fig` : "";
      return `${page.page}:${qs}${figures}`;
    })
    .join("; ");

  const layout = input.pageLayout || [];
  const figureLocks = figureLockPromptBlock(figureLocksFromPaper(input.pastPaperText, layout));
  const noFigure = noFigurePromptBlock(input.pastPaperText, layout);
  const variantPlan = buildVariantPlan(input.pastPaperText);
  const meta = [
    subject ? `Subject: ${subject}` : "",
    level ? `Level: ${level}` : "",
    extra ? `Extra: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Create a NEW close-variant past paper and matching solution from the templates below.
${meta}

RULES:
- Same course, title, layout, instructions, sections, question count/types/subquestions, marks, difficulty, command words.
- No figure: change the named object to another of the same kind. Palladium-103 can become a different isotope. Keep the question type, parts, and marks.
- Change every calculation number to the value in THIS RUN. A new Generate must not repeat the previous paper's numbers.
- Has a figure: copy the figure and keep what is drawn. Phosphorus stays Phosphorus. If the drawing shows only letters such as L and D, with no numbers on it, change those numbers in the text. Keep a number only when it is printed on the figure, such as +6.2 kV.
- Put [FIGURE FROM ORIGINAL PAGE n] where the original has a figure.
- Paper and solution must match (numbering, marks, new values).
- One original page = one generated page. Start each page with --- PAGE n ---. Do not write "Page n of m" in the question text.
- Units must look like the original paper. A length stays cm. Attenuation is cm⁻¹. Mass-energy absorption is cm²/g. Keep the minus on negative powers: 1.6×10⁻¹⁹ C, 9.1×10⁻³¹ kg, 9×10⁹ Bq, W/cm². Never leave ^, _, or braces visible.
- Do not write a marking scheme.

PAGES (keep --- PAGE n ---): ${layoutLines || "use markers in the paper text"}
${noFigure}
${figureLocks}
${variantPlan}

Write only the past paper in this reply. Put the full question text under this heading. Do not write the solution yet.
GENERATED PAST PAPER

REFERENCE PAST PAPER:
${paper}

REFERENCE SOLUTION:
${solution}
`;
}

export function buildSolutionPrompt(input: {
  generatedPaper: string;
  solutionText?: string;
  subject?: string;
  academicLevel?: string;
  pageLayout?: Array<{ page: number; questionNumbers: number[] }>;
}): string {
  const subject = input.subject?.trim();
  const level = input.academicLevel?.trim();
  const paper = clip(input.generatedPaper.trim(), 7000);
  const solution = input.solutionText?.trim()
    ? clip(input.solutionText.trim(), 4000)
    : "(No solution uploaded. Write full working for every question.)";
  const meta = [subject ? `Subject: ${subject}` : "", level ? `Level: ${level}` : ""].filter(Boolean).join("\n");
  const layoutLines = (input.pageLayout || [])
    .map((page) => `${page.page}:${page.questionNumbers.length ? `Q${page.questionNumbers.join(",")}` : "continue"}`)
    .join("; ");

  return `Write the suggested solution for the generated paper.
${meta}
Copy the reference solution's format. Recalculate with the generated paper's numbers. Do not copy the reference solution's numbers. Keep a figure's object unchanged.
Keep the reference solution's page breaks when you can. One question and its solution on a page stays on one page. Write the full working for every question. Do not stop after the page headings.
${layoutLines ? `PAGES: ${layoutLines}` : "Use the --- PAGE n --- markers in the reference solution."}
Copy the reference solution page by page. Keep every --- PAGE n --- break, including a solution that continues onto the next page.
On each page, copy what that page of the reference shows: the title line, the question, then "Solution n:", then each working step on its own line.
Do not shorten the working. Do not join steps into one line.
Then the parts on their own lines, in this shape:
a. (1/2)^n = 1/...
half-life*n = ... days
b. time is equal to n half-lives
mass*(1/2)^n = ... g
Therefore, ...
For later questions, put each "when n=" line and each photon energy on its own line, as the reference does.
Exam working only. No Python, no pseudocode, no sympy, no code blocks, no ** exponents, no # comments, and no marking scheme.
Do not write a page banner such as "PAGE 3 · QUESTION 3".
Start each answer with exactly "Solution 1:", "Solution 2:", and so on, alone on its line.
Keep spaces between words. Do not wrap a sentence in \\[ \\]. Write the working on the left, one step per line, in the same shape as the reference solution.
${checkedWorking(paper)}

GENERATED SUGGESTED SOLUTION

GENERATED PAPER:
${paper}

REFERENCE SOLUTION:
${solution}
`;
}

function clip(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[truncated]`;
}
