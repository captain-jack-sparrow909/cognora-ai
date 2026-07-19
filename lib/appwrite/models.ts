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
