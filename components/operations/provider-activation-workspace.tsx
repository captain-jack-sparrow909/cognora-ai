"use client";

import { CalendarSync, CheckCircle2, CircleDashed, CreditCard, DatabaseZap, Globe2, LoaderCircle, Mail, RefreshCw, Rocket, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type { LaunchApproval, ProviderActivation, ProviderActivationSnapshot } from "@/lib/appwrite/models";

const providerMeta: Record<ProviderActivation["provider"], { label: string; purpose: string; icon: typeof Mail }> = {
  email: { label: "Email delivery", purpose: "Verified reminders and collaboration invitations", icon: Mail },
  "google-calendar": { label: "Google Calendar", purpose: "OAuth-backed two-way schedule synchronization", icon: CalendarSync },
  embeddings: { label: "Vector retrieval", purpose: "Semantic source search and controlled backfill", icon: DatabaseZap },
  stripe: { label: "Stripe billing", purpose: "Checkout, signed webhooks, and entitlement lifecycle", icon: CreditCard },
  "custom-domain": { label: "Production site", purpose: "Verified Appwrite Sites URL and live application manifest", icon: Globe2 },
};

function statusLabel(status: ProviderActivation["status"]) {
  if (status === "verified") return "Verified";
  if (status === "configured") return "Verification required";
  if (status === "error") return "Check failed";
  return "Configuration required";
}

export function ProviderActivationWorkspace() {
  const [snapshot, setSnapshot] = useState<ProviderActivationSnapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setSnapshot(await executeLearningAction<ProviderActivationSnapshot>({ action: "get_provider_activation_snapshot" })); }
    catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function run<T>(key: string, action: () => Promise<T>, done: (result: T) => string) {
    setBusy(key); setMessage(""); setError("");
    try { const result = await action(); setMessage(done(result)); await load(); }
    catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function verify() {
    await run("verify", () => executeLearningAction<{ allVerified: boolean; providers: ProviderActivation[] }>({ action: "verify_provider_activations" }), (result) => result.allVerified ? "All production providers passed live verification." : "Verification finished. Unverified providers remain locked and are listed below.");
  }

  async function backfill() {
    await run("backfill", () => executeLearningAction<{ processed: number; remainingInWindow: number; complete: boolean }>({ action: "backfill_embeddings", limit: 25 }), (result) => result.processed ? `Embedded ${result.processed} source passages. ${Math.max(0, result.remainingInWindow)} remain in the current window.` : "Every source passage in the current window already has an embedding.");
  }

  async function evaluateLaunch() {
    await run("approval", () => executeLearningAction<{ approval: LaunchApproval }>({ action: "create_final_launch_approval" }), (result) => result.approval.publicLaunchReady ? "The final technical launch gate passed. Sites access still requires explicit approval before it can be opened." : `Public launch remains blocked by ${result.approval.blockers.length} required item${result.approval.blockers.length === 1 ? "" : "s"}.`);
  }

  async function checkout() {
    setBusy("checkout"); setError("");
    try {
      const result = await executeLearningAction<{ checkoutUrl: string }>({ action: "create_billing_checkout", plan: "pro" });
      window.location.assign(result.checkoutUrl);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); setBusy(""); }
  }

  if (!snapshot) return <div className="workspace-loading compact"><LoaderCircle className="spin" size={18} />Loading production activation…</div>;
  const verifiedCount = snapshot.providers.filter((provider) => provider.status === "verified").length;
  const embeddingsReady = snapshot.providers.find((provider) => provider.provider === "embeddings")?.status === "verified";
  const billingReady = snapshot.providers.find((provider) => provider.provider === "stripe")?.status === "verified";

  return <section className="provider-activation-section" aria-labelledby="provider-activation-title">
    <div className="provider-activation-heading"><div><p className="eyebrow">Phase 9 production activation</p><h2 id="provider-activation-title">External systems must prove they are ready</h2><p>Cognora checks provider configuration from the server, performs live verification where possible, records the evidence, and refuses the public-launch gate while any dependency is incomplete.</p></div><span>{verifiedCount} / {snapshot.providers.length} verified</span></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p className="workspace-success" role="status">{message}</p>}
    <div className="activation-provider-grid">{snapshot.providers.map((provider) => { const meta = providerMeta[provider.provider]; return <article className={`activation-provider-card ${provider.status}`} key={provider.provider}><header><span><meta.icon size={17} /></span><em>{provider.status === "verified" ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}{statusLabel(provider.status)}</em></header><h3>{meta.label}</h3><p>{meta.purpose}</p><small>{provider.error || provider.configuration.detail || "Production configuration is not present."}</small>{provider.lastCheckedAt && <time>Checked {new Date(provider.lastCheckedAt).toLocaleString()}</time>}</article>; })}</div>
    <div className="activation-action-grid">
      <article><span><RefreshCw size={19} /></span><div><strong>Verify production providers</strong><p>Checks Appwrite email, Google Calendar credentials, the embedding endpoint, Stripe, and the hosted production site without exposing secrets.</p></div><button type="button" disabled={!snapshot.isAdmin || Boolean(busy)} onClick={() => void verify()}>{busy === "verify" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}Run verification</button></article>
      <article><span><DatabaseZap size={19} /></span><div><strong>Backfill vector retrieval</strong><p>Processes source passages in bounded batches only after the embedding provider passes verification.</p></div><button type="button" disabled={!snapshot.isAdmin || !embeddingsReady || Boolean(busy)} onClick={() => void backfill()}>{busy === "backfill" ? <LoaderCircle className="spin" size={14} /> : <DatabaseZap size={14} />}Backfill 25 passages</button></article>
      <article><span><CreditCard size={19} /></span><div><strong>Subscription lifecycle</strong><p>{snapshot.subscription ? `${snapshot.subscription.plan} · ${snapshot.subscription.status}` : "Stripe checkout and signed webhook updates remain unavailable until verified."}</p></div><button type="button" disabled={!billingReady || Boolean(busy)} onClick={() => void checkout()}>{busy === "checkout" ? <LoaderCircle className="spin" size={14} /> : <CreditCard size={14} />}Start Pro checkout</button></article>
    </div>
    {snapshot.isAdmin && <article className={`final-launch-gate ${snapshot.approval?.publicLaunchReady ? "approved" : "blocked"}`}><div className="final-launch-mark">{snapshot.approval?.publicLaunchReady ? <Rocket size={23} /> : <ShieldAlert size={23} />}</div><div><p className="card-kicker">Final technical approval</p><h3>{snapshot.approval?.publicLaunchReady ? "All technical gates passed" : "Public access remains locked"}</h3><p>{snapshot.approval?.blockers?.length ? snapshot.approval.blockers.slice(0, 4).join(" · ") : "Run the evaluation after every production provider is verified and the controlled cohort is staged."}</p><small>Even an approved technical gate does not alter the Sites access policy. Opening access is a separate explicit action.</small></div><button type="button" disabled={Boolean(busy)} onClick={() => void evaluateLaunch()}>{busy === "approval" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}Evaluate final gate</button></article>}
  </section>;
}
