import { Client, ID, Permission, Query, Role, Storage, TablesDB } from "node-appwrite";
import { OfficeParser } from "officeparser";

const MAX_SOURCE_CHARS = 60_000;
const functionId = "learning-engine";

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

async function callDeepSeek({ system, prompt, model, maxTokens = 5000 }) {
  const endpoint = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${endpoint}/chat/completions`, {
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

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty response.");
  return { data: JSON.parse(content), model: payload.model || model };
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
      model,
      system: "You are Cognora's course-material analyst. Extract only what is supported by the supplied source. Build concise, student-ready outputs. Never invent deadlines, facts, or learning outcomes.",
      prompt: `Today is ${new Date().toISOString().slice(0, 10)}. Analyze this ${material.kind} named ${JSON.stringify(material.name)}.\n\nReturn this JSON shape:\n{\n  "title": "descriptive title",\n  "materialType": "syllabus|lecture|notes|assignment|transcript|other",\n  "summary": "3-6 paragraph grounded summary",\n  "outline": ["ordered section or lecture point"],\n  "keyPoints": ["high-value fact or idea"],\n  "concepts": [{"title":"concept", "description":"grounded explanation"}],\n  "flashcards": [{"front":"question or cue", "back":"answer", "concept":"matching concept title", "explanation":"why it matters"}],\n  "quiz": [{"question":"single-answer question", "options":["A","B","C","D"], "answer":"exact option text", "concept":"matching concept title", "explanation":"grounded explanation"}],\n  "studyTasks": [{"title":"task", "description":"what to do", "taskType":"review|practice|lecture|reading|project", "durationMinutes":30, "scheduledFor":"ISO date if explicitly supported or a sensible near-term date", "reason":"why this task follows from the material"}]\n}\n\nKeep at most 10 concepts, 10 flashcards, 8 quiz questions, and 8 tasks. Source:\n${source}`,
    });

    const now = new Date().toISOString();
    const permissions = userPermissions(userId);
    await Promise.all([
      deleteRows(tables, databaseId, "material_insights", [Query.equal("materialId", [materialId])]),
      deleteRows(tables, databaseId, "practice_items", [Query.equal("materialId", [materialId])]),
      deleteRows(tables, databaseId, "study_tasks", [Query.equal("materialId", [materialId]), Query.notEqual("source", ["adaptive-plan"])]),
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
    return { ok: true, materialId, concepts: conceptByTitle.size, practiceItems: flashcards.length + quiz.length };
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

async function main({ req, res, log, error }) {
  try {
    if (req.method !== "POST") return res.json({ ok: true, function: functionId }, 200);
    const services = createUserServices(req);
    const body = readJson(req.body);
    log(`Learning engine action: ${body.action || "unknown"}`);
    let result;
    if (body.action === "process_material") result = await processMaterial(services, body);
    else if (body.action === "generate_plan") result = await generatePlan(services, body);
    else if (body.action === "submit_attempt") result = await submitAttempt(services, body);
    else throw new Error("Unknown learning engine action.");
    return res.json(result, 200);
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return res.json({ ok: false, error: caught instanceof Error ? caught.message : "The learning engine could not complete this request." }, 400);
  }
}

export default main;
