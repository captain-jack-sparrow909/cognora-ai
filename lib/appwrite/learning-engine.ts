"use client";

import { ExecutionMethod } from "appwrite";
import { getAppwriteBrowserServices } from "./client";

type LearningAction =
  | { action: "process_material"; materialId: string }
  | { action: "generate_plan"; courseId: string }
  | { action: "submit_attempt"; itemId: string; response: string; confidence: number };

export async function executeLearningAction<T>(action: LearningAction): Promise<T> {
  const { functions, config } = getAppwriteBrowserServices();
  const execution = await functions.createExecution({
    functionId: config.learningFunctionId,
    body: JSON.stringify(action),
    async: false,
    xpath: "/",
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" },
  });

  let payload: { ok?: boolean; error?: string } & Partial<T> = {};
  try {
    payload = JSON.parse(execution.responseBody || "{}") as typeof payload;
  } catch {
    throw new Error("Cognora AI returned an unreadable response.");
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || "Cognora AI could not complete that request.");
  }
  return payload as T;
}
