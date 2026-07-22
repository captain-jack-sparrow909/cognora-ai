"use client";

import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileQuestion,
  FileText,
  Layers3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import { Query } from "appwrite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { executeLearningAction } from "@/lib/appwrite/learning-engine";
import type {
  Course,
  CourseConcept,
  CourseMaterial,
  MaterialInsight,
  PracticeItem,
  StudyTask,
} from "@/lib/appwrite/models";

type LearningData = {
  insights: MaterialInsight[];
  concepts: CourseConcept[];
  tasks: StudyTask[];
  practice: PracticeItem[];
};

function parseList(value?: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatStudyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function masteryLabel(value: number) {
  if (value >= 75) return "Strong";
  if (value >= 45) return "Growing";
  if (value > 0) return "Needs review";
  return "No evidence yet";
}

async function loadCourseLearningData(_userId: string, courseId: string): Promise<LearningData> {
  const { tables, config } = getAppwriteBrowserServices();
  const common = [Query.equal("courseId", [courseId])];
  const [insights, concepts, tasks, practice] = await Promise.all([
    tables.listRows<MaterialInsight>({ databaseId: config.databaseId, tableId: "material_insights", queries: [...common, Query.orderDesc("createdAt"), Query.limit(20)], ttl: 0 }),
    tables.listRows<CourseConcept>({ databaseId: config.databaseId, tableId: "concepts", queries: [...common, Query.orderAsc("mastery"), Query.limit(100)], ttl: 0 }),
    tables.listRows<StudyTask>({ databaseId: config.databaseId, tableId: "study_tasks", queries: [...common, Query.orderAsc("scheduledFor"), Query.limit(100)], ttl: 0 }),
    tables.listRows<PracticeItem>({ databaseId: config.databaseId, tableId: "practice_items", queries: [...common, Query.orderDesc("createdAt"), Query.limit(100)], ttl: 0 }),
  ]);
  return { insights: insights.rows, concepts: concepts.rows, tasks: tasks.rows, practice: practice.rows };
}

export function CourseLearningLoop({
  userId,
  course,
  materials,
  onMaterialsChanged,
  readOnly = false,
}: {
  userId: string;
  course: Course;
  materials: CourseMaterial[];
  onMaterialsChanged: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [data, setData] = useState<LearningData>({ insights: [], concepts: [], tasks: [], practice: [] });
  const [activeTab, setActiveTab] = useState<"companion" | "planner" | "practice">("companion");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await loadCourseLearningData(userId, course.$id));
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [course.$id, userId]);

  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);

  async function analyze(material: CourseMaterial) {
    setBusyId(material.$id);
    setError("");
    try {
      await executeLearningAction({ action: "process_material", materialId: material.$id });
      await Promise.all([reload(), onMaterialsChanged()]);
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
      await onMaterialsChanged();
    } finally {
      setBusyId("");
    }
  }

  async function generatePlan() {
    setBusyId("plan");
    setError("");
    try {
      await executeLearningAction({ action: "generate_plan", courseId: course.$id });
      await reload();
      setActiveTab("planner");
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setBusyId("");
    }
  }

  const latestInsight = data.insights[0];
  const readyMaterials = materials.filter((material) => material.processingStatus === "ready").length;

  return (
    <section className="learning-loop-shell">
      <div className="learning-loop-header">
        <div>
          <p className="card-kicker"><Sparkles size={14} /> AI learning loop</p>
          <h2>Turn course material into progress</h2>
          <p>DeepSeek extracts the learning structure; Cognora connects it to a plan, practice, and explainable mastery evidence.</p>
        </div>
        <div className="learning-loop-metrics">
          <span><strong>{readyMaterials}</strong> analyzed</span>
          <span><strong>{data.concepts.length}</strong> concepts</span>
          <span><strong>{data.practice.length}</strong> recall items</span>
        </div>
      </div>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      <div className="material-ai-queue">
        {materials.length === 0 ? (
          <div className="ai-empty-inline"><FileText size={18} /><span>Upload a syllabus, lecture, or notes to start the learning loop.</span></div>
        ) : materials.map((material) => (
          <div className="ai-material-row" key={material.$id}>
            <span className={`ai-status-dot ${material.processingStatus}`} />
            <div><strong>{material.name}</strong><span>{material.kind} · {material.processingStatus}</span></div>
            {!readOnly && <button
              className="ai-action-button"
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void analyze(material)}
            >
              {busyId === material.$id ? <LoaderCircle className="spin" size={15} /> : material.processingStatus === "ready" ? <RefreshCw size={14} /> : <WandSparkles size={15} />}
              {busyId === material.$id ? "Analyzing…" : material.processingStatus === "ready" ? "Analyze again" : "Analyze with AI"}
            </button>}
          </div>
        ))}
      </div>

      <div className="learning-tabs" role="tablist" aria-label="Course learning tools">
        <button className={activeTab === "companion" ? "active" : ""} type="button" onClick={() => setActiveTab("companion")}><BookOpen size={16} /> Lecture companion</button>
        <button className={activeTab === "planner" ? "active" : ""} type="button" onClick={() => setActiveTab("planner")}><CalendarDays size={16} /> Study plan</button>
        <button className={activeTab === "practice" ? "active" : ""} type="button" onClick={() => setActiveTab("practice")}><BrainCircuit size={16} /> Practice</button>
      </div>

      {loading ? (
        <div className="workspace-loading compact"><LoaderCircle className="spin" size={20} /><span>Loading course intelligence…</span></div>
      ) : activeTab === "companion" ? (
        <CompanionPanel insight={latestInsight} concepts={data.concepts} />
      ) : activeTab === "planner" ? (
        <PlannerPanel tasks={data.tasks} concepts={data.concepts} busy={busyId === "plan"} onGenerate={() => void generatePlan()} readOnly={readOnly} />
      ) : (
        <PracticePanel items={data.practice} onEvidence={reload} readOnly={readOnly} />
      )}
    </section>
  );
}

function CompanionPanel({ insight, concepts }: { insight?: MaterialInsight; concepts: CourseConcept[] }) {
  if (!insight) return <LearningEmpty icon={BookOpen} title="Your lecture companion is ready for material" copy="Analyze an uploaded file to create a grounded summary, outline, key concepts, flashcards, and quiz questions." />;
  const outline = parseList(insight.outlineJson);
  const keyPoints = parseList(insight.keyPointsJson);
  return (
    <div className="companion-grid">
      <article className="learning-panel companion-summary">
        <div className="learning-panel-heading"><div><p className="card-kicker">Latest analysis</p><h3>{insight.title}</h3></div><span>{insight.materialType}</span></div>
        <p className="grounded-summary">{insight.summary}</p>
        {keyPoints.length > 0 && <div className="key-point-list">{keyPoints.map((point) => <span key={point}><Check size={13} />{point}</span>)}</div>}
      </article>
      <aside className="learning-panel outline-panel">
        <p className="card-kicker"><Layers3 size={14} /> Structured outline</p>
        <ol>{outline.map((item) => <li key={item}>{item}</li>)}</ol>
      </aside>
      <article className="learning-panel concept-panel">
        <div className="learning-panel-heading"><div><p className="card-kicker">Knowledge map</p><h3>Concepts found</h3></div><span>{concepts.length} concepts</span></div>
        <div className="concept-evidence-grid">{concepts.map((concept) => (
          <div className="concept-evidence" key={concept.$id}>
            <div><strong>{concept.title}</strong><span>{masteryLabel(concept.mastery || 0)}</span></div>
            <p>{concept.description}</p>
            <div className="concept-mastery-track"><span style={{ width: `${concept.mastery || 0}%` }} /></div>
            <small>{concept.mastery || 0}% mastery · {concept.evidenceCount || 0} evidence</small>
          </div>
        ))}</div>
      </article>
    </div>
  );
}

function PlannerPanel({ tasks, concepts, busy, onGenerate, readOnly = false }: { tasks: StudyTask[]; concepts: CourseConcept[]; busy: boolean; onGenerate: () => void; readOnly?: boolean }) {
  return (
    <div className="learning-panel planner-panel">
      <div className="learning-panel-heading">
        <div><p className="card-kicker">Adaptive seven-day plan</p><h3>Study the right thing next</h3></div>
        {!readOnly && <button className="ai-action-button primary" type="button" disabled={busy || concepts.length === 0} onClick={onGenerate}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{busy ? "Building plan…" : tasks.length ? "Rebalance plan" : "Generate plan"}</button>}
      </div>
      {tasks.length === 0 ? <LearningEmpty icon={CalendarDays} title="No study sessions yet" copy="Analyze material first, then Cognora will balance a realistic week around the concepts with the least evidence." /> : (
        <div className="adaptive-task-list">{tasks.map((task, index) => (
          <div className="adaptive-task" key={task.$id}>
            <span className="task-sequence">{String(index + 1).padStart(2, "0")}</span>
            <div><span>{formatStudyDate(task.scheduledFor)}</span><strong>{task.title}</strong><p>{task.description}</p><small><Target size={12} />{task.reason || "Connected to your learning evidence."}</small></div>
            <span className="task-duration"><Clock3 size={13} />{task.durationMinutes} min</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function PracticePanel({ items, onEvidence, readOnly = false }: { items: PracticeItem[]; onEvidence: () => Promise<void>; readOnly?: boolean }) {
  const quiz = items.filter((item) => item.itemType === "multiple-choice");
  const flashcards = items.filter((item) => item.itemType === "flashcard");
  const [mode, setMode] = useState<"quiz" | "flashcards">(quiz.length ? "quiz" : "flashcards");
  if (items.length === 0) return <LearningEmpty icon={FileQuestion} title="Practice will appear here" copy="Analyze a lecture, syllabus, or notes to generate grounded recall cards and quiz questions." />;
  return (
    <div className="learning-panel practice-panel">
      <div className="learning-panel-heading"><div><p className="card-kicker">Practice and recall</p><h3>Convert understanding into evidence</h3></div><div className="practice-mode"><button className={mode === "quiz" ? "active" : ""} type="button" disabled={!quiz.length} onClick={() => setMode("quiz")}>Quiz · {quiz.length}</button><button className={mode === "flashcards" ? "active" : ""} type="button" disabled={!flashcards.length} onClick={() => setMode("flashcards")}>Cards · {flashcards.length}</button></div></div>
      {readOnly ? <div className="operations-note"><ShieldCheck size={14} />Shared practice is preview-only so each learner keeps separate mastery evidence.</div> : mode === "quiz" ? <QuizRunner items={quiz} onEvidence={onEvidence} /> : <FlashcardRunner items={flashcards} />}
    </div>
  );
}

function QuizRunner({ items, onEvidence }: { items: PracticeItem[]; onEvidence: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: string; explanation: string; masteryAfter: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const item = items[index % items.length];
  const options = parseList(item?.optionsJson);
  async function submit() {
    if (!item || !selected) return;
    setBusy(true); setError("");
    try {
      const result = await executeLearningAction<typeof feedback & { ok: true }>({ action: "submit_attempt", itemId: item.$id, response: selected, confidence });
      setFeedback(result);
      await onEvidence();
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setBusy(false); }
  }
  if (!item) return null;
  return (
    <div className="quiz-runner">
      <div className="quiz-progress"><span>Question {index + 1} of {items.length}</span><div><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div></div>
      <h4>{item.prompt}</h4>
      <div className="quiz-options">{options.map((option, optionIndex) => <button className={`${selected === option ? "selected" : ""} ${feedback && option === feedback.correctAnswer ? "correct" : ""}`} type="button" disabled={Boolean(feedback)} onClick={() => setSelected(option)} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
      {!feedback ? <div className="quiz-submit-row"><label>Confidence <select value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><button className="ai-action-button primary" type="button" disabled={!selected || busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}Submit answer</button></div> : <div className={`quiz-feedback ${feedback.correct ? "correct" : "incorrect"}`}><strong>{feedback.correct ? "Correct — evidence added" : "Not quite — this is useful evidence"}</strong><p>{feedback.explanation}</p><span>Concept mastery is now {feedback.masteryAfter}%</span><button type="button" onClick={() => { setIndex((current) => (current + 1) % items.length); setSelected(""); setFeedback(null); }}>Next question <ArrowRight size={14} /></button></div>}
      {error && <p className="workspace-error" role="alert">{error}</p>}
    </div>
  );
}

function FlashcardRunner({ items }: { items: PracticeItem[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const item = items[index % items.length];
  if (!item) return null;
  return (
    <div className={`flashcard ${revealed ? "revealed" : ""}`}>
      <p>{revealed ? "Answer" : "Recall prompt"}</p><h4>{revealed ? item.answer : item.prompt}</h4>{revealed && <span>{item.explanation}</span>}
      <div><button type="button" onClick={() => setRevealed((current) => !current)}>{revealed ? <RotateCcw size={15} /> : <CircleHelp size={15} />}{revealed ? "Show prompt" : "Reveal answer"}</button><button type="button" onClick={() => { setIndex((current) => (current + 1) % items.length); setRevealed(false); }}>Next card <ChevronRight size={15} /></button></div>
    </div>
  );
}

function LearningEmpty({ icon: Icon, title, copy }: { icon: typeof BookOpen; title: string; copy: string }) {
  return <div className="learning-empty"><span><Icon size={22} /></span><div><strong>{title}</strong><p>{copy}</p></div></div>;
}

export function StudyPlannerWorkspace({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const [taskRows, courseRows] = await Promise.all([
        tables.listRows<StudyTask>({ databaseId: config.databaseId, tableId: "study_tasks", queries: [Query.equal("ownerId", [userId]), Query.orderAsc("scheduledFor"), Query.limit(100)], ttl: 0 }),
        tables.listRows<Course>({ databaseId: config.databaseId, tableId: "courses", queries: [Query.equal("ownerId", [userId]), Query.limit(100)], ttl: 0 }),
      ]);
      setTasks(taskRows.rows);
      setCourses(Object.fromEntries(courseRows.rows.map((course) => [course.$id, course])));
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function complete(task: StudyTask) {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const nextStatus = task.status === "completed" ? "planned" : "completed";
      await tables.updateRow({ databaseId: config.databaseId, tableId: "study_tasks", rowId: task.$id, data: { status: nextStatus } });
      setTasks((current) => current.map((item) => item.$id === task.$id ? { ...item, status: nextStatus } : item));
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
  }
  const planned = tasks.filter((task) => task.status === "planned");
  const totalMinutes = planned.reduce((total, task) => total + task.durationMinutes, 0);
  return (
    <div className="page-wrap planner-workspace-page">
      <section className="workspace-page-heading"><div><p className="eyebrow">Adaptive study planner</p><h1>Your learning week</h1><p>Every session is connected to a syllabus, lecture, or current mastery signal.</p></div><div className="planner-total"><Clock3 size={17} /><span><strong>{Math.round(totalMinutes / 6) / 10}h</strong> planned</span></div></section>
      {error && <p className="workspace-error" role="alert">{error}</p>}
      {loading ? <div className="workspace-loading"><LoaderCircle className="spin" size={22} />Loading your plan…</div> : tasks.length === 0 ? <section className="module-preview-card compact-preview"><span className="module-preview-icon"><CalendarDays size={24} /></span><p className="eyebrow">Start with evidence</p><h2>Your adaptive plan begins inside a course</h2><p>Analyze a material, then generate a seven-day plan from its concepts and your available study time.</p></section> : <section className="weekly-plan-list">{tasks.map((task) => <article className={`weekly-plan-task ${task.status}`} key={task.$id}><button type="button" aria-label={task.status === "completed" ? `Mark ${task.title} planned` : `Complete ${task.title}`} onClick={() => void complete(task)}>{task.status === "completed" ? <CheckCircle2 size={19} /> : <span />}</button><div><span>{formatStudyDate(task.scheduledFor)} · {courses[task.courseId]?.title || "Course"}</span><h2>{task.title}</h2><p>{task.description}</p><small>{task.reason}</small></div><span><Clock3 size={13} />{task.durationMinutes} min</span></article>)}</section>}
    </div>
  );
}

export function PracticeWorkspace({ userId }: { userId: string }) {
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const result = await tables.listRows<PracticeItem>({ databaseId: config.databaseId, tableId: "practice_items", queries: [Query.equal("ownerId", [userId]), Query.orderDesc("createdAt"), Query.limit(100)], ttl: 0 });
      setItems(result.rows);
    } catch (caught) { setError(getAppwriteErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const quiz = useMemo(() => items.filter((item) => item.itemType === "multiple-choice"), [items]);
  return <div className="page-wrap practice-workspace-page"><section className="workspace-page-heading"><div><p className="eyebrow">Practice and recall</p><h1>Build evidence, not streaks</h1><p>Every answer updates a concept’s explainable mastery record.</p></div><div className="planner-total"><BrainCircuit size={17} /><span><strong>{items.length}</strong> items</span></div></section>{error && <p className="workspace-error" role="alert">{error}</p>}{loading ? <div className="workspace-loading"><LoaderCircle className="spin" size={22} />Loading practice…</div> : quiz.length ? <section className="global-practice-card"><PracticePanel items={items} onEvidence={load} /></section> : <section className="module-preview-card compact-preview"><span className="module-preview-icon"><FileQuestion size={24} /></span><p className="eyebrow">No generated practice yet</p><h2>Analyze course material first</h2><p>Cognora will create grounded flashcards and quizzes from your own lectures, notes, and syllabus.</p></section>}</div>;
}
