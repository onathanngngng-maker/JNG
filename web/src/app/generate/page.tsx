import { GenerateForm } from "@/components/GenerateForm";

export default function GeneratePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-slate-900">Generate a similar past paper</h1>
      <p className="mt-3 max-w-3xl text-slate-600">
        Upload or paste a reference past paper and its suggested solution. The generated paper will
        follow the original layout; the generated solution will follow the original answer style.
        Figures from the upload are copied across. Each generated question must stay consistent
        with that image; new variants should change calculation numbers, not the object in the figure.
      </p>
      <div className="mt-8">
        <GenerateForm />
      </div>
    </div>
  );
}
