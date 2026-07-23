"use client";

import { ArrowRight, BookOpen, BrainCircuit, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import { CognoraLogo } from "@/components/brand/cognora-logo";
import { useAuth } from "./auth-provider";

type Mode = "signin" | "register";

export function AuthScreen() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      if (mode === "register") await register(name, email, password);
      else await signIn(email, password);
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="auth-brand" href="/" aria-label="Cognora home">
          <CognoraLogo />
          <span>
            <strong>Cognora</strong>
            <small>Learning intelligence</small>
          </span>
        </Link>
        <div className="auth-story-copy">
          <p className="auth-eyebrow"><Sparkles size={15} /> Your learning, finally connected</p>
          <h1>One place to plan, learn, practice, and improve.</h1>
          <p>
            Cognora connects your courses, materials, deadlines, and mastery signals so every study session has a clear purpose.
          </p>
          <div className="auth-proof-list">
            <span><Check size={15} /> A study plan that adapts with you</span>
            <span><Check size={15} /> Private course materials and feedback</span>
            <span><Check size={15} /> Explainable knowledge-gap insights</span>
          </div>
        </div>
        <div className="auth-constellation" aria-hidden="true">
          <span className="constellation-core"><BrainCircuit size={31} /></span>
          <span className="constellation-node node-one"><BookOpen size={18} /></span>
          <span className="constellation-node node-two"><Check size={18} /></span>
          <span className="constellation-node node-three"><Sparkles size={18} /></span>
        </div>
        <p className="auth-trust"><LockKeyhole size={14} /> Your account and learning data are protected by Appwrite.</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <CognoraLogo />
            <strong>Cognora</strong>
          </div>
          <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Create your workspace"}</p>
          <h2>{mode === "signin" ? "Continue your learning" : "Start learning with clarity"}</h2>
          <p className="auth-form-intro">
            {mode === "signin"
              ? "Sign in to see today’s plan and learning signals."
              : "Set up your private student workspace in less than a minute."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account action">
            <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => { setMode("signin"); setError(""); }}>
              Sign in
            </button>
            <button className={mode === "register" ? "active" : ""} type="button" onClick={() => { setMode("register"); setError(""); }}>
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                <span>Full name</span>
                <div className="auth-input">
                  <Sparkles size={17} />
                  <input name="name" autoComplete="name" placeholder="Maya Ahmed" required maxLength={128} />
                </div>
              </label>
            )}
            <label>
              <span>Email address</span>
              <div className="auth-input">
                <Mail size={17} />
                <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </div>
            </label>
            <label>
              <span>Password</span>
              <div className="auth-input">
                <LockKeyhole size={17} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : null}
              {busy ? "Connecting…" : mode === "signin" ? "Sign in to Cognora" : "Create my workspace"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-legal">
            By continuing, you agree to use AI feedback as learning guidance, not official grading,
            and accept our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
