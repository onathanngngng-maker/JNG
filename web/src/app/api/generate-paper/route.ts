import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildMissingSolutionPrompt, buildPaperPrompt, buildSolutionPrompt } from "@/lib/buildPaperPrompt";
import { figureLocksBroken, figureLocksFromPaper, repairFigureLocksLocally } from "@/lib/figureLocks";
import { completeWithOpenRouter } from "@/lib/openrouter";
import { questionsMissingAnswers } from "@/lib/pageLayout";
import { asExamWorking, parseGeneratedOutput, substantiveText } from "@/lib/parseGeneratedOutput";
import { ACCESS_COOKIE, cookieAllowsAccess } from "@/lib/siteAccess";

export const maxDuration = 300;

const MIN_CHARS = 80;
const MAX_CHARS = 80_000;

type Body = {
  pastPaperText?: unknown;
  solutionText?: unknown;
  subject?: unknown;
  academicLevel?: unknown;
  extraInstructions?: unknown;
  pageLayout?: unknown;
  solutionPageLayout?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPageLayout(value: unknown): Array<{ page: number; questionNumbers: number[]; figureCount: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as { page?: unknown; questionNumbers?: unknown; figureCount?: unknown };
      const page = Number(row.page);
      const questionNumbers = Array.isArray(row.questionNumbers)
        ? row.questionNumbers.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const figureCount = Number(row.figureCount);
      if (!Number.isFinite(page)) return null;
      return {
        page,
        questionNumbers,
        figureCount: Number.isFinite(figureCount) && figureCount > 0 ? figureCount : 0,
      };
    })
    .filter((row): row is { page: number; questionNumbers: number[]; figureCount: number } => Boolean(row));
}

export async function POST(request: Request) {
  const jar = await cookies();
  if (!(await cookieAllowsAccess(jar.get(ACCESS_COOKIE)?.value))) {
    return NextResponse.json({ error: "Enter the password first." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const pastPaperText = asString(body.pastPaperText);
  const solutionText = asString(body.solutionText);
  const subject = asString(body.subject);
  const academicLevel = asString(body.academicLevel);
  const extraInstructions = asString(body.extraInstructions);
  const pageLayout = asPageLayout(body.pageLayout);
  const solutionPageLayout = asPageLayout(body.solutionPageLayout);

  if (pastPaperText.length + solutionText.length < MIN_CHARS) {
    return NextResponse.json(
      {
        error:
          "Paste or upload more of the reference past paper (and ideally the suggested solution). Both texts are too short to generate from.",
      },
      { status: 400 },
    );
  }

  if (!pastPaperText || pastPaperText.length < MIN_CHARS) {
    return NextResponse.json(
      { error: "Reference past paper text is required and must be long enough to use as a template." },
      { status: 400 },
    );
  }

  if (pastPaperText.length > MAX_CHARS || solutionText.length > MAX_CHARS || extraInstructions.length > 8_000) {
    return NextResponse.json(
      { error: "One of the inputs is too long. Shorten the pasted text and try again." },
      { status: 400 },
    );
  }

  const prompt = buildPaperPrompt({
    pastPaperText,
    solutionText,
    subject,
    academicLevel,
    extraInstructions,
    pageLayout,
  });

  try {
    const raw = await completeWithOpenRouter(prompt);
    let parsed = parseGeneratedOutput(raw);
    const locks = figureLocksFromPaper(pastPaperText, pageLayout);
    parsed = repairFigureLocksLocally(parsed, figureLocksBroken(parsed, locks));
    if (substantiveText(parsed.pastPaper).length < 40) {
      throw new Error(
        "The model returned the section headings and no questions. Click Generate once more.",
      );
    }
    if (substantiveText(parsed.suggestedSolution).length < 40) {
      const solutionRaw = await completeWithOpenRouter(
        buildSolutionPrompt({
          generatedPaper: parsed.pastPaper,
          solutionText,
          subject,
          academicLevel,
          pageLayout: solutionPageLayout,
        }),
      );
      const solutionParsed = parseGeneratedOutput(solutionRaw);
      const suggestedSolution = [solutionParsed.suggestedSolution, solutionParsed.markingScheme, solutionParsed.pastPaper, solutionRaw]
        .sort((left, right) => substantiveText(right).length - substantiveText(left).length)[0] || "";
      if (substantiveText(suggestedSolution).length < 40) {
        throw new Error(
          "The questions were written, but the suggested solution did not come back. Click Generate once more.",
        );
      }
      parsed = {
        ...parsed,
        suggestedSolution,
        markingScheme: "",
      };
    }
    let solution = parsed.suggestedSolution;
    const missing = questionsMissingAnswers(parsed.pastPaper, solution);
    for (const number of missing) {
      const extra = await completeWithOpenRouter(
        buildMissingSolutionPrompt({
          generatedPaper: parsed.pastPaper,
          solutionText,
          missing: [number],
        }),
      );
      solution = `${solution}\n\n${extra}`;
    }
    parsed = { ...parsed, suggestedSolution: asExamWorking(solution), markingScheme: "" };
    return NextResponse.json({
      ...parsed,
      usedSolution: Boolean(solutionText),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    const status = message.includes("OPENROUTER_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
