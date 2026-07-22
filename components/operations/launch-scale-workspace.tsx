"use client";

import { CalendarSync, CheckCircle2, CircleDashed, CreditCard, DatabaseZap, Globe2, LoaderCircle, Mail, Network, Rocket, ShieldCheck, UsersRound } from "lucide-react";
import { Query } from "appwrite";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type { CalendarConnection, Entitlement, LaunchPreferences, LaunchSnapshot } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";

const integrationLabels: Array<{ key: keyof LaunchSnapshot["integrations"]; label: string; detail: string; icon: typeof Mail }> = [
  { key: "appwriteWeb", label: "Web origins", detail: "Production and local Appwrite origins", icon: Globe2 },
  { key: "email", label: "Email delivery", detail: "Appwrite provider and verified sender", icon: Mail },
  { key: "googleCalendar", label: "Google Calendar", detail: "Two-way OAuth synchronization", icon: CalendarSync },
  { key: "microsoftCalendar", label: "Microsoft Calendar", detail: "Outlook two-way OAuth synchronization", icon: CalendarSync },
  { key: "embeddings", label: "Vector retrieval", detail: "Embedding provider for hybrid search", icon: DatabaseZap },
  { key: "billing", label: "Billing", detail: "Stripe plans and lifecycle events", icon: CreditCard },
  { key: "customDomain", label: "Custom domain", detail: "Production hostname and DNS validation", icon: Globe2 },
];

function percent(value: number, limit: number) {
  return Math.min(100, Math.round((value / Math.max(1, limit)) * 100));
}

export function LaunchScaleWorkspace({ userId }: { userId: string }) {
  const [snapshot, setSnapshot] = useState<LaunchSnapshot | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [preferences, setPreferences] = useState<LaunchPreferences | null>(null);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [launchSnapshot, entitlementRows, preferenceRows, connectionRows] = await Promise.all([
        executeLearningAction<LaunchSnapshot>({ action: "get_launch_snapshot" }),
        tables.listRows<Entitlement>({ databaseId: config.databaseId, tableId: "entitlements", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<CalendarConnection>({ databaseId: config.databaseId, tableId: "calendar_connections", queries: [Query.equal("ownerId", [userId]), Query.limit(2)], ttl: 0 }),
      ]);
      const now = new Date().toISOString();
      const permissions = privateUserPermissions(userId);
      const existingEntitlement = entitlementRows.rows[0];
      const existingPreferences = preferenceRows.rows[0];
      const [savedEntitlement, savedPreferences] = await Promise.all([
        existingEntitlement || tables.upsertRow<Entitlement>({ databaseId: config.databaseId, tableId: "entitlements", rowId: userId, data: { ownerId: userId, plan: "founding-beta", status: "active", aiDailyLimit: 40, storageLimitMb: 1024, collaborationSeats: 3, updatedAt: now }, permissions }),
        existingPreferences || tables.upsertRow<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", rowId: userId, data: { ownerId: userId, releaseChannel: "private-beta", autoUpdates: true, providerAlerts: true, updatedAt: now }, permissions }),
      ]);
      setSnapshot(launchSnapshot);
      setEntitlement(savedEntitlement);
      setPreferences(savedPreferences);
      setConnections(connectionRows.rows);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }, [userId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function saveReleaseControls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const values = new FormData(event.currentTarget);
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const now = new Date().toISOString();
      const permissions = privateUserPermissions(userId);
      const channelValue = String(values.get("releaseChannel"));
      const releaseChannel: LaunchPreferences["releaseChannel"] = ["private-beta", "early-access", "general"].includes(channelValue) ? channelValue as LaunchPreferences["releaseChannel"] : "private-beta";
      const policyValue = String(values.get("conflictPolicy"));
      const conflictPolicy: CalendarConnection["conflictPolicy"] = ["ask", "cognora-wins", "calendar-wins"].includes(policyValue) ? policyValue as CalendarConnection["conflictPolicy"] : "ask";
      const saved = await tables.upsertRow<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", rowId: userId, data: { ownerId: userId, releaseChannel, autoUpdates: values.get("autoUpdates") === "on", providerAlerts: values.get("providerAlerts") === "on", updatedAt: now }, permissions });
      const connectionRows = await Promise.all((["google", "microsoft"] as const).map((provider) => tables.upsertRow<CalendarConnection>({ databaseId: config.databaseId, tableId: "calendar_connections", rowId: `${userId}-${provider}`, data: { ownerId: userId, provider, status: "not-configured", syncMode: "two-way", conflictPolicy, updatedAt: now }, permissions })));
      setPreferences(saved); setConnections(connectionRows); setMessage("Launch channel and calendar conflict policy saved.");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function claimAdmin() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await executeLearningAction<LaunchSnapshot>({ action: "claim_launch_admin" });
      setSnapshot(result); setMessage(result.isAdmin ? "This account is now the private launch owner." : "A launch owner already exists.");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }

  const policy = connections[0]?.conflictPolicy || "ask";
  const usedStorageMb = (snapshot?.personal.storageBytes || 0) / 1024 / 1024;

  return <section className="launch-scale-section" aria-labelledby="launch-scale-title">
    <div className="launch-scale-heading"><div><p className="eyebrow">Phase 7 launch and scale</p><h2 id="launch-scale-title">A controlled path from private beta to launch</h2><p>Meter usage, stage releases, prepare collaboration, and see exactly which production providers are connected before opening access.</p></div><span><Rocket size={17} />Launch control</span></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p className="workspace-success" role="status">{message}</p>}
    {!snapshot || !entitlement || !preferences ? <div className="workspace-loading compact"><LoaderCircle className="spin" size={19} />Loading launch controls…</div> : <>
      <div className="launch-usage-grid">
        <article><span>AI requests today</span><strong>{snapshot.personal.aiJobsToday}<small> / {entitlement.aiDailyLimit}</small></strong><div><i style={{ width: `${percent(snapshot.personal.aiJobsToday, entitlement.aiDailyLimit)}%` }} /></div></article>
        <article><span>Private storage</span><strong>{usedStorageMb.toFixed(1)}<small> / {entitlement.storageLimitMb} MB</small></strong><div><i style={{ width: `${percent(usedStorageMb, entitlement.storageLimitMb)}%` }} /></div></article>
        <article><span>Collaboration seats</span><strong>{snapshot.personal.collaborators}<small> / {entitlement.collaborationSeats}</small></strong><div><i style={{ width: `${percent(snapshot.personal.collaborators, entitlement.collaborationSeats)}%` }} /></div></article>
        <article><span>Active course spaces</span><strong>{snapshot.personal.courses}</strong><div><i style={{ width: `${Math.min(100, snapshot.personal.courses * 10)}%` }} /></div></article>
      </div>
      <div className="launch-scale-grid">
        <form className="settings-panel launch-controls-panel" onSubmit={saveReleaseControls}>
          <header><span><Rocket size={19} /></span><div><p className="card-kicker">Staged release</p><h2>Channel and safeguards</h2></div></header>
          <label>Release channel<select name="releaseChannel" defaultValue={preferences.releaseChannel}><option value="private-beta">Private beta</option><option value="early-access">Early access</option><option value="general">General availability</option></select></label>
          <label>Calendar conflict policy<select name="conflictPolicy" defaultValue={policy}><option value="ask">Ask before replacing either event</option><option value="cognora-wins">Cognora plan wins</option><option value="calendar-wins">External calendar wins</option></select></label>
          <label className="toggle-row"><span><strong>Automatic product updates</strong><small>Use the selected release channel for staged feature availability.</small></span><input name="autoUpdates" type="checkbox" defaultChecked={preferences.autoUpdates} /></label>
          <label className="toggle-row"><span><strong>Provider readiness alerts</strong><small>Surface configuration gaps without sending learning content.</small></span><input name="providerAlerts" type="checkbox" defaultChecked={preferences.providerAlerts} /></label>
          <button className="dialog-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={15} />}{busy ? "Saving…" : "Save launch controls"}</button>
        </form>
        <section className="settings-panel provider-readiness-panel">
          <header><span><Network size={19} /></span><div><p className="card-kicker">Production integrations</p><h2>Truthful readiness</h2></div></header>
          <div className="provider-readiness-list">{integrationLabels.map((integration) => { const ready = snapshot.integrations[integration.key]; return <article key={integration.key} className={ready ? "ready" : "waiting"}><integration.icon size={16} /><div><strong>{integration.label}</strong><span>{integration.detail}</span></div><em>{ready ? <><CheckCircle2 size={13} />Ready</> : <><CircleDashed size={13} />Setup required</>}</em></article>; })}</div>
        </section>
        <section className="settings-panel collaboration-launch-panel">
          <header><span><UsersRound size={19} /></span><div><p className="card-kicker">Collaboration foundation</p><h2>Course membership</h2></div></header>
          <p>Course roles, membership limits, and private membership records are ready. Invitations stay locked until verified email delivery is connected.</p>
          <div className="collaboration-role-grid"><span><strong>Owner</strong>Manage course and members</span><span><strong>Editor</strong>Contribute learning material</span><span><strong>Viewer</strong>Follow shared progress</span></div>
          <button type="button" disabled><Mail size={14} />Invite a collaborator</button>
        </section>
        <section className="settings-panel launch-admin-panel">
          <header><span><ShieldCheck size={19} /></span><div><p className="card-kicker">Privacy-safe administration</p><h2>Release health</h2></div></header>
          {snapshot.isAdmin && snapshot.platform ? <div className="launch-admin-metrics"><article><span>Accounts</span><strong>{snapshot.platform.accounts}</strong></article><article><span>Feedback</span><strong>{snapshot.platform.feedback}</strong></article><article><span>AI jobs today</span><strong>{snapshot.platform.aiJobsToday}</strong></article><article><span>Failed today</span><strong>{snapshot.platform.failedJobsToday}</strong></article></div> : snapshot.canClaimAdmin ? <div className="claim-launch-admin"><p>No launch owner exists yet. Because this deployment is private, the first authenticated Cognora account can claim the aggregate-only release dashboard.</p><button type="button" disabled={busy} onClick={() => void claimAdmin()}><ShieldCheck size={14} />Claim launch ownership</button></div> : <div className="claim-launch-admin"><p>Aggregate release health is restricted to the private launch owner. No learner content is included.</p></div>}
          <p className="operations-note"><ShieldCheck size={15} />Administration exposes account, feedback, job, and failure counts only—never uploaded material, questions, answers, or AI responses.</p>
        </section>
      </div>
    </>}
  </section>;
}
