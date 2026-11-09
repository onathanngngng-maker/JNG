const PaperGenerator = (() => {
  const EXAMINER_BRIEF = `You are an expert university examiner. Create a new practice past paper that closely follows the uploaded reference paper. Preserve its course, structure, number of questions, question types, subquestions, marks, difficulty, topic sequence, and answer style. Make each question a close variant, not an exact copy, with at least one meaningful change. Include the complete generated paper, then ANSWER KEY AND WORKED SOLUTIONS, then MARKING SCHEME.`;

  const NAMES = [
    ["Ali", "Mei"],
    ["Sam", "Jordan"],
    ["Alex", "Priya"],
    ["Chen", "Hassan"],
    ["a company", "a city council"],
    ["coal", "natural gas"],
    ["solar panel", "wind turbine"],
  ];

  const MATERIALS = [
    ["copper", "aluminium"],
    ["water", "ethanol"],
    ["steel", "titanium"],
    ["glucose", "starch"],
  ];

  function formatNumber(n) {
    if (!Number.isFinite(n)) return String(n);
    if (Number.isInteger(n)) return String(n);
    const rounded = Math.round(n * 1000) / 1000;
    return String(rounded);
  }

  function tweakNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    if (n === 0) return "0";
    if (Number.isInteger(n) && Math.abs(n) <= 400) {
      const delta = Math.max(1, Math.round(Math.abs(n) * 0.15) || 1);
      const next = n + (n % 2 === 0 ? delta : -delta);
      return String(next === 0 ? n + delta : next);
    }
    return formatNumber(Math.round(n * 1.15 * 1000) / 1000);
  }

  function isProtectedNumber(full, offset, match) {
    const before = full.slice(Math.max(0, offset - 18), offset);
    const after = full.slice(offset, offset + match.length + 18);
    if (/Q(?:uestion)?\s*$/i.test(before)) return true;
    if (/marks?|mark\]/i.test(after) || /\[/.test(before.slice(-2))) return true;
    if (/\b(19|20)\d{2}\b/.test(match) && match.length === 4) return true;
    return false;
  }

  function collectNumbers(text) {
    const map = new Map();
    const re = /\b-?\d+(?:\.\d+)?\b/g;
    let match;
    while ((match = re.exec(text))) {
      if (isProtectedNumber(text, match.index, match[0])) continue;
      const n = Number(match[0]);
      if (Number.isInteger(n) && Math.abs(n) <= 3) continue;
      if (!map.has(match[0])) map.set(match[0], tweakNumber(match[0]));
    }
    return map;
  }

  function applyNumberMap(text, map) {
    const keys = [...map.keys()].sort((a, b) => b.length - a.length);
    let out = text;
    keys.forEach((key) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${escaped}\\b`, "g"), (matched, offset, full) => {
        if (isProtectedNumber(full, offset, matched)) return matched;
        return map.get(key);
      });
    });
    return out;
  }

  function applyLexicalVariants(text) {
    let out = text;
    NAMES.concat(MATERIALS).forEach(([from, to]) => {
      out = out.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
    });
    return out;
  }

  function variantText(text, map) {
    return applyLexicalVariants(applyNumberMap(text, map))
      .replace(/^(?:Question\s+|Q(?:uestion)?\s+)?\d{1,2}\s*[.)、:：]?\s*/i, "")
      .trim();
  }

  function recomputeArithmetic(text) {
    const ops = [
      { re: /(-?\d+(?:\.\d+)?)\s*([×x*])\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?(?!\s*[×x*/÷])/g, fn: (a, b) => a * b },
      { re: /(-?\d+(?:\.\d+)?)\s*([÷/])\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?(?!\s*[×x*/÷])/g, fn: (a, b) => (b === 0 ? a : a / b) },
      { re: /(-?\d+(?:\.\d+)?)\s*(\+)\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?(?!\s*[×x*/÷])/g, fn: (a, b) => a + b },
      { re: /(-?\d+(?:\.\d+)?)\s*(−|-)\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?(?!\s*[×x*/÷])/g, fn: (a, b) => a - b },
    ];
    let out = text;
    ops.forEach(({ re, fn }) => {
      out = out.replace(re, (_, a, op, b) => `${a} ${op} ${b} = ${formatNumber(fn(Number(a), Number(b)))}`);
    });
    return out;
  }

  function variantHeader(header, subject, level, time) {
    const lines = [];
    lines.push("PRACTICE PAST PAPER (close variant of the uploaded reference)");
    if (subject) lines.push(`Subject / topic: ${subject}`);
    if (level) lines.push(`Academic level: ${level}`);
    if (time) lines.push(`Time allowed: ${time}`);
    if (header) {
      lines.push("");
      lines.push(header.replace(/\bEXAMINATION\b/gi, (word, offset, full) => {
        if (/PRACTICE\s+$/i.test(full.slice(0, offset))) return word;
        return "PRACTICE EXAMINATION";
      }));
    } else {
      lines.push("");
      lines.push("Answer ALL questions. Show full working where calculations are required.");
    }
    return lines.join("\n");
  }

  function modelAnswer(question, solutionBlock, map) {
    const type = question.type;
    if (solutionBlock) {
      const adapted = recomputeArithmetic(variantText(solutionBlock.text, map));
      return {
        key: firstLine(adapted),
        working: adapted,
        source: "Adapted from the uploaded solution, using the new values and wording.",
      };
    }
    if (type === "mcq") {
      const letter = question.options[1] ? question.options[1].letter : "B";
      return {
        key: letter,
        working: `The option set is preserved. Choose ${letter} after applying the same concept as the reference item, using the new scenario or data.`,
        source: "Model answer in the reference MCQ style.",
      };
    }
    if (type === "calculation") {
      return {
        key: "See working.",
        working:
          "Write the same relationship used in the reference paper.\nSubstitute the new given values.\nRearrange, evaluate, and state units. Leave the answer to the same precision as the original paper unless told otherwise.",
        source: "Worked method in the original calculation style.",
      };
    }
    if (type === "written") {
      return {
        key: "Model answer covering the same assessment points.",
        working:
          "Define the key term used in the question.\nGive the same number of developed points as the marks imply, using the new example or condition.\nConclude in the command-word style of the reference (explain / discuss / justify).",
        source: "University-style model answer.",
      };
    }
    return {
      key: "Concise statement matching the required answer style.",
      working: "State the result, then one supporting reason drawn from the same topic sequence.",
      source: "Short-answer model response.",
    };
  }

  function firstLine(text) {
    const clipped = text.replace(/\s+/g, " ").trim();
    return clipped.split(/(?<=[.?!])\s/)[0].slice(0, 240) || clipped.slice(0, 240);
  }

  function markingPoints(question, answer, solutionBlock) {
    const marks = question.marks || 0;
    const parts = question.parts.filter((p) => p.label);
    if (parts.length) {
      return parts.map((part) => {
        const partMarks = part.marks || Math.max(1, Math.round(marks / parts.length));
        return {
          label: `(${part.label})`,
          marks: partMarks,
          points: [
            `Award up to ${partMarks} mark(s) for a response in the same style as the reference part (${part.label}).`,
            "Allow equivalent wording. Award method marks even if the final value is incorrect, provided the new data are used.",
          ],
        };
      });
    }
    const buckets = marks >= 4 ? 3 : marks >= 2 ? 2 : 1;
    const per = marks ? Math.max(1, Math.round(marks / buckets)) : 1;
    const points = [];
    if (question.type === "calculation") {
      points.push({ label: "M", marks: per, points: ["Correct method / formula (same approach as the reference)."] });
      points.push({ label: "A", marks: Math.max(1, marks - per), points: ["Correct substitution of the new values and accurate final answer with units."] });
    } else if (question.type === "mcq") {
      points.push({ label: "A", marks: marks || 1, points: [`Award full marks for ${answer.key} only.`] });
    } else {
      points.push({
        label: "B",
        marks: marks || 2,
        points: [
          "Award marking points for accurate, distinct ideas.",
          "Do not award extra marks for unrelated topics.",
          solutionBlock
            ? "Credit answers that match the uploaded mark-scheme ideas after the scenario change."
            : "Credit definition, explanation, and a justified conclusion where the command word requires it.",
        ],
      });
    }
    return points;
  }

  function generate({ paperText, solutionText, title, subject, level, time }) {
    const parsed = PaperParser.parsePaper(paperText);
    const solutions = solutionText ? PaperParser.extractAnswers(solutionText) : [];
    const paperTitle = title || subject || "Practice past paper";

    const questions = parsed.questions.map((q, index) => {
      const map = collectNumbers(q.text);
      const text = variantText(q.text, map);
      const parts = q.parts.map((part) => ({
        ...part,
        text: variantText(part.text, map),
      }));
      const solutionBlock = solutions.find((s) => s.number === q.number) || solutions[index] || null;
      const question = {
        number: q.number,
        text,
        parts,
        marks: q.marks,
        type: q.type,
        options: q.options.map((opt) => ({ ...opt, text: variantText(opt.text, map) })),
      };
      const answer = modelAnswer(question, solutionBlock, map);
      const scheme = markingPoints(question, answer, solutionBlock);
      return { question, answer, scheme, map };
    });

    return {
      title: paperTitle,
      subject: subject || "",
      level: level || "",
      time: time || "",
      header: variantHeader(parsed.header, subject, level, time),
      usedSolution: Boolean(solutionText && solutionText.trim()),
      brief: EXAMINER_BRIEF,
      questions: questions.map((row) => row.question),
      answers: questions.map((row) => ({
        number: row.question.number,
        marks: row.question.marks,
        type: row.question.type,
        ...row.answer,
      })),
      scheme: questions.map((row) => ({
        number: row.question.number,
        marks: row.question.marks,
        items: row.scheme,
      })),
    };
  }

  const SAMPLE_PAPER = `UNIVERSITY PRACTICE EXAMINATION
Course: Introduction to Environmental Science
Academic level: Year 1 undergraduate
Time allowed: 2 hours
Answer ALL questions. Show working for calculations.

Question 1
A rectangular solar panel has length 12 m and width 5 m.
(a) Calculate the area of the panel. [2]
(b) If the panel produces 180 W per square metre, calculate the total power output. [3]

Question 2
Ali walks 3 km in 40 minutes.
(a) Find the average speed in km/h. [3]
(b) Explain one limitation of using this average speed to describe the whole journey. [2]

Question 3
Explain two reasons why renewable energy is used instead of coal in a city electricity mix. [6]

Question 4
A bag contains 4 red balls and 6 blue balls. One ball is selected at random.
(a) Find the probability that the ball is red. [2]
(b) State one assumption required for this probability model. [2]

Question 5
Describe how a plant uses photosynthesis, and justify why light intensity can limit the rate. [8]
`;

  const SAMPLE_SOLUTION = `Question 1
(a) Area = length × width = 12 × 5 = 60 m².
(b) Power = 180 × 60 = 10800 W.

Question 2
(a) Time = 40/60 = 2/3 h. Speed = 3 ÷ 2/3 = 4.5 km/h.
(b) Average speed hides variation; the walk may include stops or changing pace.

Question 3
Renewable sources are replenished on human timescales. They typically produce less carbon dioxide than coal when generating electricity.

Question 4
(a) P(red) = 4 / (4+6) = 4/10 = 0.4.
(b) Assume equally likely outcomes and a well-mixed bag / random selection.

Question 5
Chlorophyll absorbs light; carbon dioxide and water are converted to glucose and oxygen. Light intensity can limit rate because insufficient photons reduce the energy available for the light-dependent reactions.
`;

  return { generate, SAMPLE_PAPER, SAMPLE_SOLUTION, EXAMINER_BRIEF };
})();
