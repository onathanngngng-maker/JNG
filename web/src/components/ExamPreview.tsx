"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { layoutA4Sheets, type FittedSheet } from "@/lib/fitA4Pages";
import { layoutSolutionLikeUpload, paginateLikeOriginal } from "@/lib/pageLayout";
import {
  injectFigureIntoQuestion,
  injectFigureIntoSolution,
  latexToHtml,
  questionBlockHtml,
  renderSolutionPage,
} from "@/lib/latexToHtml";
import type { PageLayout } from "@/lib/types";

type Props = {
  text: string;
  pages?: PageLayout[];
  paperText?: string;
  paperPages?: PageLayout[];
  showImages?: boolean;
  flow?: boolean;
  variant?: "paper" | "solution";
};

const BODY_CLASS = "exam-body font-serif text-slate-900";

function sameSheets(left: FittedSheet[], right: FittedSheet[]) {
  return left.length === right.length && left.every((sheet, index) => sheet.html === right[index]?.html && sheet.fontPx === right[index]?.fontPx);
}

function A4Sheets({
  label,
  html,
  logicalPageCount,
  showPageLabel,
  footer,
}: {
  label: string;
  html: string;
  logicalPageCount: number;
  showPageLabel: boolean;
  footer?: string;
}) {
  const probeRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [sheets, setSheets] = useState<FittedSheet[]>([{ html, fontPx: 15 }]);

  useLayoutEffect(() => {
    let cancelled = false;

    const measure = () => {
      const probe = probeRef.current;
      const body = bodyRef.current;
      if (!probe || !body) return;
      const maxHeight = body.clientHeight;
      const contentWidth = body.clientWidth;
      if (maxHeight < 10 || contentWidth < 10) return;
      probe.style.width = `${contentWidth}px`;
      const next = layoutA4Sheets(html, probe, maxHeight);
      if (cancelled) return;
      setSheets((prev) => (sameSheets(prev, next) ? prev : next));
    };

    const watchImages = () => {
      const probe = probeRef.current;
      if (!probe) return;
      probe.innerHTML = html;
      probe.querySelectorAll("img").forEach((img) => {
        if (img.complete || img.dataset.a4Wait === "1") return;
        img.dataset.a4Wait = "1";
        img.addEventListener(
          "load",
          () => {
            img.dataset.a4Wait = "0";
            if (!cancelled) measure();
          },
          { once: true },
        );
      });
    };

    measure();
    watchImages();
    const frame = requestAnimationFrame(() => {
      if (!cancelled) measure();
    });
    const fontsReady = document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      void fontsReady;
    };
  }, [html]);

  return (
    <div className="space-y-6">
      {sheets.map((sheet, index) => {
        const continued = logicalPageCount > 1 && index > 0;
        const sheetLabel =
          logicalPageCount === 1 && sheets.length > 1
            ? `Page ${index + 1}`
            : continued
              ? `${label} (continued)`
              : label;
        return (
          <div key={`${sheet.fontPx}-${index}`} className="a4-frame">
            <article className={`pdf-page${footer ? " solution-sheet" : ""}`} data-page-label={sheetLabel}>
              {showPageLabel ? <p className="pdf-page-label">{sheetLabel}</p> : null}
              <div
                ref={index === 0 ? bodyRef : undefined}
                className={BODY_CLASS}
                style={{ fontSize: showPageLabel ? `${sheet.fontPx}px` : "15px" }}
                dangerouslySetInnerHTML={{ __html: sheet.html }}
              />
              {footer ? <p className="pdf-page-footer">{footer}</p> : null}
            </article>
          </div>
        );
      })}
      <div className="a4-measure" aria-hidden="true">
        <div ref={probeRef} className={BODY_CLASS} />
      </div>
    </div>
  );
}

export function ExamPreview({
  text,
  pages = [],
  paperText = "",
  paperPages = [],
  showImages = true,
  flow = false,
  variant = "paper",
}: Props) {
  const solution = variant === "solution";
  const generated = solution ? layoutSolutionLikeUpload(text, paperText, pages) : paginateLikeOriginal(text, pages);

  return (
    <div id="exam-preview-root" className="space-y-6">
      {generated.map((page) => {
        const questionText = page.htmlSource.replace(/\[FIGURE FROM ORIGINAL PAGE \d+\]/gi, "").trim();
        if (!questionText) return null;
        const layout = pages.find((row) => row.page === page.page);
        const paperLayout = paperPages.find((row) => row.questionNumbers.some((number) => page.questionNumbers.includes(number)));
        const images = showImages ? (layout?.images?.length ? layout.images : paperLayout?.images || []) : [];
        let html = solution ? renderSolutionPage(page.htmlSource) : questionBlockHtml(latexToHtml(page.htmlSource, flow));
        images.forEach((src, imageIndex) => {
          const img = `<img src="${src}" alt="Figure from original page ${page.page}" class="exam-figure" />`;
          if (solution) {
            html = injectFigureIntoSolution(html, img);
            return;
          }
          const questionNumber = page.questionNumbers[imageIndex] ?? page.questionNumbers[0];
          html = injectFigureIntoQuestion(html, img, questionNumber);
        });
        html = html.replace(/\[FIGURE FROM ORIGINAL PAGE \d+\]/gi, "");
        if (!html.trim()) return null;
        const questions = page.questionNumbers.length
          ? ` · Question${page.questionNumbers.length > 1 ? "s" : ""} ${page.questionNumbers.join(", ")}`
          : "";
        return (
          <A4Sheets
            key={page.page}
            label={`Page ${page.page}${questions}`}
            html={html}
            logicalPageCount={generated.length}
            showPageLabel={!solution}
            footer={solution ? `Page ${page.page} of ${pages.length || generated.length}` : undefined}
          />
        );
      })}
    </div>
  );
}
