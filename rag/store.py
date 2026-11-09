import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "with",
    "that",
    "this",
    "from",
    "by",
    "as",
    "at",
    "be",
    "it",
    "if",
}


def tokenize(text: str) -> list[str]:
    return [tok for tok in TOKEN_RE.findall((text or "").lower()) if tok not in STOP and len(tok) > 1]


class RagStore:
    def __init__(self, path: Path):
        self.path = path
        self.docs: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            self.docs = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self.docs = []

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.docs, ensure_ascii=False, indent=2), encoding="utf-8")

    def ingest(self, chunks: list[dict[str, Any]]) -> dict[str, int]:
        source_ids = {chunk["source_id"] for chunk in chunks}
        self.docs = [doc for doc in self.docs if doc.get("source_id") not in source_ids]
        self.docs.extend(chunks)
        self.save()
        return self.stats()

    def stats(self) -> dict[str, int]:
        kinds = Counter(doc.get("kind") for doc in self.docs)
        sources = {doc.get("source_id") for doc in self.docs}
        return {
            "chunks": len(self.docs),
            "sources": len(sources),
            "questions": kinds.get("question", 0),
            "solutions": kinds.get("solution", 0),
        }

    def _df(self) -> Counter:
        df: Counter = Counter()
        for doc in self.docs:
            df.update(set(tokenize(doc.get("text") or "")))
        return df

    def _vector(self, text: str, df: Counter, n_docs: int) -> dict[str, float]:
        tokens = tokenize(text)
        if not tokens:
            return {}
        tf = Counter(tokens)
        vec: dict[str, float] = {}
        for term, count in tf.items():
            idf = math.log((n_docs + 1) / (1 + df.get(term, 0))) + 1
            vec[term] = (count / len(tokens)) * idf
        return vec

    @staticmethod
    def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
        if not left or not right:
            return 0.0
        dot = sum(value * right[key] for key, value in left.items() if key in right)
        norm_l = math.sqrt(sum(value * value for value in left.values()))
        norm_r = math.sqrt(sum(value * value for value in right.values()))
        if norm_l == 0 or norm_r == 0:
            return 0.0
        return dot / (norm_l * norm_r)

    def search(
        self,
        query: str,
        k: int = 4,
        kind: str | None = None,
        source_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not self.docs:
            return []
        df = self._df()
        n_docs = len(self.docs)
        query_vec = self._vector(query, df, n_docs)
        scored: list[dict[str, Any]] = []
        for doc in self.docs:
            if kind and doc.get("kind") != kind:
                continue
            if source_id and doc.get("source_id") != source_id:
                continue
            score = self._cosine(query_vec, self._vector(doc.get("text") or "", df, n_docs))
            if score <= 0:
                continue
            excerpt = re.sub(r"\s+", " ", doc.get("text") or "")[:220]
            scored.append({**doc, "score": round(score, 4), "excerpt": excerpt})
        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:k]
