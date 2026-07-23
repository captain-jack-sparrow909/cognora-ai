import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CalendarSync,
  Check,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  MessageCircleMore,
  Route,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { CognoraLogo } from "@/components/brand/cognora-logo";

const coreFeatures = [
  {
    icon: CalendarDays,
    eyebrow: "Study Planner",
    title: "A realistic plan that adapts",
    copy: "Turn courses, deadlines, available hours, and mastery signals into focused daily and weekly study sessions.",
    tone: "cobalt",
  },
  {
    icon: BookOpen,
    eyebrow: "Lecture Companion",
    title: "Every lecture becomes usable",
    copy: "Transform notes and course materials into grounded summaries, key concepts, recall cards, and quiz questions.",
    tone: "teal",
  },
  {
    icon: Route,
    eyebrow: "Learning Roadmaps",
    title: "See the path before you start",
    copy: "Break a learning goal into prerequisite-aware milestones, checkpoints, and practical next steps.",
    tone: "gold",
  },
  {
    icon: ClipboardCheck,
    eyebrow: "Assignment Feedback",
    title: "Feedback you can act on",
    copy: "Review work against a rubric, understand what needs improvement, and turn issues into targeted practice.",
    tone: "coral",
  },
  {
    icon: BrainCircuit,
    eyebrow: "Knowledge Gap Detector",
    title: "Know exactly what is missing",
    copy: "Combine attempts, materials, and mastery evidence to reveal weak concepts and explain why they need attention.",
    tone: "violet",
  },
];

const connectedFeatures = [
  { icon: MessageCircleMore, title: "AI study coach", copy: "Ask what to study next and why it matters." },
  { icon: BarChart3, title: "Practice and mastery", copy: "Build evidence through quizzes and recall." },
  { icon: CalendarSync, title: "Google Calendar sync", copy: "Carry planned sessions into your calendar." },
  { icon: ShieldCheck, title: "Private collaboration", copy: "Share course spaces without sharing personal attempts." },
];

export default function MarketingHome() {
  return (
    <main className="marketing-page" id="top">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="marketing-header">
        <Link className="marketing-brand" href="/" aria-label="Cognora AI home">
          <CognoraLogo size={44} />
          <span><strong>Cognora</strong><small>Learning intelligence</small></span>
        </Link>
        <nav aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#trust">Privacy</a>
        </nav>
        <div className="marketing-actions">
          <Link className="marketing-signin" href="/app">Sign in</Link>
          <Link className="marketing-button small" href="/app">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="marketing-hero" id="main-content">
        <div className="marketing-hero-copy">
          <p className="marketing-pill"><Sparkles size={14} /> One connected AI learning workspace</p>
          <h1>Turn every course into a plan you can actually follow.</h1>
          <p className="marketing-hero-lead">
            Cognora brings study planning, lecture understanding, learning roadmaps, assignment
            feedback, and knowledge-gap detection into one private platform—so every study session
            has a clear purpose.
          </p>
          <div className="marketing-hero-actions">
            <Link className="marketing-button" href="/app">
              Build my learning workspace <ArrowRight size={17} />
            </Link>
            <a className="marketing-secondary" href="#features">Explore the platform</a>
          </div>
          <div className="marketing-proof">
            <span><Check size={14} /> Start free</span>
            <span><Check size={14} /> Private by default</span>
            <span><Check size={14} /> AI guidance grounded in your materials</span>
          </div>
        </div>

        <div className="marketing-product-preview" aria-label="Preview of the Cognora learning workspace">
          <div className="preview-glow" />
          <div className="preview-window">
            <header>
              <div><CognoraLogo size={32} /><strong>Today</strong></div>
              <span>8 day streak</span>
            </header>
            <section className="preview-focus">
              <div>
                <small>BEST NEXT STEP</small>
                <strong>Strengthen the chain rule</strong>
                <p>A focused practice set will unlock two roadmap topics.</p>
                <span><Clock3 size={13} /> 35 minute session</span>
              </div>
              <div className="preview-mastery"><strong>48%</strong><span>mastery</span></div>
            </section>
            <div className="preview-grid">
              <section>
                <small>TODAY&apos;S PLAN</small>
                <div><time>09:30</time><span><strong>Chain rule practice</strong><em>Calculus II</em></span></div>
                <div><time>11:00</time><span><strong>Cellular respiration</strong><em>Molecular Biology</em></span></div>
              </section>
              <section className="preview-signal">
                <small>LEARNING PULSE</small>
                <strong>On track</strong>
                <div><span style={{ width: "78%" }} /></div>
                <p>12 topics growing</p>
              </section>
            </div>
          </div>
          <span className="preview-float float-plan"><CalendarDays size={16} /> Adaptive plan</span>
          <span className="preview-float float-insight"><BrainCircuit size={16} /> Gap explained</span>
        </div>
      </section>

      <section className="marketing-trust-strip" aria-label="Platform principles">
        <span><LockKeyhole size={16} /><strong>Private course content</strong></span>
        <span><UploadCloud size={16} /><strong>Your own learning materials</strong></span>
        <span><Sparkles size={16} /><strong>DeepSeek-powered guidance</strong></span>
        <span><CalendarSync size={16} /><strong>Optional calendar sync</strong></span>
      </section>

      <section className="marketing-section features-section" id="features">
        <div className="marketing-section-heading">
          <p>Five core learning systems</p>
          <h2>One platform that understands the whole learning journey.</h2>
          <span>
            Instead of isolated AI tools, Cognora connects what you study, what you need to do, how
            you perform, and what should happen next.
          </span>
        </div>

        <div className="marketing-feature-grid">
          {coreFeatures.map((feature) => (
            <article className={`marketing-feature-card ${feature.tone}`} key={feature.eyebrow}>
              <span className="feature-icon"><feature.icon size={21} /></span>
              <p>{feature.eyebrow}</p>
              <h3>{feature.title}</h3>
              <span>{feature.copy}</span>
            </article>
          ))}
        </div>

        <div className="connected-feature-grid">
          {connectedFeatures.map((feature) => (
            <article key={feature.title}>
              <feature.icon size={19} />
              <div><strong>{feature.title}</strong><span>{feature.copy}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section workflow-section" id="how-it-works">
        <div className="workflow-copy">
          <p>From material to mastery</p>
          <h2>A clear loop for learning better.</h2>
          <span>
            Cognora turns scattered course information into an explainable system that improves as
            you learn.
          </span>
          <Link className="marketing-secondary dark" href="/app">Create my workspace <ArrowRight size={15} /></Link>
        </div>
        <ol className="workflow-steps">
          <li><span>01</span><div><strong>Bring your context</strong><p>Add courses, materials, deadlines, availability, and goals.</p></div></li>
          <li><span>02</span><div><strong>Let Cognora connect it</strong><p>AI turns your context into concepts, plans, practice, feedback, and roadmaps.</p></div></li>
          <li><span>03</span><div><strong>Learn from evidence</strong><p>Every attempt updates explainable mastery signals and the next best action.</p></div></li>
        </ol>
      </section>

      <section className="marketing-section data-section" id="trust">
        <div className="data-visual" aria-hidden="true">
          <div className="data-ring ring-one" />
          <div className="data-ring ring-two" />
          <span className="data-core"><CognoraLogo size={72} /></span>
          <span className="data-node node-material">Course materials</span>
          <span className="data-node node-plan">Study plan</span>
          <span className="data-node node-calendar">Google Calendar</span>
          <span className="data-node node-mastery">Mastery evidence</span>
        </div>
        <div className="data-copy">
          <p>Consent-first by design</p>
          <h2>Your learning data should serve your learning.</h2>
          <span>
            Course content stays private by default. Cognora uses it to provide the features you
            request—not for advertising or sale.
          </span>
          <ul>
            <li><ShieldCheck size={17} /><div><strong>Private Appwrite infrastructure</strong><span>Account, database, storage, and Function access are permission-controlled.</span></div></li>
            <li><CalendarSync size={17} /><div><strong>Google Calendar only when you connect it</strong><span>Cognora creates and updates study sessions from your plan; you can revoke access through Google.</span></div></li>
            <li><BrainCircuit size={17} /><div><strong>Transparent AI purpose</strong><span>DeepSeek and the configured embedding provider process only what is needed for requested learning features.</span></div></li>
          </ul>
          <div className="data-links">
            <Link href="/privacy">Read our Privacy Policy</Link>
            <Link href="/terms">Read our Terms</Link>
          </div>
        </div>
      </section>

      <section className="marketing-cta">
        <CognoraLogo size={62} />
        <p>Ready when your next course begins</p>
        <h2>Build a learning system that knows what comes next.</h2>
        <Link className="marketing-button light" href="/app">
          Get started with Cognora <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="marketing-footer">
        <Link className="marketing-brand" href="/" aria-label="Cognora AI home">
          <CognoraLogo size={38} />
          <span><strong>Cognora</strong><small>Learning intelligence</small></span>
        </Link>
        <p>AI-powered planning, understanding, practice, feedback, and mastery—in one private workspace.</p>
        <nav aria-label="Footer">
          <Link href="/app">Sign in</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <small>© 2026 Cognora AI</small>
      </footer>
    </main>
  );
}
