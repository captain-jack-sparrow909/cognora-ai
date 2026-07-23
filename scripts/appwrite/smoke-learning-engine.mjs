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
const created = { userId: ID.unique(), memberUserId: ID.unique(), courseId: "", materialId: "", fileId: "", submissionFileId: "", cohortId: "" };

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
    email: `phase8-smoke-${Date.now()}@example.test`,
    password,
    name: "Phase 8 smoke test",
  });
  const memberPassword = `Cg!${randomBytes(18).toString("base64url")}`;
  await users.create({ userId: created.memberUserId, email: `phase8-member-${Date.now()}@example.test`, password: memberPassword, name: "Phase 8 collaboration member" });
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
  const memberSession = await users.createSession({ userId: created.memberUserId });
  const memberJwt = await users.createJWT({ userId: created.memberUserId, sessionId: memberSession.$id, duration: 900 });
  const memberClient = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setJWT(memberJwt.jwt);
  const memberTables = new TablesDB(memberClient);
  const memberWebClient = new WebClient().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setSession(memberSession.secret);
  const memberFunctions = new WebFunctions(memberWebClient);
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
      description: "Temporary Phase 8 launch-gate validation.",
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
      displayName: "Phase 8 smoke test",
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
    data: { ownerId: created.userId, cohort: "phase7-validation", analyticsEnabled: true, joinedAt: now, updatedAt: now },
    permissions,
  });
  await Promise.all([
    tables.createRow({ databaseId, tableId: "analytics_events", rowId: ID.unique(), data: { ownerId: created.userId, eventName: "view_opened", view: "settings", sessionId: ID.unique(), metadataJson: "{}", createdAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "product_feedback", rowId: ID.unique(), data: { ownerId: created.userId, category: "delight", rating: 5, message: "Phase 6 validation feedback.", status: "new", createdAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "entitlements", rowId: created.userId, data: { ownerId: created.userId, plan: "founding-beta", status: "active", aiDailyLimit: 40, storageLimitMb: 1024, collaborationSeats: 3, updatedAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "launch_preferences", rowId: created.userId, data: { ownerId: created.userId, releaseChannel: "private-beta", autoUpdates: true, providerAlerts: true, updatedAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "calendar_connections", rowId: `${created.userId}-google`, data: { ownerId: created.userId, provider: "google", status: "not-configured", syncMode: "export", conflictPolicy: "ask", updatedAt: now }, permissions }),
    tables.createRow({ databaseId, tableId: "course_members", rowId: ID.unique(), data: { ownerId: created.userId, courseId: created.courseId, memberId: created.userId, role: "owner", status: "active", joinedAt: now }, permissions }),
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
  const launchSnapshot = await runAction(functions, ExecutionMethod, { action: "claim_launch_admin" }, false);
  const invite = await runAction(functions, ExecutionMethod, { action: "create_course_invite", courseId: created.courseId, role: "viewer", maxUses: 1, expiresInDays: 7 }, false);
  const accepted = await runAction(memberFunctions, ExecutionMethod, { action: "accept_course_invite", inviteCode: invite.inviteCode }, false);
  const cohort = await runAction(functions, ExecutionMethod, { action: "create_launch_cohort", name: "Phase 8 validation cohort", maxMembers: 5 }, false);
  created.cohortId = cohort.cohortId;
  const cohortJoin = await runAction(memberFunctions, ExecutionMethod, { action: "join_launch_cohort", cohortCode: cohort.cohortCode }, false);
  const launchReview = await runAction(functions, ExecutionMethod, { action: "run_launch_review" }, false);
  const providerVerification = await runAction(functions, ExecutionMethod, { action: "verify_provider_activations" }, false);
  const activationSnapshot = await runAction(functions, ExecutionMethod, { action: "get_provider_activation_snapshot" }, false);
  const finalApproval = await runAction(functions, ExecutionMethod, { action: "create_final_launch_approval" }, false);
  const [sharedCourse, sharedMaterials] = await Promise.all([
    memberTables.getRow({ databaseId, tableId: "courses", rowId: created.courseId }),
    memberTables.listRows({ databaseId, tableId: "materials", queries: [Query.equal("courseId", [created.courseId]), Query.limit(10)] }),
  ]);
  if (accepted.courseId !== created.courseId || sharedCourse.$id !== created.courseId || !sharedMaterials.rows.length || cohortJoin.cohortId !== cohort.cohortId || !Array.isArray(launchReview.checks)) throw new Error("Phase 8 collaboration, cohort, or launch-review flow failed.");
  if (providerVerification.allVerified || activationSnapshot.providers.length !== 6 || finalApproval.approval.status !== "blocked" || finalApproval.approval.publicLaunchReady) throw new Error("Phase 9 provider and final-approval gates did not remain safely blocked without production credentials.");

  const [reports, gapRows, roadmaps, roadmapSteps, coachMessages, aiJobs, notifications, betaProfiles, analyticsEvents, productFeedback, entitlements, launchPreferences, calendarConnections, courseMembers, courseInvites, cohortMemberships, securityEvents, providerActivations, launchApprovals] = await Promise.all([
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
    tables.listRows({ databaseId, tableId: "entitlements", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "launch_preferences", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "calendar_connections", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "course_members", queries: [Query.equal("ownerId", [created.userId])] }),
    tables.listRows({ databaseId, tableId: "course_invites", queries: [Query.equal("ownerId", [created.userId])] }),
    adminTables.listRows({ databaseId, tableId: "cohort_memberships", queries: [Query.equal("cohortId", [cohort.cohortId])] }),
    adminTables.listRows({ databaseId, tableId: "security_events", queries: [Query.equal("targetId", [created.courseId])] }),
    adminTables.listRows({ databaseId, tableId: "provider_activations", queries: [Query.limit(20)] }),
    adminTables.listRows({ databaseId, tableId: "launch_approvals", queries: [Query.equal("requestedBy", [created.userId])] }),
  ]);
  if (!reports.rows.length || !gapRows.rows.length || !roadmaps.rows.length || !roadmapSteps.rows.length || !coachMessages.rows.length) {
    throw new Error("The Phase 4 function actions completed without persisting the full intelligence loop.");
  }
  if (aiJobs.rows.length !== 6 || aiJobs.rows.some((job) => job.status !== "completed" || job.progress !== 100 || !job.durationMs || !job.model)) throw new Error("Phase 5 AI job observability did not record complete operational metadata.");
  if (!notifications.rows.some((notification) => notification.type === "ai-complete") || !notifications.rows.some((notification) => notification.type === "reminder")) throw new Error("Phase 5 notifications did not include both AI completion and study reminders.");
  if (!betaProfiles.rows[0]?.analyticsEnabled || !analyticsEvents.rows.length || !productFeedback.rows.length) throw new Error("Phase 6 beta consent, analytics, and feedback records were not persisted.");
  if (!entitlements.rows.length || !launchPreferences.rows.length || !calendarConnections.rows.length || !courseMembers.rows.length || !launchSnapshot.isAdmin || !launchSnapshot.integrations?.appwriteWeb) throw new Error("Phase 7 launch controls, entitlements, collaboration, and administration were not persisted.");
  if (!courseInvites.rows.length || !cohortMemberships.rows.length || !securityEvents.rows.length) throw new Error("Phase 8 invitation, cohort, and audit records were not persisted.");
  if (providerActivations.rows.length !== 6 || !launchApprovals.rows.length) throw new Error("Phase 9 provider verification and launch approval evidence were not persisted.");
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
    launchAdmin: launchSnapshot.isAdmin,
    releaseChannel: launchPreferences.rows[0].releaseChannel,
    aiDailyEntitlement: entitlements.rows[0].aiDailyLimit,
    collaborationSeats: entitlements.rows[0].collaborationSeats,
    providerReadyCount: Object.values(launchSnapshot.integrations).filter(Boolean).length,
    sharedCourse: sharedCourse.title,
    acceptedRole: accepted.role,
    cohort: cohortJoin.cohortName,
    launchChecks: launchReview.checks.length,
    securityEvents: securityEvents.rows.length,
    providersVerified: providerVerification.providers.filter((provider) => provider.status === "verified").length,
    publicLaunchReady: finalApproval.approval.publicLaunchReady,
    launchApprovalStatus: finalApproval.approval.status,
  }, null, 2));
} finally {
  if (created.courseId) {
    await adminTables.deleteRow({ databaseId, tableId: "launch_admins", rowId: "primary" }).catch(() => undefined);
    for (const tableId of ["course_invites", "course_members", "calendar_connections", "launch_preferences", "entitlements", "product_feedback", "analytics_events", "beta_profiles", "knowledge_chunks", "notifications", "ai_jobs", "reminder_preferences", "coach_messages", "roadmap_steps", "roadmaps", "gap_insights", "feedback_reports", "submissions", "assignments", "practice_attempts", "mastery_records", "practice_items", "study_tasks", "concepts", "material_insights", "materials", "profiles"]) {
      const ownerScoped = ["course_invites", "course_members", "calendar_connections", "launch_preferences", "entitlements", "product_feedback", "analytics_events", "beta_profiles", "notifications", "ai_jobs", "reminder_preferences", "profiles"].includes(tableId);
      const actualField = ownerScoped ? "ownerId" : "courseId";
      const value = ownerScoped ? created.userId : created.courseId;
      await deleteMatching(tableId, [Query.equal(actualField, [value])]).catch(() => undefined);
    }
    await deleteMatching("security_events", [Query.equal("actorId", [created.userId, created.memberUserId])]).catch(() => undefined);
    await deleteMatching("provider_activations", [Query.equal("updatedBy", [created.userId])]).catch(() => undefined);
    await deleteMatching("launch_approvals", [Query.equal("requestedBy", [created.userId])]).catch(() => undefined);
    if (created.cohortId) {
      await deleteMatching("cohort_memberships", [Query.equal("cohortId", [created.cohortId])]).catch(() => undefined);
      await adminTables.deleteRow({ databaseId, tableId: "launch_cohorts", rowId: created.cohortId }).catch(() => undefined);
    }
    await adminTables.deleteRow({ databaseId, tableId: "courses", rowId: created.courseId }).catch(() => undefined);
  }
  if (created.fileId) await adminStorage.deleteFile({ bucketId, fileId: created.fileId }).catch(() => undefined);
  if (created.submissionFileId) await adminStorage.deleteFile({ bucketId: submissionsBucketId, fileId: created.submissionFileId }).catch(() => undefined);
  await users.delete({ userId: created.userId }).catch(() => undefined);
  await users.delete({ userId: created.memberUserId }).catch(() => undefined);
}
