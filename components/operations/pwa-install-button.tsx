"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { trackProductEvent } from "@/lib/appwrite/product-analytics";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton({ userId }: { userId: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      void trackProductEvent(userId, "pwa_install_prompted").catch(() => undefined);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      void trackProductEvent(userId, "pwa_installed").catch(() => undefined);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [userId]);

  if (installed) return <span className="installed-chip" title="Cognora is installed"><Smartphone size={15} />Installed</span>;
  if (!prompt) return null;

  return <button className="install-button" type="button" onClick={async () => {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
  }}><Download size={15} />Install app</button>;
}
