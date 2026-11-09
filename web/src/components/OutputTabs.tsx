"use client";

import { useState } from "react";
import type { PageLayout, ParsedOutput } from "@/lib/types";
import { OutputViewer } from "@/components/OutputViewer";

const TABS = [
  { id: "paper", label: "Generated Past Paper" },
  { id: "solution", label: "Generated Suggested Solution" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  output: ParsedOutput;
  paperPages?: PageLayout[];
  solutionPages?: PageLayout[];
};

export function OutputTabs({ output, paperPages = [], solutionPages = [] }: Props) {
  const [tab, setTab] = useState<TabId>("paper");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === item.id ? "bg-blue-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "paper" && (
        <OutputViewer
          title="Generated Past Paper"
          text={output.pastPaper}
          filename="generated-past-paper.pdf"
          pages={paperPages}
          showImages
          flow
        />
      )}
      {tab === "solution" && (
        <OutputViewer
          title="Generated Suggested Solution"
          text={output.suggestedSolution}
          filename="generated-suggested-solution.pdf"
          pages={solutionPages}
          paperText={output.pastPaper}
          paperPages={paperPages}
          showImages
          variant="solution"
        />
      )}
    </div>
  );
}
