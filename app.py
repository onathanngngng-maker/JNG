from flask import Flask, jsonify, render_template, request

from rag.pipeline import generate_pack, ingest, stats

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/rag/stats")
def rag_stats():
    return jsonify(stats())


@app.route("/api/rag/ingest", methods=["POST"])
def rag_ingest():
    payload = request.get_json(force=True, silent=True) or {}
    paper_text = (payload.get("paper_text") or "").strip()
    if not paper_text:
        return jsonify({"error": "paper_text is required"}), 400
    meta = {
        "title": payload.get("title") or "",
        "subject": payload.get("subject") or "",
        "level": payload.get("level") or "",
        "time": payload.get("time") or "",
    }
    result = ingest(paper_text, payload.get("solution_text") or "", meta, payload.get("source_id"))
    return jsonify(result)


@app.route("/api/rag/generate", methods=["POST"])
def rag_generate():
    payload = request.get_json(force=True, silent=True) or {}
    paper_text = (payload.get("paper_text") or "").strip()
    if not paper_text:
        return jsonify({"error": "paper_text is required"}), 400
    meta = {
        "title": payload.get("title") or "",
        "subject": payload.get("subject") or "",
        "level": payload.get("level") or "",
        "time": payload.get("time") or "",
    }
    pack = generate_pack(paper_text, payload.get("solution_text") or "", meta, payload.get("source_id"))
    return jsonify(pack)


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5050)
