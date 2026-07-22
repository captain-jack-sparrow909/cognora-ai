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
      "A private AI learning workspace with adaptive planning, grounded guidance, secure collaboration, and server-verified production launch gates.",
    manifest: "/manifest.webmanifest",
    applicationName: "Cognora AI",
    themeColor: "#10233c",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cognora" },
    openGraph: {
      title: "Cognora AI",
      description: "Providers must prove they are ready.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "Cognora AI production provider verification gates" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognora AI",
      description: "Providers must prove they are ready.",
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
