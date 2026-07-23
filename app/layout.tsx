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
    icons: {
      icon: [
        { url: "/brand/cognora-favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/cognora-favicon-64.png", sizes: "64x64", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "Cognora AI",
      description: "Your learning, finally connected.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "Cognora AI — Your learning, finally connected" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognora AI",
      description: "Your learning, finally connected.",
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
