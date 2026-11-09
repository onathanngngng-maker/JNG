(() => {
  const paperInput = document.getElementById("paper-file");
  const solutionInput = document.getElementById("solution-file");
  const generateBtn = document.getElementById("generate-btn");
  const sampleBtn = document.getElementById("sample-btn");
  const statusEl = document.getElementById("status");
  const ragStatsEl = document.getElementById("rag-stats");
  const resultPanel = document.getElementById("result-panel");
  const paperPreview = document.getElementById("paper-preview");
  const answerPreview = document.getElementById("answer-preview");
  const schemePreview = document.getElementById("scheme-preview");
  const retrievalPreview = document.getElementById("retrieval-preview");
  const resultNote = document.getElementById("result-note");
  const titleInput = document.getElementById("paper-title");
  const subjectInput = document.getElementById("paper-subject");
  const levelInput = document.getElementById("paper-level");
  const timeInput = document.getElementById("paper-time");

  let pack = null;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function bindDrop(zone, input, nameEl) {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
      const file = event.dataTransfer.files[0];
      if (!file) return;
      input.files = event.dataTransfer.files;
      nameEl.textContent = file.name;
    });
    input.addEventListener("change", () => {
      nameEl.textContent = input.files[0] ? input.files[0].name : "Click or drop a PDF";
    });
  }

  bindDrop(document.getElementById("paper-drop"), paperInput, document.getElementById("paper-file-name"));
  bindDrop(
    document.getElementById("solution-drop"),
    solutionInput,
    document.getElementById("solution-file-name")
  );

  async function extractPdfText(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToLines(content.items));
    }
    return pages.join("\n\n");
  }

  function itemsToLines(items) {
    const sorted = [...items].sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      if (Math.abs(dy) > 2.5) return dy;
      return a.transform[4] - b.transform[4];
    });
    const lines = [];
    let currentY = null;
    let buffer = [];
    sorted.forEach((item) => {
      const y = item.transform[5];
      const str = item.str || "";
      if (!str) return;
      if (currentY === null || Math.abs(y - currentY) > 3) {
        if (buffer.length) lines.push(buffer.join(" ").replace(/[ \t]+/g, " ").trim());
        buffer = [str];
        currentY = y;
      } else {
        buffer.push(str);
      }
    });
    if (buffer.length) lines.push(buffer.join(" ").replace(/[ \t]+/g, " ").trim());
    return lines.filter(Boolean).join("\n");
  }

  function meta() {
    return {
      title: titleInput.value.trim(),
      subject: subjectInput.value.trim(),
      level: levelInput.value.trim(),
      time: timeInput.value.trim(),
    };
  }

  function showStats(stats) {
    if (!stats) return;
    ragStatsEl.textContent = `RAG index: ${stats.chunks} chunks from ${stats.sources} source(s) · ${stats.questions} questions · ${stats.solutions} solutions`;
  }

  async function refreshStats() {
    try {
      const res = await fetch("/api/rag/stats");
      if (!res.ok) return;
      showStats(await res.json());
    } catch (error) {
      console.error(error);
    }
  }

  function renderPack(nextPack) {
    pack = nextPack;
    paperPreview.textContent = pack.formatted_paper || [pack.header, "", ...pack.questions.map((q) => q.formatted || `${q.heading || `Question ${q.number}`}\n${q.text}`)].join("\n\n");
    answerPreview.textContent = pack.answers
      .map((a) => `${a.heading || `Question ${a.number}`}\n${a.working}`)
      .join("\n\n");
    schemePreview.textContent = pack.scheme
      .map((s) => {
        const lines = s.items.map((item) => `${item.label}${item.marks ? ` [${item.marks}]` : ""}: ${item.points.join(" ")}`);
        return `${s.heading || `Question ${s.number}`}\n${lines.join("\n")}`;
      })
      .join("\n\n");
    retrievalPreview.textContent = (pack.retrievals || [])
      .map((row) => {
        const sols = (row.solution_hits || [])
          .slice(0, 2)
          .map((hit) => `${hit.id} ${hit.score}`)
          .join(", ");
        const qs = (row.question_hits || [])
          .slice(0, 2)
          .map((hit) => `${hit.id} ${hit.score}`)
          .join(", ");
        return `Q${row.number}  questions: ${qs || "—"}  |  solutions: ${sols || "—"}`;
      })
      .join("\n");
    const grounded = (pack.retrievals || []).filter((row) => (row.solution_hits || []).length).length;
    resultNote.textContent = pack.usedSolution
      ? `RAG grounded ${grounded}/${pack.questions.length} question(s) in retrieved solution chunks.`
      : "RAG indexed the paper. Add a solution PDF so answers retrieve from a mark scheme.";
    resultPanel.classList.remove("hidden");
    showStats(pack.stats);
  }

  async function generateFromText(paperText, solutionText) {
    setStatus("Indexing into the RAG store…");
    const res = await fetch("/api/rag/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper_text: paperText,
        solution_text: solutionText,
        ...meta(),
      }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "RAG generate failed");
    renderPack(payload);
    setStatus(`RAG generated ${payload.questions.length} close-variant question(s).`);
  }

  generateBtn.addEventListener("click", async () => {
    const file = paperInput.files[0];
    if (!file) {
      setStatus("Upload a reference past paper PDF first, or load the sample.");
      return;
    }
    generateBtn.disabled = true;
    setStatus("Reading the reference paper…");
    try {
      const paperText = await extractPdfText(file);
      let solutionText = "";
      if (solutionInput.files[0]) {
        setStatus("Reading the solution…");
        solutionText = await extractPdfText(solutionInput.files[0]);
      }
      await generateFromText(paperText, solutionText);
    } catch (error) {
      console.error(error);
      setStatus("RAG generate failed. Check the PDF text, or load the sample.");
    } finally {
      generateBtn.disabled = false;
    }
  });

  sampleBtn.addEventListener("click", async () => {
    subjectInput.value = subjectInput.value || "Introduction to Environmental Science";
    levelInput.value = levelInput.value || "Year 1 undergraduate";
    timeInput.value = timeInput.value || "2 hours";
    titleInput.value = titleInput.value || "Practice past paper";
    sampleBtn.disabled = true;
    try {
      await generateFromText(PaperGenerator.SAMPLE_PAPER, PaperGenerator.SAMPLE_SOLUTION);
    } catch (error) {
      console.error(error);
      setStatus("Could not reach the RAG API. Is the Flask server running?");
    } finally {
      sampleBtn.disabled = false;
    }
  });

  document.getElementById("dl-full").addEventListener("click", () => {
    if (!pack) return;
    PaperPdf.downloadFullPack(pack);
  });
  document.getElementById("dl-questions").addEventListener("click", () => {
    if (!pack) return;
    PaperPdf.downloadQuestions(pack);
  });
  document.getElementById("dl-answers").addEventListener("click", () => {
    if (!pack) return;
    PaperPdf.downloadAnswers(pack);
  });

  refreshStats();
})();
