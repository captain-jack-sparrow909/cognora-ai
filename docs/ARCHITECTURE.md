# Cognora AI architecture

## Application stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4 with a project-owned component system
- Appwrite Cloud for authentication, tables, storage, functions, realtime, messaging, and site hosting
- DeepSeek V4 Flash for high-volume structured work
- DeepSeek V4 Pro for complex reasoning and synthesis

## Boundary rules

- DeepSeek API keys are server-only and will be used from Appwrite Functions.
- Appwrite API keys are server-only.
- Browser code uses the Appwrite Web SDK and user-scoped sessions.
- All user records include an owner identifier and use row-level permissions.
- Uploaded files use file-level permissions and default to private.
- AI responses are schema validated before persistence.
- Model names are configuration, not hardcoded business logic.

## Initial Appwrite resources

### Phase 2 tables — provisioned

- `profiles`: one private onboarding profile per Appwrite user
- `courses`: private student-owned course workspaces
- `materials`: private metadata linked to uploaded Storage files

### Phase 3 tables — provisioned

- `material_insights`: grounded summaries, outlines, and key points for analyzed material
- `concepts`: course knowledge units with current evidence counts and mastery
- `study_tasks`: syllabus, lecture, and adaptive-plan study sessions
- `practice_items`: grounded flashcards and quiz questions
- `practice_attempts`: scored student responses and confidence evidence
- `mastery_records`: one explainable mastery record per concept

### Phase 4 tables — provisioned

- `assignments`: private briefs, rubrics, due dates, and review state
- `submissions`: private assignment-file metadata and review lifecycle
- `feedback_reports`: rubric-linked strengths, improvements, advisory scores, and revision plans
- `gap_insights`: explainable concept gaps separated from missing evidence
- `roadmaps`: active, completed, and archived learning goals
- `roadmap_steps`: ordered, unlockable roadmap milestones
- `coach_messages`: course-grounded questions, answers, actions, and evidence

### Planned tables

`course_members`, `lectures`, `concept_relationships`, `study_sessions`, `assessments`, `ai_jobs`, and `notifications`.

### Storage

- `course-materials`: provisioned with file-level security, encryption, antivirus scanning, a 50 MB limit, and document-only extensions
- `assignment-submissions` (`submissions`): provisioned with file-level security, encryption, antivirus scanning, a 50 MB limit, and assignment-document extensions

### Functions

- `learning-engine`: deployed authenticated Appwrite Function handling material processing, adaptive planning, practice scoring, mastery updates, assignment feedback, knowledge-gap detection, roadmap generation, and contextual coaching through a user-scoped JWT

- `process-material`: now implemented as the `process_material` learning-engine action
- `generate-study-plan`: now implemented as the `generate_plan` learning-engine action
- `analyze-lecture`: create summaries, concepts, questions, and recall items
- `generate-roadmap`: implemented as the `generate_roadmap` action
- `review-assignment`: implemented as the `review_assignment` action
- `detect-gaps`: implemented as the `detect_gaps` action with explicit evidence and missing-evidence handling
- `ask-coach`: implemented as the `ask_coach` action grounded in profile, course, concepts, gaps, plan, materials, and roadmap
- `update-mastery`: implemented as the `submit_attempt` action
- `deepseek-gateway`: the learning engine currently owns validated JSON model access; shared logging, retries, and cost controls harden in Phase 5

Long-running AI actions are submitted asynchronously. The browser polls the user-owned result records rather than relying on Appwrite's 30-second synchronous execution response window.

## Retrieval approach

The first version uses course-scoped text chunks and Appwrite full-text search. Semantic vector search can be added later through an external vector store connected by an Appwrite Function, while Appwrite remains the system of record.
