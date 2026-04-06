import { db } from "@/lib/db";
import { classes, classStudents } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Returns true if the given teacher owns at least one class the student is enrolled in.
 * Used to gate teacher dashboard access so a teacher cannot read data for students
 * outside their own roster.
 */
export async function teacherOwnsStudent(
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const [row] = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .where(
      and(
        eq(classStudents.studentId, studentId),
        eq(classes.teacherId, teacherId)
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Drizzle subquery that yields every studentId enrolled in any class owned by
 * this teacher. Use inside `inArray(students.id, visibleStudentIds(teacherId))`
 * to scope SELECT queries to the teacher's roster only.
 */
export function visibleStudentIds(teacherId: string) {
  return sql`(
    SELECT ${classStudents.studentId}
    FROM ${classStudents}
    INNER JOIN ${classes} ON ${classStudents.classId} = ${classes.id}
    WHERE ${classes.teacherId} = ${teacherId}
  )`;
}
