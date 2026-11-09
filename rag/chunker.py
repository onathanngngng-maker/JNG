import re
from typing import Any

QUESTION_RE = re.compile(
    r"(?:^|\n)\s*(?:Question\s+|Q(?:uestion)?\s+)(\d{1,2})\b|(?:^|\n)\s*(\d{1,2})\.\s+(?=[A-Z(\[])",
    re.I,
)
PART_RE = re.compile(r"(?:^|\n)\s*\(([a-z]|[ivx]+)\)\s+", re.I)
MARK_RE = re.compile(r"\[(\d+)\s*(?:marks?|mark|分)?\]", re.I)
OPTION_RE = re.compile(r"(?:^|\n)\s*[(\[]?([A-D])[)\].:]\s+(.+)")


def normalize(text: str) -> str:
    cleaned = (text or "").replace("\r", "\n").replace("\u00a0", " ")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _matches(text: str) -> list[re.Match[str]]:
    return list(QUESTION_RE.finditer(text))


def split_front_matter(text: str) -> tuple[str, str]:
    cleaned = normalize(text)
    matches = _matches(cleaned)
    if not matches:
        return "", cleaned
    first = matches[0].start()
    return cleaned[:first].strip(), cleaned[first:].strip()


def split_questions(text: str) -> list[str]:
    cleaned = normalize(text)
    matches = _matches(cleaned)
    if not matches:
        return [cleaned] if cleaned else []
    blocks = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        body = cleaned[start:end].strip()
        if len(body) > 8:
            blocks.append(body)
    return blocks


def extract_marks(text: str) -> int | None:
    marks = [int(m) for m in MARK_RE.findall(text)]
    if not marks:
        return None
    return sum(marks)


def strip_number(block: str) -> str:
    return re.sub(r"^(?:Question\s+|Q(?:uestion)?\s+)?\d{1,2}\s*[.)、:：]?\s*", "", block, flags=re.I).strip()


def split_parts(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    matches = list(PART_RE.finditer(cleaned))
    if len(matches) < 2:
        return [{"label": None, "text": cleaned, "marks": extract_marks(cleaned)}]
    parts: list[dict[str, Any]] = []
    before = cleaned[: matches[0].start()].strip()
    if before:
        parts.append({"label": None, "text": before, "marks": extract_marks(before)})
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        chunk = cleaned[start:end].strip()
        parts.append({"label": match.group(1).lower(), "text": chunk, "marks": extract_marks(chunk)})
    return parts


def extract_options(text: str) -> list[dict[str, str]]:
    options = [{"letter": m.group(1), "text": m.group(2).strip()} for m in OPTION_RE.finditer(text)]
    return options if len(options) >= 3 else []


def classify(text: str) -> str:
    if len(extract_options(text)) >= 3:
        return "mcq"
    if re.search(r"\b(calculate|compute|evaluate|solve|find the|determine the)\b", text, re.I):
        return "calculation"
    if re.search(r"\b(explain|discuss|describe|compare|contrast|justify|assess|outline why)\b", text, re.I):
        return "written"
    return "short"


def heading_style(block: str) -> str:
    if re.match(r"^\s*Question\s+\d+", block, re.I):
        return "question"
    if re.match(r"^\s*Q\s*\d+", block, re.I):
        return "q"
    if re.match(r"^\s*\d+\.", block):
        return "dot"
    return "question"


def format_heading(style: str, number: int) -> str:
    if style == "q":
        return f"Q{number}"
    if style == "dot":
        return f"{number}."
    return f"Question {number}"


def detect_mark_style(text: str) -> str:
    if re.search(r"\[\d+\s*marks\]", text, re.I):
        return "brackets-marks"
    if re.search(r"\[\d+\s*mark\]", text, re.I):
        return "brackets-mark"
    if re.search(r"\(\d+\s*marks?\)", text, re.I):
        return "parens"
    if re.search(r"\[\d+\]", text):
        return "brackets"
    return "brackets-marks"


def parse_question(block: str, index: int) -> dict[str, Any]:
    number_match = re.match(r"^(?:Question\s+|Q(?:uestion)?\s+)?(\d{1,2})\b", block, re.I)
    if not number_match:
        number_match = re.match(r"^(\d{1,2})\.", block)
    number = int(number_match.group(1)) if number_match else index + 1
    style = heading_style(block)
    body = strip_number(block)
    return {
        "number": number,
        "heading": format_heading(style, number),
        "heading_style": style,
        "raw": block,
        "text": body,
        "parts": split_parts(body),
        "marks": extract_marks(body),
        "mark_style": detect_mark_style(block),
        "type": classify(body),
        "options": extract_options(body),
    }


def parse_paper(text: str) -> dict[str, Any]:
    cleaned = normalize(text)
    header, body = split_front_matter(cleaned)
    blocks = split_questions(body or cleaned)
    questions = [parse_question(block, i) for i, block in enumerate(blocks)]
    style = questions[0]["heading_style"] if questions else "question"
    mark_style = questions[0]["mark_style"] if questions else "brackets-marks"
    return {
        "header": header,
        "questions": questions,
        "heading_style": style,
        "mark_style": mark_style,
    }


def make_chunks(paper_text: str, solution_text: str, meta: dict[str, Any], source_id: str) -> list[dict[str, Any]]:
    parsed = parse_paper(paper_text)
    chunks: list[dict[str, Any]] = []
    if parsed["header"]:
        chunks.append(
            {
                "id": f"{source_id}:header",
                "source_id": source_id,
                "kind": "header",
                "number": 0,
                "text": parsed["header"],
                "subject": meta.get("subject") or "",
                "level": meta.get("level") or "",
            }
        )
    for question in parsed["questions"]:
        chunks.append(
            {
                "id": f"{source_id}:q:{question['number']}",
                "source_id": source_id,
                "kind": "question",
                "number": question["number"],
                "text": question["text"],
                "subject": meta.get("subject") or "",
                "level": meta.get("level") or "",
            }
        )
    if solution_text and solution_text.strip():
        for solution in parse_paper(solution_text)["questions"]:
            chunks.append(
                {
                    "id": f"{source_id}:s:{solution['number']}",
                    "source_id": source_id,
                    "kind": "solution",
                    "number": solution["number"],
                    "text": solution["text"],
                    "subject": meta.get("subject") or "",
                    "level": meta.get("level") or "",
                }
            )
    return chunks
