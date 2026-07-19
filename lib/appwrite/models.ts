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
