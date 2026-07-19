import {
  Client,
  Compression,
  Permission,
  Role,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from "node-appwrite";

const required = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_MATERIALS_BUCKET_ID",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);
const storage = new Storage(client);
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const bucketId = process.env.APPWRITE_MATERIALS_BUCKET_ID ?? process.env.NEXT_PUBLIC_APPWRITE_MATERIALS_BUCKET_ID;
const authenticatedCreate = [Permission.create(Role.users())];

const definitions = [
  {
    id: "profiles",
    name: "Student profiles",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "displayName", type: "varchar", size: 128, required: true },
      {
        key: "studyLevel",
        type: "enum",
        elements: ["high-school", "undergraduate", "postgraduate", "professional", "other"],
        required: true,
      },
      { key: "timezone", type: "varchar", size: 64, required: true },
      { key: "weeklyHours", type: "integer", min: 1, max: 80, required: true },
      { key: "learningGoal", type: "text", required: false },
      { key: "onboardingComplete", type: "boolean", required: false, default: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_unique", type: TablesDBIndexType.Unique, columns: ["ownerId"] },
    ],
  },
  {
    id: "courses",
    name: "Courses",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 160, required: true },
      { key: "code", type: "varchar", size: 32, required: false },
      {
        key: "color",
        type: "enum",
        elements: ["cobalt", "teal", "coral", "amber", "violet", "slate"],
        required: true,
      },
      { key: "term", type: "varchar", size: 64, required: false },
      { key: "description", type: "text", required: false },
      { key: "targetGrade", type: "varchar", size: 32, required: false },
      {
        key: "status",
        type: "enum",
        elements: ["active", "completed", "archived"],
        required: true,
      },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_status", type: TablesDBIndexType.Key, columns: ["ownerId", "status"] },
      { key: "owner_title", type: TablesDBIndexType.Key, columns: ["ownerId", "title"] },
    ],
  },
  {
    id: "materials",
    name: "Course materials",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "fileId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 255, required: true },
      { key: "mimeType", type: "varchar", size: 128, required: true },
      { key: "size", type: "integer", min: 0, max: 52428800, required: true },
      {
        key: "kind",
        type: "enum",
        elements: ["syllabus", "lecture", "notes", "assignment", "transcript", "other"],
        required: true,
      },
      {
        key: "processingStatus",
        type: "enum",
        elements: ["uploaded", "queued", "processing", "ready", "failed"],
        required: true,
      },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "file_unique", type: TablesDBIndexType.Unique, columns: ["fileId"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "processingStatus"] },
    ],
  },
  {
    id: "material_insights",
    name: "AI material insights",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 255, required: true },
      { key: "materialType", type: "varchar", size: 32, required: true },
      { key: "summary", type: "text", required: true },
      { key: "outlineJson", type: "text", required: true },
      { key: "keyPointsJson", type: "text", required: true },
      { key: "sourceExcerpt", type: "text", required: false },
      { key: "model", type: "varchar", size: 64, required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_unique", type: TablesDBIndexType.Unique, columns: ["materialId"] },
    ],
  },
  {
    id: "concepts",
    name: "Course concepts",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 160, required: true },
      { key: "description", type: "text", required: true },
      { key: "mastery", type: "integer", min: 0, max: 100, required: false, default: 0 },
      { key: "evidenceCount", type: "integer", min: 0, max: 100000, required: false, default: 0 },
      { key: "lastEvidenceAt", type: "datetime", required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_title", type: TablesDBIndexType.Key, columns: ["materialId", "title"] },
      { key: "course_mastery", type: TablesDBIndexType.Key, columns: ["courseId", "mastery"] },
    ],
  },
  {
    id: "study_tasks",
    name: "Adaptive study tasks",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "materialId", type: "varchar", size: 36, required: false },
      { key: "title", type: "varchar", size: 200, required: true },
      { key: "description", type: "text", required: false },
      { key: "taskType", type: "enum", elements: ["review", "practice", "lecture", "reading", "project"], required: true },
      { key: "durationMinutes", type: "integer", min: 5, max: 480, required: true },
      { key: "scheduledFor", type: "datetime", required: true },
      { key: "status", type: "enum", elements: ["planned", "completed", "skipped"], required: true },
      { key: "source", type: "enum", elements: ["syllabus", "lecture", "adaptive-plan", "manual"], required: true },
      { key: "reason", type: "text", required: false },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_schedule", type: TablesDBIndexType.Key, columns: ["ownerId", "scheduledFor"] },
      { key: "course_status", type: TablesDBIndexType.Key, columns: ["courseId", "status"] },
      { key: "material_source", type: TablesDBIndexType.Key, columns: ["materialId", "source"] },
    ],
  },
  {
    id: "practice_items",
    name: "Recall and quiz items",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "materialId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "itemType", type: "enum", elements: ["flashcard", "multiple-choice", "short-answer"], required: true },
      { key: "prompt", type: "text", required: true },
      { key: "answer", type: "text", required: true },
      { key: "optionsJson", type: "text", required: false },
      { key: "explanation", type: "text", required: true },
      { key: "createdAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "material_type", type: TablesDBIndexType.Key, columns: ["materialId", "itemType"] },
      { key: "concept_type", type: TablesDBIndexType.Key, columns: ["conceptId", "itemType"] },
    ],
  },
  {
    id: "practice_attempts",
    name: "Practice attempts",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "itemId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: false },
      { key: "response", type: "text", required: true },
      { key: "correct", type: "boolean", required: true },
      { key: "confidence", type: "integer", min: 1, max: 5, required: true },
      { key: "masteryAfter", type: "integer", min: 0, max: 100, required: true },
      { key: "answeredAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "owner_answered", type: TablesDBIndexType.Key, columns: ["ownerId", "answeredAt"] },
      { key: "concept_answered", type: TablesDBIndexType.Key, columns: ["conceptId", "answeredAt"] },
      { key: "item_answered", type: TablesDBIndexType.Key, columns: ["itemId", "answeredAt"] },
    ],
  },
  {
    id: "mastery_records",
    name: "Explainable mastery records",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "courseId", type: "varchar", size: 36, required: true },
      { key: "conceptId", type: "varchar", size: 36, required: true },
      { key: "mastery", type: "integer", min: 0, max: 100, required: true },
      { key: "evidenceCount", type: "integer", min: 0, max: 100000, required: true },
      { key: "correctCount", type: "integer", min: 0, max: 100000, required: true },
      { key: "lastEvidence", type: "text", required: true },
      { key: "updatedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "concept_unique", type: TablesDBIndexType.Unique, columns: ["conceptId"] },
      { key: "owner_course", type: TablesDBIndexType.Key, columns: ["ownerId", "courseId"] },
      { key: "course_mastery", type: TablesDBIndexType.Key, columns: ["courseId", "mastery"] },
    ],
  },
];

function isNotFound(error) {
  return error && typeof error === "object" && error.code === 404;
}

function isConflict(error) {
  return error && typeof error === "object" && error.code === 409;
}

async function getTable(tableId) {
  try {
    return await tables.getTable({ databaseId, tableId });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitForColumns(tableId, expected) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const table = await tables.getTable({ databaseId, tableId });
    const columns = table.columns ?? [];
    const failed = columns.find((column) => column.status === "failed");
    if (failed) throw new Error(`Column ${failed.key} failed: ${failed.error ?? "unknown error"}`);
    if (columns.length >= expected && columns.every((column) => column.status === "available")) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${tableId} columns`);
}

async function waitForColumn(tableId, key) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const table = await tables.getTable({ databaseId, tableId });
    const column = table.columns?.find((candidate) => candidate.key === key);
    if (column?.status === "failed") {
      throw new Error(`Column ${column.key} failed: ${column.error ?? "unknown error"}`);
    }
    if (column?.status === "available") return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${tableId}.${key}`);
}

async function createColumn(tableId, column) {
  const common = {
    databaseId,
    tableId,
    key: column.key,
    required: column.required,
  };

  switch (column.type) {
    case "varchar":
      return tables.createVarcharColumn({ ...common, size: column.size });
    case "text":
      return tables.createTextColumn(common);
    case "enum":
      return tables.createEnumColumn({ ...common, elements: column.elements });
    case "integer":
      return tables.createIntegerColumn({ ...common, min: column.min, max: column.max });
    case "boolean":
      return tables.createBooleanColumn({ ...common, xdefault: column.default });
    case "datetime":
      return tables.createDatetimeColumn(common);
    default:
      throw new Error(`Unsupported column type: ${column.type}`);
  }
}

async function ensureColumns(definition) {
  const current = await tables.getTable({ databaseId, tableId: definition.id });
  const existing = new Set((current.columns ?? []).map((column) => column.key));

  for (const column of definition.columns) {
    if (existing.has(column.key)) continue;
    await createColumn(definition.id, column);
    await waitForColumn(definition.id, column.key);
  }
}

async function ensureIndexes(definition) {
  const current = await tables.listIndexes({ databaseId, tableId: definition.id });
  const existing = new Set(current.indexes.map((index) => index.key));

  for (const index of definition.indexes) {
    if (existing.has(index.key)) continue;
    await tables.createIndex({
      databaseId,
      tableId: definition.id,
      key: index.key,
      type: index.type,
      columns: index.columns,
    });
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = await tables.listIndexes({ databaseId, tableId: definition.id });
    const expected = result.indexes.filter((index) => definition.indexes.some((item) => item.key === index.key));
    const failed = expected.find((index) => index.status === "failed");
    if (failed) throw new Error(`Index ${failed.key} failed: ${failed.error ?? "unknown error"}`);
    if (expected.length === definition.indexes.length && expected.every((index) => index.status === "available")) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out while waiting for ${definition.id} indexes`);
}

for (const definition of definitions) {
  let table = await getTable(definition.id);
  if (!table) {
    try {
      table = await tables.createTable({
        databaseId,
        tableId: definition.id,
        name: definition.name,
        permissions: authenticatedCreate,
        rowSecurity: true,
        enabled: true,
      });
      console.log(`Created table: ${definition.id}`);
    } catch (error) {
      if (!isConflict(error)) throw error;
      const deadline = Date.now() + 30_000;
      while (!table && Date.now() < deadline) {
        table = await getTable(definition.id);
        if (!table) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (!table) throw error;
      console.log(`Verified table after concurrent creation: ${definition.id}`);
    }
  } else {
    await tables.updateTable({
      databaseId,
      tableId: definition.id,
      name: definition.name,
      permissions: authenticatedCreate,
      rowSecurity: true,
      enabled: true,
    });
    console.log(`Verified table: ${definition.id}`);
  }

  await ensureColumns(definition);
  await waitForColumns(definition.id, definition.columns.length);
  await ensureIndexes(definition);
}

await storage.updateBucket({
  bucketId,
  name: "course-materials",
  permissions: authenticatedCreate,
  fileSecurity: true,
  enabled: true,
  maximumFileSize: 52_428_800,
  allowedFileExtensions: ["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"],
  compression: Compression.None,
  encryption: true,
  antivirus: true,
  transformations: false,
});

console.log("Secured bucket: course-materials");
console.log("Appwrite Phase 3 resources are ready.");
