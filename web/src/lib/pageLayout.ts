const QUESTION_BOUNDARY =
  /(?:^|\n)\s*(?:Question\s+|Q(?:uestion)?\.?\s*)(\d{1,2})\b|(?:^|\n)\s*(\d{1,2})\.\s+(?=[A-Za-z(\[])|(?:^|\n)\s*Solution\s+(\d{1,2})\b/gi;

export function questionNumbersInText(text: string): number[] {
  const found: number[] = [];
  QUESTION_BOUNDARY.lastIndex = 0;
  for (const match of text.matchAll(QUESTION_BOUNDARY)) {
    const n = Number(match[1] || match[2] || match[3]);
    if (Number.isFinite(n) && !found.includes(n)) found.push(n);
  }
  return found;
}

export function splitQuestions(text: string): { number: number; body: string }[] {
  const cleaned = text.trim();
  QUESTION_BOUNDARY.lastIndex = 0;
  const matches = [...cleaned.matchAll(QUESTION_BOUNDARY)];
  const starts: { index: number; number: number }[] = [];
  let open = 0;
  for (const match of matches) {
    const number = Number(match[1] || match[2] || match[3] || 0);
    const isSolutionLine = Boolean(match[3]);
    if (!Number.isFinite(number) || number <= 0) continue;
    if (isSolutionLine && number === open) continue;
    starts.push({ index: match.index ?? 0, number });
    open = number;
  }
  if (!starts.length) return [{ number: 1, body: cleaned }];
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : cleaned.length;
    return { number: start.number, body: cleaned.slice(start.index, end).trim() };
  });
}

export function splitByPageMarkers(text: string): string[] {
  const matches = [...text.matchAll(/^\s*---\s*PAGE\s+(\d+)\s*---\s*$/gim)];
  if (!matches.length) return [];
  const pages = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    return text.slice(start, end).trim();
  });
  const preamble = text.slice(0, matches[0].index ?? 0).trim();
  if (preamble) pages[0] = `${preamble}\n\n${pages[0]}`.trim();
  return pages.filter(Boolean);
}

type PageLayoutInput = { page: number; questionNumbers: number[] };

export type GeneratedPage = {
  page: number;
  htmlSource: string;
  questionNumbers: number[];
};

function stripPrintedPageLabels(text: string): string {
  return text
    .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "")
    .replace(/^\s*---\s*PAGE\s+\d+\s*---\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkLines(body: string, parts: number): string[] {
  if (parts <= 1) return [body];
  const lines = body.split("\n");
  const size = Math.max(1, Math.ceil(lines.length / parts));
  return Array.from({ length: parts }, (_, index) => lines.slice(index * size, (index + 1) * size).join("\n").trim());
}

function visibleAmount(pages: GeneratedPage[]): number {
  return pages.reduce((total, page) => total + page.htmlSource.replace(/\s+/g, "").length, 0);
}

function keepTheWholeAnswer(cleaned: string, laid: GeneratedPage[]): GeneratedPage[] {
  const source = cleaned.replace(/\s+/g, "").length;
  if (source < 80 || visibleAmount(laid) >= source * 0.6) return laid;
  return [{ page: 1, htmlSource: cleaned, questionNumbers: questionNumbersInText(cleaned) }];
}

export function paginateLikeOriginal(generatedPaper: string, pages: PageLayoutInput[]): GeneratedPage[] {
  const cleaned = stripPrintedPageLabels(generatedPaper);
  const marked = splitByPageMarkers(generatedPaper);

  if (pages.length && marked.length === pages.length) {
    return keepTheWholeAnswer(
      cleaned,
      marked.map((body, index) => ({
        page: pages[index]?.page ?? index + 1,
        htmlSource: stripPrintedPageLabels(body),
        questionNumbers: pages[index]?.questionNumbers || questionNumbersInText(body),
      })),
    );
  }

  if (pages.length) {
    const questions = splitQuestions(cleaned);
    const headerEnd = questions[0] ? cleaned.indexOf(questions[0].body) : 0;
    const header = headerEnd > 0 ? cleaned.slice(0, headerEnd).trim() : "";
    const byNumber = new Map(questions.map((q) => [q.number, q.body]));
    const groups: PageLayoutInput[][] = [];
    for (const page of pages) {
      if (page.questionNumbers.length || !groups.length) groups.push([page]);
      else groups[groups.length - 1].push(page);
    }

    const laid: GeneratedPage[] = [];
    groups.forEach((group, groupIndex) => {
      const numbers = group[0].questionNumbers;
      const joined = numbers
        .map((n) => byNumber.get(n))
        .filter((body): body is string => Boolean(body))
        .join("\n\n");
      const chunks = chunkLines(joined, group.length);
      group.forEach((page, index) => {
        const prefix = groupIndex === 0 && index === 0 && header ? `${header}\n\n` : "";
        const htmlSource = `${prefix}${chunks[index] || ""}`.trim();
        laid.push({
          page: page.page,
          htmlSource: htmlSource || (groupIndex === 0 && index === 0 ? cleaned : ""),
          questionNumbers: index === 0 ? numbers : page.questionNumbers,
        });
      });
    });
    return keepTheWholeAnswer(cleaned, laid);
  }

  if (marked.length) {
    return marked.map((body, index) => ({
      page: index + 1,
      htmlSource: stripPrintedPageLabels(body),
      questionNumbers: questionNumbersInText(body),
    }));
  }

  return [{ page: 1, htmlSource: cleaned, questionNumbers: questionNumbersInText(cleaned) }];
}

const SOLUTION_QUESTION_STEM = /^\d{1,2}\.\s+[A-Z]/;

/** A solution heading, including scrambled forms such as "2 Solution:" and "4:". */
export function splitSolutionHeading(line: string): { number: number; rest: string } | null {
  const text = line.trim();
  if (!text) return null;
  const mixed = text.match(/^(\d{1,2})\s+Solution\s+(\d{1,2})\s*[:.]?\s*(.*)$/i);
  if (mixed) return { number: Number(mixed[2]), rest: mixed[3].trim() };
  const leading = text.match(/^(\d{1,2})\s+Solution\s*[:.]?\s*(.*)$/i);
  if (leading) return { number: Number(leading[1]), rest: leading[2].trim() };
  const named = text.match(/^(?:(\d{1,2})\s+)?Solution\s*(\d+)\s*[:.]?\s*(.*)$/i);
  if (named) return { number: Number(named[2] || named[1]), rest: named[3].trim() };
  if (text.length <= 8 && /^(\d{1,2})\s*[:.]\s*$/.test(text)) {
    return { number: Number(text.match(/\d+/)?.[0]), rest: "" };
  }
  return null;
}

/** One page per solution. Question numbers (1., 2., 3.) do not start a new page. */
export function paginateSolutions(generatedSolution: string): GeneratedPage[] {
  const cleaned = stripPrintedPageLabels(generatedSolution);
  const sections: { number: number; preface: string[]; body: string[] }[] = [];
  let current: { number: number; preface: string[]; body: string[] } | null = null;
  let before: string[] = [];

  for (const line of cleaned.split("\n")) {
    const heading = splitSolutionHeading(line);
    if (heading) {
      if (current) sections.push(current);
      current = {
        number: heading.number,
        preface: before,
        body: heading.rest ? [heading.rest] : [],
      };
      before = [];
      continue;
    }
    if (current && SOLUTION_QUESTION_STEM.test(line.trim())) {
      sections.push(current);
      current = null;
      before = [line];
      continue;
    }
    if (!current) before.push(line);
    else current.body.push(line);
  }
  if (current) sections.push(current);
  else if (before.length && sections.length) sections[sections.length - 1].body.push(...before);
  if (!sections.length) {
    return [{ page: 1, htmlSource: cleaned, questionNumbers: [] }];
  }

  return sections.map((section, index) => ({
    page: index + 1,
    htmlSource: [...section.preface, `Solution ${section.number}:`, ...section.body]
      .filter((line) => line.trim())
      .join("\n"),
    questionNumbers: [section.number],
  }));
}

type SolutionSection = { number: number; preface: string; body: string };

function collectSolutionSections(text: string): SolutionSection[] {
  const cleaned = stripPrintedPageLabels(text);
  const sections: SolutionSection[] = [];
  let current: { number: number; preface: string[]; body: string[] } | null = null;
  let before: string[] = [];

  for (const line of cleaned.split("\n")) {
    const heading = splitSolutionHeading(line);
    if (heading) {
      if (current) {
        sections.push({
          number: current.number,
          preface: current.preface.join("\n").trim(),
          body: current.body.join("\n").trim(),
        });
      }
      current = { number: heading.number, preface: before, body: heading.rest ? [heading.rest] : [] };
      before = [];
      continue;
    }
    if (current && SOLUTION_QUESTION_STEM.test(line.trim())) {
      sections.push({
        number: current.number,
        preface: current.preface.join("\n").trim(),
        body: current.body.join("\n").trim(),
      });
      current = null;
      before = [line];
      continue;
    }
    if (!current) before.push(line);
    else current.body.push(line);
  }
  if (current) {
    sections.push({
      number: current.number,
      preface: current.preface.join("\n").trim(),
      body: current.body.join("\n").trim(),
    });
  }
  return sections;
}

function paperIntro(paperText: string): string {
  const cleaned = stripPrintedPageLabels(paperText);
  const questions = splitQuestions(cleaned);
  if (!questions[0]) return "";
  const start = cleaned.indexOf(questions[0].body);
  return start > 0 ? cleaned.slice(0, start).trim() : "";
}

/** Same pages as the uploaded solution: question, then Solution n:, and a continuation stays a continuation. */
export function layoutSolutionLikeUpload(
  solutionText: string,
  paperText: string,
  solutionPages: PageLayoutInput[],
): GeneratedPage[] {
  const marked = splitByPageMarkers(solutionText);
  if (solutionPages.length && marked.length === solutionPages.length) {
    return marked.map((body, index) => ({
      page: solutionPages[index]?.page ?? index + 1,
      htmlSource: stripPrintedPageLabels(body),
      questionNumbers: solutionPages[index]?.questionNumbers || [],
    }));
  }

  const paperQuestions = splitQuestions(stripPrintedPageLabels(paperText));
  const answers = answersByQuestion(solutionText);
  const intro = paperIntro(paperText);
  if (!solutionPages.length) return paginateSolutions(solutionText);

  const pages = solutionPages.some((page) => page.questionNumbers.length)
    ? solutionPages
    : distributeQuestions(paperQuestions, solutionPages);
  const byNumber = new Map(paperQuestions.map((question) => [question.number, question.body]));
  const laid: GeneratedPage[] = [];
  const placed = new Set<number>();

  pages.forEach((page, pageIndex) => {
    const numbers = page.questionNumbers.filter((number) => byNumber.has(number) || answers.has(number));
    const parts: string[] = [];
    if (pageIndex === 0 && intro) parts.push(intro);
    if (!numbers.length) {
      const carried = [...answers.keys()].find((number) => placed.has(number));
      if (carried && answers.get(carried)) {
        const rest = answers.get(carried) || "";
        answers.set(carried, "");
        if (rest.trim()) parts.push(rest);
      }
    }
    numbers.forEach((number) => {
      const question = byNumber.get(number) || "";
      const answer = withoutRepeatedQuestion(question, answers.get(number) || "");
      if (question) parts.push(question);
      if (answer.trim()) parts.push(answer.trim());
      else if (!question) parts.push(`Solution ${number}:`);
      placed.add(number);
      answers.set(number, "");
    });
    const htmlSource = parts.filter((part) => part.trim()).join("\n\n");
    if (!htmlSource.trim()) return;
    laid.push({ page: page.page, htmlSource, questionNumbers: numbers });
  });

  const missed = paperQuestions.filter((question) => !placed.has(question.number));
  if (missed.length && laid.length) {
    const tail = missed
      .map((question) =>
        [question.body, withoutRepeatedQuestion(question.body, answers.get(question.number) || "")]
          .filter(Boolean)
          .join("\n\n"),
      )
      .join("\n\n");
    laid[laid.length - 1].htmlSource = `${laid[laid.length - 1].htmlSource}\n\n${tail}`.trim();
    laid[laid.length - 1].questionNumbers = [
      ...laid[laid.length - 1].questionNumbers,
      ...missed.map((question) => question.number),
    ];
  }
  return laid.length ? laid : paginateSolutions(solutionText);
}

function distributeQuestions(
  questions: { number: number; body: string }[],
  pages: PageLayoutInput[],
): PageLayoutInput[] {
  if (!questions.length) return pages;
  const firstHasParts = /\(a\)/i.test(questions[0].body) && /\(b\)/i.test(questions[0].body);
  if (firstHasParts && pages.length > 1 && questions.length > 1) {
    const rest = questions.slice(1);
    const restPages = pages.slice(1);
    const size = Math.max(1, Math.ceil(rest.length / restPages.length));
    return [
      { page: pages[0].page, questionNumbers: [questions[0].number] },
      ...restPages.map((page, index) => ({
        page: page.page,
        questionNumbers: rest.slice(index * size, (index + 1) * size).map((question) => question.number),
      })),
    ];
  }
  const size = Math.max(1, Math.ceil(questions.length / pages.length));
  return pages.map((page, index) => ({
    page: page.page,
    questionNumbers: questions.slice(index * size, (index + 1) * size).map((question) => question.number),
  }));
}

function withoutRepeatedQuestion(question: string, answer: string): string {
  const asked = question.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!asked || !answer.trim()) return answer.trim();
  const kept = answer.split("\n").filter((line) => {
    const compact = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (compact.length < 24) return true;
    return !asked.includes(compact);
  });
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function answersByQuestion(solutionText: string): Map<number, string> {
  const answers = new Map<number, string>();
  const remember = (number: number, body: string) => {
    const cleaned = body.trim();
    if (!cleaned) return;
    const previous = answers.get(number) || "";
    if (cleaned.length > previous.length) answers.set(number, cleaned);
  };
  for (const section of collectSolutionSections(solutionText)) remember(section.number, section.body);
  for (const question of splitQuestions(stripPrintedPageLabels(solutionText))) {
    remember(question.number, question.body.replace(/^Q\.?\s*\d+[^\n]*\n/i, ""));
  }
  return answers;
}

/** Question numbers that have a paper question but no real working in the solution. */
export function questionsMissingAnswers(paperText: string, solutionText: string): number[] {
  const answers = answersByQuestion(solutionText);
  return splitQuestions(stripPrintedPageLabels(paperText))
    .filter((question) => question.body.trim().length > 40)
    .map((question) => question.number)
    .filter((number) => (answers.get(number) || "").replace(/\s+/g, "").length < 80);
}
