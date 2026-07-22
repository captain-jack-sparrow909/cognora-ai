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
      "A launch-controlled private AI learning workspace with adaptive planning, grounded guidance, usage entitlements, staged releases, and truthful integration readiness.",
    manifest: "/manifest.webmanifest",
    applicationName: "Cognora AI",
    themeColor: "#10233c",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cognora" },
    openGraph: {
      title: "Cognora AI",
      description: "Private learning intelligence with controlled launch and scale.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Cognora AI connected learning workspace" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognora AI",
      description: "Private learning intelligence with controlled launch and scale.",
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
