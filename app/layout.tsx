import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "CognoraAI — AI-powered learning platform for students",
    description:
      "CognoraAI is an AI-powered learning platform for students with study planning, lecture support, learning roadmaps, assignment feedback, and knowledge-gap detection.",
    manifest: "/manifest.webmanifest",
    applicationName: "CognoraAI",
    themeColor: "#10233c",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CognoraAI" },
    icons: {
      icon: [
        { url: "/brand/cognora-favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/cognora-favicon-64.png", sizes: "64x64", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "CognoraAI",
      description: "An AI-powered learning platform for students.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "CognoraAI — Your learning, finally connected" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CognoraAI",
      description: "An AI-powered learning platform for students.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
