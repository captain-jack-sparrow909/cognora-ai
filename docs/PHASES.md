# Delivery phases

## Phase 1 — Product foundation ✅

- Confirm the nine-capability product scope
- Establish the frontend and responsive design system
- Create the connected dashboard shell
- Add Appwrite client and server configuration boundaries
- Document product, architecture, and delivery phases

## Phase 2 — Accounts and course foundation ✅

- Appwrite authentication and protected application shell
- Student onboarding and learning preferences
- Course creation and course dashboard
- Private material uploads with processing states
- Initial Appwrite tables, indexes, permissions, and storage buckets

Delivered with Appwrite-backed email/password accounts, private onboarding profiles, live course creation, course workspaces, private uploads, and an idempotent provisioning workflow.

## Phase 3 — Core learning loop ✅

- Syllabus extraction
- Adaptive study planner
- Lecture companion
- Flashcards and quizzes
- Initial mastery evidence

Delivered with a private Appwrite Function backed by DeepSeek V4 Flash, document extraction, grounded lecture and syllabus insights, concept mapping, adaptive seven-day plans, generated flashcards and quizzes, scored practice attempts, and explainable mastery updates.

## Phase 4 — Intelligence layer ✅

- Assignment feedback
- Knowledge gap detector
- Roadmap adaptation
- AI study coach with course context

Delivered with private assignment submissions, rubric-linked advisory feedback, evidence-aware gap analysis, prerequisite-aware adaptive roadmaps, and a course-grounded DeepSeek coach. Long-running reasoning uses asynchronous Appwrite executions and persisted-result polling so work can safely exceed the synchronous response window.

## Phase 5 — Engagement and production readiness ✅

- Messaging and reminders
- Realtime AI job progress
- Accessibility and performance review
- End-to-end tests, observability, cost controls, and deployment hardening

Delivered with private in-app reminders, realtime AI job progress, completion/failure notifications, token and runtime telemetry, bounded retries, a server-enforced daily request limit, accessible navigation and live regions, reduced-motion support, lazy-loaded workspaces, contract tests, and a full temporary-user Appwrite/DeepSeek smoke test. Email delivery is intentionally disabled until an Appwrite email provider and sender are configured.

## Phase 6 — Beta growth and integrations ✅

- Installable PWA experience
- Calendar export and Google/Outlook event handoff
- Consent-first product analytics, private feedback, and beta cohort tooling
- Searchable source retrieval for larger multi-course libraries
- Email provider readiness check

Delivered with an installable PWA shell, safe static-asset caching, `.ics` export, direct Google Calendar event creation, opt-in content-free analytics, private beta feedback, founding-beta cohort preferences, and Appwrite full-text retrieval across material chunks for grounded coaching. Google-only OAuth synchronization was added during production hookup with encrypted server-side refresh credentials. The live Appwrite project has no messaging provider configured, so email delivery remains intentionally disabled and accurately labeled instead of simulating delivery.

## Phase 7 — Launch and scale ✅

- Production provider readiness and truthful activation states
- Calendar conflict policy and two-way connection records
- Optional vector embeddings with hybrid full-text and cosine retrieval
- Privacy-safe launch administration and aggregate release health
- Usage entitlements, collaboration roles, and staged release controls
- Registered Appwrite web platforms for local and private production access

Delivered with account-level AI, storage, and collaboration limits; live usage meters; staged release channels; course membership roles; Google Calendar sync-state and conflict-policy records; optional OpenAI-compatible embeddings with full-text fallback; provider-ready email delivery; and an owner-claimable administration dashboard that exposes aggregate counts without learner content. Appwrite production and localhost origins are registered. External provider switches remain off until email, Google, Stripe, and embedding configuration is verified.

## Phase 8 — Launch gate and controlled collaboration ✅

- Server-verified, expiring course invitation codes with viewer/editor roles and bounded uses
- Shared course materials and learning intelligence without exposing personal attempts, mastery, submissions, feedback, or coaching history
- Controlled founding-cohort codes, capacity limits, and private enrollment
- Content-free security audit events for invitation, enrollment, rejected-code, and launch-review activity
- Private-pilot and public-launch readiness checks with external providers treated as hard gates
- A repeatable concurrent Appwrite Function load check for the launch dashboard

Delivered without weakening the private deployment. Invitation and cohort secrets are returned once, stored only as SHA-256 hashes, and verified inside the Appwrite Function. Course permissions are refreshed server-side when a learner joins. The launch review distinguishes a safe private pilot from a public launch and cannot enable public access. Email, Google, Stripe, and embeddings remain gated until their real configuration is supplied and verified.

## Phase 9 — Production activation gate ⚠️ External inputs required

- Live, server-side verification for Appwrite email, Google Calendar credentials, embeddings, Stripe, and the Appwrite-hosted production site
- Persisted provider activation evidence with configured, verified, and error states
- Bounded embedding backfill for existing private source passages
- Stripe Checkout plus a separately deployable, signature-verified webhook that updates subscriptions and entitlements idempotently
- Persisted final launch approvals that combine private-pilot checks with every verified external provider
- A production activation center that keeps unavailable actions disabled and lists exact blockers

The activation layer verifies each configured external provider and the production Appwrite Site. No readiness flag is promoted merely because UI or schema support exists.

## Phase 10 — Provider hookup and first public cohort

- Add and verify the chosen email provider and sender
- Register Google Calendar OAuth, redirect URIs, consent scopes, and two-way sync tests
- Connect the embedding endpoint and complete the source-vector backfill
- Add Stripe secrets and prices, deploy the billing webhook, and complete a test subscription lifecycle
- Verify the Appwrite-provided Sites hostname and live application manifest
- Re-run the final approval, explicitly approve the Sites access change, and open the first production cohort
