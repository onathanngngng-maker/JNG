export const ACCESS_COOKIE = "paper_gen_access";

export function sitePassword(): string {
  return (process.env.SITE_PASSWORD || "").trim();
}

export function passwordRequired(): boolean {
  return sitePassword().length > 0;
}

export function passwordMatches(input: string): boolean {
  const expected = sitePassword();
  const given = input.trim();
  if (!expected || given.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function accessToken(): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sitePassword()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("paper-gen-access"),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cookieAllowsAccess(cookieValue: string | undefined): Promise<boolean> {
  if (!passwordRequired()) return true;
  const expected = await accessToken();
  const given = cookieValue || "";
  if (given.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/generate";
  }
  return value;
}
