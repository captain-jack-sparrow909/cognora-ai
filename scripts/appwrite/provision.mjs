import {
  Client,
  Compression,
  Permission,
  Project,
  Role,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from "node-appwrite";

const required = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_MATERIALS_BUCKET_ID",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);
const storage = new Storage(client);
const project = new Project(client);
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const bucketId = process.env.APPWRITE_MATERIALS_BUCKET_ID ?? process.env.NEXT_PUBLIC_APPWRITE_MATERIALS_BUCKET_ID;
const authenticatedCreate = [Permission.create(Role.users())];

const definitions = [
  {
    id: "profiles",
    name: "Student profiles",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "displayName", type: "varchar", size: 128, required: true },
      {
        key: "studyLevel",
        type: "enum",
        elements: ["high-school", "undergraduate", "postgraduate", "professional", "other"],
        required: true,
      },
      { key: "timezone", type: "varchar", size: 64, required: true },
      { key: "weeklyHours", type: "integer", min: 1, max: 80, required: true },
      { key: "learningGoal", type: "text", required: false },
      { key: "onboardingComplete", type: "boolean", required: false, default: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
    ],
  },
  {
    id: "courses",
    name: "Courses",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 160, required: true },
      { key: "code", type: "varchar", size: 32, required: false },
      {
        key: "color",
        type: "enum",
        elements: ["cobalt", "teal", "coral", "amber", "violet", "slate"],
        required: true,
      },
      { key: "term", type: "varchar", size: 64, required: false },
      { key: "description", type: "text", required: false },
      { key: "targetGrade", type: "varchar", size: 32, required: false },
      {
        key: "status",
        type: "enum",
        elements: ["active", "completed", "archived"],
        required: true,
      },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_status", type: TablesDBIndexType.Key, columns: ["ownerId", "status"] },
      { key: "owner_title", type: TablesDBIndexType.Key, columns: ["ownerId", "title"] },
    ],
  },
  {
    id: "materials",
    name: "Course materials",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "fileId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 255, required: true },
      { key: "mimeType", type: "varchar", size: 128, required: true },
      { key: "size", type: "integer", min: 0, max: 52428800, required: true },
      {
        key: "kind",
        type: "enum",
        elements: ["syllabus", "lecture", "notes", "assignment", "transcript", "other"],
        required: true,
      },
      {
        key: "processingStatus",
        type: "enum",
        elements: ["uploaded", "queued", "processing", "ready", "failed"],
        required: true,
      },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "file_unique", type: TablesDBIndexType.Unique, columns: ["fileId"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "processingStatus"] },
    ],
  },
  {
    id: "material_insights",
    name: "AI material insights",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 255, required: true },
      { key: "materialType", type: "varchar", size: 32, required: true },
      { key: "summary", type: "text", required: true },
      { key: "outlineJson", type: "text", required: true },
      { key: "keyPointsJson", type: "text", required: true },
      { key: "sourceExcerpt", type: "text", required: false },
      { key: "model", type: "varchar", size: 64, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_unique", type: TablesDBIndexType.Unique, columns: ["materialId"] },
    ],
  },
  {
    id: "concepts",
    name: "Course concepts",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 160, required: true },
      { key: "description", type: "text", required: true },
      { key: "mastery", type: "integer", min: 0, max: 100, required: false, default: 0 },
      { key: "evidenceCount", type: "integer", min: 0, max: 100000, required: false, default: 0 },
      { key: "lastEvidenceAt", type: "datetime", required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_title", type: TablesDBIndexType.Key, columns: ["materialId", "title"] },
      { key: "course_mastery", type: TablesDBIndexType.Key, columns: ["courseId", "mastery"] },
    ],
  },
  {
    id: "study_tasks",
    name: "Adaptive study tasks",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "materialId", type: "varchar", size: 36, required: false },
      { key: "title", type: "varchar", size: 200, required: true },
      { key: "description", type: "text", required: false },
      { key: "taskType", type: "enum", elements: ["review", "practice", "lecture", "reading", "project"], required: true },
      { key: "durationMinutes", type: "integer", min: 5, max: 480, required: true },
      { key: "scheduledFor", type: "datetime", required: true },
      { key: "status", type: "enum", elements: ["planned", "completed", "skipped"], required: true },
      { key: "source", type: "enum", elements: ["syllabus", "lecture", "adaptive-plan", "manual"], required: true },
      { key: "reason", type: "text", required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_schedule", type: TablesDBIndexType.Key, columns: ["ownerId", "scheduledFor"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
      { key: "material_source", type: TablesDBIndexType.Key, columns: ["materialId", "source"] },
    ],
  },
  {
    id: "practice_items",
    name: "Recall and quiz items",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "itemType", type: "enum", elements: ["flashcard", "multiple-choice", "short-answer"], required: true },
      { key: "prompt", type: "text", required: true },
      { key: "answer", type: "text", required: true },
      { key: "optionsJson", type: "text", required: false },
      { key: "explanation", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_type", type: TablesDBIndexType.Key, columns: ["materialId", "itemType"] },
      { key: "concept_type", type: TablesDBIndexType.Key, columns: ["conceptId", "itemType"] },
    ],
  },
  {
    id: "practice_attempts",
    name: "Practice attempts",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "itemId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "response", type: "text", required: true },
      { key: "correct", type: "boolean", required: true },
      { key: "confidence", type: "integer", min: 1, max: 5, required: true },
      { key: "masteryAfter", type: "integer", min: 0, max: 100, required: true },
      { key: "answeredAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_answered", type: TablesDBIndexType.Key, columns: ["ownerId", "answeredAt"] },
      { key: "concept_answered", type: TablesDBIndexType.Key, columns: ["conceptId", "answeredAt"] },
      { key: "item_answered", type: TablesDBIndexType.Key, columns: ["itemId", "answeredAt"] },
    ],
  },
  {
    id: "mastery_records",
    name: "Explainable mastery records",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: true },
      { key: "mastery", type: "integer", min: 0, max: 100, required: true },
      { key: "evidenceCount", type: "integer", min: 0, max: 100000, required: true },
      { key: "correctCount", type: "integer", min: 0, max: 100000, required: true },
      { key: "lastEvidence", type: "text", required: true },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "concept_unique", type: TablesDBIndexType.Unique, columns: ["conceptId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_mastery", type: TablesDBIndexType.Key, columns: ["courseId", "mastery"] },
    ],
  },
  {
    id: "assignments",
    name: "Assignments",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 200, required: true },
      { key: "brief", type: "text", required: true },
      { key: "rubricText", type: "text", required: true },
      { key: "dueAt", type: "datetime", required: false },
      { key: "status", type: "enum", elements: ["draft", "submitted", "reviewed"], required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
    ],
  },
  {
    id: "submissions",
    name: "Assignment submissions",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "assignmentId", type: "varchar", size: 36, required: true },
      { key: "fileId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 255, required: true },
      { key: "mimeType", type: "varchar", size: 128, required: true },
      { key: "size", type: "integer", min: 0, max: 52428800, required: true },
      { key: "status", type: "enum", elements: ["uploaded", "reviewing", "reviewed", "failed"], required: true },
      { key: "submittedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "assignment_unique", type: TablesDBIndexType.Unique, columns: ["assignmentId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
    ],
  },
  {
    id: "feedback_reports",
    name: "AI assignment feedback",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "assignmentId", type: "varchar", size: 36, required: true },
      { key: "submissionId", type: "varchar", size: 36, required: true },
      { key: "summary", type: "text", required: true },
      { key: "strengthsJson", type: "text", required: true },
      { key: "improvementsJson", type: "text", required: true },
      { key: "rubricJson", type: "text", required: true },
      { key: "nextStepsJson", type: "text", required: true },
      { key: "linkedConceptsJson", type: "text", required: true },
      { key: "advisoryScore", type: "integer", min: 0, max: 100, required: true },
      { key: "model", type: "varchar", size: 64, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "assignment_unique", type: TablesDBIndexType.Unique, columns: ["assignmentId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_created", type: TablesDBIndexType.Key, columns: ["courseId", "createdAt"] },
    ],
  },
  {
    id: "gap_insights",
    name: "Knowledge gap insights",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 180, required: true },
      { key: "severity", type: "enum", elements: ["high", "medium", "low"], required: true },
      { key: "mastery", type: "integer", min: 0, max: 100, required: true },
      { key: "evidenceCount", type: "integer", min: 0, max: 100000, required: true },
      { key: "evidenceJson", type: "text", required: true },
      { key: "explanation", type: "text", required: true },
      { key: "recommendedAction", type: "text", required: true },
      { key: "status", type: "enum", elements: ["open", "improving", "resolved"], required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "concept_unique", type: TablesDBIndexType.Unique, columns: ["conceptId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_severity", type: TablesDBIndexType.Key, columns: ["courseId", "severity"] },
    ],
  },
  {
    id: "roadmaps",
    name: "Learning roadmaps",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "goal", type: "text", required: true },
      { key: "title", type: "varchar", size: 200, required: true },
      { key: "summary", type: "text", required: true },
      { key: "status", type: "enum", elements: ["active", "completed", "archived"], required: true },
      { key: "model", type: "varchar", size: 64, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
    ],
  },
  {
    id: "roadmap_steps",
    name: "Learning roadmap steps",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "roadmapId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "sequence", type: "integer", min: 1, max: 1000, required: true },
      { key: "title", type: "varchar", size: 200, required: true },
      { key: "description", type: "text", required: true },
      { key: "status", type: "enum", elements: ["locked", "available", "in-progress", "completed"], required: true },
      { key: "targetDate", type: "datetime", required: true },
      { key: "reason", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "roadmap_sequence", type: TablesDBIndexType.Unique, columns: ["roadmapId", "sequence"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "roadmap_status", type: TablesDBIndexType.Key, columns: ["roadmapId", "status"] },
    ],
  },
  {
    id: "coach_messages",
    name: "AI study coach conversations",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: false },
      { key: "question", type: "text", required: true },
      { key: "answer", type: "text", required: true },
      { key: "suggestedActionsJson", type: "text", required: true },
      { key: "evidenceJson", type: "text", required: true },
      { key: "model", type: "varchar", size: 64, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_created", type: TablesDBIndexType.Key, columns: ["ownerId", "createdAt"] },
      { key: "course_created", type: TablesDBIndexType.Key, columns: ["courseId", "createdAt"] },
    ],
  },
  {
    id: "ai_jobs",
    name: "AI job operations",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: false },
      { key: "entityId", type: "varchar", size: 36, required: false },
      { key: "action", type: "varchar", size: 48, required: true },
      { key: "label", type: "varchar", size: 160, required: true },
      { key: "status", type: "enum", elements: ["queued", "processing", "completed", "failed"], required: true },
      { key: "progress", type: "integer", min: 0, max: 100, required: true },
      { key: "stage", type: "varchar", size: 160, required: true },
      { key: "model", type: "varchar", size: 64, required: false },
      { key: "inputChars", type: "integer", min: 0, max: 2000000, required: false },
      { key: "promptTokens", type: "integer", min: 0, max: 10000000, required: false },
      { key: "completionTokens", type: "integer", min: 0, max: 10000000, required: false },
      { key: "durationMs", type: "integer", min: 0, max: 3600000, required: false },
      { key: "retryCount", type: "integer", min: 0, max: 10, required: false },
      { key: "error", type: "text", required: false },
      { key: "createdAt", type: "datetime", required: true },
      { key: "startedAt", type: "datetime", required: false },
      { key: "completedAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "owner_created", type: TablesDBIndexType.Key, columns: ["ownerId", "createdAt"] },
      { key: "owner_status", type: TablesDBIndexType.Key, columns: ["ownerId", "status"] },
    ],
  },
  {
    id: "notifications",
    name: "Learner notifications",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "type", type: "enum", elements: ["reminder", "ai-complete", "ai-failed", "insight"], required: true },
      { key: "title", type: "varchar", size: 180, required: true },
      { key: "body", type: "text", required: true },
      { key: "entityType", type: "varchar", size: 48, required: false },
      { key: "entityId", type: "varchar", size: 36, required: false },
      { key: "read", type: "boolean", required: false, default: false },
      { key: "scheduledFor", type: "datetime", required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_read", type: TablesDBIndexType.Key, columns: ["ownerId", "read"] },
      { key: "owner_schedule", type: TablesDBIndexType.Key, columns: ["ownerId", "scheduledFor"] },
    ],
  },
  {
    id: "reminder_preferences",
    name: "Reminder preferences",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "inAppEnabled", type: "boolean", required: false, default: true },
      { key: "emailEnabled", type: "boolean", required: false, default: false },
      { key: "dailyTime", type: "varchar", size: 5, required: true },
      { key: "daysJson", type: "text", required: true },
      { key: "timezone", type: "varchar", size: 64, required: true },
      { key: "taskLeadMinutes", type: "integer", min: 5, max: 1440, required: true },
      { key: "quietStart", type: "varchar", size: 5, required: false },
      { key: "quietEnd", type: "varchar", size: 5, required: false },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
    ],
  },
  {
    id: "knowledge_chunks",
    name: "Searchable material knowledge chunks",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "chunkIndex", type: "integer", min: 0, max: 500, required: true },
      { key: "content", type: "text", required: true },
      { key: "embeddingJson", type: "text", required: false },
      { key: "embeddingModel", type: "varchar", size: 96, required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "material_chunk", type: TablesDBIndexType.Unique, columns: ["materialId", "chunkIndex"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "content_search", type: TablesDBIndexType.Fulltext, columns: ["content"] },
    ],
  },
  {
    id: "beta_profiles",
    name: "Private beta preferences",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "cohort", type: "varchar", size: 64, required: true },
      { key: "analyticsEnabled", type: "boolean", required: false, default: false },
      { key: "joinedAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
      { key: "cohort_joined", type: TablesDBIndexType.Key, columns: ["cohort", "joinedAt"] },
    ],
  },
  {
    id: "analytics_events",
    name: "Privacy-safe product analytics",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "eventName", type: "varchar", size: 64, required: true },
      { key: "view", type: "varchar", size: 48, required: false },
      { key: "sessionId", type: "varchar", size: 36, required: true },
      { key: "metadataJson", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_created", type: TablesDBIndexType.Key, columns: ["ownerId", "createdAt"] },
      { key: "event_created", type: TablesDBIndexType.Key, columns: ["eventName", "createdAt"] },
    ],
  },
  {
    id: "product_feedback",
    name: "Private beta feedback",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "category", type: "enum", elements: ["idea", "confusing", "bug", "delight"], required: true },
      { key: "rating", type: "integer", min: 1, max: 5, required: true },
      { key: "message", type: "text", required: true },
      { key: "status", type: "enum", elements: ["new", "reviewed", "planned", "resolved"], required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_created", type: TablesDBIndexType.Key, columns: ["ownerId", "createdAt"] },
      { key: "status_created", type: TablesDBIndexType.Key, columns: ["status", "createdAt"] },
    ],
  },
  {
    id: "entitlements",
    name: "Learner plans and usage entitlements",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "plan", type: "enum", elements: ["founding-beta", "pro", "education"], required: true },
      { key: "status", type: "enum", elements: ["active", "trialing", "paused"], required: true },
      { key: "aiDailyLimit", type: "integer", min: 1, max: 10000, required: true },
      { key: "storageLimitMb", type: "integer", min: 50, max: 1000000, required: true },
      { key: "collaborationSeats", type: "integer", min: 1, max: 10000, required: true },
      { key: "trialEndsAt", type: "datetime", required: false },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
      { key: "plan_status", type: TablesDBIndexType.Key, columns: ["plan", "status"] },
    ],
  },
  {
    id: "launch_preferences",
    name: "Staged release preferences",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "releaseChannel", type: "enum", elements: ["private-beta", "early-access", "general"], required: true },
      { key: "autoUpdates", type: "boolean", required: false, default: true },
      { key: "providerAlerts", type: "boolean", required: false, default: true },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [{ key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] }],
  },
  {
    id: "calendar_connections",
    name: "Calendar sync connections",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "provider", type: "enum", elements: ["google", "microsoft"], required: true },
      { key: "status", type: "enum", elements: ["not-configured", "connected", "paused", "error"], required: true },
      { key: "syncMode", type: "enum", elements: ["export", "import", "two-way"], required: true },
      { key: "conflictPolicy", type: "enum", elements: ["ask", "cognora-wins", "calendar-wins"], required: true },
      { key: "lastSyncAt", type: "datetime", required: false },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_provider", type: TablesDBIndexType.Unique, columns: ["ownerId", "provider"] },
      { key: "owner_status", type: TablesDBIndexType.Key, columns: ["ownerId", "status"] },
    ],
  },
  {
    id: "course_members",
    name: "Course collaboration memberships",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "memberId", type: "varchar", size: 36, required: true },
      { key: "role", type: "enum", elements: ["owner", "editor", "viewer"], required: true },
      { key: "status", type: "enum", elements: ["active", "invited", "revoked"], required: true },
      { key: "joinedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "course_member", type: TablesDBIndexType.Unique, columns: ["courseId", "memberId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "member_status", type: TablesDBIndexType.Key, columns: ["memberId", "status"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
    ],
  },
  {
    id: "launch_admins",
    name: "Launch administration roles",
    createPermissions: [],
    columns: [
      { key: "userId", type: "varchar", size: 36, required: true },
      { key: "role", type: "enum", elements: ["owner", "operator"], required: true },
      { key: "claimedAt", type: "datetime", required: true },
    ],
    indexes: [{ key: "user_unique", type: TablesDBIndexType.Unique, columns: ["userId"] }],
  },
  {
    id: "course_invites",
    name: "Private course invitation codes",
    createPermissions: [],
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "codeHash", type: "varchar", size: 64, required: true },
      { key: "role", type: "enum", elements: ["editor", "viewer"], required: true },
      { key: "maxUses", type: "integer", min: 1, max: 100, required: true },
      { key: "useCount", type: "integer", min: 0, max: 100, required: true },
      { key: "status", type: "enum", elements: ["active", "exhausted", "revoked"], required: true },
      { key: "expiresAt", type: "datetime", required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_status", type: TablesDBIndexType.Key, columns: ["ownerId", "status"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
      { key: "status_only", type: TablesDBIndexType.Key, columns: ["status"] },
    ],
  },
  {
    id: "launch_cohorts",
    name: "Controlled launch cohorts",
    createPermissions: [],
    columns: [
      { key: "createdBy", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 120, required: true },
      { key: "codeHash", type: "varchar", size: 64, required: true },
      { key: "status", type: "enum", elements: ["draft", "open", "closed"], required: true },
      { key: "maxMembers", type: "integer", min: 1, max: 10000, required: true },
      { key: "memberCount", type: "integer", min: 0, max: 10000, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "creator_status", type: TablesDBIndexType.Key, columns: ["createdBy", "status"] },
      { key: "status_created", type: TablesDBIndexType.Key, columns: ["status", "createdAt"] },
    ],
  },
  {
    id: "cohort_memberships",
    name: "Launch cohort memberships",
    createPermissions: [],
    columns: [
      { key: "cohortId", type: "varchar", size: 36, required: true },
      { key: "userId", type: "varchar", size: 36, required: true },
      { key: "status", type: "enum", elements: ["active", "removed"], required: true },
      { key: "joinedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "cohort_user", type: TablesDBIndexType.Unique, columns: ["cohortId", "userId"] },
      { key: "user_status", type: TablesDBIndexType.Key, columns: ["userId", "status"] },
      { key: "status_only", type: TablesDBIndexType.Key, columns: ["status"] },
    ],
  },
  {
    id: "security_events",
    name: "Launch security audit events",
    createPermissions: [],
    columns: [
      { key: "actorId", type: "varchar", size: 36, required: true },
      { key: "eventName", type: "varchar", size: 80, required: true },
      { key: "targetType", type: "varchar", size: 64, required: true },
      { key: "targetId", type: "varchar", size: 36, required: false },
      { key: "metadataJson", type: "text", required: true },
      { key: "severity", type: "enum", elements: ["info", "warning", "critical"], required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "actor_created", type: TablesDBIndexType.Key, columns: ["actorId", "createdAt"] },
      { key: "severity_created", type: TablesDBIndexType.Key, columns: ["severity", "createdAt"] },
      { key: "target_created", type: TablesDBIndexType.Key, columns: ["targetId", "createdAt"] },
    ],
  },
  {
    id: "provider_activations",
    name: "Production provider verification state",
    createPermissions: [],
    columns: [
      { key: "provider", type: "enum", elements: ["email", "google-calendar", "microsoft-calendar", "embeddings", "stripe", "custom-domain"], required: true },
      { key: "status", type: "enum", elements: ["unconfigured", "configured", "verifying", "verified", "error"], required: true },
      { key: "configurationJson", type: "text", required: true },
      { key: "verifiedAt", type: "datetime", required: false },
      { key: "lastCheckedAt", type: "datetime", required: true },
      { key: "lastError", type: "text", required: false },
      { key: "updatedBy", type: "varchar", size: 36, required: true },
    ],
    indexes: [
      { key: "provider_unique", type: TablesDBIndexType.Unique, columns: ["provider"] },
      { key: "status_checked", type: TablesDBIndexType.Key, columns: ["status", "lastCheckedAt"] },
      { key: "updated_by", type: TablesDBIndexType.Key, columns: ["updatedBy"] },
    ],
  },
  {
    id: "subscriptions",
    name: "Billing subscription lifecycle",
    createPermissions: [],
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "provider", type: "enum", elements: ["stripe"], required: true },
      { key: "plan", type: "enum", elements: ["pro", "education"], required: true },
      { key: "status", type: "enum", elements: ["inactive", "trialing", "active", "past-due", "canceled"], required: true },
      { key: "externalCustomerId", type: "varchar", size: 128, required: false },
      { key: "externalSubscriptionId", type: "varchar", size: 128, required: false },
      { key: "priceId", type: "varchar", size: 128, required: false },
      { key: "currentPeriodEnd", type: "datetime", required: false },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
      { key: "subscription_lookup", type: TablesDBIndexType.Key, columns: ["externalSubscriptionId"] },
      { key: "status_updated", type: TablesDBIndexType.Key, columns: ["status", "updatedAt"] },
    ],
  },
  {
    id: "billing_events",
    name: "Verified billing webhook events",
    createPermissions: [],
    columns: [
      { key: "eventId", type: "varchar", size: 128, required: true },
      { key: "eventType", type: "varchar", size: 128, required: true },
      { key: "status", type: "enum", elements: ["received", "processed", "ignored", "failed"], required: true },
      { key: "userId", type: "varchar", size: 36, required: false },
      { key: "metadataJson", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
      { key: "processedAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "event_unique", type: TablesDBIndexType.Unique, columns: ["eventId"] },
      { key: "status_created", type: TablesDBIndexType.Key, columns: ["status", "createdAt"] },
    ],
  },
  {
    id: "launch_approvals",
    name: "Final launch approval evidence",
    createPermissions: [],
    columns: [
      { key: "requestedBy", type: "varchar", size: 36, required: true },
      { key: "status", type: "enum", elements: ["blocked", "approved", "revoked"], required: true },
      { key: "privatePilotReady", type: "boolean", required: true },
      { key: "publicLaunchReady", type: "boolean", required: true },
      { key: "blockersJson", type: "text", required: true },
      { key: "checksJson", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
      { key: "approvedAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "requester_created", type: TablesDBIndexType.Key, columns: ["requestedBy", "createdAt"] },
      { key: "status_created", type: TablesDBIndexType.Key, columns: ["status", "createdAt"] },
      { key: "created_only", type: TablesDBIndexType.Key, columns: ["createdAt"] },
    ],
  },
];

function isNotFound(error) {
  return error && typeof error === "object" && error.code === 404;
}

function isConflict(error) {
  return error && typeof error === "object" && error.code === 409;
}

async function getTable(tableId) {
  try {
    return await tables.getTable({ databaseId, tableId });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitForColumns(tableId, expected) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const table = await tables.getTable({ databaseId, tableId });
    const columns = table.columns ?? [];
    const failed = columns.find((column) => column.status === "failed");
    if (failed) throw new Error(`Column ${failed.key} failed: ${failed.error ?? "unknown error"}`);
    if (columns.length >= expected && columns.every((column) => column.status === "available")) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${tableId} columns`);
}

async function waitForColumn(tableId, key) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const table = await tables.getTable({ databaseId, tableId });
    const column = table.columns?.find((candidate) => candidate.key === key);
    if (column?.status === "failed") {
      throw new Error(`Column ${column.key} failed: ${column.error ?? "unknown error"}`);
    }
    if (column?.status === "available") return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${tableId}.${key}`);
}

async function createColumn(tableId, column) {
  const common = {
    databaseId,
    tableId,
    key: column.key,
    required: column.required,
  };

  switch (column.type) {
    case "varchar":
      return tables.createVarcharColumn({ ...common, size: column.size });
    case "text":
      return tables.createTextColumn(common);
    case "enum":
      return tables.createEnumColumn({ ...common, elements: column.elements });
    case "integer":
      return tables.createIntegerColumn({ ...common, min: column.min, max: column.max });
    case "boolean":
      return tables.createBooleanColumn({ ...common, xdefault: column.default });
    case "datetime":
      return tables.createDatetimeColumn(common);
    default:
      throw new Error(`Unsupported column type: ${column.type}`);
  }
}

async function ensureColumns(definition) {
  const current = await tables.getTable({ databaseId, tableId: definition.id });
  const existing = new Set((current.columns ?? []).map((column) => column.key));

  for (const column of definition.columns) {
    if (existing.has(column.key)) continue;
    try {
      await createColumn(definition.id, column);
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
    await waitForColumn(definition.id, column.key);
  }
}

async function ensureIndexes(definition) {
  const current = await tables.listIndexes({ databaseId, tableId: definition.id });
  const existing = new Set(current.indexes.map((index) => index.key));

  for (const index of definition.indexes) {
    if (existing.has(index.key)) continue;
    try {
      await tables.createIndex({
        databaseId,
        tableId: definition.id,
        key: index.key,
        type: index.type,
        columns: index.columns,
      });
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = await tables.listIndexes({ databaseId, tableId: definition.id });
    const expected = result.indexes.filter((index) => definition.indexes.some((item) => item.key === index.key));
    const failed = expected.find((index) => index.status === "failed");
    if (failed) throw new Error(`Index ${failed.key} failed: ${failed.error ?? "unknown error"}`);
    if (expected.length === definition.indexes.length && expected.every((index) => index.status === "available")) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${definition.id} indexes`);
}

for (const definition of definitions) {
  let table = await getTable(definition.id);
  if (!table) {
    try {
      table = await tables.createTable({
        databaseId,
        tableId: definition.id,
        name: definition.name,
        permissions: definition.createPermissions ?? authenticatedCreate,
        rowSecurity: true,
        enabled: true,
      });
      console.log(`Created table: ${definition.id}`);
    } catch (error) {
      if (!isConflict(error)) throw error;
      const deadline = Date.now() + 30_000;
      while (!table && Date.now() < deadline) {
        table = await getTable(definition.id);
        if (!table) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (!table) throw error;
      console.log(`Verified table after concurrent creation: ${definition.id}`);
    }
  } else {
    await tables.updateTable({
      databaseId,
      tableId: definition.id,
      name: definition.name,
      permissions: definition.createPermissions ?? authenticatedCreate,
      rowSecurity: true,
      enabled: true,
    });
    console.log(`Verified table: ${definition.id}`);
  }

  await ensureColumns(definition);
  await waitForColumns(definition.id, definition.columns.length);
  await ensureIndexes(definition);
}

await storage.updateBucket({
  bucketId,
  name: "course-materials",
  permissions: authenticatedCreate,
  fileSecurity: true,
  enabled: true,
  maximumFileSize: 52_428_800,
  allowedFileExtensions: ["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"],
  compression: Compression.None,
  encryption: true,
  antivirus: true,
  transformations: false,
});

const submissionsBucketId = process.env.APPWRITE_SUBMISSIONS_BUCKET_ID || "submissions";
const submissionBucketConfig = {
  bucketId: submissionsBucketId,
  name: "assignment-submissions",
  permissions: authenticatedCreate,
  fileSecurity: true,
  enabled: true,
  maximumFileSize: 52_428_800,
  allowedFileExtensions: ["pdf", "doc", "docx", "txt", "md"],
  compression: Compression.None,
  encryption: true,
  antivirus: true,
  transformations: false,
};
try {
  await storage.getBucket({ bucketId: submissionsBucketId });
  await storage.updateBucket(submissionBucketConfig);
  console.log("Verified bucket: assignment-submissions");
} catch (error) {
  if (!isNotFound(error)) throw error;
  await storage.createBucket(submissionBucketConfig);
  console.log("Created bucket: assignment-submissions");
}

console.log("Secured bucket: course-materials");

const webHosts = [...new Set((process.env.APPWRITE_WEB_HOSTNAMES || "localhost,cognora-ai.khanjabir909.chatgpt.site").split(",").map((host) => host.trim()).filter(Boolean))];
const platforms = await project.listPlatforms({ total: false });
for (const [index, hostname] of webHosts.entries()) {
  if (platforms.platforms.some((platform) => platform.type === "web" && platform.hostname === hostname)) continue;
  await project.createWebPlatform({ platformId: `cognora-web-${index + 1}`, name: hostname === "localhost" ? "Cognora local" : "Cognora production", hostname });
  console.log(`Registered web platform: ${hostname}`);
}

console.log("Appwrite Phase 9 resources are ready.");
