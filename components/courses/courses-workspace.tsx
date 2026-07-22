"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  GraduationCap,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { listAccessibleCourses } from "@/lib/appwrite/courses";
import { getAppwriteErrorMessage } from "@/lib/appwrite/errors";
import type { Course, CourseColor, CourseMaterial, MaterialKind } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";
import { CourseLearningLoop } from "@/components/learning/learning-workspaces";

const courseColors: Array<{ value: CourseColor; label: string }> = [
  { value: "cobalt", label: "Cobalt" },
  { value: "teal", label: "Teal" },
  { value: "coral", label: "Coral" },
  { value: "amber", label: "Amber" },
  { value: "violet", label: "Violet" },
  { value: "slate", label: "Slate" },
];

const allowedExtensions = ["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function classifyMaterial(file: File): MaterialKind {
  const name = file.name.toLowerCase();
  if (name.includes("syllabus")) return "syllabus";
  if (name.includes("lecture") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "lecture";
  if (name.includes("assignment")) return "assignment";
  if (name.includes("transcript")) return "transcript";
  if (name.endsWith(".txt") || name.endsWith(".md")) return "notes";
  return "other";
}

export function CoursesWorkspace({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCourses = useCallback(async () => {
    try {
      setCourses(await listAccessibleCourses(userId));
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMaterials = useCallback(async (courseId: string) => {
    try {
      const { tables, config } = getAppwriteBrowserServices();
      const result = await tables.listRows<CourseMaterial>({
        databaseId: config.databaseId,
        tableId: "materials",
        queries: [Query.equal("courseId", [courseId]), Query.orderDesc("createdAt")],
        ttl: 0,
      });
      setMaterials(result.rows);
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadCourses());
  }, [loadCourses]);

  useEffect(() => {
    if (selectedCourse) queueMicrotask(() => void loadMaterials(selectedCourse.$id));
  }, [loadMaterials, selectedCourse]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => `${course.title} ${course.code ?? ""}`.toLowerCase().includes(normalized));
  }, [courses, query]);

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      const { tables, config } = getAppwriteBrowserServices();
      const course = await tables.createRow<Course>({
        databaseId: config.databaseId,
        tableId: "courses",
        rowId: ID.unique(),
        data: {
          ownerId: userId,
          title: String(data.get("title") ?? "").trim(),
          code: String(data.get("code") ?? "").trim(),
          color: String(data.get("color") ?? "cobalt") as CourseColor,
          term: String(data.get("term") ?? "").trim(),
          description: String(data.get("description") ?? "").trim(),
          targetGrade: String(data.get("targetGrade") ?? "").trim(),
          status: "active",
          createdAt: new Date().toISOString(),
        },
        permissions: privateUserPermissions(userId),
      });
      setCourses((current) => [course, ...current]);
      setShowCreate(false);
      setSelectedCourse(course);
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function uploadMaterial(file: File) {
    if (!selectedCourse) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.includes(extension)) {
      setError(`Use one of these file types: ${allowedExtensions.join(", ")}.`);
      return;
    }
    if (file.size > 52_428_800) {
      setError("Files must be 50 MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");
    const { storage, tables, config } = getAppwriteBrowserServices();
    const fileId = ID.unique();
    const permissions = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ];

    try {
      await storage.createFile({
        bucketId: config.materialsBucketId,
        fileId,
        file,
        permissions,
        onProgress: (progress) => setUploadProgress(Math.round(progress.progress)),
      });

      try {
        const material = await tables.createRow<CourseMaterial>({
          databaseId: config.databaseId,
          tableId: "materials",
          rowId: ID.unique(),
          data: {
            ownerId: userId,
            courseId: selectedCourse.$id,
            fileId,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            kind: classifyMaterial(file),
            processingStatus: "uploaded",
            createdAt: new Date().toISOString(),
          },
          permissions: privateUserPermissions(userId),
        });
        setMaterials((current) => [material, ...current]);
      } catch (metadataError) {
        await storage.deleteFile({ bucketId: config.materialsBucketId, fileId }).catch(() => undefined);
        throw metadataError;
      }
    } catch (caught) {
      setError(getAppwriteErrorMessage(caught));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (selectedCourse) {
    const sharedReadOnly = selectedCourse.ownerId !== userId;
    return (
      <div className="page-wrap courses-page course-detail-page">
        <button className="back-button" type="button" onClick={() => { setSelectedCourse(null); setMaterials([]); }}>
          <ArrowLeft size={16} /> All courses
        </button>
        <section className={`course-hero ${selectedCourse.color}`}>
          <div>
            <p className="eyebrow">{selectedCourse.term || "Active course"}</p>
            <h1>{selectedCourse.title}</h1>
            <p>{selectedCourse.description || "Your connected workspace for lectures, materials, assignments, and progress."}</p>
          </div>
          <div className="course-code-badge">{selectedCourse.code || "COURSE"}</div>
        </section>

        {error && <p className="workspace-error" role="alert">{error}</p>}

        <CourseLearningLoop
          userId={userId}
          course={selectedCourse}
          materials={materials}
          onMaterialsChanged={() => loadMaterials(selectedCourse.$id)}
          readOnly={sharedReadOnly}
        />

        <section className="course-detail-grid">
          <article className="surface-card materials-card">
            <div className="section-heading">
              <div>
                <p className="card-kicker">Unified course library</p>
                <h2>Course materials</h2>
              </div>
              {!sharedReadOnly && <label className={`upload-button ${uploading ? "disabled" : ""}`}>
                {uploading ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />}
                {uploading ? `Uploading ${uploadProgress}%` : "Upload material"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadMaterial(file);
                  }}
                />
              </label>}
            </div>

            {materials.length === 0 ? (
              sharedReadOnly ? <div className="material-dropzone"><span><UsersRound size={25} /></span><strong>Shared course library</strong><p>The owner has not added material yet.</p><small>Your personal mastery and submissions remain separate.</small></div> : <button className="material-dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
                <span><UploadCloud size={25} /></span>
                <strong>Add your first course material</strong>
                <p>Upload a syllabus, lecture PDF, slides, notes, or transcript.</p>
                <small>PDF, DOCX, PPTX, TXT or MD · up to 50 MB</small>
              </button>
            ) : (
              <div className="materials-list">
                {materials.map((material) => (
                  <div className="material-row" key={material.$id}>
                    <span className="material-icon"><FileText size={18} /></span>
                    <div>
                      <strong>{material.name}</strong>
                      <span>{material.kind} · {formatFileSize(material.size)}</span>
                    </div>
                    <span className="material-status"><Check size={13} /> Private upload</span>
                    <button className="icon-button" type="button" aria-label={`More options for ${material.name}`}><MoreHorizontal size={17} /></button>
                  </div>
                ))}
              </div>
            )}
          </article>

          <aside className="course-side-column">
            <article className="surface-card course-ready-card">
              <div className="ready-icon"><Sparkles size={19} /></div>
              <p className="card-kicker">Phase 3 learning engine</p>
              <h2>One material, four outcomes</h2>
              <p>Analyze a file to create a grounded companion, adaptive tasks, recall practice, and the first mastery evidence.</p>
              <span><ShieldCheck size={15} /> Files are private to your account</span>
            </article>
            <article className="surface-card course-stat-card">
              <div><span>Materials</span><strong>{materials.length}</strong></div>
              <div><span>Target grade</span><strong>{selectedCourse.targetGrade || "—"}</strong></div>
              <div><span>Status</span><strong>Active</strong></div>
            </article>
          </aside>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap courses-page">
      <section className="courses-heading">
        <div>
          <p className="eyebrow">Unified course library</p>
          <h1>Your courses</h1>
          <p>Every plan, lecture, assignment, and mastery signal starts with a course.</p>
        </div>
        <button className="create-course-button" type="button" onClick={() => setShowCreate(true)}>
          <Plus size={17} /> Add course
        </button>
      </section>

      <div className="courses-toolbar">
        <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your courses" /></label>
        <span>{courses.length} active {courses.length === 1 ? "course" : "courses"}</span>
      </div>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      {loading ? (
        <div className="workspace-loading"><LoaderCircle className="spin" size={24} /><span>Loading your courses…</span></div>
      ) : filteredCourses.length === 0 && courses.length === 0 ? (
        <section className="empty-courses">
          <div className="empty-course-visual">
            <span className="empty-orbit orbit-a" />
            <span className="empty-orbit orbit-b" />
            <span className="empty-core"><GraduationCap size={31} /></span>
            <span className="empty-node node-a"><BookOpen size={18} /></span>
            <span className="empty-node node-b"><FileText size={18} /></span>
          </div>
          <p className="card-kicker">Your first building block</p>
          <h2>Add a course to begin</h2>
          <p>Cognora will use it to organize materials, deadlines, plans, and learning evidence in one place.</p>
          <button className="create-course-button" type="button" onClick={() => setShowCreate(true)}><Plus size={17} /> Create first course</button>
        </section>
      ) : (
        <section className="course-card-grid">
          {filteredCourses.map((course) => (
            <button className={`course-card ${course.color}`} type="button" key={course.$id} onClick={() => setSelectedCourse(course)}>
              <div className="course-card-top">
                <span className="course-folder"><FolderOpen size={19} /></span>
                <span className="course-status-dot">Active</span>
              </div>
              <p>{course.code || "COURSE"}</p>
              <h2>{course.title}</h2>
              <span>{course.term || "Current term"}</span>
              <div className="course-card-footer">
                <span>Open workspace</span><ChevronRight size={17} />
              </div>
            </button>
          ))}
        </section>
      )}

      {showCreate && (
        <div className="dialog-scrim" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <section className="course-dialog" role="dialog" aria-modal="true" aria-labelledby="course-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-heading">
              <div><p className="card-kicker">Course foundation</p><h2 id="course-dialog-title">Add a course</h2></div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={createCourse}>
              <label className="field-label"><span>Course name</span><input name="title" placeholder="Molecular Biology" required maxLength={160} autoFocus /></label>
              <div className="dialog-two-col">
                <label className="field-label"><span>Course code</span><input name="code" placeholder="BIO 204" maxLength={32} /></label>
                <label className="field-label"><span>Term</span><input name="term" placeholder="Fall 2026" maxLength={64} /></label>
              </div>
              <label className="field-label"><span>What will you learn?</span><textarea name="description" rows={3} placeholder="A short course description" /></label>
              <div className="dialog-two-col">
                <label className="field-label"><span>Target grade</span><input name="targetGrade" placeholder="A" maxLength={32} /></label>
                <label className="field-label"><span>Course color</span><select name="color" defaultValue="cobalt">{courseColors.map((color) => <option value={color.value} key={color.value}>{color.label}</option>)}</select></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="dialog-submit" type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
                {busy ? "Creating course…" : "Create course"}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
