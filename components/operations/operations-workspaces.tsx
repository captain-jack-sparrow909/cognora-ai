"use client";

import {
  Activity,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Channel, Query } from "appwrite";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type { AiJob, LearnerNotification, ReminderPreferences } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function upsertById<T extends { $id: string }>(rows: T[], row: T) {
  const index = rows.findIndex((candidate) => candidate.$id === row.$id);
  if (index === -1) return [row, ...rows];
  const next = [...rows];
  next[index] = row;
  return next;
}

export function ActivityCenter({ userId, onOpenSettings }: { userId: string; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [notifications, setNotifications] = useState<LearnerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [jobRows, notificationRows] = await Promise.all([
        tables.listRows<AiJob>({ databaseId: config.databaseId, tableId: "ai_jobs", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(20)], ttl: 0 }),
        tables.listRows<LearnerNotification>({ databaseId: config.databaseId, tableId: "notifications", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(30)], ttl: 0 }),
      ]);
      setJobs(jobRows.rows);
      setNotifications(notificationRows.rows);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  useEffect(() => {
    const { client, config } = getAppwriteBrowserServices();
    const unsubscribeJobs = client.subscribe<AiJob>(Channel.tablesdb(config.databaseId).table("ai_jobs").row(), (event) => {
      if (event.payload.ownerId === userId) setJobs((current) => upsertById(current, event.payload).slice(0, 20));
    });
    const unsubscribeNotifications = client.subscribe<LearnerNotification>(Channel.tablesdb(config.databaseId).table("notifications").row(), (event) => {
      if (event.payload.ownerId === userId) setNotifications((current) => upsertById(current, event.payload).slice(0, 30));
    });
    const onJob = (event: Event) => {
      const job = (event as CustomEvent<AiJob>).detail;
      if (job.ownerId === userId) setJobs((current) => upsertById(current, job).slice(0, 20));
    };
    window.addEventListener("cognora:ai-job", onJob);
    return () => { unsubscribeJobs(); unsubscribeNotifications(); window.removeEventListener("cognora:ai-job", onJob); };
  }, [userId]);

  const active = jobs.filter((job) => job.status === "queued" || job.status === "processing");
  const dueNotifications = notifications.filter((notification) => !notification.scheduledFor || new Date(notification.scheduledFor) <= new Date());
  const unread = dueNotifications.filter((notification) => !notification.read).length;

  async function markRead() {
    const { tables, config } = getAppwriteBrowserServices();
    const unreadRows = dueNotifications.filter((notification) => !notification.read);
    await Promise.all(unreadRows.map((notification) => tables.updateRow({ databaseId: config.databaseId, tableId: "notifications", rowId: notification.$id, data: { read: true } })));
    setNotifications((current) => current.map((notification) => unreadRows.some((row) => row.$id === notification.$id) ? { ...notification, read: true } : notification));
  }

  const liveMessage = active[0] ? `${active[0].label}: ${active[0].stage}, ${active[0].progress} percent` : "";

  return <div className="activity-center">
    <span className="sr-only" aria-live="polite">{liveMessage}</span>
    <button className="activity-trigger" type="button" aria-label={`Activity${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {active.length ? <LoaderCircle className="spin" size={17} /> : <Bell size={17} />}
      {(unread > 0 || active.length > 0) && <span>{active.length || unread}</span>}
    </button>
    {open && <aside className="activity-popover" aria-label="Learning activity">
      <header><div><p className="card-kicker">Realtime activity</p><h2>Updates and reminders</h2></div><button className="icon-button" type="button" aria-label="Close activity" onClick={() => setOpen(false)}><X size={16} /></button></header>
      {active.length > 0 && <section className="active-job-list">{active.map((job) => <article key={job.$id}><div><span><Sparkles size={13} />{job.label}</span><strong>{job.progress}%</strong></div><p>{job.stage}</p><div className="job-progress"><span style={{ width: `${job.progress}%` }} /></div></article>)}</section>}
      <section className="notification-list">
        {loading ? <div className="activity-empty"><LoaderCircle className="spin" size={18} /> Loading activity…</div> : dueNotifications.length === 0 ? <div className="activity-empty"><BellRing size={21} /><strong>All quiet for now</strong><span>AI results and study reminders will appear here.</span></div> : dueNotifications.slice(0, 8).map((notification) => <article className={notification.read ? "" : "unread"} key={notification.$id}><span className={`notification-icon ${notification.type}`}>{notification.type === "ai-failed" ? <TriangleAlert size={14} /> : notification.type === "reminder" ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}</span><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{relativeTime(notification.createdAt)}</small></div></article>)}
      </section>
      <footer>{unread > 0 && <button type="button" onClick={() => void markRead()}><Check size={13} />Mark all read</button>}<button type="button" onClick={() => { setOpen(false); onOpenSettings(); }}>Notification settings</button></footer>
    </aside>}
  </div>;
}

export function SettingsWorkspace({ userId, timezone }: { userId: string; timezone: string }) {
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [preferenceRows, jobRows] = await Promise.all([
        tables.listRows<ReminderPreferences>({ databaseId: config.databaseId, tableId: "reminder_preferences", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<AiJob>({ databaseId: config.databaseId, tableId: "ai_jobs", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(30)], ttl: 0 }),
      ]);
      setPreferences(preferenceRows.rows[0] || null);
      setJobs(jobRows.rows);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const saved = await tables.upsertRow<ReminderPreferences>({
        databaseId: config.databaseId,
        tableId: "reminder_preferences",
        rowId: userId,
        data: {
          ownerId: userId,
          inAppEnabled: form.get("inAppEnabled") === "on",
          emailEnabled: false,
          dailyTime: String(form.get("dailyTime") || "18:00"),
          daysJson: JSON.stringify(form.getAll("days")),
          timezone,
          taskLeadMinutes: Number(form.get("taskLeadMinutes") || 30),
          quietStart: String(form.get("quietStart") || "22:00"),
          quietEnd: String(form.get("quietEnd") || "07:00"),
          updatedAt: new Date().toISOString(),
        },
        permissions: privateUserPermissions(userId),
      });
      setPreferences(saved);
      const result = await executeLearningAction<{ created: number }>({ action: "sync_reminders" });
      setMessage(`Preferences saved. ${result.created || 0} upcoming reminders synced.`);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }

  const days = useMemo(() => {
    try { return JSON.parse(preferences?.daysJson || '["mon","tue","wed","thu","fri"]') as string[]; } catch { return ["mon", "tue", "wed", "thu", "fri"]; }
  }, [preferences]);
  const completed = jobs.filter((job) => job.status === "completed");
  const failed = jobs.filter((job) => job.status === "failed");
  const totalTokens = completed.reduce((total, job) => total + (job.promptTokens || 0) + (job.completionTokens || 0), 0);
  const averageDuration = completed.length ? Math.round(completed.reduce((total, job) => total + (job.durationMs || 0), 0) / completed.length / 1000) : 0;

  return <div className="page-wrap operations-page">
    <section className="workspace-page-heading"><div><p className="eyebrow">Settings and operations</p><h1>Reminders that respect your attention</h1><p>Control in-app study prompts and review private AI usage signals without exposing course content.</p></div></section>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p className="workspace-success" role="status">{message}</p>}
    {loading ? <div className="workspace-loading"><LoaderCircle className="spin" size={20} />Loading preferences…</div> : <div className="settings-grid">
      <form className="settings-panel reminder-settings" onSubmit={save}>
        <header><span><BellRing size={19} /></span><div><p className="card-kicker">Study reminders</p><h2>In-app schedule</h2></div></header>
        <label className="toggle-row"><span><strong>In-app reminders</strong><small>Show planned sessions and completed AI work in Cognora.</small></span><input name="inAppEnabled" type="checkbox" defaultChecked={preferences?.inAppEnabled ?? true} /></label>
        <label className="toggle-row disabled"><span><strong>Email reminders</strong><small>Ready to enable after an Appwrite email provider and sender are connected.</small></span><Mail size={17} /><input name="emailEnabled" type="checkbox" disabled /></label>
        <div className="settings-two-col"><label>Daily digest time<input name="dailyTime" type="time" defaultValue={preferences?.dailyTime || "18:00"} /></label><label>Task reminder<select name="taskLeadMinutes" defaultValue={String(preferences?.taskLeadMinutes || 30)}><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label></div>
        <fieldset><legend>Study days</legend><div className="day-picker">{[["mon","M"],["tue","T"],["wed","W"],["thu","T"],["fri","F"],["sat","S"],["sun","S"]].map(([value,label]) => <label key={value}><input name="days" type="checkbox" value={value} defaultChecked={days.includes(value)} /><span>{label}</span></label>)}</div></fieldset>
        <div className="settings-two-col"><label>Quiet hours start<input name="quietStart" type="time" defaultValue={preferences?.quietStart || "22:00"} /></label><label>Quiet hours end<input name="quietEnd" type="time" defaultValue={preferences?.quietEnd || "07:00"} /></label></div>
        <button className="dialog-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}{busy ? "Syncing…" : "Save and sync reminders"}</button>
      </form>
      <section className="settings-panel operations-panel">
        <header><span><Activity size={19} /></span><div><p className="card-kicker">Private observability</p><h2>Recent AI health</h2></div></header>
        <div className="operations-metrics"><article><span>Success rate</span><strong>{jobs.length ? Math.round((completed.length / jobs.length) * 100) : 100}%</strong></article><article><span>Tokens recorded</span><strong>{totalTokens.toLocaleString()}</strong></article><article><span>Average runtime</span><strong>{averageDuration}s</strong></article></div>
        <div className="job-history">{jobs.length === 0 ? <p>No AI operations recorded yet.</p> : jobs.slice(0, 8).map((job) => <article key={job.$id}><span className={job.status}>{job.status === "completed" ? <CheckCircle2 size={14} /> : job.status === "failed" ? <TriangleAlert size={14} /> : <LoaderCircle className="spin" size={14} />}</span><div><strong>{job.label}</strong><small>{job.stage} · {relativeTime(job.createdAt)}</small></div><em>{job.durationMs ? `${Math.round(job.durationMs / 1000)}s` : `${job.progress}%`}</em></article>)}</div>
        <p className="operations-note"><ShieldCheck size={15} />Operational records contain status, duration, model, and token totals—not submission text or AI responses. The daily request guardrail is enforced server-side.</p>
        {failed.length > 0 && <p className="failure-note"><TriangleAlert size={14} />{failed.length} recent {failed.length === 1 ? "job needs" : "jobs need"} attention. Existing learning data remains intact.</p>}
      </section>
    </div>}
  </div>;
}
