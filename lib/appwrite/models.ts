import type { Models } from "appwrite";

export type StudyLevel =
  | "high-school"
  | "undergraduate"
  | "postgraduate"
  | "professional"
  | "other";

export type CourseColor = "cobalt" | "teal" | "coral" | "amber" | "violet" | "slate";
export type CourseStatus = "active" | "completed" | "archived";
export type MaterialKind = "syllabus" | "lecture" | "notes" | "assignment" | "transcript" | "other";
export type MaterialStatus = "uploaded" | "queued" | "processing" | "ready" | "failed";

export type StudentProfile = Models.Row & {
  ownerId: string;
  displayName: string;
  studyLevel: StudyLevel;
  timezone: string;
  weeklyHours: number;
  learningGoal?: string;
  onboardingComplete: boolean;
  createdAt: string;
};

export type Course = Models.Row & {
  ownerId: string;
  title: string;
  code?: string;
  color: CourseColor;
  term?: string;
  description?: string;
  targetGrade?: string;
  status: CourseStatus;
  createdAt: string;
};

export type CourseMaterial = Models.Row & {
  ownerId: string;
  courseId: string;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: MaterialKind;
  processingStatus: MaterialStatus;
  createdAt: string;
};

export type MaterialInsight = Models.Row & {
  ownerId: string;
  courseId: string;
  materialId: string;
  title: string;
  materialType: string;
  summary: string;
  outlineJson: string;
  keyPointsJson: string;
  sourceExcerpt?: string;
  model: string;
  createdAt: string;
};

export type CourseConcept = Models.Row & {
  ownerId: string;
  courseId: string;
  materialId: string;
  title: string;
  description: string;
  mastery: number;
  evidenceCount: number;
  lastEvidenceAt?: string;
  createdAt: string;
};

export type StudyTask = Models.Row & {
  ownerId: string;
  courseId: string;
  conceptId?: string;
  materialId?: string;
  title: string;
  description?: string;
  taskType: "review" | "practice" | "lecture" | "reading" | "project";
  durationMinutes: number;
  scheduledFor: string;
  status: "planned" | "completed" | "skipped";
  source: "syllabus" | "lecture" | "adaptive-plan" | "manual";
  reason?: string;
  createdAt: string;
};

export type PracticeItem = Models.Row & {
  ownerId: string;
  courseId: string;
  materialId: string;
  conceptId?: string;
  itemType: "flashcard" | "multiple-choice" | "short-answer";
  prompt: string;
  answer: string;
  optionsJson?: string;
  explanation: string;
  createdAt: string;
};

export type MasteryRecord = Models.Row & {
  ownerId: string;
  courseId: string;
  conceptId: string;
  mastery: number;
  evidenceCount: number;
  correctCount: number;
  lastEvidence: string;
  updatedAt: string;
};

export type Assignment = Models.Row & {
  ownerId: string;
  courseId: string;
  title: string;
  brief: string;
  rubricText: string;
  dueAt?: string;
  status: "draft" | "submitted" | "reviewed";
  createdAt: string;
};

export type AssignmentSubmission = Models.Row & {
  ownerId: string;
  courseId: string;
  assignmentId: string;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  status: "uploaded" | "reviewing" | "reviewed" | "failed";
  submittedAt: string;
};

export type FeedbackReport = Models.Row & {
  ownerId: string;
  courseId: string;
  assignmentId: string;
  submissionId: string;
  summary: string;
  strengthsJson: string;
  improvementsJson: string;
  rubricJson: string;
  nextStepsJson: string;
  linkedConceptsJson: string;
  advisoryScore: number;
  model: string;
  createdAt: string;
};

export type GapInsight = Models.Row & {
  ownerId: string;
  courseId: string;
  conceptId: string;
  title: string;
  severity: "high" | "medium" | "low";
  mastery: number;
  evidenceCount: number;
  evidenceJson: string;
  explanation: string;
  recommendedAction: string;
  status: "open" | "improving" | "resolved";
  createdAt: string;
};

export type LearningRoadmap = Models.Row & {
  ownerId: string;
  courseId: string;
  goal: string;
  title: string;
  summary: string;
  status: "active" | "completed" | "archived";
  model: string;
  createdAt: string;
};

export type RoadmapStep = Models.Row & {
  ownerId: string;
  courseId: string;
  roadmapId: string;
  conceptId?: string;
  sequence: number;
  title: string;
  description: string;
  status: "locked" | "available" | "in-progress" | "completed";
  targetDate: string;
  reason: string;
  createdAt: string;
};

export type CoachMessage = Models.Row & {
  ownerId: string;
  courseId?: string;
  question: string;
  answer: string;
  suggestedActionsJson: string;
  evidenceJson: string;
  model: string;
  createdAt: string;
};

export type AiJob = Models.Row & {
  ownerId: string;
  courseId?: string;
  entityId?: string;
  action: string;
  label: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  model?: string;
  inputChars?: number;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  retryCount?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type LearnerNotification = Models.Row & {
  ownerId: string;
  type: "reminder" | "ai-complete" | "ai-failed" | "insight";
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  scheduledFor?: string;
  createdAt: string;
};

export type ReminderPreferences = Models.Row & {
  ownerId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  dailyTime: string;
  daysJson: string;
  timezone: string;
  taskLeadMinutes: number;
  quietStart?: string;
  quietEnd?: string;
  updatedAt: string;
};

export type KnowledgeChunk = Models.Row & {
  ownerId: string;
  courseId: string;
  materialId: string;
  chunkIndex: number;
  content: string;
  embeddingJson?: string;
  embeddingModel?: string;
  createdAt: string;
};

export type BetaProfile = Models.Row & {
  ownerId: string;
  cohort: string;
  analyticsEnabled: boolean;
  joinedAt: string;
  updatedAt: string;
};

export type AnalyticsEvent = Models.Row & {
  ownerId: string;
  eventName: string;
  view?: string;
  sessionId: string;
  metadataJson: string;
  createdAt: string;
};

export type ProductFeedback = Models.Row & {
  ownerId: string;
  category: "idea" | "confusing" | "bug" | "delight";
  rating: number;
  message: string;
  status: "new" | "reviewed" | "planned" | "resolved";
  createdAt: string;
};

export type Entitlement = Models.Row & {
  ownerId: string;
  plan: "founding-beta" | "pro" | "education";
  status: "active" | "trialing" | "paused";
  aiDailyLimit: number;
  storageLimitMb: number;
  collaborationSeats: number;
  trialEndsAt?: string;
  updatedAt: string;
};

export type LaunchPreferences = Models.Row & {
  ownerId: string;
  releaseChannel: "private-beta" | "early-access" | "general";
  autoUpdates: boolean;
  providerAlerts: boolean;
  updatedAt: string;
};

export type CalendarConnection = Models.Row & {
  ownerId: string;
  provider: "google" | "microsoft";
  status: "not-configured" | "connected" | "paused" | "error";
  syncMode: "export" | "import" | "two-way";
  conflictPolicy: "ask" | "cognora-wins" | "calendar-wins";
  lastSyncAt?: string;
  updatedAt: string;
};

export type CourseMember = Models.Row & {
  ownerId: string;
  courseId: string;
  memberId: string;
  role: "owner" | "editor" | "viewer";
  status: "active" | "invited" | "revoked";
  joinedAt: string;
};

export type CourseInviteResult = {
  ok: boolean;
  inviteCode: string;
  role: "editor" | "viewer";
  maxUses: number;
  expiresAt: string;
  courseTitle: string;
};

export type CourseInviteAcceptance = {
  ok: boolean;
  courseId: string;
  courseTitle: string;
  role: "editor" | "viewer";
};

export type LaunchCohortResult = {
  ok: boolean;
  cohortId: string;
  cohortName: string;
  cohortCode: string;
  maxMembers: number;
};

export type LaunchReview = {
  ok: boolean;
  privatePilotReady: boolean;
  publicLaunchReady: boolean;
  checks: Array<{ key: string; label: string; passed: boolean }>;
  integrations: LaunchSnapshot["integrations"];
  reviewedAt: string;
};

export type LaunchSnapshot = {
  ok: boolean;
  isAdmin: boolean;
  canClaimAdmin: boolean;
  integrations: {
    appwriteWeb: boolean;
    email: boolean;
    googleCalendar: boolean;
    microsoftCalendar: boolean;
    embeddings: boolean;
    billing: boolean;
    customDomain: boolean;
  };
  personal: {
    aiJobsToday: number;
    storageBytes: number;
    courses: number;
    collaborators: number;
  };
  platform?: {
    accounts: number;
    feedback: number;
    aiJobsToday: number;
    failedJobsToday: number;
    activeInvites: number;
    cohortMembers: number;
    securityWarningsToday: number;
  };
};
