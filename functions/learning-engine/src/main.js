import { Client, ID, Permission, Query, Role, Storage, TablesDB } from "node-appwrite";
import { OfficeParser } from "officeparser";

const MAX_SOURCE_CHARS = 60_000;
const functionId = "learning-engine";

function chunkSource(source, size = 2600, overlap = 300) {
  const chunks = [];
  let start = 0;
  while (start < source.length && chunks.length < 40) {
    let end = Math.min(source.length, start + size);
    if (end < source.length) {
      const boundary = Math.max(source.lastIndexOf("\n", end), source.lastIndexOf(". ", end));
      if (boundary > start + Math.floor(size * 0.6)) end = boundary + 1;
    }
    const content = source.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= source.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function readJson(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("The request body must be valid JSON.");
  }
}

function text(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function stringList(value, limit = 12) {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean).slice(0, limit)
    : [];
}

function valueList(value, limit = 12) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function jsonText(value, limit = 12) {
  return JSON.stringify(valueList(value, limit)).slice(0, 60_000);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || minimum));
}

function safeDate(value, fallbackDays = 1) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + fallbackDays);
  fallback.setHours(9, 0, 0, 0);
  return fallback.toISOString();
}

function userPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function requestHeader(headers, name) {
  const exact = headers[name];
  if (exact) return exact;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function createUserServices(req) {
  const userId = requestHeader(req.headers, "x-appwrite-user-id");
  const jwt = requestHeader(req.headers, "x-appwrite-user-jwt");
  if (!userId || !jwt) throw new Error("Sign in to use Cognora AI.");

  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  if (!endpoint || !projectId) throw new Error("Appwrite function configuration is incomplete.");

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  return {
    userId,
    tables: new TablesDB(client),
    storage: new Storage(client),
    databaseId: process.env.APPWRITE_DATABASE_ID,
    bucketId: process.env.APPWRITE_MATERIALS_BUCKET_ID,
    submissionsBucketId: process.env.APPWRITE_SUBMISSIONS_BUCKET_ID || "submissions",
  };
}

async function extractText(buffer, filename, mimeType) {
  const extension = filename.split(".").pop()?.toLowerCase() || "txt";
  if (["txt", "md"].includes(extension) || mimeType.startsWith("text/")) {
    return new TextDecoder("utf-8").decode(buffer);
  }

  const ast = await OfficeParser.parseOffice(new Uint8Array(buffer), {
    fileType: extension === "doc" ? "docx" : extension === "ppt" ? "pptx" : extension,
    extractAttachments: false,
    ocr: false,
  });
  return ast.toText();
}

async function callDeepSeek({ services, system, prompt, model, maxTokens = 5000 }) {
  const endpoint = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  await services?.reportProgress?.(38, "DeepSeek is reasoning");
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: `${system}\nReturn one valid JSON object and no markdown.` },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    if (response.ok || (response.status < 500 && response.status !== 429)) break;
    services.retryCount = attempt + 1;
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }

  if (!response?.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty response.");
  services.usage = {
    inputChars: prompt.length,
    promptTokens: Number(payload.usage?.prompt_tokens || 0),
    completionTokens: Number(payload.usage?.completion_tokens || 0),
    model: payload.model || model,
  };
  await services?.reportProgress?.(74, "Saving grounded results");
  return { data: JSON.parse(content), model: payload.model || model };
}

async function createNotification(services, data) {
  return services.tables.createRow({
    databaseId: services.databaseId,
    tableId: "notifications",
    rowId: ID.unique(),
    data: {
      ownerId: services.userId,
      read: false,
      createdAt: new Date().toISOString(),
      ...data,
    },
    permissions: userPermissions(services.userId),
  });
}

async function syncReminders(services) {
  const { tables, databaseId, userId } = services;
  const preferences = await tables.listRows({ databaseId, tableId: "reminder_preferences", queries: [Query.equal("ownerId", [userId]), Query.limit(1)] });
  const preference = preferences.rows[0];
  if (!preference?.inAppEnabled) return { ok: true, created: 0 };
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);
  const [tasks, existing] = await Promise.all([
    tables.listRows({ databaseId, tableId: "study_tasks", queries: [Query.equal("ownerId", [userId]), Query.equal("status", ["planned"]), Query.greaterThanEqual("scheduledFor", [now.toISOString()]), Query.lessThanEqual("scheduledFor", [horizon.toISOString()]), Query.limit(100)] }),
    tables.listRows({ databaseId, tableId: "notifications", queries: [Query.equal("ownerId", [userId]), Query.equal("type", ["reminder"]), Query.limit(100)] }),
  ]);
  const existingIds = new Set(existing.rows.map((notification) => notification.entityId));
  let created = 0;
  for (const task of tasks.rows) {
    if (existingIds.has(task.$id)) continue;
    const scheduledFor = new Date(task.scheduledFor);
    scheduledFor.setMinutes(scheduledFor.getMinutes() - (preference.taskLeadMinutes || 30));
    await createNotification(services, {
      type: "reminder",
      title: `Upcoming: ${task.title}`.slice(0, 180),
      body: `${task.durationMinutes} minutes · ${task.reason || "Part of your adaptive study plan."}`.slice(0, 20_000),
      entityType: "study_task",
      entityId: task.$id,
      scheduledFor: scheduledFor > now ? scheduledFor.toISOString() : now.toISOString(),
    });
    created += 1;
  }
  return { ok: true, created };
}

async function deleteRows(tables, databaseId, tableId, queries) {
  const existing = await tables.listRows({ databaseId, tableId, queries: [...queries, Query.limit(100)] });
  await Promise.all(existing.rows.map((row) => tables.deleteRow({ databaseId, tableId, rowId: row.$id })));
}

async function processMaterial(services, body) {
  const materialId = text(body.materialId);
  if (!materialId) throw new Error("Choose a material to analyze.");
  const { tables, storage, databaseId, bucketId, userId } = services;
  const material = await tables.getRow({ databaseId, tableId: "materials", rowId: materialId });
  if (material.ownerId !== userId) throw new Error("This material does not belong to your account.");

  await tables.updateRow({
    databaseId,
    tableId: "materials",
    rowId: materialId,
    data: { processingStatus: "processing" },
  });

  try {
    const fileBuffer = await storage.getFileDownload({ bucketId, fileId: material.fileId });
    const extracted = (await extractText(fileBuffer, material.name, material.mimeType)).replace(/\u0000/g, "").trim();
    if (extracted.length < 40) throw new Error("The document did not contain enough extractable text.");
    const source = extracted.slice(0, MAX_SOURCE_CHARS);
    const model = process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash";
    const { data, model: usedModel } = await callDeepSeek({
      services,
      model,
      system: "You are Cognora's course-material analyst. Extract only what is supported by the supplied source. Build concise, student-ready outputs. Never invent deadlines, facts, or learning outcomes.",
      prompt: `Today is ${new Date().toISOString().slice(0, 10)}. Analyze this ${material.kind} named ${JSON.stringify(material.name)}.\n\nReturn this JSON shape:\n{\n  "title": "descriptive title",\n  "materialType": "syllabus|lecture|notes|assignment|transcript|other",\n  "summary": "3-6 paragraph grounded summary",\n  "outline": ["ordered section or lecture point"],\n  "keyPoints": ["high-value fact or idea"],\n  "concepts": [{"title":"concept", "description":"grounded explanation"}],\n  "flashcards": [{"front":"question or cue", "back":"answer", "concept":"matching concept title", "explanation":"why it matters"}],\n  "quiz": [{"question":"single-answer question", "options":["A","B","C","D"], "answer":"exact option text", "concept":"matching concept title", "explanation":"grounded explanation"}],\n  "studyTasks": [{"title":"task", "description":"what to do", "taskType":"review|practice|lecture|reading|project", "durationMinutes":30, "scheduledFor":"ISO date if explicitly supported or a sensible near-term date", "reason":"why this task follows from the material"}]\n}\n\nKeep at most 10 concepts, 10 flashcards, 8 quiz questions, and 8 tasks. Source:\n${source}`,
    });

    const now = new Date().toISOString();
    const permissions = userPermissions(userId);
    const chunks = chunkSource(source);
    await Promise.all([
      deleteRows(tables, databaseId, "material_insights", [Query.equal("materialId", [materialId])]),
      deleteRows(tables, databaseId, "practice_items", [Query.equal("materialId", [materialId])]),
      deleteRows(tables, databaseId, "study_tasks", [Query.equal("materialId", [materialId]), Query.notEqual("source", ["adaptive-plan"])]),
      deleteRows(tables, databaseId, "knowledge_chunks", [Query.equal("materialId", [materialId])]),
    ]);
    const oldConcepts = await tables.listRows({
      databaseId,
      tableId: "concepts",
      queries: [Query.equal("materialId", [materialId]), Query.limit(100)],
    });
    for (const concept of oldConcepts.rows) {
      const mastery = await tables.listRows({ databaseId, tableId: "mastery_records", queries: [Query.equal("conceptId", [concept.$id]), Query.limit(1)] });
      if (mastery.rows.length === 0) await tables.deleteRow({ databaseId, tableId: "concepts", rowId: concept.$id });
    }

    await tables.createRow({
      databaseId,
      tableId: "material_insights",
      rowId: ID.unique(),
      data: {
        ownerId: userId,
        courseId: material.courseId,
        materialId,
        title: text(data.title, material.name).slice(0, 255),
        materialType: text(data.materialType, material.kind).slice(0, 32),
        summary: text(data.summary, "No summary was generated.").slice(0, 60_000),
        outlineJson: JSON.stringify(stringList(data.outline, 16)),
        keyPointsJson: JSON.stringify(stringList(data.keyPoints, 16)),
        sourceExcerpt: source.slice(0, 18_000),
        model: usedModel.slice(0, 64),
        createdAt: now,
      },
      permissions,
    });

    for (const [chunkIndex, content] of chunks.entries()) {
      await tables.createRow({
        databaseId,
        tableId: "knowledge_chunks",
        rowId: ID.unique(),
        data: { ownerId: userId, courseId: material.courseId, materialId, chunkIndex, content, createdAt: now },
        permissions,
      });
    }

    const conceptByTitle = new Map();
    for (const candidate of Array.isArray(data.concepts) ? data.concepts.slice(0, 10) : []) {
      const title = text(candidate?.title).slice(0, 160);
      if (!title || conceptByTitle.has(title.toLowerCase())) continue;
      const concept = await tables.createRow({
        databaseId,
        tableId: "concepts",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          courseId: material.courseId,
          materialId,
          title,
          description: text(candidate?.description, `A key concept from ${material.name}.`).slice(0, 12_000),
          mastery: 0,
          evidenceCount: 0,
          createdAt: now,
        },
        permissions,
      });
      conceptByTitle.set(title.toLowerCase(), concept.$id);
    }

    const firstConceptId = conceptByTitle.values().next().value;
    const flashcards = Array.isArray(data.flashcards) ? data.flashcards.slice(0, 10) : [];
    const quiz = Array.isArray(data.quiz) ? data.quiz.slice(0, 8) : [];
    for (const card of flashcards) {
      const prompt = text(card?.front);
      const answer = text(card?.back);
      if (!prompt || !answer) continue;
      await tables.createRow({
        databaseId,
        tableId: "practice_items",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          courseId: material.courseId,
          materialId,
          conceptId: conceptByTitle.get(text(card?.concept).toLowerCase()) || firstConceptId,
          itemType: "flashcard",
          prompt: prompt.slice(0, 20_000),
          answer: answer.slice(0, 20_000),
          explanation: text(card?.explanation, answer).slice(0, 20_000),
          createdAt: now,
        },
        permissions,
      });
    }
    for (const item of quiz) {
      const prompt = text(item?.question);
      const options = stringList(item?.options, 5);
      const answer = text(item?.answer);
      if (!prompt || !answer || options.length < 2 || !options.includes(answer)) continue;
      await tables.createRow({
        databaseId,
        tableId: "practice_items",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          courseId: material.courseId,
          materialId,
          conceptId: conceptByTitle.get(text(item?.concept).toLowerCase()) || firstConceptId,
          itemType: "multiple-choice",
          prompt: prompt.slice(0, 20_000),
          answer: answer.slice(0, 20_000),
          optionsJson: JSON.stringify(options),
          explanation: text(item?.explanation, answer).slice(0, 20_000),
          createdAt: now,
        },
        permissions,
      });
    }

    const taskSource = material.kind === "syllabus" ? "syllabus" : "lecture";
    for (const [index, task] of (Array.isArray(data.studyTasks) ? data.studyTasks.slice(0, 8) : []).entries()) {
      const title = text(task?.title);
      if (!title) continue;
      const taskType = ["review", "practice", "lecture", "reading", "project"].includes(task?.taskType) ? task.taskType : "review";
      await tables.createRow({
        databaseId,
        tableId: "study_tasks",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          courseId: material.courseId,
          materialId,
          title: title.slice(0, 200),
          description: text(task?.description).slice(0, 20_000),
          taskType,
          durationMinutes: clamp(task?.durationMinutes, 10, 180),
          scheduledFor: safeDate(task?.scheduledFor, index + 1),
          status: "planned",
          source: taskSource,
          reason: text(task?.reason, `Created from ${material.name}.`).slice(0, 20_000),
          createdAt: now,
        },
        permissions,
      });
    }

    await tables.updateRow({ databaseId, tableId: "materials", rowId: materialId, data: { processingStatus: "ready" } });
    return { ok: true, materialId, chunks: chunks.length, concepts: conceptByTitle.size, practiceItems: flashcards.length + quiz.length };
  } catch (caught) {
    await tables.updateRow({ databaseId, tableId: "materials", rowId: materialId, data: { processingStatus: "failed" } }).catch(() => undefined);
    throw caught;
  }
}

async function generatePlan(services, body) {
  const courseId = text(body.courseId);
  if (!courseId) throw new Error("Choose a course to plan.");
  const { tables, databaseId, userId } = services;
  const course = await tables.getRow({ databaseId, tableId: "courses", rowId: courseId });
  if (course.ownerId !== userId) throw new Error("This course does not belong to your account.");

  const [concepts, profiles] = await Promise.all([
    tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [courseId]), Query.orderAsc("mastery"), Query.limit(20)] }),
    tables.listRows({ databaseId, tableId: "profiles", queries: [Query.equal("ownerId", [userId]), Query.limit(1)] }),
  ]);
  if (concepts.rows.length === 0) throw new Error("Analyze a course material before generating an adaptive plan.");

  const profile = profiles.rows[0];
  const model = process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash";
  const { data } = await callDeepSeek({
    services,
    model,
    system: "You are Cognora's adaptive study planner. Create realistic study sessions from mastery evidence. Prioritize low-mastery concepts, balance cognitive load, and never schedule more time than the student's weekly availability.",
    prompt: `Create a seven-day plan starting ${new Date().toISOString().slice(0, 10)} for ${course.title}. Weekly availability: ${profile?.weeklyHours || 6} hours. Learning goal: ${profile?.learningGoal || "Build reliable course mastery"}. Concepts: ${JSON.stringify(concepts.rows.map((concept) => ({ id: concept.$id, title: concept.title, mastery: concept.mastery || 0, evidenceCount: concept.evidenceCount || 0 })))}. Return {"tasks":[{"conceptId":"exact id", "title":"task", "description":"specific activity", "taskType":"review|practice|lecture|reading|project", "durationMinutes":30, "scheduledFor":"ISO date-time", "reason":"evidence-based reason"}]}. Return 4-8 tasks.`,
    maxTokens: 2800,
  });

  await deleteRows(tables, databaseId, "study_tasks", [Query.equal("courseId", [courseId]), Query.equal("source", ["adaptive-plan"]), Query.equal("status", ["planned"])]);
  const conceptIds = new Set(concepts.rows.map((concept) => concept.$id));
  const permissions = userPermissions(userId);
  const now = new Date().toISOString();
  let created = 0;
  for (const [index, task] of (Array.isArray(data.tasks) ? data.tasks.slice(0, 8) : []).entries()) {
    const title = text(task?.title);
    if (!title) continue;
    const taskType = ["review", "practice", "lecture", "reading", "project"].includes(task?.taskType) ? task.taskType : "practice";
    await tables.createRow({
      databaseId,
      tableId: "study_tasks",
      rowId: ID.unique(),
      data: {
        ownerId: userId,
        courseId,
        conceptId: conceptIds.has(task?.conceptId) ? task.conceptId : concepts.rows[index % concepts.rows.length].$id,
        title: title.slice(0, 200),
        description: text(task?.description).slice(0, 20_000),
        taskType,
        durationMinutes: clamp(task?.durationMinutes, 10, 120),
        scheduledFor: safeDate(task?.scheduledFor, index + 1),
        status: "planned",
        source: "adaptive-plan",
        reason: text(task?.reason, "Prioritized from your current mastery evidence.").slice(0, 20_000),
        createdAt: now,
      },
      permissions,
    });
    created += 1;
  }
  return { ok: true, created };
}

function normalizeAnswer(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function submitAttempt(services, body) {
  const itemId = text(body.itemId);
  const response = text(body.response);
  const confidence = clamp(body.confidence, 1, 5);
  if (!itemId || !response) throw new Error("Choose an answer before submitting.");
  const { tables, databaseId, userId } = services;
  const item = await tables.getRow({ databaseId, tableId: "practice_items", rowId: itemId });
  if (item.ownerId !== userId) throw new Error("This practice item does not belong to your account.");

  const correct = normalizeAnswer(response) === normalizeAnswer(item.answer);
  let masteryAfter = correct ? 18 : 0;
  let evidenceCount = 1;
  let correctCount = correct ? 1 : 0;
  let masteryRow;
  if (item.conceptId) {
    const records = await tables.listRows({ databaseId, tableId: "mastery_records", queries: [Query.equal("conceptId", [item.conceptId]), Query.limit(1)] });
    masteryRow = records.rows[0];
    const previous = masteryRow?.mastery || 0;
    masteryAfter = correct ? Math.round(previous + (100 - previous) * (0.12 + confidence * 0.015)) : Math.round(previous * 0.82);
    evidenceCount = (masteryRow?.evidenceCount || 0) + 1;
    correctCount = (masteryRow?.correctCount || 0) + (correct ? 1 : 0);
  }
  const now = new Date().toISOString();
  const permissions = userPermissions(userId);
  const evidence = `${correct ? "Correct" : "Incorrect"} ${item.itemType} response with confidence ${confidence}/5.`;

  await tables.createRow({
    databaseId,
    tableId: "practice_attempts",
    rowId: ID.unique(),
    data: {
      ownerId: userId,
      courseId: item.courseId,
      itemId,
      conceptId: item.conceptId,
      response: response.slice(0, 20_000),
      correct,
      confidence,
      masteryAfter,
      answeredAt: now,
    },
    permissions,
  });

  if (item.conceptId) {
    const recordData = {
      ownerId: userId,
      courseId: item.courseId,
      conceptId: item.conceptId,
      mastery: masteryAfter,
      evidenceCount,
      correctCount,
      lastEvidence: evidence,
      updatedAt: now,
    };
    if (masteryRow) {
      await tables.updateRow({ databaseId, tableId: "mastery_records", rowId: masteryRow.$id, data: recordData });
    } else {
      await tables.createRow({ databaseId, tableId: "mastery_records", rowId: ID.unique(), data: recordData, permissions });
    }
    await tables.updateRow({
      databaseId,
      tableId: "concepts",
      rowId: item.conceptId,
      data: { mastery: masteryAfter, evidenceCount, lastEvidenceAt: now },
    });
  }

  return { ok: true, correct, correctAnswer: item.answer, explanation: item.explanation, masteryAfter };
}

async function reviewAssignment(services, body) {
  const assignmentId = text(body.assignmentId);
  if (!assignmentId) throw new Error("Choose an assignment to review.");
  const { tables, storage, databaseId, submissionsBucketId, userId } = services;
  const assignment = await tables.getRow({ databaseId, tableId: "assignments", rowId: assignmentId });
  if (assignment.ownerId !== userId) throw new Error("This assignment does not belong to your account.");
  const submissions = await tables.listRows({
    databaseId,
    tableId: "submissions",
    queries: [Query.equal("assignmentId", [assignmentId]), Query.limit(1)],
  });
  const submission = submissions.rows[0];
  if (!submission) throw new Error("Upload a submission before requesting feedback.");

  await tables.updateRow({ databaseId, tableId: "submissions", rowId: submission.$id, data: { status: "reviewing" } });
  try {
    const [fileBuffer, concepts] = await Promise.all([
      storage.getFileDownload({ bucketId: submissionsBucketId, fileId: submission.fileId }),
      tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [assignment.courseId]), Query.limit(30)] }),
    ]);
    const extracted = (await extractText(fileBuffer, submission.name, submission.mimeType)).replace(/\u0000/g, "").trim();
    if (extracted.length < 40) throw new Error("The submission did not contain enough extractable text.");
    const model = process.env.DEEPSEEK_REASONING_MODEL || "deepseek-v4-pro";
    const { data, model: usedModel } = await callDeepSeek({
      services,
      model,
      system: "You are Cognora's assignment feedback coach. Give rigorous, constructive, rubric-linked feedback. Your score is advisory, never an official grade. Do not rewrite the student's submission. Quote no more than a short phrase when pointing to evidence.",
      prompt: `Review this student submission. Assignment title: ${assignment.title}. Brief: ${assignment.brief}. Rubric: ${assignment.rubricText}. Course concepts: ${JSON.stringify(concepts.rows.map((concept) => ({ id: concept.$id, title: concept.title, description: concept.description })))}. Return {"summary":"overall assessment", "advisoryScore":78, "strengths":["specific strength"], "improvements":[{"issue":"issue", "evidence":"brief evidence", "howToImprove":"action"}], "rubric":[{"criterion":"criterion", "level":"advisory level", "score":80, "feedback":"feedback"}], "nextSteps":["ordered revision action"], "linkedConcepts":[{"conceptId":"exact supplied id", "title":"concept title", "reason":"why it matters"}]}. Submission:\n${extracted.slice(0, MAX_SOURCE_CHARS)}`,
      maxTokens: 5200,
    });
    const now = new Date().toISOString();
    await deleteRows(tables, databaseId, "feedback_reports", [Query.equal("assignmentId", [assignmentId])]);
    const report = await tables.createRow({
      databaseId,
      tableId: "feedback_reports",
      rowId: ID.unique(),
      data: {
        ownerId: userId,
        courseId: assignment.courseId,
        assignmentId,
        submissionId: submission.$id,
        summary: text(data.summary, "Cognora completed an advisory review.").slice(0, 30_000),
        strengthsJson: JSON.stringify(stringList(data.strengths, 10)),
        improvementsJson: jsonText(data.improvements, 10),
        rubricJson: jsonText(data.rubric, 12),
        nextStepsJson: JSON.stringify(stringList(data.nextSteps, 10)),
        linkedConceptsJson: jsonText(data.linkedConcepts, 10),
        advisoryScore: clamp(data.advisoryScore, 0, 100),
        model: usedModel.slice(0, 64),
        createdAt: now,
      },
      permissions: userPermissions(userId),
    });
    await Promise.all([
      tables.updateRow({ databaseId, tableId: "submissions", rowId: submission.$id, data: { status: "reviewed" } }),
      tables.updateRow({ databaseId, tableId: "assignments", rowId: assignmentId, data: { status: "reviewed" } }),
    ]);
    return { ok: true, reportId: report.$id, advisoryScore: report.advisoryScore };
  } catch (caught) {
    await tables.updateRow({ databaseId, tableId: "submissions", rowId: submission.$id, data: { status: "failed" } }).catch(() => undefined);
    throw caught;
  }
}

async function detectGaps(services, body) {
  const courseId = text(body.courseId);
  if (!courseId) throw new Error("Choose a course to scan for gaps.");
  const { tables, databaseId, userId } = services;
  const course = await tables.getRow({ databaseId, tableId: "courses", rowId: courseId });
  if (course.ownerId !== userId) throw new Error("This course does not belong to your account.");
  const [concepts, attempts, records] = await Promise.all([
    tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [courseId]), Query.orderAsc("mastery"), Query.limit(50)] }),
    tables.listRows({ databaseId, tableId: "practice_attempts", queries: [Query.equal("courseId", [courseId]), Query.orderDesc("answeredAt"), Query.limit(100)] }),
    tables.listRows({ databaseId, tableId: "mastery_records", queries: [Query.equal("courseId", [courseId]), Query.limit(50)] }),
  ]);
  if (concepts.rows.length === 0) throw new Error("Analyze course material before detecting knowledge gaps.");
  const model = process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash";
  const { data } = await callDeepSeek({
    services,
    model,
    system: "You are Cognora's evidence-based knowledge gap detector. Separate missing evidence from demonstrated weakness. Never label a student weak solely because they have not attempted a concept. Explain every gap with the supplied evidence.",
    prompt: `Analyze gaps for ${course.title}. Concepts: ${JSON.stringify(concepts.rows.map((concept) => ({ id: concept.$id, title: concept.title, description: concept.description, mastery: concept.mastery || 0, evidenceCount: concept.evidenceCount || 0 })))}. Mastery records: ${JSON.stringify(records.rows.map((record) => ({ conceptId: record.conceptId, mastery: record.mastery, evidenceCount: record.evidenceCount, correctCount: record.correctCount, lastEvidence: record.lastEvidence })))}. Recent attempts: ${JSON.stringify(attempts.rows.map((attempt) => ({ conceptId: attempt.conceptId, correct: attempt.correct, confidence: attempt.confidence, masteryAfter: attempt.masteryAfter })))}. Return {"gaps":[{"conceptId":"exact id", "title":"concept title", "severity":"high|medium|low", "evidence":["specific evidence or missing-evidence statement"], "explanation":"why this is a gap", "recommendedAction":"specific next learning action"}]}. Return at most 8, prioritizing demonstrated weakness, then low-evidence concepts.`,
      maxTokens: 3600,
    });
  await deleteRows(tables, databaseId, "gap_insights", [Query.equal("courseId", [courseId])]);
  const conceptMap = new Map(concepts.rows.map((concept) => [concept.$id, concept]));
  const now = new Date().toISOString();
  const permissions = userPermissions(userId);
  let created = 0;
  for (const candidate of valueList(data.gaps, 8)) {
    const concept = conceptMap.get(candidate?.conceptId);
    if (!concept) continue;
    const mastery = concept.mastery || 0;
    const severity = ["high", "medium", "low"].includes(candidate?.severity) ? candidate.severity : mastery < 35 ? "high" : mastery < 60 ? "medium" : "low";
    const status = mastery >= 70 ? "resolved" : mastery >= 45 ? "improving" : "open";
    await tables.createRow({
      databaseId,
      tableId: "gap_insights",
      rowId: ID.unique(),
      data: {
        ownerId: userId,
        courseId,
        conceptId: concept.$id,
        title: text(candidate?.title, concept.title).slice(0, 180),
        severity,
        mastery,
        evidenceCount: concept.evidenceCount || 0,
        evidenceJson: JSON.stringify(stringList(candidate?.evidence, 8)),
        explanation: text(candidate?.explanation, "More evidence is needed for this concept.").slice(0, 20_000),
        recommendedAction: text(candidate?.recommendedAction, `Complete a focused practice session on ${concept.title}.`).slice(0, 20_000),
        status,
        createdAt: now,
      },
      permissions,
    });
    created += 1;
  }
  return { ok: true, created };
}

async function generateRoadmap(services, body) {
  const courseId = text(body.courseId);
  const goal = text(body.goal);
  if (!courseId || !goal) throw new Error("Choose a course and describe your roadmap goal.");
  const { tables, databaseId, userId } = services;
  const course = await tables.getRow({ databaseId, tableId: "courses", rowId: courseId });
  if (course.ownerId !== userId) throw new Error("This course does not belong to your account.");
  const [concepts, gaps, profileRows] = await Promise.all([
    tables.listRows({ databaseId, tableId: "concepts", queries: [Query.equal("courseId", [courseId]), Query.limit(50)] }),
    tables.listRows({ databaseId, tableId: "gap_insights", queries: [Query.equal("courseId", [courseId]), Query.limit(20)] }),
    tables.listRows({ databaseId, tableId: "profiles", queries: [Query.equal("ownerId", [userId]), Query.limit(1)] }),
  ]);
  if (concepts.rows.length === 0) throw new Error("Analyze course material before creating a learning roadmap.");
  const existing = await tables.listRows({ databaseId, tableId: "roadmaps", queries: [Query.equal("courseId", [courseId]), Query.equal("status", ["active"]), Query.limit(10)] });
  for (const roadmap of existing.rows) await tables.updateRow({ databaseId, tableId: "roadmaps", rowId: roadmap.$id, data: { status: "archived" } });
  const profile = profileRows.rows[0];
  const model = process.env.DEEPSEEK_REASONING_MODEL || "deepseek-v4-pro";
  const { data, model: usedModel } = await callDeepSeek({
    services,
    model,
    system: "You are Cognora's prerequisite-aware learning roadmap architect. Sequence foundations before dependent skills, adapt around evidence-backed gaps, and make every step achievable within the student's available time.",
    prompt: `Build a roadmap for ${course.title}. Goal: ${goal}. Weekly hours: ${profile?.weeklyHours || 6}. Concepts: ${JSON.stringify(concepts.rows.map((concept) => ({ id: concept.$id, title: concept.title, description: concept.description, mastery: concept.mastery || 0, evidenceCount: concept.evidenceCount || 0 })))}. Current gaps: ${JSON.stringify(gaps.rows.map((gap) => ({ conceptId: gap.conceptId, severity: gap.severity, explanation: gap.explanation, recommendedAction: gap.recommendedAction })))}. Return {"title":"roadmap title", "summary":"how this path reaches the goal", "steps":[{"conceptId":"exact supplied id when relevant", "title":"milestone", "description":"specific outcome and activity", "targetDate":"ISO date", "reason":"prerequisite or evidence-based reason"}]}. Return 5-10 ordered steps.`,
    maxTokens: 4600,
  });
  const now = new Date().toISOString();
  const permissions = userPermissions(userId);
  const roadmap = await tables.createRow({
    databaseId,
    tableId: "roadmaps",
    rowId: ID.unique(),
    data: {
      ownerId: userId,
      courseId,
      goal: goal.slice(0, 30_000),
      title: text(data.title, `${course.title} learning roadmap`).slice(0, 200),
      summary: text(data.summary, `A focused path toward ${goal}.`).slice(0, 30_000),
      status: "active",
      model: usedModel.slice(0, 64),
      createdAt: now,
    },
    permissions,
  });
  const conceptIds = new Set(concepts.rows.map((concept) => concept.$id));
  let created = 0;
  for (const [index, step] of valueList(data.steps, 10).entries()) {
    const title = text(step?.title);
    if (!title) continue;
    await tables.createRow({
      databaseId,
      tableId: "roadmap_steps",
      rowId: ID.unique(),
      data: {
        ownerId: userId,
        courseId,
        roadmapId: roadmap.$id,
        conceptId: conceptIds.has(step?.conceptId) ? step.conceptId : undefined,
        sequence: index + 1,
        title: title.slice(0, 200),
        description: text(step?.description).slice(0, 20_000),
        status: index === 0 ? "available" : "locked",
        targetDate: safeDate(step?.targetDate, (index + 1) * 5),
        reason: text(step?.reason, "Sequenced from course prerequisites and current evidence.").slice(0, 20_000),
        createdAt: now,
      },
      permissions,
    });
    created += 1;
  }
  return { ok: true, roadmapId: roadmap.$id, created };
}

async function askCoach(services, body) {
  const courseId = text(body.courseId);
  const message = text(body.message);
  if (!message) throw new Error("Ask Cognora a study question.");
  const { tables, databaseId, userId } = services;
  let course;
  if (courseId) {
    course = await tables.getRow({ databaseId, tableId: "courses", rowId: courseId });
    if (course.ownerId !== userId) throw new Error("This course does not belong to your account.");
  }
  const courseQueries = courseId ? [Query.equal("courseId", [courseId])] : [Query.equal("ownerId", [userId])];
  const knowledgePromise = (async () => {
    try {
      const searched = await tables.listRows({ databaseId, tableId: "knowledge_chunks", queries: [...courseQueries, Query.search("content", message), Query.limit(8)] });
      if (searched.rows.length) return searched;
    } catch {
      // Full-text search can be temporarily unavailable while a new index is building.
    }
    return tables.listRows({ databaseId, tableId: "knowledge_chunks", queries: [...courseQueries, Query.orderDesc("createdAt"), Query.limit(6)] });
  })();
  const [profiles, concepts, gaps, tasks, insights, roadmaps, knowledge] = await Promise.all([
    tables.listRows({ databaseId, tableId: "profiles", queries: [Query.equal("ownerId", [userId]), Query.limit(1)] }),
    tables.listRows({ databaseId, tableId: "concepts", queries: [...courseQueries, Query.orderAsc("mastery"), Query.limit(20)] }),
    tables.listRows({ databaseId, tableId: "gap_insights", queries: [...courseQueries, Query.limit(12)] }),
    tables.listRows({ databaseId, tableId: "study_tasks", queries: [...courseQueries, Query.equal("status", ["planned"]), Query.orderAsc("scheduledFor"), Query.limit(12)] }),
    tables.listRows({ databaseId, tableId: "material_insights", queries: [...courseQueries, Query.orderDesc("createdAt"), Query.limit(5)] }),
    tables.listRows({ databaseId, tableId: "roadmaps", queries: [...courseQueries, Query.equal("status", ["active"]), Query.limit(5)] }),
    knowledgePromise,
  ]);
  const model = process.env.DEEPSEEK_REASONING_MODEL || "deepseek-v4-pro";
  const { data, model: usedModel } = await callDeepSeek({
    services,
    model,
    system: "You are Cognora, a calm and evidence-aware AI study coach. Answer directly, give actionable next steps, and explain which course evidence supports your advice. Clearly say when the available evidence is insufficient. Do not claim to change schedules or grades.",
    prompt: `Student profile: ${JSON.stringify(profiles.rows[0] || {})}. Selected course: ${JSON.stringify(course ? { id: course.$id, title: course.title, description: course.description, targetGrade: course.targetGrade } : null)}. Lowest-mastery concepts: ${JSON.stringify(concepts.rows.map((concept) => ({ title: concept.title, mastery: concept.mastery || 0, evidenceCount: concept.evidenceCount || 0 })))}. Gap insights: ${JSON.stringify(gaps.rows.map((gap) => ({ title: gap.title, severity: gap.severity, explanation: gap.explanation, recommendedAction: gap.recommendedAction })))}. Planned tasks: ${JSON.stringify(tasks.rows.map((task) => ({ title: task.title, scheduledFor: task.scheduledFor, durationMinutes: task.durationMinutes, reason: task.reason })))}. Material summaries: ${JSON.stringify(insights.rows.map((insight) => ({ title: insight.title, summary: insight.summary.slice(0, 1800) })))}. Retrieved source passages: ${JSON.stringify(knowledge.rows.map((chunk) => ({ materialId: chunk.materialId, passage: chunk.content.slice(0, 2600) })))}. Active roadmaps: ${JSON.stringify(roadmaps.rows.map((roadmap) => ({ title: roadmap.title, goal: roadmap.goal, summary: roadmap.summary })))}. Student question: ${message}. Return {"answer":"clear coach response", "suggestedActions":["specific action"], "evidence":["course evidence used or an explicit insufficient-evidence note"]}.`,
    maxTokens: 3200,
  });
  const now = new Date().toISOString();
  const coachMessage = await tables.createRow({
    databaseId,
    tableId: "coach_messages",
    rowId: ID.unique(),
    data: {
      ownerId: userId,
      courseId: courseId || undefined,
      question: message.slice(0, 20_000),
      answer: text(data.answer, "I need more course evidence before I can answer reliably.").slice(0, 30_000),
      suggestedActionsJson: JSON.stringify(stringList(data.suggestedActions, 8)),
      evidenceJson: JSON.stringify(stringList(data.evidence, 8)),
      model: usedModel.slice(0, 64),
      createdAt: now,
    },
    permissions: userPermissions(userId),
  });
  return {
    ok: true,
    messageId: coachMessage.$id,
    answer: coachMessage.answer,
    suggestedActions: stringList(data.suggestedActions, 8),
    evidence: stringList(data.evidence, 8),
  };
}

async function prepareJob(services, body) {
  const jobId = text(body.jobId);
  if (!jobId) return;
  const job = await services.tables.getRow({ databaseId: services.databaseId, tableId: "ai_jobs", rowId: jobId });
  if (job.ownerId !== services.userId) throw new Error("This AI job does not belong to your account.");
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const recent = await services.tables.listRows({
    databaseId: services.databaseId,
    tableId: "ai_jobs",
    queries: [Query.equal("ownerId", [services.userId]), Query.greaterThanEqual("createdAt", [startOfDay.toISOString()]), Query.limit(100)],
    total: false,
  });
  const limit = clamp(process.env.AI_DAILY_REQUEST_LIMIT || 40, 1, 1000);
  if (recent.rows.length > limit) {
    await services.tables.updateRow({ databaseId: services.databaseId, tableId: "ai_jobs", rowId: jobId, data: { status: "failed", progress: 100, stage: "Daily limit reached", error: `Daily AI request limit reached (${limit}).`, completedAt: new Date().toISOString() } });
    throw new Error(`Daily AI request limit reached (${limit}). Try again tomorrow.`);
  }
  services.job = job;
  services.jobStartedAt = Date.now();
  services.retryCount = 0;
  services.reportProgress = async (progress, stage) => services.tables.updateRow({
    databaseId: services.databaseId,
    tableId: "ai_jobs",
    rowId: jobId,
    data: { progress: clamp(progress, 0, 99), stage: text(stage, "Working").slice(0, 160) },
  });
  await services.tables.updateRow({
    databaseId: services.databaseId,
    tableId: "ai_jobs",
    rowId: jobId,
    data: { status: "processing", progress: 10, stage: "Preparing private course context", startedAt: new Date().toISOString() },
  });
}

async function completeJob(services) {
  if (!services.job) return;
  const completedAt = new Date().toISOString();
  const usage = services.usage || {};
  await services.tables.updateRow({
    databaseId: services.databaseId,
    tableId: "ai_jobs",
    rowId: services.job.$id,
    data: {
      status: "completed",
      progress: 100,
      stage: "Ready",
      model: usage.model,
      inputChars: usage.inputChars || 0,
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      durationMs: Math.max(0, Date.now() - services.jobStartedAt),
      retryCount: services.retryCount || 0,
      completedAt,
    },
  });
  await createNotification(services, {
    type: "ai-complete",
    title: `${services.job.label} is ready`.slice(0, 180),
    body: "Cognora finished securely and saved the result in your workspace.",
    entityType: "ai_job",
    entityId: services.job.$id,
    scheduledFor: completedAt,
  });
}

async function failJob(services, caught) {
  if (!services?.job) return;
  const completedAt = new Date().toISOString();
  const message = caught instanceof Error ? caught.message : "The AI job could not be completed.";
  await services.tables.updateRow({
    databaseId: services.databaseId,
    tableId: "ai_jobs",
    rowId: services.job.$id,
    data: { status: "failed", progress: 100, stage: "Needs attention", error: message.slice(0, 20_000), durationMs: Math.max(0, Date.now() - services.jobStartedAt), retryCount: services.retryCount || 0, completedAt },
  }).catch(() => undefined);
  await createNotification(services, {
    type: "ai-failed",
    title: `${services.job.label} needs attention`.slice(0, 180),
    body: "The request did not finish. Your existing learning data was preserved, and you can safely try again.",
    entityType: "ai_job",
    entityId: services.job.$id,
    scheduledFor: completedAt,
  }).catch(() => undefined);
}

async function main({ req, res, log, error }) {
  let services;
  try {
    if (req.method !== "POST") return res.json({ ok: true, function: functionId }, 200);
    services = createUserServices(req);
    const body = readJson(req.body);
    await prepareJob(services, body);
    log(JSON.stringify({ event: "learning_action_started", action: body.action || "unknown", jobId: body.jobId || null }));
    let result;
    if (body.action === "process_material") result = await processMaterial(services, body);
    else if (body.action === "generate_plan") result = await generatePlan(services, body);
    else if (body.action === "submit_attempt") result = await submitAttempt(services, body);
    else if (body.action === "review_assignment") result = await reviewAssignment(services, body);
    else if (body.action === "detect_gaps") result = await detectGaps(services, body);
    else if (body.action === "generate_roadmap") result = await generateRoadmap(services, body);
    else if (body.action === "ask_coach") result = await askCoach(services, body);
    else if (body.action === "sync_reminders") result = await syncReminders(services);
    else throw new Error("Unknown learning engine action.");
    if (body.action === "generate_plan") await syncReminders(services).catch(() => undefined);
    await completeJob(services);
    log(JSON.stringify({ event: "learning_action_completed", action: body.action, jobId: body.jobId || null, durationMs: services.jobStartedAt ? Date.now() - services.jobStartedAt : 0 }));
    return res.json(result, 200);
  } catch (caught) {
    await failJob(services, caught);
    error(caught instanceof Error ? caught.message : String(caught));
    return res.json({ ok: false, error: caught instanceof Error ? caught.message : "The learning engine could not complete this request." }, 400);
  }
}

export default main;
