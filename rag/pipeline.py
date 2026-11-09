from __future__ import annotations

import time
import uuid
from pathlib import Path
from typing import Any

from rag.chunker import format_heading, make_chunks, parse_paper
from rag.store import RagStore
from rag.variants import collect_numbers, marking_points, model_answer, variant_header, variant_preserve, variant_text

ROOT = Path(__file__).resolve().parent.parent
STORE = RagStore(ROOT / "data" / "rag_index.json")

EXAMINER_BRIEF = (
    "You are an expert university examiner. Create a new practice past paper that closely "
    "follows the uploaded reference paper. Preserve its course, structure, number of questions, "
    "question types, subquestions, marks, difficulty, topic sequence, and answer style."
)


def ingest(paper_text: str, solution_text: str, meta: dict[str, Any], source_id: str | None = None) -> dict[str, Any]:
    source_id = source_id or f"src-{uuid.uuid4().hex[:10]}"
    chunks = make_chunks(paper_text, solution_text, meta, source_id)
    stats = STORE.ingest(chunks)
    return {
        "source_id": source_id,
        "indexed": len(chunks),
        "stats": stats,
        "at": int(time.time()),
    }


def generate_pack(paper_text: str, solution_text: str, meta: dict[str, Any], source_id: str | None = None) -> dict[str, Any]:
    ingested = ingest(paper_text, solution_text, meta, source_id)
    source_id = ingested["source_id"]
    parsed = parse_paper(paper_text)
    title = meta.get("title") or meta.get("subject") or "Practice past paper"
    used_solution = bool((solution_text or "").strip())
    retrievals: list[dict[str, Any]] = []
    questions_out: list[dict[str, Any]] = []
    answers_out: list[dict[str, Any]] = []
    scheme_out: list[dict[str, Any]] = []

    for question in parsed["questions"]:
        mapping = collect_numbers(question["text"])
        query = question["text"]
        similar_questions = STORE.search(query, k=3, kind="question")
        similar_solutions = STORE.search(query, k=5, kind="solution")
        same_source_solution = next(
            (hit for hit in similar_solutions if hit.get("source_id") == source_id and hit.get("number") == question["number"]),
            None,
        )
        best_solution = same_source_solution or (similar_solutions[0] if similar_solutions else None)
        formatted = variant_preserve(question.get("raw") or question["text"], mapping)
        heading_style = question.get("heading_style") or parsed.get("heading_style") or "question"
        heading = format_heading(heading_style, question["number"])

        new_question = {
            "number": question["number"],
            "heading": heading,
            "heading_style": heading_style,
            "formatted": formatted,
            "text": variant_text(question["text"], mapping),
            "parts": [
                {**part, "text": variant_preserve(part["text"], mapping)} for part in question.get("parts") or []
            ],
            "marks": question.get("marks"),
            "mark_style": question.get("mark_style") or parsed.get("mark_style"),
            "type": question.get("type"),
            "options": [
                {**opt, "text": variant_preserve(opt["text"], mapping)} for opt in question.get("options") or []
            ],
        }
        note_bits = []
        if best_solution:
            note_bits.append(
                f"Retrieved solution {best_solution.get('id')} (score {best_solution.get('score')})."
            )
        retrieval_note = " ".join(note_bits) or "No solution chunk retrieved; used examiner method template."
        answer = model_answer(new_question, best_solution["text"] if best_solution else None, mapping, retrieval_note)
        scheme = marking_points(new_question, answer, bool(best_solution))
        questions_out.append(new_question)
        answers_out.append(
            {
                "number": new_question["number"],
                "heading": heading,
                "marks": new_question["marks"],
                "type": new_question["type"],
                **answer,
            }
        )
        scheme_out.append(
            {
                "number": new_question["number"],
                "heading": heading,
                "marks": new_question["marks"],
                "items": scheme,
            }
        )
        retrievals.append(
            {
                "number": question["number"],
                "question_hits": [
                    {"id": hit["id"], "score": hit["score"], "excerpt": hit["excerpt"]} for hit in similar_questions
                ],
                "solution_hits": [
                    {"id": hit["id"], "score": hit["score"], "excerpt": hit["excerpt"]} for hit in similar_solutions
                ],
            }
        )

    header = variant_header(parsed["header"], meta.get("subject") or "", meta.get("level") or "", meta.get("time") or "")
    formatted_paper = "\n\n".join(
        [part for part in [header, *[q["formatted"] for q in questions_out]] if part]
    )
    heading_style = parsed.get("heading_style") or "question"
    return {
        "title": title,
        "subject": meta.get("subject") or "",
        "level": meta.get("level") or "",
        "time": meta.get("time") or "",
        "header": header,
        "formatted_paper": formatted_paper,
        "heading_style": heading_style,
        "mark_style": parsed.get("mark_style") or "brackets-marks",
        "usedSolution": used_solution,
        "brief": EXAMINER_BRIEF,
        "mode": "rag",
        "source_id": source_id,
        "stats": ingested["stats"],
        "questions": questions_out,
        "answers": answers_out,
        "scheme": scheme_out,
        "retrievals": retrievals,
    }


def stats() -> dict[str, int]:
    return STORE.stats()
