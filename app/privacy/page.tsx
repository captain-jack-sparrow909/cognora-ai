import type { Metadata } from "next";
import Link from "next/link";
import { CognoraLogo } from "@/components/brand/cognora-logo";

export const metadata: Metadata = {
  title: "Privacy Policy — CognoraAI",
  description: "How CognoraAI collects, uses, protects, and shares information.",
};

const effectiveDate = "July 23, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="CognoraAI home">
          <CognoraLogo size={48} />
          <span><strong>CognoraAI</strong><small>Learning intelligence</small></span>
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/">Home</Link>
          <Link aria-current="page" href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </header>

      <article className="legal-document">
        <p className="legal-eyebrow">Trust and data protection</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Effective and last updated: {effectiveDate}</p>
        <p className="legal-lead">
          CognoraAI (“we,” “us,” or “our”) is a private learning workspace that helps
          people plan study time, understand course materials, practice concepts, review assignments,
          identify knowledge gaps, and synchronize study sessions with Google Calendar. This policy
          explains what information CognoraAI handles and the choices available to you.
        </p>

        <section>
          <h2>1. Information we collect</h2>
          <h3>Account and profile information</h3>
          <p>
            We collect the name, email address, authentication records, study level, timezone,
            availability, and learning goals you provide when creating and personalizing an account.
          </p>
          <h3>Learning content and activity</h3>
          <p>
            We process materials you upload, course details, study plans, questions, answers,
            assignment submissions, feedback, mastery evidence, roadmap progress, and AI coach
            conversations so the requested learning features can work.
          </p>
          <h3>Integration and transaction information</h3>
          <p>
            If you connect Google Calendar, CognoraAI receives authorization tokens and the calendar
            event information needed to create or update CognoraAI study sessions. If you purchase a
            plan, Stripe processes payment-card details; CognoraAI receives transaction, customer,
            subscription, and entitlement information but does not store full card numbers.
          </p>
          <h3>Technical and operational information</h3>
          <p>
            We collect limited security, device, session, error, performance, feature-use, and
            request-volume information. Optional product analytics are off by default and exclude
            uploaded course content, filenames, questions, answers, and AI responses.
          </p>
        </section>

        <section>
          <h2>2. How we use information</h2>
          <ul>
            <li>Provide, personalize, secure, and maintain CognoraAI.</li>
            <li>Generate grounded summaries, plans, practice, feedback, roadmaps, and gap insights.</li>
            <li>Create and update Google Calendar study events when you request synchronization.</li>
            <li>Process subscriptions, enforce plan limits, and prevent fraud or abuse.</li>
            <li>Diagnose failures and improve reliability using content-minimized operational records.</li>
            <li>Comply with law, enforce our Terms, and protect users and the service.</li>
          </ul>
        </section>

        <section>
          <h2>3. AI processing</h2>
          <p>
            CognoraAI sends only the information needed for a requested AI feature to configured model
            and embedding providers, including DeepSeek and the configured embedding service. AI
            output may be incomplete or inaccurate and is learning guidance, not official grading,
            professional advice, or a substitute for your institution’s requirements.
          </p>
        </section>

        <section>
          <h2>4. Google API data</h2>
          <p>
            CognoraAI requests the Google Calendar events scope to create, update, and maintain study
            sessions that originate from your CognoraAI plan. We do not use Google user data for
            advertising, sell it, or allow humans to read it except when necessary for security,
            support with your permission, legal compliance, or aggregated internal operations where
            the data cannot identify you.
          </p>
          <p>
            CognoraAI&apos;s use and transfer of information received from Google APIs adheres to the
            <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer">
              Google API Services User Data Policy
            </a>, including its Limited Use requirements.
          </p>
          <p>
            You can revoke CognoraAI&apos;s access at any time from your Google Account&apos;s third-party
            connections. Revocation stops future synchronization but does not automatically delete
            events already created in your calendar.
          </p>
        </section>

        <section>
          <h2>5. When information is shared</h2>
          <p>
            We share information only as needed with service providers that operate CognoraAI, such as
            Appwrite for authentication, databases, functions, messaging, and storage; AI and
            embedding providers for requested learning features; Google for Calendar integration;
            and Stripe for billing. We may also disclose information when legally required, to
            protect rights and safety, or during a business reorganization subject to appropriate
            safeguards. We do not sell personal information.
          </p>
        </section>

        <section>
          <h2>6. Storage, security, and retention</h2>
          <p>
            CognoraAI uses access controls, private-by-default records, encrypted transport, and
            encrypted storage for Google authorization tokens. No service can guarantee absolute
            security. We retain information while your account or integration is active and as
            reasonably necessary to provide the service, resolve disputes, meet legal obligations,
            and protect the platform. Retention periods vary by record type and operational need.
          </p>
        </section>

        <section>
          <h2>7. Your choices and rights</h2>
          <p>
            You may choose what learning content to upload, disable optional analytics, revoke Google
            access, and request access, correction, export, or deletion of personal information,
            subject to legal exceptions. You may also delete individual course materials and account
            content through available product controls.
          </p>
        </section>

        <section>
          <h2>8. Children and educational use</h2>
          <p>
            CognoraAI is not directed to children under 13. If local law requires parental, guardian,
            school, or institutional authorization for a learner to use the service, that
            authorization must be obtained before account creation.
          </p>
        </section>

        <section>
          <h2>9. International processing</h2>
          <p>
            Service providers may process information in countries other than your own. Where
            required, we use appropriate contractual or legal safeguards for international data
            transfers.
          </p>
        </section>

        <section>
          <h2>10. Changes and contact</h2>
          <p>
            We may update this policy as CognoraAI evolves. Material changes will be reflected by a new
            effective date and, when appropriate, an in-product notice. For privacy questions or
            requests, use CognoraAI&apos;s private in-app feedback channel. If you cannot access an account,
            contact the developer identified on CognoraAI&apos;s Google OAuth consent screen.
          </p>
        </section>
      </article>

      <footer className="legal-footer">
        <span>© 2026 CognoraAI</span>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/">Return home</Link>
      </footer>
    </main>
  );
}
