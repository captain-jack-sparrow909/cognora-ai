"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Flag,
  Lightbulb,
  LoaderCircle,
  MessageCircleMore,
  Paperclip,
  Plus,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type {
  Assignment,
  AssignmentSubmission,
  CoachMessage,
  Course,
  CourseConcept,
  FeedbackReport,
  GapInsight,
  LearningRoadmap,
  RoadmapStep,
} from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";

function jsonList<T = string>(value?: string): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

async function loadCourses(userId: string) {
  const { tables, config } = getAppwriteBrowserServices();
  return tables.listRows<Course>({
    databaseId: config.databaseId,
    tableId: "courses",
    queries: [Query.equal("ownerId", [userId]), Query.equal("status", ["active"]), Query.orderAsc("title"), Query.limit(100)],
    ttl: 0,
  });
}

function IntelligenceLoading({ label }: { label: string }) {
  return <div className="workspace-loading"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function AssignmentsWorkspace({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [courseRows, assignmentRows, submissionRows, reportRows] = await Promise.all([
        loadCourses(userId),
        tables.listRows<Assignment>({ databaseId: config.databaseId, tableId: "assignments", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(100)], ttl: 0 }),
        tables.listRows<AssignmentSubmission>({ databaseId: config.databaseId, tableId: "submissions", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("submittedAt"), Query.limit(100)], ttl: 0 }),
        tables.listRows<FeedbackReport>({ databaseId: config.databaseId, tableId: "feedback_reports", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(100)], ttl: 0 }),
      ]);
      setCourses(courseRows.rows);
      setAssignments(assignmentRows.rows);
      setSubmissions(submissionRows.rows);
      setReports(reportRows.rows);
      setSelectedId((current) => current || assignmentRows.rows[0]?.$id || "");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Attach the work you want Cognora to review."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx", "txt", "md"].includes(extension)) { setError("Use a PDF, DOC, DOCX, TXT, or MD submission."); return; }
    setBusy("create"); setError(""); setUploadProgress(0);
    const form = new FormData(event.currentTarget);
    const assignmentId = ID.unique();
    const fileId = ID.unique();
    const dueValue = String(form.get("dueAt") || "");
    const { tables, storage, config } = getAppwriteBrowserServices();
    const permissions = privateUserPermissions(userId);
    try {
      await storage.createFile({
        bucketId: config.submissionsBucketId,
        fileId,
        file,
        permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
        onProgress: (progress) => setUploadProgress(Math.round(progress.progress)),
      });
      const now = new Date().toISOString();
      const assignment = await tables.createRow<Assignment>({
        databaseId: config.databaseId,
        tableId: "assignments",
        rowId: assignmentId,
        data: {
          ownerId: userId,
          courseId: String(form.get("courseId")),
          title: String(form.get("title") || "").trim(),
          brief: String(form.get("brief") || "").trim(),
          rubricText: String(form.get("rubricText") || "").trim(),
          dueAt: dueValue ? new Date(dueValue).toISOString() : undefined,
          status: "submitted",
          createdAt: now,
        },
        permissions,
      });
      await tables.createRow({
        databaseId: config.databaseId,
        tableId: "submissions",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          courseId: assignment.courseId,
          assignmentId,
          fileId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          status: "uploaded",
          submittedAt: now,
        },
        permissions,
      });
      setShowCreate(false); setSelectedId(assignmentId); setSelectedFileName("");
      await load();
    } catch (caught) {
      await storage.deleteFile({ bucketId: config.submissionsBucketId, fileId }).catch(() => undefined);
      setError(getAppwriteErrorMessage(caught));
    } finally { setBusy(""); setUploadProgress(0); }
  }

  async function review(assignmentId: string) {
    setBusy(assignmentId); setError("");
    try {
      await executeLearningAction({ action: "review_assignment", assignmentId });
      await load();
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(""); }
  }

  const selected = assignments.find((assignment) => assignment.$id === selectedId);
  const report = reports.find((item) => item.assignmentId === selectedId);
  const submission = submissions.find((item) => item.assignmentId === selectedId);
  const courseMap = useMemo(() => Object.fromEntries(courses.map((course) => [course.$id, course])), [courses]);
  const strengths = jsonList<string>(report?.strengthsJson);
  const improvements = jsonList<{ issue?: string; evidence?: string; howToImprove?: string }>(report?.improvementsJson);
  const rubric = jsonList<{ criterion?: string; level?: string; score?: number; feedback?: string }>(report?.rubricJson);
  const nextSteps = jsonList<string>(report?.nextStepsJson);

  return (
    <div className="page-wrap intelligence-page">
      <section className="workspace-page-heading"><div><p className="eyebrow">Assignment feedback</p><h1>Improve the work, not just the score</h1><p>Review your submission against its actual brief and rubric. Feedback is advisory and private.</p></div><button className="create-course-button" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> New review</button></section>
      {error && <p className="workspace-error" role="alert">{error}</p>}
      {loading ? <IntelligenceLoading label="Loading assignments…" /> : assignments.length === 0 ? <section className="intelligence-empty"><span><ClipboardCheck size={27} /></span><h2>Bring your first assignment</h2><p>Add the brief, rubric, and your work. Cognora will connect revision advice back to course concepts.</p><button className="create-course-button" type="button" onClick={() => setShowCreate(true)}>Start a review <ArrowRight size={15} /></button></section> : (
        <section className="assignment-layout">
          <aside className="assignment-list">{assignments.map((assignment) => <button className={selectedId === assignment.$id ? "active" : ""} type="button" key={assignment.$id} onClick={() => setSelectedId(assignment.$id)}><span className={`assignment-state ${assignment.status}`}><FileText size={16} /></span><div><strong>{assignment.title}</strong><span>{courseMap[assignment.courseId]?.title || "Course"} · {formatDate(assignment.dueAt)}</span></div><ChevronRight size={15} /></button>)}</aside>
          <div className="assignment-report-shell">
            {selected && <div className="assignment-report-heading"><div><p className="card-kicker">{courseMap[selected.courseId]?.title || "Assignment"}</p><h2>{selected.title}</h2><span><Paperclip size={13} />{submission?.name || "Submission attached"}</span></div>{!report && <button className="ai-action-button primary" type="button" disabled={Boolean(busy)} onClick={() => void review(selected.$id)}>{busy === selected.$id ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{busy === selected.$id ? "Reviewing…" : "Generate feedback"}</button>}</div>}
            {report ? <div className="feedback-report">
              <div className="feedback-score"><div><strong>{report.advisoryScore}</strong><span>advisory score</span></div><p>{report.summary}</p></div>
              <div className="feedback-columns"><article><p className="card-kicker"><CheckCircle2 size={14} /> Strengths</p>{strengths.map((strength) => <p key={strength}>{strength}</p>)}</article><article><p className="card-kicker coral"><Target size={14} /> Improvements</p>{improvements.map((item, index) => <div key={`${item.issue}-${index}`}><strong>{item.issue}</strong><p>{item.howToImprove}</p>{item.evidence && <small>Evidence: {item.evidence}</small>}</div>)}</article></div>
              <article className="rubric-breakdown"><div className="section-heading"><div><p className="card-kicker">Rubric-linked review</p><h3>Criterion breakdown</h3></div><span>Advisory, not an official grade</span></div>{rubric.map((item, index) => <div className="rubric-row" key={`${item.criterion}-${index}`}><div><strong>{item.criterion}</strong><span>{item.level}</span></div><p>{item.feedback}</p><strong>{item.score ?? "—"}</strong></div>)}</article>
              <article className="revision-plan"><p className="card-kicker"><Flag size={14} /> Revision plan</p><ol>{nextSteps.map((step) => <li key={step}>{step}</li>)}</ol></article>
            </div> : <div className="report-ready"><span><FileCheck2 size={25} /></span><h3>Ready for a rubric-linked review</h3><p>Cognora will inspect the submission, preserve your authorship, and turn feedback into an ordered revision plan.</p></div>}
          </div>
        </section>
      )}
      {showCreate && <div className="dialog-scrim" role="presentation" onMouseDown={() => setShowCreate(false)}><section className="course-dialog assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-dialog-title" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><p className="card-kicker">Private advisory review</p><h2 id="assignment-dialog-title">Add an assignment</h2></div></div><form onSubmit={createAssignment}><label className="field-label"><span>Course</span><select name="courseId" required defaultValue=""><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.$id} value={course.$id}>{course.title}</option>)}</select></label><div className="dialog-two-col"><label className="field-label"><span>Assignment title</span><input name="title" required maxLength={200} placeholder="Research essay" /></label><label className="field-label"><span>Due date</span><input name="dueAt" type="date" /></label></div><label className="field-label"><span>Brief</span><textarea name="brief" required rows={3} placeholder="What the assignment asks you to demonstrate" /></label><label className="field-label"><span>Rubric</span><textarea name="rubricText" required rows={4} placeholder="Paste the criteria and performance expectations" /></label><label className="assignment-file-field"><UploadCloud size={20} /><span>{selectedFileName || "Attach your submission"}</span><small>PDF, DOCX, TXT, or MD · up to 50 MB</small><input ref={fileRef} type="file" required accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")} /></label><button className="dialog-submit" type="submit" disabled={busy === "create"}>{busy === "create" ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy === "create" ? `Uploading ${uploadProgress}%` : "Create private review"}</button></form></section></div>}
    </div>
  );
}

export function InsightsWorkspace({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [gaps, setGaps] = useState<GapInsight[]>([]);
  const [concepts, setConcepts] = useState<CourseConcept[]>([]);
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [courseRows, gapRows, conceptRows] = await Promise.all([
        loadCourses(userId),
        tables.listRows<GapInsight>({ databaseId: config.databaseId, tableId: "gap_insights", queries: [Query.equal("ownerId", [userId]), Query.limit(100)], ttl: 0 }),
        tables.listRows<CourseConcept>({ databaseId: config.databaseId, tableId: "concepts", queries: [Query.equal("ownerId", [userId]), Query.limit(100)], ttl: 0 }),
      ]);
      setCourses(courseRows.rows); setGaps(gapRows.rows); setConcepts(conceptRows.rows); setCourseId((current) => current || courseRows.rows[0]?.$id || "");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function scan() { if (!courseId) return; setBusy(true); setError(""); try { await executeLearningAction({ action: "detect_gaps", courseId }); await load(); } catch (caught) { setError(getAppwriteErrorMessage(caught)); } finally { setBusy(false); } }
  const visible = gaps.filter((gap) => gap.courseId === courseId).sort((a, b) => a.mastery - b.mastery);
  const visibleConcepts = concepts.filter((concept) => concept.courseId === courseId);
  const average = visibleConcepts.length ? Math.round(visibleConcepts.reduce((total, concept) => total + (concept.mastery || 0), 0) / visibleConcepts.length) : 0;
  return <div className="page-wrap intelligence-page"><section className="workspace-page-heading"><div><p className="eyebrow">Knowledge gap detector</p><h1>See what the evidence actually says</h1><p>Cognora separates demonstrated weakness from concepts that simply need more evidence.</p></div><div className="intelligence-course-action"><select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.$id} value={course.$id}>{course.title}</option>)}</select><button className="create-course-button" type="button" disabled={!courseId || busy} onClick={() => void scan()}>{busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}{busy ? "Scanning…" : "Refresh gaps"}</button></div></section>{error && <p className="workspace-error" role="alert">{error}</p>}{loading ? <IntelligenceLoading label="Reading mastery evidence…" /> : <><section className="gap-overview"><article><span>Course mastery</span><strong>{average}%</strong><div><span style={{ width: `${average}%` }} /></div></article><article><span>Open gaps</span><strong>{visible.filter((gap) => gap.status === "open").length}</strong><small>Evidence-backed priorities</small></article><article><span>Concept evidence</span><strong>{visibleConcepts.reduce((total, concept) => total + (concept.evidenceCount || 0), 0)}</strong><small>Scored learning signals</small></article></section>{visible.length ? <section className="gap-insight-grid">{visible.map((gap) => <article className={`gap-insight-card ${gap.severity}`} key={gap.$id}><div className="gap-card-top"><span>{gap.severity} priority</span><strong>{gap.mastery}%</strong></div><h2>{gap.title}</h2><p>{gap.explanation}</p><div className="gap-evidence"><strong>Evidence</strong>{jsonList<string>(gap.evidenceJson).map((evidence) => <span key={evidence}><Check size={12} />{evidence}</span>)}</div><div className="gap-action"><Target size={15} /><span>{gap.recommendedAction}</span></div><small>{gap.evidenceCount} evidence {gap.evidenceCount === 1 ? "signal" : "signals"} · {gap.status}</small></article>)}</section> : <section className="intelligence-empty compact"><span><BrainCircuit size={27} /></span><h2>No gap analysis yet</h2><p>Analyze course material and answer practice questions, then ask Cognora to explain where attention will help most.</p></section>}</>}</div>;
}

export function RoadmapsWorkspace({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [roadmaps, setRoadmaps] = useState<LearningRoadmap[]>([]);
  const [steps, setSteps] = useState<RoadmapStep[]>([]);
  const [courseId, setCourseId] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [courseRows, roadmapRows, stepRows] = await Promise.all([
        loadCourses(userId),
        tables.listRows<LearningRoadmap>({ databaseId: config.databaseId, tableId: "roadmaps", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(100)], ttl: 0 }),
        tables.listRows<RoadmapStep>({ databaseId: config.databaseId, tableId: "roadmap_steps", queries: [Query.equal("ownerId", [userId]), Query.limit(100)], ttl: 0 }),
      ]);
      setCourses(courseRows.rows); setRoadmaps(roadmapRows.rows); setSteps(stepRows.rows); setCourseId((current) => current || courseRows.rows[0]?.$id || "");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function generate(event: FormEvent) { event.preventDefault(); if (!courseId || !goal.trim()) return; setBusy(true); setError(""); try { await executeLearningAction({ action: "generate_roadmap", courseId, goal: goal.trim() }); await load(); } catch (caught) { setError(getAppwriteErrorMessage(caught)); } finally { setBusy(false); } }
  async function advance(step: RoadmapStep) {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      await tables.updateRow({ databaseId: config.databaseId, tableId: "roadmap_steps", rowId: step.$id, data: { status: step.status === "completed" ? "available" : "completed" } });
      if (step.status !== "completed") {
        const next = steps.filter((item) => item.roadmapId === step.roadmapId).sort((a, b) => a.sequence - b.sequence).find((item) => item.sequence > step.sequence);
        if (next?.status === "locked") await tables.updateRow({ databaseId: config.databaseId, tableId: "roadmap_steps", rowId: next.$id, data: { status: "available" } });
      }
      await load();
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }
  const roadmap = roadmaps.find((item) => item.courseId === courseId && item.status === "active");
  const roadmapSteps = roadmap ? steps.filter((step) => step.roadmapId === roadmap.$id).sort((a, b) => a.sequence - b.sequence) : [];
  return <div className="page-wrap intelligence-page"><section className="workspace-page-heading"><div><p className="eyebrow">Learning roadmap</p><h1>A path that adapts to what you know</h1><p>Foundations come first, gaps reshape the route, and every milestone explains why it is next.</p></div></section>{error && <p className="workspace-error" role="alert">{error}</p>}{loading ? <IntelligenceLoading label="Loading your roadmaps…" /> : <><form className="roadmap-builder" onSubmit={generate}><div><label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>{courses.map((course) => <option key={course.$id} value={course.$id}>{course.title}</option>)}</select></label><label>Goal<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Master the course before the final exam" required /></label></div><button className="create-course-button" type="submit" disabled={busy || !courseId}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{busy ? "Adapting roadmap…" : roadmap ? "Adapt roadmap" : "Generate roadmap"}</button></form>{roadmap ? <section className="roadmap-shell"><header><span><Route size={19} /></span><div><p className="card-kicker">Active roadmap</p><h2>{roadmap.title}</h2><p>{roadmap.summary}</p></div></header><div className="roadmap-timeline">{roadmapSteps.map((step, index) => <article className={`roadmap-step ${step.status}`} key={step.$id}><div className="roadmap-marker"><span>{step.status === "completed" ? <Check size={15} /> : step.sequence}</span>{index < roadmapSteps.length - 1 && <i />}</div><div><span>{formatDate(step.targetDate)} · {step.status}</span><h3>{step.title}</h3><p>{step.description}</p><small><Lightbulb size={12} />{step.reason}</small>{step.status !== "locked" && <button type="button" onClick={() => void advance(step)}>{step.status === "completed" ? "Reopen milestone" : "Mark complete"}<ArrowRight size={13} /></button>}</div></article>)}</div></section> : <section className="intelligence-empty compact"><span><Route size={27} /></span><h2>Describe where you want to go</h2><p>Cognora will sequence the concepts, account for current gaps, and build a milestone path around your weekly availability.</p></section>}</>}</div>;
}

export function CoachWorkspace({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [courseId, setCourseId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [courseRows, messageRows] = await Promise.all([
        loadCourses(userId),
        tables.listRows<CoachMessage>({ databaseId: config.databaseId, tableId: "coach_messages", queries: [Query.equal("ownerId", [userId]), Query.orderAsc("createdAt"), Query.limit(100)], ttl: 0 }),
      ]);
      setCourses(courseRows.rows); setMessages(messageRows.rows); setCourseId((current) => current || courseRows.rows[0]?.$id || "");
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function ask(event: FormEvent) { event.preventDefault(); const question = message.trim(); if (!question) return; setBusy(true); setError(""); try { await executeLearningAction({ action: "ask_coach", courseId: courseId || undefined, message: question }); setMessage(""); await load(); } catch (caught) { setError(getAppwriteErrorMessage(caught)); } finally { setBusy(false); } }
  const visibleMessages = messages.filter((item) => !courseId || item.courseId === courseId);
  const suggestions = ["What should I study next, and why?", "Explain my biggest knowledge gap.", "How should I prepare for this week's work?"];
  return <div className="page-wrap intelligence-page coach-page"><section className="workspace-page-heading"><div><p className="eyebrow">AI study coach</p><h1>Ask with your course in context</h1><p>Cognora answers from your materials, plan, roadmap, and mastery evidence—and says when evidence is missing.</p></div><select className="coach-course-select" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">All courses</option>{courses.map((course) => <option key={course.$id} value={course.$id}>{course.title}</option>)}</select></section>{error && <p className="workspace-error" role="alert">{error}</p>}{loading ? <IntelligenceLoading label="Opening your coach…" /> : <section className="coach-workspace"><div className="coach-conversation">{visibleMessages.length === 0 ? <div className="coach-welcome"><span><MessageCircleMore size={27} /></span><h2>What would help you move forward?</h2><p>Choose a course for the most grounded answer, or ask across your whole learning workspace.</p><div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setMessage(suggestion)}>{suggestion}<ArrowRight size={13} /></button>)}</div></div> : visibleMessages.map((item) => <article className="coach-exchange" key={item.$id}><div className="student-message"><span>You</span><p>{item.question}</p></div><div className="coach-response"><span className="coach-response-mark"><Sparkles size={15} /></span><div><strong>Cognora</strong><p>{item.answer}</p>{jsonList<string>(item.suggestedActionsJson).length > 0 && <div className="coach-actions"><span>Recommended next steps</span>{jsonList<string>(item.suggestedActionsJson).map((action) => <p key={action}><Check size={12} />{action}</p>)}</div>}{jsonList<string>(item.evidenceJson).length > 0 && <details><summary>Evidence used</summary>{jsonList<string>(item.evidenceJson).map((evidence) => <p key={evidence}>{evidence}</p>)}</details>}</div></div></article>)}</div><form className="coach-composer" onSubmit={ask}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask what to study, why a gap matters, or how to get back on track…" rows={3} /><div><span><ShieldCheck size={13} />Private course context</span><button type="submit" disabled={busy || !message.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}{busy ? "Thinking…" : "Ask Cognora"}</button></div></form></section>}</div>;
}
