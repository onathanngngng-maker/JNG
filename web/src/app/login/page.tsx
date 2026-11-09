import { PasswordForm } from "@/components/PasswordForm";
import { passwordRequired, safeNextPath } from "@/lib/siteAccess";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!passwordRequired()) redirect("/generate");
  const params = await searchParams;
  const nextValue = typeof params.next === "string" ? params.next : "/generate";

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-slate-900">Enter the password</h1>
      <p className="mt-3 text-slate-600">
        Paper Gen is shared with a password. The home page stays open. Generating a paper asks for
        the password first.
      </p>
      <PasswordForm nextPath={safeNextPath(nextValue)} />
    </div>
  );
}
