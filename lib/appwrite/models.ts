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
