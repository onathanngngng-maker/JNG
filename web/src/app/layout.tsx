import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SiteHeader } from "@/components/SiteHeader";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paper Gen — similar university past papers",
  description:
    "Upload a reference past paper and suggested solution to generate a close-variant paper and a matching worked solution.",
  applicationName: "Paper Gen",
  appleWebApp: {
    capable: true,
    title: "Paper Gen",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
