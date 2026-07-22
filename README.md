# Cognora AI

Cognora AI is a personal learning operating system that connects planning, lectures, roadmaps, assignment feedback, knowledge gaps, practice, course materials, progress, and an AI study coach in one student workspace.

## Current product state

Phase 6 provides:

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

Email reminder delivery is provider-ready but remains disabled until an Appwrite email provider and sender are connected.

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
5. Optionally validate the full temporary learning, intelligence, retrieval, beta, operations, and reminder loop with `npm run appwrite:smoke-learning`.
6. Start the app with `npm run dev`.

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Documentation

- `docs/PRODUCT.md` — product model and principles
- `docs/ARCHITECTURE.md` — application and Appwrite architecture
- `docs/PHASES.md` — delivery sequence
