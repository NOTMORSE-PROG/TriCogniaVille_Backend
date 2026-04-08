import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Returns true if the given student exists. TriCognia Ville is a single-org
 * product without classroom features, so every authenticated teacher sees
 * every student. The function signature is preserved so call sites in the
 * dashboard routes don't need to change.
 */
export async function teacherOwnsStudent(
  _teacherId: string,
  studentId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  return !!row;
}

/**
 * Drizzle subquery yielding every studentId in the system. Single-org
 * product, so this is just `SELECT id FROM students`. Use inside
 * `inArray(students.id, visibleStudentIds(teacherId))`.
 */
export function visibleStudentIds(_teacherId: string) {
  return sql`(SELECT ${students.id} FROM ${students})`;
}
