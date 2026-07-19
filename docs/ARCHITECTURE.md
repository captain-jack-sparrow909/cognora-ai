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

### Planned tables

`course_members`, `lectures`, `concepts`, `concept_relationships`, `assignments`, `submissions`, `feedback_reports`, `roadmaps`, `roadmap_steps`, `study_tasks`, `study_sessions`, `assessments`, `questions`, `attempts`, `mastery_records`, `gap_insights`, `ai_jobs`, and `notifications`.

### Storage

- `course-materials`: provisioned with file-level security, encryption, antivirus scanning, a 50 MB limit, and document-only extensions
- `submissions`: private assignment files

### Functions

- `process-material`: extract, chunk, classify, and index document text
- `generate-study-plan`: create a draft plan and pass it through scheduling rules
- `analyze-lecture`: create summaries, concepts, questions, and recall items
- `generate-roadmap`: build a prerequisite-aware learning sequence
- `review-assignment`: produce rubric-linked advisory feedback
- `update-mastery`: calculate concept evidence and gap signals
- `deepseek-gateway`: shared validated model access, logging, retries, and cost controls

## Retrieval approach

The first version uses course-scoped text chunks and Appwrite full-text search. Semantic vector search can be added later through an external vector store connected by an Appwrite Function, while Appwrite remains the system of record.
