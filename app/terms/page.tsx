import type { Metadata } from "next";
import Link from "next/link";
import { CognoraLogo } from "@/components/brand/cognora-logo";

export const metadata: Metadata = {
  title: "Terms of Service — CognoraAI",
  description: "The terms governing access to and use of CognoraAI.",
};

const effectiveDate = "July 23, 2026";

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="CognoraAI home">
          <CognoraLogo size={48} />
          <span><strong>CognoraAI</strong><small>Learning intelligence</small></span>
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link aria-current="page" href="/terms">Terms</Link>
        </nav>
      </header>

      <article className="legal-document">
        <p className="legal-eyebrow">Clear expectations</p>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Effective and last updated: {effectiveDate}</p>
        <p className="legal-lead">
          These Terms of Service (“Terms”) govern your access to and use of CognoraAI. By creating
          an account or using CognoraAI, you agree to these Terms and acknowledge the Privacy Policy.
          If you do not agree, do not use the service.
        </p>

        <section>
          <h2>1. The service</h2>
          <p>
            CognoraAI is an AI-assisted learning workspace offering study planning, lecture and
            material analysis, learning roadmaps, assignment feedback, practice generation,
            knowledge-gap detection, coaching, collaboration, calendar synchronization, and related
            tools. Features may change as the service develops.
          </p>
        </section>

        <section>
          <h2>2. Eligibility and accounts</h2>
          <p>
            You must be legally able to enter these Terms. Users under the age of legal majority must
            have any consent required by applicable law. You are responsible for accurate account
            information, safeguarding credentials, and activity under your account. Notify us
            promptly through the in-app feedback channel if you believe an account has been
            compromised.
          </p>
        </section>

        <section>
          <h2>3. AI output and academic responsibility</h2>
          <p>
            AI-generated summaries, plans, explanations, feedback, scores, and recommendations may
            be incomplete, outdated, or incorrect. They are educational guidance—not official
            grading, accreditation, medical, legal, financial, or other professional advice. You are
            responsible for checking important output, following institutional policies, citing
            sources where required, and submitting work that honestly represents your own effort.
          </p>
        </section>

        <section>
          <h2>4. Your content</h2>
          <p>
            You retain ownership of content you upload or submit. You grant CognoraAI a limited,
            worldwide, non-exclusive license to host, copy, process, transform, and display that
            content only as needed to provide, secure, and improve the features you request. You must
            have the rights necessary to upload the content and must not violate privacy, copyright,
            confidentiality, or institutional rules.
          </p>
        </section>

        <section>
          <h2>5. Acceptable use</h2>
          <p>You may not use CognoraAI to:</p>
          <ul>
            <li>Break the law, facilitate harm, harassment, fraud, or academic misconduct.</li>
            <li>Upload malware or content that infringes another person’s rights.</li>
            <li>Probe, disrupt, overload, bypass, or reverse engineer security or usage controls.</li>
            <li>Access another account or private learning workspace without authorization.</li>
            <li>Resell or automate access in a way that harms CognoraAI or other users.</li>
          </ul>
        </section>

        <section>
          <h2>6. Google Calendar and third-party services</h2>
          <p>
            Optional integrations are governed by their providers’ terms and privacy practices.
            Calendar synchronization may create or update events in the connected Google account.
            You are responsible for reviewing synchronized events and managing access through your
            Google Account. CognoraAI is not responsible for third-party outages or changes outside its
            control.
          </p>
        </section>

        <section>
          <h2>7. Paid plans</h2>
          <p>
            Paid subscriptions are processed by Stripe and renew for the billing period shown at
            checkout until canceled. Prices, taxes, plan limits, renewal terms, and refund rights are
            presented at purchase or required by law. Canceling stops future renewal and does not
            normally refund a current period unless applicable law requires otherwise.
          </p>
        </section>

        <section>
          <h2>8. CognoraAI property</h2>
          <p>
            CognoraAI&apos;s software, branding, interface, documentation, and service-generated systems
            are protected by intellectual-property laws. Except for the limited right to use the
            service under these Terms, no rights are transferred to you.
          </p>
        </section>

        <section>
          <h2>9. Availability, suspension, and termination</h2>
          <p>
            We may modify, pause, or discontinue features and may limit or suspend access when
            reasonably necessary for security, maintenance, legal compliance, nonpayment, or a
            material violation of these Terms. You may stop using CognoraAI at any time. Provisions
            that by their nature should survive termination will continue to apply.
          </p>
        </section>

        <section>
          <h2>10. Disclaimers and limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, CognoraAI is provided “as is” and “as available”
            without warranties of uninterrupted operation, accuracy, fitness for a particular
            purpose, or non-infringement. To the fullest extent permitted by law, CognoraAI and its
            operator will not be liable for indirect, incidental, special, consequential, exemplary,
            or punitive damages, lost data, lost profits, academic outcomes, or reliance on AI
            output. Mandatory consumer rights are not excluded.
          </p>
        </section>

        <section>
          <h2>11. Changes, disputes, and contact</h2>
          <p>
            We may update these Terms as the service changes. Material updates will carry a revised
            effective date and, when appropriate, an in-product notice. Applicable law and mandatory
            consumer protections govern disputes. For questions, use CognoraAI&apos;s private in-app
            feedback channel; if you cannot access an account, contact the developer identified on
            CognoraAI&apos;s Google OAuth consent screen.
          </p>
        </section>
      </article>

      <footer className="legal-footer">
        <span>© 2026 CognoraAI</span>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/">Return home</Link>
      </footer>
    </main>
  );
}
