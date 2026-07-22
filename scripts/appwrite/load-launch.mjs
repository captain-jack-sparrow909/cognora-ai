import { randomBytes } from "node:crypto";
import { Client, ID, Users } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const functionId = process.env.NEXT_PUBLIC_APPWRITE_LEARNING_FUNCTION_ID || "learning-engine";
if (!endpoint || !projectId || !apiKey) throw new Error("Appwrite environment is incomplete.");

const adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const users = new Users(adminClient);
const userId = ID.unique();
const concurrency = Math.min(25, Math.max(1, Number(process.env.LAUNCH_LOAD_CONCURRENCY || 12)));

try {
  await users.create({ userId, email: `phase8-load-${Date.now()}@example.test`, password: `Cg!${randomBytes(18).toString("base64url")}`, name: "Phase 8 load check" });
  const session = await users.createSession({ userId });
  const { Client: WebClient, ExecutionMethod, Functions } = await import("appwrite");
  const webClient = new WebClient().setEndpoint(endpoint).setProject(projectId).setSession(session.secret);
  const functions = new Functions(webClient);
  const startedAt = Date.now();
  const executions = await Promise.all(Array.from({ length: concurrency }, () => functions.createExecution({
    functionId,
    body: JSON.stringify({ action: "get_launch_snapshot" }),
    async: false,
    method: ExecutionMethod.POST,
  })));
  const failures = executions.filter((execution) => execution.responseStatusCode !== 200 || JSON.parse(execution.responseBody || "{}").ok !== true);
  if (failures.length) throw new Error(`${failures.length} of ${concurrency} launch snapshot requests failed.`);
  const elapsedMs = Date.now() - startedAt;
  console.log(JSON.stringify({ function: functionId, concurrency, succeeded: executions.length, failed: 0, elapsedMs, averageMs: Math.round(elapsedMs / concurrency) }, null, 2));
} finally {
  await users.delete({ userId }).catch(() => undefined);
}
