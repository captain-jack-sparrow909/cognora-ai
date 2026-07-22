"use client";

import { Channel, ExecutionMethod, ID } from "appwrite";
import { getAppwriteBrowserServices } from "./client";
import type { AiJob } from "./models";
import { privateUserPermissions } from "./permissions";

type LearningAction =
  | { action: "process_material"; materialId: string }
  | { action: "generate_plan"; courseId: string }
  | { action: "submit_attempt"; itemId: string; response: string; confidence: number }
  | { action: "review_assignment"; assignmentId: string }
  | { action: "detect_gaps"; courseId: string }
  | { action: "generate_roadmap"; courseId: string; goal: string }
  | { action: "ask_coach"; courseId?: string; message: string }
  | { action: "sync_reminders" }
  | { action: "get_launch_snapshot" }
  | { action: "claim_launch_admin" }
  | { action: "create_course_invite"; courseId: string; role: "editor" | "viewer"; maxUses?: number; expiresInDays?: number }
  | { action: "accept_course_invite"; inviteCode: string }
  | { action: "create_launch_cohort"; name: string; maxMembers: number }
  | { action: "join_launch_cohort"; cohortCode: string }
  | { action: "run_launch_review" };

type InstantAction = "submit_attempt" | "sync_reminders" | "get_launch_snapshot" | "claim_launch_admin" | "create_course_invite" | "accept_course_invite" | "create_launch_cohort" | "join_launch_cohort" | "run_launch_review";

const instantActions: LearningAction["action"][] = ["submit_attempt", "sync_reminders", "get_launch_snapshot", "claim_launch_admin", "create_course_invite", "accept_course_invite", "create_launch_cohort", "join_launch_cohort", "run_launch_review"];

const jobLabels: Record<Exclude<LearningAction["action"], InstantAction>, string> = {
  process_material: "Analyzing course material",
  generate_plan: "Building an adaptive plan",
  review_assignment: "Reviewing an assignment",
  detect_gaps: "Detecting knowledge gaps",
  generate_roadmap: "Building a learning roadmap",
  ask_coach: "Preparing coach guidance",
};

function announceJob(job: AiJob) {
  window.dispatchEvent(new CustomEvent<AiJob>("cognora:ai-job", { detail: job }));
}

function jobContext(action: LearningAction) {
  if (action.action === "process_material") return { entityId: action.materialId };
  if (action.action === "review_assignment") return { entityId: action.assignmentId };
  if ("courseId" in action) return { courseId: action.courseId || undefined };
  return {};
}

export async function executeLearningAction<T>(action: LearningAction): Promise<T> {
  const { account, client, functions, tables, config } = getAppwriteBrowserServices();
  const runAsync = !instantActions.includes(action.action);
  let jobId: string | undefined;
  let unsubscribe: (() => void) | undefined;
  let requestBody: LearningAction & { jobId?: string } = action;

  if (runAsync) {
    const user = await account.get();
    jobId = ID.unique();
    const job = await tables.createRow<AiJob>({
      databaseId: config.databaseId,
      tableId: "ai_jobs",
      rowId: jobId,
      data: {
        ownerId: user.$id,
        ...jobContext(action),
        action: action.action,
        label: jobLabels[action.action as keyof typeof jobLabels],
        status: "queued",
        progress: 2,
        stage: "Queued securely",
        retryCount: 0,
        createdAt: new Date().toISOString(),
      },
      permissions: privateUserPermissions(user.$id),
    });
    announceJob(job);
    unsubscribe = client.subscribe<AiJob>(
      Channel.tablesdb(config.databaseId).table("ai_jobs").row(jobId),
      (event) => announceJob(event.payload),
    );
    requestBody = { ...action, jobId };
  }

  let execution;
  try {
    execution = await functions.createExecution({
    functionId: config.learningFunctionId,
    body: JSON.stringify(requestBody),
    async: runAsync,
    xpath: "/",
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" },
    });
  } catch (caught) {
    if (jobId) await tables.updateRow({ databaseId: config.databaseId, tableId: "ai_jobs", rowId: jobId, data: { status: "failed", progress: 100, stage: "Could not start", error: caught instanceof Error ? caught.message.slice(0, 20_000) : "Could not start AI job.", completedAt: new Date().toISOString() } }).catch(() => undefined);
    unsubscribe?.();
    throw caught;
  }

  if (runAsync && jobId) {
    const deadline = Date.now() + 180_000;
    try {
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        const job = await tables.getRow<AiJob>({ databaseId: config.databaseId, tableId: "ai_jobs", rowId: jobId });
        announceJob(job);
        if (job.status === "completed") return { ok: true, jobId } as T;
        if (job.status === "failed") {
          throw new Error(job.error || "Cognora AI could not complete that request.");
        }
      }
      throw new Error("Cognora AI is taking longer than expected. The job remains visible in Activity.");
    } finally {
      unsubscribe?.();
    }
  }

  let payload: { ok?: boolean; error?: string } & Partial<T> = {};
  try {
    payload = JSON.parse(execution.responseBody || '{"ok":true}') as typeof payload;
  } catch {
    throw new Error("Cognora AI returned an unreadable response.");
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || "Cognora AI could not complete that request.");
  }
  return payload as T;
}
