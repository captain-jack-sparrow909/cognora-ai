"use client";

import { CalendarDays, CheckCircle2, Download, ExternalLink, LoaderCircle, MessageSquareText, ShieldCheck, UsersRound } from "lucide-react";
import { ID, Query } from "appwrite";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type { BetaProfile, CalendarConnection, ProductFeedback, StudyTask } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";
import { trackProductEvent } from "@/lib/appwrite/product-analytics";

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function calendarStamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function endDate(task: StudyTask) {
  return new Date(new Date(task.scheduledFor).getTime() + task.durationMinutes * 60_000);
}

function calendarDetails(task: StudyTask) {
  return `${task.durationMinutes} minute Cognora study session${task.reason ? ` — ${task.reason}` : ""}`;
}

function externalCalendarUrl(task: StudyTask) {
  const start = new Date(task.scheduledFor);
  const end = endDate(task);
  const query = new URLSearchParams({ action: "TEMPLATE", text: task.title, dates: `${calendarStamp(start.toISOString())}/${calendarStamp(end.toISOString())}`, details: calendarDetails(task) });
  return `https://calendar.google.com/calendar/render?${query}`;
}

function downloadCalendar(tasks: StudyTask[]) {
  const events = tasks.map((task) => [
    "BEGIN:VEVENT",
    `UID:${task.$id}@cognora.ai`,
    `DTSTAMP:${calendarStamp(new Date().toISOString())}`,
    `DTSTART:${calendarStamp(task.scheduledFor)}`,
    `DTEND:${calendarStamp(endDate(task).toISOString())}`,
    `SUMMARY:${icsText(task.title)}`,
    `DESCRIPTION:${icsText(calendarDetails(task))}`,
    "END:VEVENT",
  ].join("\r\n"));
  const value = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cognora AI//Study Plan//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([value], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "cognora-study-plan.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export function BetaGrowthWorkspace({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<BetaProfile | null>(null);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [feedback, setFeedback] = useState<ProductFeedback[]>([]);
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const now = new Date().toISOString();
      const [profiles, taskRows, feedbackRows, connectionRows] = await Promise.all([
        tables.listRows<BetaProfile>({ databaseId: config.databaseId, tableId: "beta_profiles", queries: [Query.equal("ownerId", [userId]), Query.limit(1)], ttl: 0 }),
        tables.listRows<StudyTask>({ databaseId: config.databaseId, tableId: "study_tasks", queries: [Query.equal("ownerId", [userId]), Query.equal("status", ["planned"]), Query.greaterThanEqual("scheduledFor", [now]), Query.orderAsc("scheduledFor"), Query.limit(50)], ttl: 0 }),
        tables.listRows<ProductFeedback>({ databaseId: config.databaseId, tableId: "product_feedback", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(5)], ttl: 0 }),
        tables.listRows<CalendarConnection>({ databaseId: config.databaseId, tableId: "calendar_connections", queries: [Query.equal("ownerId", [userId]), Query.equal("provider", ["google"]), Query.limit(1)], ttl: 0 }),
      ]);
      setProfile(profiles.rows[0] || null);
      setTasks(taskRows.rows);
      setFeedback(feedbackRows.rows);
      setCalendarConnection(connectionRows.rows[0] || null);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }, [userId]);

  async function connectGoogleCalendar() {
    setCalendarBusy(true); setError(""); setMessage("");
    try {
      const result = await executeLearningAction<{ authorizationUrl: string }>({ action: "create_google_calendar_authorization" });
      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught)); setCalendarBusy(false);
    }
  }

  async function syncGoogleCalendar() {
    setCalendarBusy(true); setError(""); setMessage("");
    try {
      const result = await executeLearningAction<{ created: number; updated: number; total: number }>({ action: "sync_google_calendar" });
      setMessage(`Google Calendar synced ${result.total} session${result.total === 1 ? "" : "s"} (${result.created} created, ${result.updated} updated).`);
      await load();
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setCalendarBusy(false); }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const nextTask = tasks[0];
  const upcomingLabel = useMemo(() => tasks.length === 1 ? "1 upcoming session" : `${tasks.length} upcoming sessions`, [tasks.length]);

  async function saveAnalytics(enabled: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const now = new Date().toISOString();
      const saved = await tables.upsertRow<BetaProfile>({
        databaseId: config.databaseId,
        tableId: "beta_profiles",
        rowId: userId,
        data: { ownerId: userId, cohort: profile?.cohort || "founding-beta", analyticsEnabled: enabled, joinedAt: profile?.joinedAt || now, updatedAt: now },
        permissions: privateUserPermissions(userId),
      });
      setProfile(saved);
      setMessage(enabled ? "Private product analytics enabled." : "Product analytics disabled. Your learning content is never included.");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const categoryValue = String(values.get("category"));
      const category: ProductFeedback["category"] = ["idea", "confusing", "bug", "delight"].includes(categoryValue) ? categoryValue as ProductFeedback["category"] : "idea";
      const row = await tables.createRow<ProductFeedback>({
        databaseId: config.databaseId,
        tableId: "product_feedback",
        rowId: ID.unique(),
        data: { ownerId: userId, category, rating: Number(values.get("rating")), message: String(values.get("message") || "").trim().slice(0, 20_000), status: "new", createdAt: new Date().toISOString() },
        permissions: privateUserPermissions(userId),
      });
      setFeedback((current) => [row, ...current].slice(0, 5));
      form.reset();
      setMessage("Thanks — your feedback is stored privately for the beta team.");
      await trackProductEvent(userId, "feedback_submitted", "settings", { category: row.category, rating: row.rating }).catch(() => undefined);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }

  return <section className="beta-growth-section" aria-labelledby="beta-growth-title">
    <div className="beta-growth-heading"><div><p className="eyebrow">Phase 6 beta growth</p><h2 id="beta-growth-title">Take Cognora beyond the browser tab</h2><p>Install the workspace, carry your study plan into a calendar, and shape the founding beta with privacy controls you can change anytime.</p></div><span><UsersRound size={17} />Founding beta</span></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p className="workspace-success" role="status">{message}</p>}
    <div className="beta-growth-grid">
      <article className="settings-panel calendar-panel">
        <header><span><CalendarDays size={19} /></span><div><p className="card-kicker">Calendar portability</p><h2>Your plan, where you work</h2></div></header>
        <div className="calendar-summary"><div><strong>{upcomingLabel}</strong><span>{nextTask ? `Next: ${nextTask.title}` : "Generate a study plan to add sessions."}</span></div><button type="button" disabled={!tasks.length} onClick={() => { downloadCalendar(tasks); void trackProductEvent(userId, "calendar_exported", "settings", { sessions: tasks.length }).catch(() => undefined); }}><Download size={15} />Export .ics</button></div>
        <div className="calendar-links"><p>{calendarConnection?.status === "connected" ? "Keep planned sessions synchronized" : "Connect Google Calendar for one-click plan synchronization"}</p>{calendarConnection?.status === "connected" ? <button type="button" disabled={calendarBusy || !tasks.length} onClick={() => void syncGoogleCalendar()}>{calendarBusy ? <LoaderCircle className="spin" size={13} /> : <CalendarDays size={13} />}Sync Google Calendar</button> : <button type="button" disabled={calendarBusy} onClick={() => void connectGoogleCalendar()}>{calendarBusy ? <LoaderCircle className="spin" size={13} /> : <CalendarDays size={13} />}Connect Google Calendar</button>}{nextTask && <a href={externalCalendarUrl(nextTask)} target="_blank" rel="noreferrer" onClick={() => void trackProductEvent(userId, "calendar_link_opened", "settings", { provider: "google" }).catch(() => undefined)}>Add next session manually <ExternalLink size={13} /></a>}</div>
        <p className="operations-note"><ShieldCheck size={15} />Exports include session titles, timing, duration, and planning reason. They do not include uploaded material, answers, or coach conversations.</p>
      </article>
      <article className="settings-panel beta-panel">
        <header><span><ShieldCheck size={19} /></span><div><p className="card-kicker">Consent-first analytics</p><h2>Help improve the beta</h2></div></header>
        <label className="toggle-row"><span><strong>Share product usage signals</strong><small>Records feature names, screen names, session IDs, and timestamps only—never course content, filenames, questions, answers, or AI responses.</small></span><input type="checkbox" checked={profile?.analyticsEnabled || false} disabled={busy} onChange={(event) => void saveAnalytics(event.target.checked)} /></label>
        <div className="beta-status"><CheckCircle2 size={16} /><div><strong>{profile?.analyticsEnabled ? "Analytics enabled" : "Analytics off by default"}</strong><span>Cohort: {profile?.cohort || "founding-beta"}</span></div></div>
      </article>
      <form className="settings-panel feedback-panel" onSubmit={submitFeedback}>
        <header><span><MessageSquareText size={19} /></span><div><p className="card-kicker">Beta feedback</p><h2>Tell us what would help</h2></div></header>
        <div className="feedback-fields"><label>Feedback type<select name="category" defaultValue="idea"><option value="idea">Feature idea</option><option value="confusing">Something confusing</option><option value="bug">Bug report</option><option value="delight">What worked well</option></select></label><label>Experience rating<select name="rating" defaultValue="4"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Frustrating</option><option value="1">1 — Blocked</option></select></label></div>
        <label>Message<textarea name="message" required minLength={5} maxLength={20000} placeholder="What happened, what did you expect, or what should Cognora do next?" /></label>
        <button className="dialog-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <MessageSquareText size={15} />}{busy ? "Sending…" : "Send private feedback"}</button>
        {feedback.length > 0 && <p className="feedback-history">{feedback.length} recent {feedback.length === 1 ? "submission" : "submissions"} · Latest status: {feedback[0].status}</p>}
      </form>
    </div>
  </section>;
}
