"use client";

type Props = {
  pending: boolean;
  children: string;
};

export function LoadingButton({ pending, children }: Props) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
    >
      {pending ? "Generating…" : children}
    </button>
  );
}
