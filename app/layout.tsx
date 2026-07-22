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
      "A launch-gated private AI learning workspace with adaptive planning, grounded guidance, secure course collaboration, controlled cohorts, and truthful integration readiness.",
    manifest: "/manifest.webmanifest",
    applicationName: "Cognora AI",
    themeColor: "#10233c",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cognora" },
    openGraph: {
      title: "Cognora AI",
      description: "One learning system. A controlled path to launch.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1728, height: 910, alt: "Cognora AI controlled learning launch path" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognora AI",
      description: "One learning system. A controlled path to launch.",
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
