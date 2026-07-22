"use client";

import { Query } from "appwrite";
import { getAppwriteBrowserServices } from "./client";
import type { Course, CourseMember } from "./models";

export async function listAccessibleCourses(userId: string, activeOnly = true): Promise<Course[]> {
  const { tables, config } = getAppwriteBrowserServices();
  const [owned, memberships] = await Promise.all([
    tables.listRows<Course>({
      databaseId: config.databaseId,
      tableId: "courses",
      queries: [Query.equal("ownerId", [userId]), ...(activeOnly ? [Query.equal("status", ["active"])] : []), Query.limit(100)],
      ttl: 0,
    }),
    tables.listRows<CourseMember>({
      databaseId: config.databaseId,
      tableId: "course_members",
      queries: [Query.equal("memberId", [userId]), Query.equal("status", ["active"]), Query.limit(100)],
      ttl: 0,
    }),
  ]);
  const shared = await Promise.all(memberships.rows
    .filter((membership) => !owned.rows.some((course) => course.$id === membership.courseId))
    .map((membership) => tables.getRow<Course>({ databaseId: config.databaseId, tableId: "courses", rowId: membership.courseId }).catch(() => null)));
  const visibleShared = shared.filter((course): course is Course => course !== null).filter((course) => !activeOnly || course.status === "active");
  return [...owned.rows, ...visibleShared]
    .filter((course, index, rows) => rows.findIndex((candidate) => candidate.$id === course.$id) === index)
    .sort((left, right) => left.title.localeCompare(right.title));
}
