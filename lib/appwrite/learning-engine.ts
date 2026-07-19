"use client";

import { ExecutionMethod, Query } from "appwrite";
import { getAppwriteBrowserServices } from "./client";

type LearningAction =
  | { action: "process_material"; materialId: string }
  | { action: "generate_plan"; courseId: string }
  | { action: "submit_attempt"; itemId: string; response: string; confidence: number }
  | { action: "review_assignment"; assignmentId: string }
  | { action: "detect_gaps"; courseId: string }
  | { action: "generate_roadmap"; courseId: string; goal: string }
  | { action: "ask_coach"; courseId?: string; message: string };

export async function executeLearningAction<T>(action: LearningAction): Promise<T> {
  const { functions, tables, config } = getAppwriteBrowserServices();
  const runAsync = action.action !== "submit_attempt";
  const startedAt = Date.now();
  const execution = await functions.createExecution({
    functionId: config.learningFunctionId,
    body: JSON.stringify(action),
    async: runAsync,
    xpath: "/",
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" },
  });

  if (runAsync) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      if (action.action === "process_material") {
        const material = await tables.getRow({ databaseId: config.databaseId, tableId: "materials", rowId: action.materialId });
        if (material.processingStatus === "failed") throw new Error("Cognora could not analyze this material.");
        if (material.processingStatus === "ready") return { ok: true } as T;
      } else {
        const tableId = action.action === "generate_plan" ? "study_tasks" : action.action === "review_assignment" ? "feedback_reports" : action.action === "detect_gaps" ? "gap_insights" : action.action === "generate_roadmap" ? "roadmaps" : "coach_messages";
        const key = action.action === "review_assignment" ? "assignmentId" : "courseId";
        const value = action.action === "review_assignment" ? action.assignmentId : action.courseId;
        const rows = await tables.listRows({ databaseId: config.databaseId, tableId, queries: [Query.equal(key, [value]), Query.limit(100)], ttl: 0 });
        const created = rows.rows.find((row) => Date.parse(String(row.createdAt || row.$createdAt)) >= startedAt - 1_000);
        if (created) return { ok: true } as T;
        if (action.action === "review_assignment") {
          const assignment = await tables.getRow({ databaseId: config.databaseId, tableId: "assignments", rowId: action.assignmentId });
          if (assignment.status === "reviewed") return { ok: true } as T;
        }
      }
    }
    throw new Error("Cognora AI is taking longer than expected. Your work is safe; try refreshing in a moment.");
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
