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
    title: "Cognora AI — Your learning, finally connected",
    description:
      "Cognora AI turns course evidence into private feedback, explainable knowledge gaps, adaptive roadmaps, and grounded coaching.",
    openGraph: {
      title: "Cognora AI",
      description: "Evidence becomes direction.",
      type: "website",
      images: [{ url: `${origin}/og-phase4.png`, width: 1536, height: 1024, alt: "Cognora AI connected intelligence loop" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognora AI",
      description: "Evidence becomes direction.",
      images: [`${origin}/og-phase4.png`],
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
