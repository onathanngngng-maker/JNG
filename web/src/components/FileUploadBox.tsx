"use client";

type Props = {
  label: string;
  hint: string;
  fileName?: string;
  onFile: (file: File) => void;
};

export function FileUploadBox({ label, hint, fileName, onFile }: Props) {
  return (
    <label className="flex cursor-pointer flex-col rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 hover:border-blue-400 hover:bg-blue-50/40">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 text-sm text-slate-600">{fileName || hint}</span>
      <input
        type="file"
        accept=".txt,.md,.pdf,text/plain,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
