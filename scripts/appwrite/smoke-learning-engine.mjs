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
const submissionsBucketId = process.env.APPWRITE_SUBMISSIONS_BUCKET_ID;
const functionId = process.env.NEXT_PUBLIC_APPWRITE_LEARNING_FUNCTION_ID || "learning-engine";
const created = { userId: ID.unique(), courseId: "", materialId: "", fileId: "", submissionFileId: "" };

async function deleteMatching(tableId, queries) {
  const result = await adminTables.listRows({ databaseId, tableId, queries: [...queries, Query.limit(100)] });
  for (const row of result.rows) await adminTables.deleteRow({ databaseId, tableId, rowId: row.$id });
}

function executionPayload(execution) {
  const payload = JSON.parse(execution.responseBody || "{}");
  if (execution.responseStatusCode >= 400 || payload.ok === false) throw new Error(payload.error || execution.errors || "Function execution failed.");
  return payload;
}

const actionLabels = {
  process_material: "Analyzing course material",
  generate_plan: "Building an adaptive plan",
  review_assignment: "Reviewing an assignment",
  detect_gaps: "Detecting knowledge gaps",
  generate_roadmap: "Building a learning roadmap",
  ask_coach: "Preparing coach guidance",
};

async function runAction(functions, ExecutionMethod, body, runAsync = true, completion, context) {
  let actionBody = body;
  let jobId;
  if (runAsync) {
    jobId = ID.unique();
    await context.tables.createRow({
      databaseId,
      tableId: "ai_jobs",
      rowId: jobId,
      data: {
        ownerId: context.userId,
        courseId: context.courseId,
        entityId: body.materialId || body.assignmentId,
        action: body.action,
        label: actionLabels[body.action],
        status: "queued",
        progress: 2,
        stage: "Queued securely",
        retryCount: 0,
        createdAt: new Date().toISOString(),
      },
      permissions: context.permissions,
    });
    actionBody = { ...body, jobId };
  }
  const execution = await functions.createExecution({
    functionId,
    body: JSON.stringify(actionBody),
    async: runAsync,
    method: ExecutionMethod.POST,
  });
  if (runAsync) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const job = await context.tables.getRow({ databaseId, tableId: "ai_jobs", rowId: jobId });
      if (job.status === "failed") throw new Error(job.error || `Execution ${execution.$id} failed.`);
      if (job.status === "completed") {
        if (!(await completion())) throw new Error(`Execution ${execution.$id} completed without its expected result.`);
        return { ok: true, job };
      }
    }
    throw new Error(`Execution ${execution.$id} timed out while polling for its persisted result.`);
  }
  if (execution.responseStatusCode >= 400) {
    let message = execution.errors || "Function execution failed.";
    try { message = JSON.parse(execution.responseBody || "{}").error || message; } catch {}
    throw new Error(message);
  }
  if (!execution.responseBody) return { ok: true };
  return executionPayload(execution);
}

try {
  const password = `Cg!${randomBytes(18).toString("base64url")}`;
  await users.create({
    userId: created.userId,
    email: `phase6-smoke-${Date.now()}@example.test`,
    password,
    name: "Phase 6 smoke test",
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
      description: "Temporary Phase 6 beta-loop validation.",
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
      displayName: "Phase 6 smoke test",
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
  const operationContext = { tables, userId: created.userId, permissions, courseId: created.courseId };
  await tables.createRow({
    databaseId,
    tableId: "reminder_preferences",
    rowId: created.userId,
    data: {
      ownerId: created.userId,
      inAppEnabled: true,
      emailEnabled: false,
      dailyTime: "18:00",
      daysJson: '["mon","tue","wed","thu","fri"]',
      timezone: "Asia/Dubai",
      taskLeadMinutes: 30,
      quietStart: "22:00",
      quietEnd: "07:00",
      updatedAt: now,
    },
    permissions,
  });
  await tables.createRow({
    databaseId,
    tableId: "beta_profiles",
    rowId: created.userId,
    data: { ownerId: created.userId, cohort: "phase6-validation", analyticsEnabled: true, joinedAt: now, updatedAt: now },
    permissions,
  });
  await Promise.all([
    tables.createRow({ databaseId, tableId: "analytics_events", rowId: ID.unique(), data: { ownerId: created.userId, eventName: "view_opened", view: "settings", sessionId: ID.unique(), metadataJson: "{}", createdAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "product_feedback", rowId: ID.unique(), data: { ownerId: created.userId, category: "delight", rating: 5, message: "Phase 6 validation feedback.", status: "new", createdAt: now }, permissions }),
  ]);

  await runAction(functions, ExecutionMethod, { action: "process_material", materialId: created.materialId }, true, async () => {
    const row = await tables.getRow({ databaseId, tableId: "materials", rowId: created.materialId });
    if (row.processingStatus === "failed") throw new Error("Material processing failed.");
    return row.processingStatus === "ready";
  }, operationContext);
  await runAction(functions, ExecutionMethod, { action: "generate_plan", courseId: created.courseId }, true, async () => {
    const rows = await tables.listRows({ databaseId, tableId: "study_tasks", queries: [Query.equal("courseId", [created.courseId])] });
    return rows.rows.length > 0;
  }, operationContext);

  const [insights, concepts, tasks, practice, chunks] = await Promise.all([
    tables.listRows({ databaseId, tableId: "material_insights", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "study_tasks", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "practice_items", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "knowledge_chunks", queries: [Query.equal("courseId", [created.courseId])] }),
  ]);
  const quiz = practice.rows.find((item) => item.itemType === "multiple-choice");
  if (!insights.rows.length || !concepts.rows.length || !tasks.rows.length || !quiz || !chunks.rows.length) throw new Error("The function completed without producing the full searchable learning loop.");
  const attempt = await runAction(functions, ExecutionMethod, { action: "submit_attempt", itemId: quiz.$id, response: quiz.answer, confidence: 4 }, false);

  const assignmentId = ID.unique();
  created.submissionFileId = ID.unique();
  const assignmentText = "Cellular respiration transforms energy through linked stages. Glycolysis happens in the cytosol and produces pyruvate, ATP, and NADH. The citric acid cycle loads electron carriers in the mitochondrial matrix. These carriers supply the electron transport chain, which establishes a proton gradient. ATP synthase then uses chemiosmosis to produce ATP. Oxygen serves as the final electron acceptor, allowing electron flow to continue. This organization shows how location and energy transfer connect each stage, although a stronger response should compare the inputs and outputs quantitatively and explain why the gradient is essential.";
  await storage.createFile({
    bucketId: submissionsBucketId,
    fileId: created.submissionFileId,
    file: InputFile.fromPlainText(assignmentText, "cell-respiration-response.txt"),
    permissions,
  });
  await tables.createRow({
    databaseId,
    tableId: "assignments",
    rowId: assignmentId,
    data: {
      ownerId: created.userId,
      courseId: created.courseId,
      title: "Explain cellular respiration",
      brief: "Explain how the stages of cellular respiration work together to produce ATP.",
      rubricText: "Accuracy 40%; connection between stages 30%; use of evidence and terminology 20%; clarity 10%.",
      status: "submitted",
      createdAt: now,
    },
    permissions,
  });
  await tables.createRow({
    databaseId,
    tableId: "submissions",
    rowId: ID.unique(),
    data: {
      ownerId: created.userId,
      courseId: created.courseId,
      assignmentId,
      fileId: created.submissionFileId,
      name: "cell-respiration-response.txt",
      mimeType: "text/plain",
      size: Buffer.byteLength(assignmentText),
      status: "uploaded",
      submittedAt: now,
    },
    permissions,
  });

  await runAction(functions, ExecutionMethod, { action: "review_assignment", assignmentId }, true, async () => {
    const rows = await tables.listRows({ databaseId, tableId: "feedback_reports", queries: [Query.equal("assignmentId", [assignmentId])] });
    return rows.rows.length > 0;
  }, operationContext);

  await runAction(functions, ExecutionMethod, { action: "sync_reminders" }, false);
  await runAction(functions, ExecutionMethod, { action: "detect_gaps", courseId: created.courseId }, true, async () => {
    const rows = await tables.listRows({ databaseId, tableId: "gap_insights", queries: [Query.equal("courseId", [created.courseId])] });
    return rows.rows.length > 0;
  }, operationContext);
  await runAction(functions, ExecutionMethod, { action: "generate_roadmap", courseId: created.courseId, goal: "Explain cellular respiration confidently in the final exam." }, true, async () => {
    const rows = await tables.listRows({ databaseId, tableId: "roadmaps", queries: [Query.equal("courseId", [created.courseId])] });
    return rows.rows.length > 0;
  }, operationContext);
  await runAction(functions, ExecutionMethod, { action: "ask_coach", courseId: created.courseId, message: "What should I study next, and which evidence supports that advice?" }, true, async () => {
    const rows = await tables.listRows({ databaseId, tableId: "coach_messages", queries: [Query.equal("courseId", [created.courseId])] });
    return rows.rows.length > 0;
  }, operationContext);

  const [reports, gapRows, roadmaps, roadmapSteps, coachMessages, aiJobs, notifications, betaProfiles, analyticsEvents, productFeedback] = await Promise.all([
    tables.listRows({ databaseId, tableId: "feedback_reports", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "gap_insights", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "roadmaps", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "roadmap_steps", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "coach_messages", queries: [Query.equal("courseId", [created.courseId])] }),
    tables.listRows({ databaseId, tableId: "ai_jobs", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "notifications", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "beta_profiles", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "analytics_events", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "product_feedback", queries: [Query.equal("ownerId", [created.userId])] }),
  ]);
  if (!reports.rows.length || !gapRows.rows.length || !roadmaps.rows.length || !roadmapSteps.rows.length || !coachMessages.rows.length) {
    throw new Error("The Phase 4 function actions completed without persisting the full intelligence loop.");
  }
  if (aiJobs.rows.length !== 6 || aiJobs.rows.some((job) => job.status !== "completed" || job.progress !== 100 || !job.durationMs || !job.model)) throw new Error("Phase 5 AI job observability did not record complete operational metadata.");
  if (!notifications.rows.some((notification) => notification.type === "ai-complete") || !notifications.rows.some((notification) => notification.type === "reminder")) throw new Error("Phase 5 notifications did not include both AI completion and study reminders.");
  if (!betaProfiles.rows[0]?.analyticsEnabled || !analyticsEvents.rows.length || !productFeedback.rows.length) throw new Error("Phase 6 beta consent, analytics, and feedback records were not persisted.");
  console.log(JSON.stringify({
    function: functionId,
    materialStatus: "ready",
    insights: insights.rows.length,
    concepts: concepts.rows.length,
    tasks: tasks.rows.length,
    practiceItems: practice.rows.length,
    knowledgeChunks: chunks.rows.length,
    scoredAttempt: attempt.correct,
    masteryAfter: attempt.masteryAfter,
    feedbackScore: reports.rows[0].advisoryScore,
    gapInsights: gapRows.rows.length,
    roadmapSteps: roadmapSteps.rows.length,
    coachResponseStored: Boolean(coachMessages.rows[0]?.answer),
    completedAiJobs: aiJobs.rows.length,
    recordedPromptTokens: aiJobs.rows.reduce((total, job) => total + (job.promptTokens || 0), 0),
    notifications: notifications.rows.length,
    reminderSynced: notifications.rows.some((notification) => notification.type === "reminder"),
    betaCohort: betaProfiles.rows[0].cohort,
    analyticsEvents: analyticsEvents.rows.length,
    productFeedback: productFeedback.rows.length,
  }, null, 2));
} finally {
  if (created.courseId) {
    for (const tableId of ["product_feedback", "analytics_events", "beta_profiles", "knowledge_chunks", "notifications", "ai_jobs", "reminder_preferences", "coach_messages", "roadmap_steps", "roadmaps", "gap_insights", "feedback_reports", "submissions", "assignments", "practice_attempts", "mastery_records", "practice_items", "study_tasks", "concepts", "material_insights", "materials", "profiles"]) {
      const ownerScoped = ["product_feedback", "analytics_events", "beta_profiles", "notifications", "ai_jobs", "reminder_preferences", "profiles"].includes(tableId);
      const actualField = ownerScoped ? "ownerId" : "courseId";
      const value = ownerScoped ? created.userId : created.courseId;
      await deleteMatching(tableId, [Query.equal(actualField, [value])]).catch(() => undefined);
    }
    await adminTables.deleteRow({ databaseId, tableId: "courses", rowId: created.courseId }).catch(() => undefined);
  }
  if (created.fileId) await adminStorage.deleteFile({ bucketId, fileId: created.fileId }).catch(() => undefined);
  if (created.submissionFileId) await adminStorage.deleteFile({ bucketId: submissionsBucketId, fileId: created.submissionFileId }).catch(() => undefined);
  await users.delete({ userId: created.userId }).catch(() => undefined);
}
