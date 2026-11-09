const PaperParser = (() => {
  function normalize(text) {
    return String(text || "")
      .replace(/\r/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function questionMatches(text) {
    const re =
      /(?:^|\n)\s*(?:Question\s+|Q(?:uestion)?\s+)(\d{1,2})\b|(?:^|\n)\s*(\d{1,2})\.\s+(?=[A-Z(\[])/gi;
    return [...text.matchAll(re)];
  }

  function splitFrontMatter(text) {
    const cleaned = normalize(text);
    const matches = questionMatches(cleaned);
    if (!matches.length) {
      return { header: "", body: cleaned };
    }
    const first = matches[0].index;
    return {
      header: cleaned.slice(0, first).trim(),
      body: cleaned.slice(first).trim(),
    };
  }

  function splitQuestions(text) {
    const cleaned = normalize(text);
    const matches = questionMatches(cleaned);
    if (matches.length < 1) {
      return cleaned ? [cleaned] : [];
    }
    const questions = [];
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;
      const body = cleaned.slice(start, end).trim();
      if (body.length > 8) questions.push(body);
    }
    return questions;
  }

  function stripNumber(block) {
    return block
      .replace(/^(?:Question\s+|Q(?:uestion)?\s+)?\d{1,2}\s*[.)、:：]?\s*/i, "")
      .trim();
  }

  function extractMarksList(text) {
    const found = [...text.matchAll(/\[(\d+)\s*(?:marks?|mark|分)?\]/gi)];
    return found.map((m) => Number(m[1]));
  }

  function extractMarks(text) {
    const list = extractMarksList(text);
    if (!list.length) return null;
    return list.reduce((sum, n) => sum + n, 0);
  }

  function splitParts(text) {
    const cleaned = text.trim();
    const partRe = /(?:^|\n)\s*\(([a-z]|[ivx]+)\)\s+/gi;
    const matches = [...cleaned.matchAll(partRe)];
    if (matches.length < 2) {
      return [{ label: null, text: cleaned, marks: extractMarks(cleaned) }];
    }
    const parts = [];
    const before = cleaned.slice(0, matches[0].index).trim();
    if (before) {
      parts.push({ label: null, text: before, marks: extractMarks(before) });
    }
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;
      const chunk = cleaned.slice(start, end).trim();
      parts.push({
        label: matches[i][1].toLowerCase(),
        text: chunk,
        marks: extractMarks(chunk),
      });
    }
    return parts;
  }

  function extractOptions(text) {
    const optionRe = /(?:^|\n)\s*[\(\[]?([A-D])[\)\].:]\s+(.+)/g;
    const options = [];
    let match;
    while ((match = optionRe.exec(text))) {
      options.push({ letter: match[1], text: match[2].trim() });
    }
    return options.length >= 3 ? options : [];
  }

  function classify(text) {
    if (extractOptions(text).length >= 3) return "mcq";
    if (/\b(calculate|compute|evaluate|solve|find the|determine the)\b/i.test(text)) {
      return "calculation";
    }
    if (/\b(explain|discuss|describe|compare|contrast|justify|assess|outline why)\b/i.test(text)) {
      return "written";
    }
    return "short";
  }

  function parseQuestion(block, index) {
    const numberMatch = block.match(/^(?:Question\s+|Q(?:uestion)?\s+)?(\d{1,2})\b/i);
    const number = numberMatch ? Number(numberMatch[1]) : index + 1;
    const body = stripNumber(block);
    const parts = splitParts(body);
    return {
      number,
      raw: block,
      text: body,
      parts,
      marks: extractMarks(body),
      type: classify(body),
      options: extractOptions(body),
    };
  }

  function parsePaper(text) {
    const cleaned = normalize(text);
    const { header, body } = splitFrontMatter(cleaned);
    const blocks = splitQuestions(body || cleaned);
    return {
      header,
      questions: blocks.map((block, index) => parseQuestion(block, index)),
    };
  }

  function extractAnswers(text) {
    return parsePaper(text).questions.map((q) => ({
      number: q.number,
      text: q.text,
      parts: q.parts,
    }));
  }

  return {
    normalize,
    splitQuestions,
    extractMarks,
    extractAnswers,
    parsePaper,
    parseQuestion,
    classify,
  };
})();
