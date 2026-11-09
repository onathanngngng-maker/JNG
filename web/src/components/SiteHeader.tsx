import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-lg font-semibold text-slate-900">
          Paper Gen
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-blue-700">
            Home
          </Link>
          <Link
            href="/generate"
            className="rounded-full bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
          >
            Generate Past Paper
          </Link>
        </nav>
      </div>
    </header>
  );
}
