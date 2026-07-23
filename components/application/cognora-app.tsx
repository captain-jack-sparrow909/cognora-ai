"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  Flame,
  FolderOpen,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  Play,
  Route,
  Search,
  Settings,
  Sparkles,
  Target,
  TimerReset,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthScreen } from "@/components/auth/auth-screen";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { useAuth } from "@/components/auth/auth-provider";
import { CognoraLogo } from "@/components/brand/cognora-logo";
import { ActivityCenter, SettingsWorkspace } from "@/components/operations/operations-workspaces";
import { PwaInstallButton } from "@/components/operations/pwa-install-button";
import { trackProductEvent } from "@/lib/appwrite/product-analytics";

const CoursesWorkspace = lazy(() => import("@/components/courses/courses-workspace").then((module) => ({ default: module.CoursesWorkspace })));
const StudyPlannerWorkspace = lazy(() => import("@/components/learning/learning-workspaces").then((module) => ({ default: module.StudyPlannerWorkspace })));
const PracticeWorkspace = lazy(() => import("@/components/learning/learning-workspaces").then((module) => ({ default: module.PracticeWorkspace })));
const AssignmentsWorkspace = lazy(() => import("@/components/intelligence/intelligence-workspaces").then((module) => ({ default: module.AssignmentsWorkspace })));
const CoachWorkspace = lazy(() => import("@/components/intelligence/intelligence-workspaces").then((module) => ({ default: module.CoachWorkspace })));
const InsightsWorkspace = lazy(() => import("@/components/intelligence/intelligence-workspaces").then((module) => ({ default: module.InsightsWorkspace })));
const RoadmapsWorkspace = lazy(() => import("@/components/intelligence/intelligence-workspaces").then((module) => ({ default: module.RoadmapsWorkspace })));

const navigation = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: FolderOpen },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "roadmaps", label: "Roadmaps", icon: Route },
  { id: "assignments", label: "Assignments", icon: ClipboardCheck },
  { id: "practice", label: "Practice", icon: BrainCircuit },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "coach", label: "AI Coach", icon: MessageCircleMore },
];

const schedule = [
  {
    time: "09:30",
    title: "Chain rule practice",
    course: "Calculus II",
    duration: "35 min",
    color: "cobalt",
  },
  {
    time: "11:00",
    title: "Cellular respiration",
    course: "Molecular Biology",
    duration: "50 min",
    color: "teal",
  },
  {
    time: "16:30",
    title: "Lab report outline",
    course: "Organic Chemistry",
    duration: "40 min",
    color: "coral",
  },
];

const learningSystem = [
  {
    title: "Lecture companion",
    description: "Turn today’s lectures into notes, questions, and recall cards.",
    icon: BookOpen,
    action: "Open library",
    tone: "blue",
  },
  {
    title: "Assignment feedback",
    description: "Review work against its rubric and find what to improve next.",
    icon: FileText,
    action: "Review work",
    tone: "coral",
  },
  {
    title: "AI study coach",
    description: "Ask what to study, why it matters, or how to get back on track.",
    icon: MessageCircleMore,
    action: "Ask Cognora",
    tone: "teal",
  },
];

const mastery = [
  { label: "Cell respiration", value: 82, status: "Steady", tone: "teal" },
  { label: "Chain rule", value: 48, status: "Needs attention", tone: "coral" },
  { label: "Essay structure", value: 67, status: "Growing", tone: "cobalt" },
];

export default function CognoraApp() {
  const { user, profile, loading, signOut } = useAuth();
  const [focusActive, setFocusActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("today");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!user?.$id || !profile) return;
    void trackProductEvent(user.$id, "view_opened", activeView).catch(() => undefined);
  }, [activeView, profile, user?.$id]);

  if (loading) return <AppLoading />;
  if (!user) return <AuthScreen />;
  if (!profile) return <OnboardingScreen />;

  const firstName = profile.displayName.split(" ")[0] || "there";
  const initials = profile.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const studyLevel = profile.studyLevel.replace("-", " ");

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-workspace">Skip to workspace</a>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <CognoraLogo />
          <div>
            <div className="brand-name">Cognora</div>
            <div className="brand-caption">Learning intelligence</div>
          </div>
          <button
            className="icon-button sidebar-close"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => (
            <button
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              type="button"
              key={item.label}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => {
                setActiveView(item.id);
                setMenuOpen(false);
              }}
            >
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {activeView === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="coach-card">
          <div className="coach-icon">
            <Sparkles size={17} />
          </div>
          <p className="coach-kicker">AI study coach</p>
          <p className="coach-copy">You have a 45-minute opening before your next lecture.</p>
          <button className="coach-card-action" type="button" onClick={() => setActiveView("coach")}>
            Ask Cognora <ArrowRight size={14} />
          </button>
        </div>

        <div className="sidebar-footer">
          <button className="nav-item" type="button" onClick={() => setActiveView("settings")}>
            <Settings size={18} strokeWidth={1.8} /><span>Settings</span>
          </button>
          <div className="profile-row">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{profile.displayName}</strong>
              <span className="capitalize">{studyLevel}</span>
            </div>
            <button className="profile-logout" type="button" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <section className="main-content" id="main-workspace" tabIndex={-1}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search Cognora</span>
            <input ref={searchRef} placeholder="Search courses, notes, concepts…" />
            <kbd>⌘ K</kbd>
          </label>
          <ActivityCenter userId={user.$id} onOpenSettings={() => setActiveView("settings")} />
          <PwaInstallButton userId={user.$id} />
          <button className="help-button" type="button">
            <CircleHelp size={17} />
            Help
          </button>
          <div className="streak-chip">
            <Flame size={16} />
            <span>8 day streak</span>
          </div>
        </header>

        <Suspense fallback={<WorkspaceLoading />}>
        {activeView === "courses" ? (
          <CoursesWorkspace userId={user.$id} />
        ) : activeView === "planner" ? (
          <StudyPlannerWorkspace userId={user.$id} />
        ) : activeView === "practice" ? (
          <PracticeWorkspace userId={user.$id} />
        ) : activeView === "assignments" ? (
          <AssignmentsWorkspace userId={user.$id} />
        ) : activeView === "roadmaps" ? (
          <RoadmapsWorkspace userId={user.$id} />
        ) : activeView === "insights" ? (
          <InsightsWorkspace userId={user.$id} />
        ) : activeView === "coach" ? (
          <CoachWorkspace userId={user.$id} />
        ) : activeView === "settings" ? (
          <SettingsWorkspace userId={user.$id} timezone={profile.timezone} />
        ) : activeView === "today" ? (
        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">Sunday, 19 July</p>
              <h1>Good morning, {firstName}.</h1>
              <p>Your plan is balanced. One concept needs attention today.</p>
            </div>
            <button className="secondary-button" type="button">
              <CalendarDays size={17} />
              View week
            </button>
          </section>

          <section className="overview-grid">
            <article className="focus-card">
              <div className="focus-copy">
                <div className="card-kicker light">
                  <Target size={16} />
                  Best next step
                </div>
                <p className="course-tag">CALCULUS II · KNOWLEDGE GAP</p>
                <h2>Strengthen the chain rule</h2>
                <p className="focus-description">
                  A short practice set now will unlock two topics in your current roadmap.
                </p>
                <div className="focus-actions">
                  <button
                    className={`primary-button ${focusActive ? "session-active" : ""}`}
                    type="button"
                    onClick={() => setFocusActive((current) => !current)}
                  >
                    {focusActive ? <TimerReset size={17} /> : <Play size={16} fill="currentColor" />}
                    {focusActive ? "Session in progress" : "Start 35-min session"}
                  </button>
                  <button className="quiet-button" type="button">
                    Why this?
                  </button>
                </div>
              </div>
              <div className="focus-visual" aria-label="48 percent mastery">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="mastery-ring">
                  <div>
                    <strong>48%</strong>
                    <span>mastery</span>
                  </div>
                </div>
                <span className="concept-pill concept-a">Functions</span>
                <span className="concept-pill concept-b">Derivatives</span>
                <span className="concept-pill concept-c">Chain rule</span>
              </div>
            </article>

            <article className="pulse-card">
              <div className="section-heading compact">
                <div>
                  <p className="card-kicker">Learning pulse</p>
                  <h2>Across your courses</h2>
                </div>
                <button className="icon-button" type="button" aria-label="Open learning insights">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="pulse-score-row">
                <div className="mini-ring">
                  <span>72</span>
                </div>
                <div>
                  <strong>On track</strong>
                  <span>Up 6% this week</span>
                </div>
              </div>
              <div className="pulse-divider" />
              <div className="pulse-stats">
                <div>
                  <span>Focused time</span>
                  <strong>6h 20m</strong>
                </div>
                <div>
                  <span>Topics growing</span>
                  <strong>12</strong>
                </div>
                <div>
                  <span>Gaps detected</span>
                  <strong className="coral-text">3</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="content-grid">
            <div className="content-column">
              <article className="surface-card schedule-card">
                <div className="section-heading">
                  <div>
                    <p className="card-kicker">Adaptive planner</p>
                    <h2>Today’s study plan</h2>
                  </div>
                  <button className="text-button" type="button">
                    Open planner <ArrowRight size={15} />
                  </button>
                </div>
                <div className="schedule-list">
                  {schedule.map((item, index) => (
                    <div className="schedule-item" key={item.title}>
                      <div className="schedule-time">
                        <span>{item.time}</span>
                        {index === 0 && <span className="now-label">NEXT</span>}
                      </div>
                      <div className={`schedule-accent ${item.color}`} />
                      <div className="schedule-copy">
                        <strong>{item.title}</strong>
                        <span>{item.course}</span>
                      </div>
                      <div className="duration-chip">
                        <Clock3 size={14} />
                        {item.duration}
                      </div>
                      <button className="icon-button" type="button" aria-label={`Open ${item.title}`}>
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="plan-summary">
                  <Check size={16} />
                  <span>Balanced around your 11:00 lecture and tomorrow’s lab deadline.</span>
                </div>
              </article>

              <article className="surface-card" id="learning-system">
                <div className="section-heading">
                  <div>
                    <p className="card-kicker">One connected workspace</p>
                    <h2>Your learning system</h2>
                  </div>
                  <span className="nine-tools">9 connected tools</span>
                </div>
                <div className="tool-grid">
                  {learningSystem.map((item) => (
                    <a className="tool-card" href="#today" key={item.title}>
                      <div className={`tool-icon ${item.tone}`}>
                        <item.icon size={19} />
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <span>
                        {item.action} <ArrowRight size={14} />
                      </span>
                    </a>
                  ))}
                </div>
              </article>
            </div>

            <aside className="insight-column">
              <article className="surface-card gap-card">
                <div className="section-heading compact">
                  <div>
                    <p className="card-kicker">Knowledge map</p>
                    <h2>Mastery signals</h2>
                  </div>
                  <BrainCircuit size={20} className="muted-icon" />
                </div>
                <div className="mastery-list">
                  {mastery.map((item) => (
                    <div className="mastery-item" key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.status}</span>
                      </div>
                      <div className="mastery-value-row">
                        <div className="progress-track">
                          <span
                            className={item.tone}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                        <strong>{item.value}%</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="wide-outline-button" type="button">
                  View knowledge gaps
                  <ArrowRight size={15} />
                </button>
              </article>

              <article className="insight-card" id="coach-insight">
                <div className="insight-topline">
                  <div className="coach-icon small">
                    <Sparkles size={15} />
                  </div>
                  <span>Cognora insight</span>
                </div>
                <p>
                  Your recall is strongest before noon. I moved chain rule practice to 09:30 and kept the evening lighter.
                </p>
                <button type="button">
                  See reasoning <ChevronRight size={14} />
                </button>
              </article>

              <article className="surface-card deadline-card">
                <div className="deadline-date">
                  <span>20</span>
                  <strong>JUL</strong>
                </div>
                <div>
                  <p className="card-kicker">Due tomorrow</p>
                  <strong>Enzyme kinetics lab</strong>
                  <span>Organic Chemistry · 23:59</span>
                </div>
                <ChevronRight size={17} />
              </article>
            </aside>
          </section>

          <footer className="product-footer">
            <span>Phase 9 · Providers gated</span>
            <span>Plan → Learn → Practice → Understand</span>
          </footer>
        </div>
        ) : (
          <ModulePreview view={activeView} onOpenCourses={() => setActiveView("courses")} />
        )}
        </Suspense>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map((item) => (
          <button
            className={activeView === item.id ? "active" : ""}
            type="button"
            key={item.label}
            onClick={() => setActiveView(item.id)}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function AppLoading() {
  return (
    <main className="app-loading">
      <CognoraLogo size={48} />
      <LoaderCircle className="spin" size={21} />
      <p>Connecting your learning workspace…</p>
      <nav className="app-loading-legal" aria-label="Public legal information">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </nav>
    </main>
  );
}

function WorkspaceLoading() {
  return <div className="workspace-route-loading" role="status"><LoaderCircle className="spin" size={20} /><span>Opening workspace…</span></div>;
}

function ModulePreview({ view, onOpenCourses }: { view: string; onOpenCourses: () => void }) {
  const labels: Record<string, { title: string; description: string }> = {
    planner: { title: "Adaptive study planner", description: "Your courses and availability will become a realistic daily and weekly plan." },
    roadmaps: { title: "Learning roadmaps", description: "Turn goals into prerequisite-aware milestones, checkpoints, and dates." },
    assignments: { title: "Assignment feedback", description: "Review work against its rubric and turn every issue into a learning step." },
    practice: { title: "Practice and recall", description: "Generate quizzes and flashcards that strengthen the concepts needing attention." },
    insights: { title: "Knowledge insights", description: "See explainable mastery signals and the evidence behind every detected gap." },
    settings: { title: "Workspace settings", description: "Manage your learning preferences, privacy, messaging, and account." },
  };
  const content = labels[view] ?? labels.planner;

  return (
    <div className="page-wrap module-preview-page">
      <section className="module-preview-card">
        <span className="module-preview-icon"><Sparkles size={24} /></span>
        <p className="eyebrow">Connected capability</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
        <div className="module-foundation-note"><Check size={16} /> Cognora’s intelligence layer, installable workspace, and founding beta loop are active.</div>
        <button className="create-course-button" type="button" onClick={onOpenCourses}>Build your course library <ArrowRight size={16} /></button>
      </section>
    </div>
  );
}
