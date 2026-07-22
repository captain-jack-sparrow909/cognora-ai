"use client";

import { CalendarSync, Check, CheckCircle2, CircleDashed, Clipboard, CreditCard, DatabaseZap, Globe2, KeyRound, LoaderCircle, Mail, Network, Rocket, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { Query } from "appwrite";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type { CalendarConnection, Course, CourseInviteAcceptance, CourseInviteResult, Entitlement, LaunchCohortResult, LaunchPreferences, LaunchReview, LaunchSnapshot } from "@/lib/appwrite/models";
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [invite, setInvite] = useState<CourseInviteResult | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [cohort, setCohort] = useState<LaunchCohortResult | null>(null);
  const [cohortCode, setCohortCode] = useState("");
  const [review, setReview] = useState<LaunchReview | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [launchSnapshot, entitlementRows, preferenceRows, connectionRows, courseRows] = await Promise.all([
        executeLearningAction<LaunchSnapshot>({ action: "get_launch_snapshot" }),
        tables.listRows<Entitlement>({ databaseId: config.databaseId, tableId: "entitlements", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<CalendarConnection>({ databaseId: config.databaseId, tableId: "calendar_connections", queries: [Query.equal("ownerId", [userId]), Query.limit(2)], ttl: 0 }),
        tables.listRows<Course>({ databaseId: config.databaseId, tableId: "courses", queries: [Query.equal("ownerId", [userId]), Query.equal("status", ["active"]), Query.orderAsc("title"), Query.limit(100)], ttl: 0 }),
      ]);
      const now = new Date().toISOString();
      const permissions = privateUserPermissions(userId);
      const existingEntitlement = entitlementRows.rows[0];
      const existingPreferences = preferenceRows.rows[0];
      const [savedEntitlement, savedPreferences] = await Promise.all([
        existingEntitlement || tables.upsertRow<Entitlement>({ databaseId: config.databaseId, tableId: "entitlements", rowId: userId, data: { ownerId: userId, plan: "founding-beta", status: "active", aiDailyLimit: 40, storageLimitMb: 1024, collaborationSeats: 3, updatedAt: now }, permissions }),
        existingPreferences || tables.upsertRow<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", rowId: userId, data: { ownerId: userId, releaseChannel: "private-beta", autoUpdates: true, providerAlerts: true, updatedAt: now }, permissions }),
      ]);
      setSnapshot(launchSnapshot); setEntitlement(savedEntitlement); setPreferences(savedPreferences); setConnections(connectionRows.rows); setCourses(courseRows.rows);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }, [userId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function run<T>(key: string, action: () => Promise<T>, complete: (result: T) => string) {
    setBusy(key); setError(""); setMessage("");
    try { const result = await action(); setMessage(complete(result)); await load(); }
    catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied. Share it only with the intended learner.`); }
    catch { setError(`Copy failed. Select the ${label.toLowerCase()} manually.`); }
  }

  async function saveReleaseControls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await run("controls", async () => {
      const { tables, config } = getAppwriteBrowserServices(); const now = new Date().toISOString(); const permissions = privateUserPermissions(userId);
      const channelValue = String(values.get("releaseChannel")); const releaseChannel: LaunchPreferences["releaseChannel"] = ["private-beta", "early-access", "general"].includes(channelValue) ? channelValue as LaunchPreferences["releaseChannel"] : "private-beta";
      const policyValue = String(values.get("conflictPolicy")); const conflictPolicy: CalendarConnection["conflictPolicy"] = ["ask", "cognora-wins", "calendar-wins"].includes(policyValue) ? policyValue as CalendarConnection["conflictPolicy"] : "ask";
      const saved = await tables.upsertRow<LaunchPreferences>({ databaseId: config.databaseId, tableId: "launch_preferences", rowId: userId, data: { ownerId: userId, releaseChannel, autoUpdates: values.get("autoUpdates") === "on", providerAlerts: values.get("providerAlerts") === "on", updatedAt: now }, permissions });
      const connectionRows = await Promise.all((["google", "microsoft"] as const).map((provider) => tables.upsertRow<CalendarConnection>({ databaseId: config.databaseId, tableId: "calendar_connections", rowId: `${userId}-${provider}`, data: { ownerId: userId, provider, status: "not-configured", syncMode: "two-way", conflictPolicy, updatedAt: now }, permissions })));
      setPreferences(saved); setConnections(connectionRows); return true;
    }, () => "Launch channel and calendar conflict policy saved.");
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await run("invite", () => executeLearningAction<CourseInviteResult>({ action: "create_course_invite", courseId: String(values.get("courseId")), role: values.get("role") === "editor" ? "editor" : "viewer", maxUses: Number(values.get("maxUses")), expiresInDays: Number(values.get("expiresInDays")) }), (result) => { setInvite(result); return `A ${result.role} invitation is ready for ${result.courseTitle}.`; });
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("accept", () => executeLearningAction<CourseInviteAcceptance>({ action: "accept_course_invite", inviteCode: inviteCode.trim() }), (result) => { setInviteCode(""); return `${result.courseTitle} was added to Courses with ${result.role} access.`; });
  }

  async function createCohort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await run("cohort", () => executeLearningAction<LaunchCohortResult>({ action: "create_launch_cohort", name: String(values.get("name")), maxMembers: Number(values.get("maxMembers")) }), (result) => { setCohort(result); return `${result.cohortName} is open for controlled enrollment.`; });
  }

  async function joinCohort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("join", () => executeLearningAction<{ cohortName: string }>({ action: "join_launch_cohort", cohortCode: cohortCode.trim() }), (result) => { setCohortCode(""); return `You joined ${result.cohortName}.`; });
  }

  const policy = connections[0]?.conflictPolicy || "ask";
  const usedStorageMb = (snapshot?.personal.storageBytes || 0) / 1024 / 1024;

  return <section className="launch-scale-section" aria-labelledby="launch-scale-title">
    <div className="launch-scale-heading"><div><p className="eyebrow">Phase 8 launch gate</p><h2 id="launch-scale-title">Invite carefully. Review evidence. Open access deliberately.</h2><p>Collaboration and cohort enrollment now work without pretending external providers are connected. Public launch remains blocked behind verified infrastructure.</p></div><span><Rocket size={17} />Launch gate</span></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p className="workspace-success" role="status">{message}</p>}
    {!snapshot || !entitlement || !preferences ? <div className="workspace-loading compact"><LoaderCircle className="spin" size={19} />Loading launch controls…</div> : <>
      <div className="launch-usage-grid">
        <article><span>AI requests today</span><strong>{snapshot.personal.aiJobsToday}<small> / {entitlement.aiDailyLimit}</small></strong><div><i style={{ width: `${percent(snapshot.personal.aiJobsToday, entitlement.aiDailyLimit)}%` }} /></div></article>
        <article><span>Private storage</span><strong>{usedStorageMb.toFixed(1)}<small> / {entitlement.storageLimitMb} MB</small></strong><div><i style={{ width: `${percent(usedStorageMb, entitlement.storageLimitMb)}%` }} /></div></article>
        <article><span>Collaboration seats</span><strong>{snapshot.personal.collaborators}<small> / {entitlement.collaborationSeats}</small></strong><div><i style={{ width: `${percent(snapshot.personal.collaborators, entitlement.collaborationSeats)}%` }} /></div></article>
        <article><span>Active course spaces</span><strong>{snapshot.personal.courses}</strong><div><i style={{ width: `${Math.min(100, snapshot.personal.courses * 10)}%` }} /></div></article>
      </div>
      <div className="launch-scale-grid phase-eight-grid">
        <section className="settings-panel collaboration-launch-panel phase-eight-wide">
          <header><span><UsersRound size={19} /></span><div><p className="card-kicker">Working collaboration</p><h2>Private course invitations</h2></div></header>
          <div className="phase-eight-columns">
            <form className="phase-eight-form" onSubmit={createInvite}><strong>Create a share code</strong><label>Course<select name="courseId" required defaultValue=""><option value="" disabled>Select a course</option>{courses.map((course) => <option value={course.$id} key={course.$id}>{course.title}</option>)}</select></label><div><label>Role<select name="role" defaultValue="viewer"><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label><label>Uses<input name="maxUses" type="number" min="1" max={entitlement.collaborationSeats} defaultValue="1" /></label><label>Days<input name="expiresInDays" type="number" min="1" max="30" defaultValue="7" /></label></div><button type="submit" disabled={busy === "invite" || courses.length === 0}>{busy === "invite" ? <LoaderCircle className="spin" size={14} /> : <UserPlus size={14} />}Create invitation</button>{invite && <div className="secure-code"><span>{invite.courseTitle} · {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span><code>{invite.inviteCode}</code><button type="button" onClick={() => void copy(invite.inviteCode, "Invitation code")}><Clipboard size={13} />Copy code</button></div>}</form>
            <form className="phase-eight-form" onSubmit={acceptInvite}><strong>Join a shared course</strong><p>Paste the code from a course owner. Cognora verifies it server-side and never stores the usable secret.</p><label>Invitation code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required placeholder="invite-id.secret" autoComplete="off" /></label><button type="submit" disabled={busy === "accept" || !inviteCode.trim()}>{busy === "accept" ? <LoaderCircle className="spin" size={14} /> : <KeyRound size={14} />}Accept invitation</button></form>
          </div>
          <p className="operations-note"><ShieldCheck size={15} />Shared materials, companion summaries, concepts, plans, practice previews, gaps, and roadmaps become readable. Personal attempts, mastery, submissions, feedback, and coach history stay private.</p>
        </section>

        <form className="settings-panel launch-controls-panel" onSubmit={saveReleaseControls}>
          <header><span><Rocket size={19} /></span><div><p className="card-kicker">Staged release</p><h2>Channel and safeguards</h2></div></header>
          <label>Release channel<select name="releaseChannel" defaultValue={preferences.releaseChannel}><option value="private-beta">Private beta</option><option value="early-access">Early access</option><option value="general">General availability</option></select></label>
          <label>Calendar conflict policy<select name="conflictPolicy" defaultValue={policy}><option value="ask">Ask before replacing either event</option><option value="cognora-wins">Cognora plan wins</option><option value="calendar-wins">External calendar wins</option></select></label>
          <label className="toggle-row"><span><strong>Automatic product updates</strong><small>Use the selected release channel for staged feature availability.</small></span><input name="autoUpdates" type="checkbox" defaultChecked={preferences.autoUpdates} /></label>
          <label className="toggle-row"><span><strong>Provider readiness alerts</strong><small>Surface configuration gaps without sending learning content.</small></span><input name="providerAlerts" type="checkbox" defaultChecked={preferences.providerAlerts} /></label>
          <button className="dialog-submit" type="submit" disabled={busy === "controls"}>{busy === "controls" ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={15} />}{busy === "controls" ? "Saving…" : "Save launch controls"}</button>
        </form>

        <section className="settings-panel provider-readiness-panel">
          <header><span><Network size={19} /></span><div><p className="card-kicker">Production integrations</p><h2>Truthful readiness</h2></div></header>
          <div className="provider-readiness-list">{integrationLabels.map((integration) => { const ready = snapshot.integrations[integration.key]; return <article key={integration.key} className={ready ? "ready" : "waiting"}><integration.icon size={16} /><div><strong>{integration.label}</strong><span>{integration.detail}</span></div><em>{ready ? <><CheckCircle2 size={13} />Ready</> : <><CircleDashed size={13} />Setup required</>}</em></article>; })}</div>
        </section>

        <section className="settings-panel cohort-panel">
          <header><span><UsersRound size={19} /></span><div><p className="card-kicker">Controlled cohort</p><h2>Founding learner access</h2></div></header>
          {snapshot.isAdmin && <form className="phase-eight-form compact" onSubmit={createCohort}><label>Cohort name<input name="name" required minLength={3} placeholder="Founding learners · August" /></label><label>Member limit<input name="maxMembers" type="number" min="1" max="500" defaultValue="25" /></label><button type="submit" disabled={busy === "cohort"}>{busy === "cohort" ? <LoaderCircle className="spin" size={14} /> : <UsersRound size={14} />}Open cohort</button>{cohort && <div className="secure-code"><span>{cohort.cohortName} · {cohort.maxMembers} seats</span><code>{cohort.cohortCode}</code><button type="button" onClick={() => void copy(cohort.cohortCode, "Cohort code")}><Clipboard size={13} />Copy code</button></div>}</form>}
          <form className="phase-eight-form compact" onSubmit={joinCohort}><label>Join code<input value={cohortCode} onChange={(event) => setCohortCode(event.target.value)} required placeholder="cohort-id.secret" autoComplete="off" /></label><button type="submit" disabled={busy === "join" || !cohortCode.trim()}>{busy === "join" ? <LoaderCircle className="spin" size={14} /> : <KeyRound size={14} />}Join cohort</button></form>
        </section>

        <section className="settings-panel launch-admin-panel phase-eight-wide">
          <header><span><ShieldCheck size={19} /></span><div><p className="card-kicker">Audited launch review</p><h2>Release health and launch gates</h2></div></header>
          {snapshot.isAdmin && snapshot.platform ? <><div className="launch-admin-metrics phase-eight-metrics"><article><span>Accounts</span><strong>{snapshot.platform.accounts}</strong></article><article><span>Active invites</span><strong>{snapshot.platform.activeInvites}</strong></article><article><span>Cohort members</span><strong>{snapshot.platform.cohortMembers}</strong></article><article><span>Warnings today</span><strong>{snapshot.platform.securityWarningsToday}</strong></article><article><span>Failed AI jobs</span><strong>{snapshot.platform.failedJobsToday}</strong></article></div><button className="launch-review-button" type="button" disabled={busy === "review"} onClick={() => void run("review", () => executeLearningAction<LaunchReview>({ action: "run_launch_review" }), (result) => { setReview(result); return result.publicLaunchReady ? "All public launch gates passed." : result.privatePilotReady ? "The private pilot gate passed; external public-launch providers are still required." : "The review found private-pilot gates that still need attention."; })}>{busy === "review" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}Run launch review</button>{review && <div className="launch-review-results"><div><strong>{review.privatePilotReady ? "Private pilot ready" : "Private pilot blocked"}</strong><span>{review.publicLaunchReady ? "Public launch ready" : "Public launch stays locked"}</span></div>{review.checks.map((check) => <span className={check.passed ? "passed" : "blocked"} key={check.key}>{check.passed ? <Check size={13} /> : <CircleDashed size={13} />}{check.label}</span>)}</div>}</> : snapshot.canClaimAdmin ? <div className="claim-launch-admin"><p>No launch owner exists yet. The first authenticated Cognora account can claim the aggregate-only release dashboard while this deployment remains private.</p><button type="button" disabled={busy === "claim"} onClick={() => void run("claim", () => executeLearningAction<LaunchSnapshot>({ action: "claim_launch_admin" }), (result) => { setSnapshot(result); return result.isAdmin ? "This account is now the private launch owner." : "A launch owner already exists."; })}><ShieldCheck size={14} />Claim launch ownership</button></div> : <div className="claim-launch-admin"><p>Aggregate release health is restricted to the private launch owner. No learner content is included.</p></div>}
          <p className="operations-note"><ShieldCheck size={15} />Every invite, cohort enrollment, rejected code, and launch review creates a content-free security event. Public access is never enabled by a preference toggle.</p>
        </section>
      </div>
    </>}
  </section>;
}
