import re
from typing import Any

NAMES = [
    ("Ali", "Mei"),
    ("Sam", "Jordan"),
    ("Alex", "Priya"),
    ("Chen", "Hassan"),
    ("a company", "a city council"),
    ("coal", "natural gas"),
    ("solar panel", "wind turbine"),
]
MATERIALS = [
    ("copper", "aluminium"),
    ("water", "ethanol"),
    ("steel", "titanium"),
    ("glucose", "starch"),
]


def format_number(n: float) -> str:
    if n == int(n):
        return str(int(n))
    return str(round(n, 3))


def tweak_number(value: str) -> str:
    n = float(value)
    if n == 0:
        return "0"
    if n.is_integer() and abs(n) <= 400:
        delta = max(1, round(abs(n) * 0.15) or 1)
        nxt = int(n) + (delta if int(n) % 2 == 0 else -delta)
        return str(n + delta if nxt == 0 else nxt)
    return format_number(round(n * 1.15, 3))


def is_protected(full: str, offset: int, match: str) -> bool:
    before = full[max(0, offset - 18) : offset]
    after = full[offset : offset + len(match) + 18]
    if re.search(r"Q(?:uestion)?\s*$", before, re.I):
        return True
    if re.search(r"marks?|mark\]", after, re.I) or "[" in before[-2:]:
        return True
    if re.fullmatch(r"(19|20)\d{2}", match):
        return True
    return False


def collect_numbers(text: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for match in re.finditer(r"-?\d+(?:\.\d+)?", text):
        token = match.group(0)
        if is_protected(text, match.start(), token):
            continue
        n = float(token)
        if n.is_integer() and abs(n) <= 3:
            continue
        mapping.setdefault(token, tweak_number(token))
    return mapping


def apply_number_map(text: str, mapping: dict[str, str]) -> str:
    out = text
    for key in sorted(mapping, key=len, reverse=True):
        pattern = re.compile(rf"\b{re.escape(key)}\b")

        def repl(match: re.Match[str], src: str = key) -> str:
            if is_protected(match.string, match.start(), match.group(0)):
                return match.group(0)
            return mapping[src]

        out = pattern.sub(repl, out)
    return out


def apply_lexical(text: str) -> str:
    out = text
    for src, dst in NAMES + MATERIALS:
        out = re.sub(rf"\b{re.escape(src)}\b", dst, out, flags=re.I)
    return out


def variant_preserve(text: str, mapping: dict[str, str] | None = None) -> str:
    mapping = mapping if mapping is not None else collect_numbers(text)
    return apply_lexical(apply_number_map(text, mapping)).rstrip()


def variant_text(text: str, mapping: dict[str, str]) -> str:
    out = variant_preserve(text, mapping)
    return re.sub(r"^(?:Question\s+|Q(?:uestion)?\s+)?\d{1,2}\s*[.)、:：]?\s*", "", out, flags=re.I).strip()


def _replace_labeled_line(text: str, labels: list[str], value: str) -> str:
    if not value or not text:
        return text
    pattern = re.compile(rf"(?im)^(.*(?:{'|'.join(labels)}).*?[:：]\s*).+$")
    if not pattern.search(text):
        return text
    return pattern.sub(lambda match: match.group(1) + value, text, count=1)


def variant_header(header: str, subject: str, level: str, time: str) -> str:
    text = variant_preserve(header) if header else ""
    text = _replace_labeled_line(text, [r"subject", r"course", r"topic", r"module", r"paper"], subject)
    text = _replace_labeled_line(text, [r"academic level", r"level", r"year"], level)
    text = _replace_labeled_line(text, [r"time allowed", r"duration", r"time"], time)
    return text


def recompute_arithmetic(text: str) -> str:
    def sub_op(pattern: str, fn) -> None:
        nonlocal text

        def repl(match: re.Match[str]) -> str:
            a, op, b = match.group(1), match.group(2), match.group(3)
            try:
                result = fn(float(a), float(b))
            except ZeroDivisionError:
                result = float(a)
            return f"{a} {op} {b} = {format_number(result)}"

        text = re.sub(pattern, repl, text)

    tail = r"(?!\s*[×x*/÷])"
    sub_op(rf"(-?\d+(?:\.\d+)?)\s*([×x*])\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?{tail}", lambda a, b: a * b)
    sub_op(rf"(-?\d+(?:\.\d+)?)\s*([÷/])\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?{tail}", lambda a, b: a / b if b else a)
    sub_op(rf"(-?\d+(?:\.\d+)?)\s*(\+)\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?{tail}", lambda a, b: a + b)
    sub_op(rf"(-?\d+(?:\.\d+)?)\s*(−|-)\s*(-?\d+(?:\.\d+)?)\s*=\s*-?\d+(?:\.\d+)?{tail}", lambda a, b: a - b)
    return text


def first_line(text: str) -> str:
    clipped = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.?!])\s", clipped, maxsplit=1)
    return (parts[0] if parts else clipped)[:240]


def model_answer(question: dict[str, Any], solution_text: str | None, mapping: dict[str, str], retrieval_note: str) -> dict[str, str]:
    if solution_text:
        adapted = recompute_arithmetic(variant_preserve(solution_text, mapping))
        return {
            "key": first_line(adapted),
            "working": adapted,
            "source": retrieval_note or "Retrieved solution chunk, rewritten with new values.",
        }
    qtype = question.get("type")
    if qtype == "calculation":
        working = (
            "Write the same relationship used in the retrieved reference item.\n"
            "Substitute the new given values.\n"
            "Rearrange, evaluate, and state units."
        )
        return {"key": "See working.", "working": working, "source": retrieval_note}
    if qtype == "written":
        working = (
            "Define the key term from the retrieved question.\n"
            "Give the same number of developed points as the marks imply.\n"
            "Conclude in the original command-word style."
        )
        return {"key": "Model answer covering the same assessment points.", "working": working, "source": retrieval_note}
    return {
        "key": "Concise statement matching the required answer style.",
        "working": "State the result, then one supporting reason from the retrieved topic.",
        "source": retrieval_note,
    }


def marking_points(question: dict[str, Any], answer: dict[str, str], has_solution: bool) -> list[dict[str, Any]]:
    marks = question.get("marks") or 0
    parts = [part for part in question.get("parts") or [] if part.get("label")]
    if parts:
        items = []
        for part in parts:
            part_marks = part.get("marks") or max(1, round(marks / len(parts)) if marks else 1)
            items.append(
                {
                    "label": f"({part['label']})",
                    "marks": part_marks,
                    "points": [
                        f"Award up to {part_marks} mark(s) for a response in the same style as retrieved part ({part['label']}).",
                        "Allow equivalent wording. Award method marks if the new data are used.",
                    ],
                }
            )
        return items
    if question.get("type") == "calculation":
        method = max(1, round(marks / 2) if marks else 1)
        return [
            {"label": "M", "marks": method, "points": ["Correct method / formula from the retrieved worked solution."]},
            {
                "label": "A",
                "marks": max(1, (marks or 2) - method),
                "points": ["Correct substitution of the new values and accurate final answer with units."],
            },
        ]
    if question.get("type") == "mcq":
        return [{"label": "A", "marks": marks or 1, "points": [f"Award full marks for {answer.get('key')} only."]}]
    return [
        {
            "label": "B",
            "marks": marks or 2,
            "points": [
                "Award marking points for accurate, distinct ideas from the retrieved mark scheme.",
                "Do not award extra marks for unrelated topics.",
                "Credit answers that match retrieved ideas after the scenario change."
                if has_solution
                else "Credit definition, explanation, and a justified conclusion.",
            ],
        }
    ]
