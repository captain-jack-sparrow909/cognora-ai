import { randomBytes } from "node:crypto";
import {
  Client,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
  Users,
} from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const users = new Users(client);
const adminTables = new TablesDB(client);
const adminStorage = new Storage(client);
const databaseId = process.env.APPWRITE_DATABASE_ID;
const bucketId = process.env.APPWRITE_MATERIALS_BUCKET_ID;
const functionId = process.env.NEXT_PUBLIC_APPWRITE_LEARNING_FUNCTION_ID || "learning-engine";
const created = { userId: ID.unique(), courseId: "", materialId: "", fileId: "" };

async function deleteMatching(tableId, queries) {
  const result = await adminTables.listRows({ databaseId, tableId, queries: [...queries, Query.limit(100)] });
  for (const row of result.rows) await adminTables.deleteRow({ databaseId, tableId, rowId: row.$id });
}

function executionPayload(execution) {
  const payload = JSON.parse(execution.responseBody || "{}");
  if (execution.responseStatusCode >= 400 || payload.ok === false) throw new Error(payload.error || execution.errors || "Function execution failed.");
  return payload;
}

try {
  const password = `Cg!${randomBytes(18).toString("base64url")}`;
  await users.create({
    userId: created.userId,
    email: `phase3-smoke-${Date.now()}@example.test`,
    password,
    name: "Phase 3 smoke test",
  });
  const session = await users.createSession({ userId: created.userId });
  const jwt = await users.createJWT({ userId: created.userId, sessionId: session.$id, duration: 900 });
  const userClient = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setJWT(jwt.jwt);
  const tables = new TablesDB(userClient);
  const storage = new Storage(userClient);
  const { Client: WebClient, ExecutionMethod, Functions: WebFunctions } = await import("appwrite");
  const webClient = new WebClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setSession(session.secret);
  const functions = new WebFunctions(webClient);
  const permissions = [
    Permission.read(Role.user(created.userId)),
    Permission.update(Role.user(created.userId)),
    Permission.delete(Role.user(created.userId)),
  ];
  const now = new Date().toISOString();

  const course = await tables.createRow({
    databaseId,
    tableId: "courses",
    rowId: ID.unique(),
    data: {
      ownerId: created.userId,
      title: "Cell Biology Validation",
      code: "BIO-SMOKE",
      color: "teal",
      term: "Validation",
      description: "Temporary Phase 3 learning-loop validation.",
      targetGrade: "A",
      status: "active",
      createdAt: now,
    },
    permissions,
  });
  created.courseId = course.$id;
  await tables.createRow({
    databaseId,
    tableId: "profiles",
    rowId: ID.unique(),
    data: {
      ownerId: created.userId,
      displayName: "Phase 3 smoke test",
      studyLevel: "undergraduate",
      timezone: "Asia/Dubai",
      weeklyHours: 5,
      learningGoal: "Understand cell respiration and prepare for a quiz.",
      onboardingComplete: true,
      createdAt: now,
    },
    permissions,
  });
  created.fileId = ID.unique();
  await storage.createFile({
    bucketId,
    fileId: created.fileId,
    file: InputFile.fromPlainText(
      "Lecture: Cellular respiration. Glycolysis occurs in the cytosol and converts glucose into two pyruvate molecules, producing a net two ATP and two NADH. Pyruvate oxidation occurs in the mitochondrial matrix. The citric acid cycle produces NADH and FADH2. The electron transport chain uses those carriers to create a proton gradient across the inner mitochondrial membrane. ATP synthase uses chemiosmosis to produce ATP. Oxygen is the final electron acceptor. Quiz review should focus on the location, inputs, outputs, and purpose of each stage.",
      "lecture-cellular-respiration.txt",
    ),
    permissions,
  });
  const material = await tables.createRow({
    databaseId,
    tableId: "materials",
    rowId: ID.unique(),
    data: {
      ownerId: created.userId,
      courseId: created.courseId,
      fileId: created.fileId,
      name: "lecture-cellular-respiration.txt",
      mimeType: "text/plain",
      size: 525,
      kind: "lecture",
      processingStatus: "uploaded",
      createdAt: now,
    },
    permissions,
  });
  created.materialId = material.$id;

  executionPayload(await functions.createExecution({
    functionId,
    body: JSON.stringify({ action: "process_material", materialId: created.materialId }),
    async: false,
    method: ExecutionMethod.POST,
  }));
  executionPayload(await functions.createExecution({
    functionId,
    body: JSON.stringify({ action: "generate_plan", courseId: created.courseId }),
    async: false,
    method: ExecutionMethod.POST,
  }));

  const [insights, concepts, tasks, practice] = await Promise.all([
    tables.listRows({ databaseId, tableId: "material_insights", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "study_tasks", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "practice_items", queries: [Query.equal("courseId", [created.courseId])] }),
  ]);
  const quiz = practice.rows.find((item) => item.itemType === "multiple-choice");
  if (!insights.rows.length || !concepts.rows.length || !tasks.rows.length || !quiz) throw new Error("The function completed without producing the full learning loop.");
  const attempt = executionPayload(await functions.createExecution({
    functionId,
    body: JSON.stringify({ action: "submit_attempt", itemId: quiz.$id, response: quiz.answer, confidence: 4 }),
    async: false,
    method: ExecutionMethod.POST,
  }));
  console.log(JSON.stringify({
    function: functionId,
    materialStatus: "ready",
    insights: insights.rows.length,
    concepts: concepts.rows.length,
    tasks: tasks.rows.length,
    practiceItems: practice.rows.length,
    scoredAttempt: attempt.correct,
    masteryAfter: attempt.masteryAfter,
  }, null, 2));
} finally {
  if (created.courseId) {
    for (const tableId of ["practice_attempts", "mastery_records", "practice_items", "study_tasks", "concepts", "material_insights", "materials", "profiles"]) {
      const field = tableId === "profiles" ? "ownerId" : tableId === "materials" ? "courseId" : tableId === "practice_attempts" || tableId === "mastery_records" || tableId === "practice_items" || tableId === "study_tasks" || tableId === "concepts" || tableId === "material_insights" ? "courseId" : "ownerId";
      const value = field === "ownerId" ? created.userId : created.courseId;
      await deleteMatching(tableId, [Query.equal(field, [value])]).catch(() => undefined);
    }
    await adminTables.deleteRow({ databaseId, tableId: "courses", rowId: created.courseId }).catch(() => undefined);
  }
  if (created.fileId) await adminStorage.deleteFile({ bucketId, fileId: created.fileId }).catch(() => undefined);
  await users.delete({ userId: created.userId }).catch(() => undefined);
}
