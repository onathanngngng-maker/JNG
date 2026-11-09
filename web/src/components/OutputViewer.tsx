"use client";

import { useRef, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExamPreview } from "@/components/ExamPreview";
import { downloadPreviewPdf } from "@/lib/downloadPdf";
import type { PageLayout } from "@/lib/types";

type Props = {
  title: string;
  text: string;
  filename: string;
  pages?: PageLayout[];
  paperText?: string;
  paperPages?: PageLayout[];
  showImages?: boolean;
  flow?: boolean;
  variant?: "paper" | "solution";
};

export function OutputViewer({
  title,
  text,
  filename,
  pages,
  paperText,
  paperPages,
  showImages,
  flow,
  variant = "paper",
}: Props) {
  const empty = !text.trim();
  const rootRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onDownload() {
    if (!rootRef.current) return;
    setSaving(true);
    setError("");
    try {
      await downloadPreviewPdf(filename, rootRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h3 className="font-serif text-lg font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          disabled={empty || saving}
          onClick={onDownload}
          className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
        >
          {saving ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>
      <div className="px-4">
        <ErrorMessage message={error} />
      </div>
      <div className="overflow-x-auto bg-slate-100 px-4 py-6">
        {empty ? (
          <p className="text-sm text-slate-500">
            This section was empty. The model may have skipped the heading. Click Generate again, or check the
            other tabs.
          </p>
        ) : (
          <div ref={rootRef}>
            <ExamPreview
              text={text}
              pages={pages}
              paperText={paperText}
              paperPages={paperPages}
              showImages={showImages}
              flow={flow}
              variant={variant}
            />
          </div>
        )}
      </div>
    </section>
  );
}
