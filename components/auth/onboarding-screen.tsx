"use client";

import { ArrowRight, Check, Clock3, GraduationCap, LoaderCircle, Sparkles, Target } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { CognoraLogo } from "@/components/brand/cognora-logo";
import type { StudyLevel } from "@/lib/appwrite/models";
import { useAuth } from "./auth-provider";

const levels: Array<{ value: StudyLevel; label: string; note: string }> = [
  { value: "high-school", label: "High school", note: "Subjects and exams" },
  { value: "undergraduate", label: "Undergraduate", note: "Courses and assignments" },
  { value: "postgraduate", label: "Postgraduate", note: "Advanced study and research" },
  { value: "professional", label: "Professional", note: "Skills and certifications" },
  { value: "other", label: "Independent learner", note: "A goal of your own" },
];

export function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const [level, setLevel] = useState<StudyLevel>("undergraduate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      await completeOnboarding({
        displayName: String(data.get("displayName") ?? "").trim(),
        studyLevel: level,
        timezone,
        weeklyHours: Number(data.get("weeklyHours") ?? 8),
        learningGoal: String(data.get("learningGoal") ?? "").trim(),
      });
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div className="auth-brand dark">
          <CognoraLogo />
          <span><strong>Cognora</strong><small>Learning intelligence</small></span>
        </div>
        <div className="onboarding-progress"><span>1</span><i /><span className="muted">2</span></div>
      </header>
      <section className="onboarding-card">
        <div className="onboarding-copy">
          <p className="auth-eyebrow"><Sparkles size={15} /> Personalize your workspace</p>
          <h1>Let’s build a plan around how you learn.</h1>
          <p>These details give Cognora enough context to balance your first courses and recommendations.</p>
          <div className="onboarding-points">
            <span><GraduationCap size={18} /><b>Your level</b><small>Sets the depth of explanations.</small></span>
            <span><Clock3 size={18} /><b>Your availability</b><small>Keeps every plan realistic.</small></span>
            <span><Target size={18} /><b>Your goal</b><small>Shapes milestones and priorities.</small></span>
          </div>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <label className="field-label">
            <span>What should we call you?</span>
            <input name="displayName" defaultValue={user?.name ?? ""} placeholder="Your name" required maxLength={128} />
          </label>

          <fieldset>
            <legend>Where are you in your learning journey?</legend>
            <div className="level-grid">
              {levels.map((item) => (
                <button
                  className={level === item.value ? "selected" : ""}
                  type="button"
                  key={item.value}
                  onClick={() => setLevel(item.value)}
                >
                  <span>{item.label}</span>
                  <small>{item.note}</small>
                  {level === item.value && <Check size={15} />}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="onboarding-two-col">
            <label className="field-label">
              <span>Study hours per week</span>
              <input name="weeklyHours" type="number" min={1} max={80} defaultValue={8} required />
            </label>
            <label className="field-label">
              <span>Detected timezone</span>
              <input value={timezone} readOnly />
            </label>
          </div>

          <label className="field-label">
            <span>What would you most like to achieve?</span>
            <textarea name="learningGoal" placeholder="Example: stay ahead of lectures and feel prepared before finals" rows={3} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="onboarding-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {busy ? "Creating workspace…" : "Create my learning workspace"}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>
      </section>
    </main>
  );
}
