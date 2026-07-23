import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CognoraAI Learning Workspace",
    short_name: "CognoraAI",
    description: "Plan, learn, practice, and understand in one private AI learning workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#10233c",
    icons: [
      { src: "/brand/cognora-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/cognora-logo-google.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
