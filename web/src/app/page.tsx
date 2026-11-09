import Link from "next/link";

const features = [
  {
    title: "Upload past paper",
    body: "Use a real exam as the layout template: title, instructions, sections, marks, and question order.",
  },
  {
    title: "Upload suggested solution",
    body: "The official solution or mark scheme sets the working style, numbering, and level of detail.",
  },
  {
    title: "Generate similar paper",
    body: "Each item is a close variant—new values or scenarios—not a copy, with the same difficulty and command words.",
  },
  {
    title: "Generate matching solution",
    body: "Answers follow the uploaded solution format and stay consistent with the new numbers and questions.",
  },
  {
    title: "Download PDF",
    body: "Save the new paper as an A4 PDF, with the same page layout, copied figures, and proper mathematical notation.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            University practice papers
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
            Generate a similar past paper and matching suggested solution from files you already have.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Upload a reference paper and its suggested solution. Paper Gen keeps the same course,
            structure, marks, and answer style, then writes a new practice pack you can copy or
            download.
          </p>
          <div className="mt-8">
            <Link
              href="/generate"
              className="inline-flex rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Generate Past Paper
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-2xl font-semibold text-slate-900">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            "Upload the reference past paper and suggested solution (or paste the text).",
            "Add subject, level, and any extra instructions if you want.",
            "Generate a close-variant paper and a worked solution in the same format as the uploaded solution.",
          ].map((step, index) => (
            <li key={step} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-blue-700">Step {index + 1}</p>
              <p className="mt-2 text-slate-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="font-serif text-2xl font-semibold text-slate-900">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
