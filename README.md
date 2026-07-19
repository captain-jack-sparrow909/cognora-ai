# Cognora AI

Cognora AI is a personal learning operating system that connects planning, lectures, roadmaps, assignment feedback, knowledge gaps, practice, course materials, progress, and an AI study coach in one student workspace.

## Current product state

Phase 2 provides:

- Appwrite email/password authentication
- private student profiles and onboarding preferences
- course creation and course workspaces
- private course-material uploads
- row-level and file-level permissions
- responsive dashboard and module navigation

Phase 3 will connect uploaded materials to syllabus extraction, lecture analysis, study planning, recall practice, and initial mastery evidence.

## Stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Appwrite Cloud for Auth, TablesDB, Storage, Functions, Realtime, and Messaging
- DeepSeek V4 Flash and V4 Pro
- Sites-compatible vinext build output

## Local setup

1. Copy `.env.example` to `.env` and add the Appwrite and DeepSeek values.
2. Install dependencies with `npm install`.
3. Provision the Phase 2 Appwrite resources with `npm run appwrite:provision`.
4. Start the app with `npm run dev`.

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Documentation

- `docs/PRODUCT.md` — product model and principles
- `docs/ARCHITECTURE.md` — application and Appwrite architecture
- `docs/PHASES.md` — delivery sequence
