import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paper Gen",
    short_name: "Paper Gen",
    description: "Generate similar university past papers and matching solutions as PDF.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
  };
}
