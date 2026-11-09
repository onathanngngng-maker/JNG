"use client";

import { FormEvent, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { FileUploadBox } from "@/components/FileUploadBox";
import { LoadingButton } from "@/components/LoadingButton";
import { OutputTabs } from "@/components/OutputTabs";
import { TextInputSection } from "@/components/TextInputSection";
import { extractDocument } from "@/lib/extractText";
import type { PageLayout, ParsedOutput } from "@/lib/types";

export function GenerateForm() {
  const [pastPaperText, setPastPaperText] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [subject, setSubject] = useState("");
  const [academicLevel, setAcademicLevel] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [paperFileName, setPaperFileName] = useState("");
  const [solutionFileName, setSolutionFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<ParsedOutput | null>(null);
  const [paperPages, setPaperPages] = useState<PageLayout[]>([]);
  const [solutionPages, setSolutionPages] = useState<PageLayout[]>([]);

  async function onUpload(kind: "paper" | "solution", file: File) {
    setError("");
    try {
      if (kind === "paper") {
        const extracted = await extractDocument(file);
        setPastPaperText(extracted.text);
        setPaperPages(extracted.pages);
        setPaperFileName(file.name);
      } else {
        const extracted = await extractDocument(file);
        setSolutionText(extracted.text);
        setSolutionPages(extracted.pages);
        setSolutionFileName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/generate-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastPaperText,
          solutionText,
          subject,
          academicLevel,
          extraInstructions,
          pageLayout: paperPages.map(({ page, questionNumbers, images }) => ({
            page,
            questionNumbers,
            figureCount: images.length,
          })),
          solutionPageLayout: solutionPages.map(({ page, questionNumbers }) => ({
            page,
            questionNumbers,
          })),
        }),
      });
      const payload = (await response.json()) as ParsedOutput & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Generation failed.");
      }
      setOutput(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <FileUploadBox
            label="Reference past paper"
            hint="Upload .txt or .pdf, or paste below"
            fileName={paperFileName}
            onFile={(file) => onUpload("paper", file)}
          />
          <FileUploadBox
            label="Suggested solution"
            hint="Upload .txt or .pdf, or paste below. The generated solution copies this format."
            fileName={solutionFileName}
            onFile={(file) => onUpload("solution", file)}
          />
        </div>

        <TextInputSection
          label="Past paper text"
          value={pastPaperText}
          onChange={setPastPaperText}
          placeholder="Paste the extracted past paper here if you are not uploading a file."
        />
        <TextInputSection
          label="Suggested solution text"
          value={solutionText}
          onChange={setSolutionText}
          placeholder="Paste the official solution. The generated solution will follow this format."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Subject / topic</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Organic chemistry"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Academic level</span>
            <input
              value={academicLevel}
              onChange={(event) => setAcademicLevel(event.target.value)}
              placeholder="e.g. Year 2 undergraduate"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Extra instructions</span>
          <textarea
            value={extraInstructions}
            onChange={(event) => setExtraInstructions(event.target.value)}
            placeholder="Optional. e.g. keep SI units, prefer local names, avoid a specific topic."
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <LoadingButton pending={pending}>Generate</LoadingButton>
          {pending ? (
            <p className="text-sm text-slate-500">Calling the model. The paper and the solution are written one after the other. This can take a couple of minutes.</p>
          ) : null}
        </div>
        <ErrorMessage message={error} />
      </form>

      {output ? <OutputTabs output={output} paperPages={paperPages} solutionPages={solutionPages} /> : null}
    </div>
  );
}
