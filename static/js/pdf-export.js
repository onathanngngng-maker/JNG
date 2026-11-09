const PaperPdf = (() => {
  function footer(doc, page, total, label) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`${label}  ·  page ${page} of ${total}`, 20, 287);
    doc.setTextColor(20);
  }

  function writeLines(doc, text, y, maxWidth = 170) {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line) => {
      if (y > 272) {
        doc.addPage();
        y = 24;
      }
      doc.text(line, 20, y);
      y += 6.2;
    });
    return y;
  }

  function stampPages(doc, label) {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      footer(doc, i, pages, label);
    }
  }

  function writePaper(doc, pack, startY) {
    let y = startY;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const body = pack.formatted_paper || [pack.header, "", ...(pack.questions || []).map((q) => q.formatted || `${q.heading || `Question ${q.number}`}\n${q.text}`)].join("\n\n");
    y = writeLines(doc, body, y);
    return y;
  }

  function writeAnswers(doc, pack, startY) {
    let y = startY;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    y = writeLines(doc, "ANSWER KEY AND WORKED SOLUTIONS", y);
    y += 4;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const source = pack.usedSolution
      ? "Worked solutions follow the uploaded solution style, with new values and full working."
      : "Model answers in the reference answer style. Upload a solution PDF for closer marking-scheme alignment.";
    y = writeLines(doc, source, y);
    y += 6;
    pack.answers.forEach((a) => {
      const heading = a.heading || `Question ${a.number}`;
      doc.setFont("times", "bold");
      y = writeLines(doc, heading, y);
      doc.setFont("times", "normal");
      y = writeLines(doc, a.working, y);
      y += 8;
    });
    return y;
  }

  function writeScheme(doc, pack, startY) {
    let y = startY;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    y = writeLines(doc, "MARKING SCHEME", y);
    y += 4;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    y = writeLines(
      doc,
      "Award marks for equivalent wording. Method marks are available where the candidate uses the new data correctly. Do not credit unrelated topics or extra questions.",
      y
    );
    y += 6;
    pack.scheme.forEach((s) => {
      const heading = s.heading || `Question ${s.number}`;
      doc.setFont("times", "bold");
      y = writeLines(doc, heading, y);
      doc.setFont("times", "normal");
      s.items.forEach((item) => {
        const body = `${item.label}${item.marks ? ` [${item.marks}]` : ""}: ${item.points.join(" ")}`;
        y = writeLines(doc, body, y);
        y += 2;
      });
      y += 6;
    });
    return y;
  }

  function newDoc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: "mm", format: "a4" });
  }

  function downloadFullPack(pack) {
    const doc = newDoc();
    writePaper(doc, pack, 20);
    doc.addPage();
    writeAnswers(doc, pack, 20);
    doc.addPage();
    writeScheme(doc, pack, 20);
    stampPages(doc, pack.title);
    doc.save(safeName(pack.title, "full-pack"));
  }

  function downloadQuestions(pack) {
    const doc = newDoc();
    writePaper(doc, pack, 20);
    stampPages(doc, "Practice paper");
    doc.save(safeName(pack.title, "paper"));
  }

  function downloadAnswers(pack) {
    const doc = newDoc();
    writeAnswers(doc, pack, 20);
    doc.addPage();
    writeScheme(doc, pack, 20);
    stampPages(doc, "Answers and marking scheme");
    doc.save(safeName(pack.title, "answers-and-marking-scheme"));
  }

  function safeName(title, suffix) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paper";
    return `${base}-${suffix}.pdf`;
  }

  return { downloadFullPack, downloadQuestions, downloadAnswers };
})();
