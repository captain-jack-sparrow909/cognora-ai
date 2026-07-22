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

Delivered with an installable PWA shell, safe static-asset caching, `.ics` export, direct Google Calendar and Outlook event creation, opt-in content-free analytics, private beta feedback, founding-beta cohort preferences, and Appwrite full-text retrieval across material chunks for grounded coaching. The live Appwrite project has no messaging provider configured, so email delivery remains intentionally disabled and accurately labeled instead of simulating delivery.

## Phase 7 — Launch and scale ✅

- Production provider readiness and truthful activation states
- Calendar conflict policy and two-way connection records
- Optional vector embeddings with hybrid full-text and cosine retrieval
- Privacy-safe launch administration and aggregate release health
- Usage entitlements, collaboration roles, and staged release controls
- Registered Appwrite web platforms for local and private production access

Delivered with account-level AI, storage, and collaboration limits; live usage meters; staged release channels; course membership roles; calendar sync-state and conflict-policy records; optional OpenAI-compatible embeddings with full-text fallback; provider-ready email delivery; and an owner-claimable administration dashboard that exposes aggregate counts without learner content. Appwrite production and localhost origins are registered. External provider switches remain off because email, Google, Microsoft, Stripe, embedding, custom-domain credentials, and DNS are not configured.

## Phase 8 — Provider activation and public launch

- Connect and verify the Appwrite email sender
- Supply Google and Microsoft OAuth credentials and activate two-way calendar sync
- Choose an embedding provider and backfill existing material vectors
- Connect Stripe plans, checkout, webhooks, and entitlement lifecycle updates
- Add the production custom domain and complete DNS/SSL validation
- Turn on collaboration invitations, conduct a security/load review, and stage the first public cohort
