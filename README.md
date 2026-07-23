# Cognora AI

Cognora AI is a personal learning operating system that connects planning, lectures, roadmaps, assignment feedback, knowledge gaps, practice, course materials, progress, and an AI study coach in one student workspace.

## Current product state

Phase 9 provides:

- Appwrite email/password authentication
- private student profiles and onboarding preferences
- course creation and course workspaces
- private course-material uploads
- row-level and file-level permissions
- responsive dashboard and module navigation
- grounded syllabus and lecture analysis through DeepSeek
- concept extraction, adaptive seven-day study plans, flashcards, and quizzes
- scored practice attempts and explainable concept mastery evidence
- private assignment uploads and rubric-linked advisory feedback
- evidence-aware knowledge-gap detection
- prerequisite-aware adaptive learning roadmaps
- a course-grounded AI study coach
- asynchronous persisted-result handling for long DeepSeek reasoning jobs
- realtime AI job progress with completion and failure activity
- private in-app study reminders and notification preferences
- model, token, retry, and runtime observability without storing prompt content in operations records
- server-side daily AI request guardrails and bounded retries
- lazy-loaded workspaces, keyboard navigation, live regions, focus visibility, and reduced-motion support
- an installable PWA shell with static-asset caching that leaves authenticated pages and APIs network-only
- `.ics` study-plan export plus one-click Google Calendar and Outlook event handoff
- opt-in, content-free product analytics and private founding-beta feedback
- searchable material chunks and course-scoped Appwrite full-text retrieval for the AI coach
- founding-beta cohort preferences and private feedback history
- per-account AI, storage, and collaboration entitlements with live usage meters
- staged private-beta, early-access, and general-release preferences
- an owner-claimable, aggregate-only release-health dashboard
- provider readiness for verified email, Google Calendar, embeddings, billing, and the production Appwrite Site
- course membership roles and collaboration-seat foundations
- optional OpenAI-compatible embeddings with full-text fallback and cosine reranking
- registered Appwrite web origins for local and private production access
- expiring, bounded-use course invitation codes with server-side verification
- shared course intelligence with personal evidence and submissions kept private
- capacity-limited founding cohorts and content-free security audit events
- audited private-pilot/public-launch gates plus a concurrent launch load check
- persisted production-provider verification with truthful configured and verified states
- bounded embedding backfill controls
- Stripe Checkout and a signature-verified, idempotent subscription webhook
- immutable final launch approval evidence that cannot change Sites access

Email, Google Calendar OAuth, vector embeddings, and billing are provider-ready. The production URL can use the Appwrite-provided Sites hostname without separate DNS configuration.

## Stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Appwrite Cloud for Auth, TablesDB, Storage, Functions, Realtime, and Messaging
- DeepSeek V4 Flash and V4 Pro
- Sites-compatible vinext build output

## Local setup

1. Copy `.env.example` to `.env` and add the Appwrite and DeepSeek values.
2. Install dependencies with `npm install`.
3. Provision the Appwrite resources with `npm run appwrite:provision`.
4. Deploy the learning function with `npm run appwrite:deploy-function`.
5. Deploy the Google Calendar OAuth callback with `npm run appwrite:deploy-google-calendar`, then register `GOOGLE_CALENDAR_REDIRECT_URI` in Google Cloud.
6. After configuring Stripe, deploy the signed webhook with `npm run appwrite:deploy-billing-webhook`.
7. Optionally validate the full temporary learning, intelligence, retrieval, beta, launch-administration, operations, and reminder loop with `npm run appwrite:smoke-learning`.
8. Optionally run the concurrent launch snapshot check with `npm run appwrite:load-launch`.
9. Start the app with `npm run dev`.

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Documentation

- `docs/PRODUCT.md` — product model and principles
- `docs/ARCHITECTURE.md` — application and Appwrite architecture
- `docs/PHASES.md` — delivery sequence
