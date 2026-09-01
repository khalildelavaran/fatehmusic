import { courses as staticCourses } from "../data/courses.js";
import { instructors as staticInstructors } from "../data/instructors.js";
import { listCourses } from "./courses";
import { listInstructors } from "./instructors";

export type CourseRelation = Record<string, any> & { instructors: any[]; instructorIds: number[] };
export type InstructorRelation = Record<string, any> & { courses: any[]; courseSlugs: string[] };

function uniqueNumbers(values: unknown[]): number[] {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(String).filter(Boolean))];
}

export async function resolveCourseInstructorRelations(db?: D1Database): Promise<{ courses: CourseRelation[]; instructors: InstructorRelation[] }> {
  const courses = await listCourses(db);
  const d1Instructors = db ? await listInstructors(db, { page: 1, pageSize: 100 }) : null;
  const instructors = d1Instructors?.instructors?.length ? d1Instructors.instructors : (staticInstructors as any[]);

  const instructorById = new Map<number, any>(instructors.map((item: any) => [Number(item.id), item]));
  const courseBySlug = new Map<string, any>((courses as any[]).map((item: any) => [item.slug, item]));

  const courseIdsByInstructor = new Map<number, Set<string>>();
  for (const instructor of instructors as any[]) {
    const slugs = uniqueStrings(instructor.instruments || []);
    courseIdsByInstructor.set(Number(instructor.id), new Set(slugs));
  }

  const resolvedCourses: CourseRelation[] = (courses as any[]).map((course) => {
    const explicitIds = uniqueNumbers(Array.isArray(course.instructors) ? course.instructors : []);
    const reverseIds = (instructors as any[])
      .filter((instructor) => Array.isArray(instructor.instruments) && instructor.instruments.includes(course.slug))
      .map((instructor) => Number(instructor.id));
    const instructorIds = uniqueNumbers([...explicitIds, ...reverseIds]);
    return {
      ...course,
      instructorIds,
      instructors: instructorIds.map((id) => instructorById.get(id)).filter(Boolean)
    };
  });

  const resolvedInstructors: InstructorRelation[] = (instructors as any[]).map((instructor) => {
    const explicitSlugs = uniqueStrings(instructor.instruments || []);
    const reverseSlugs = (courses as any[])
      .filter((course) => Array.isArray(course.instructors) && course.instructors.includes(Number(instructor.id)))
      .map((course) => String(course.slug));
    const courseSlugs = uniqueStrings([...explicitSlugs, ...reverseSlugs]);
    return {
      ...instructor,
      courseSlugs,
      courses: courseSlugs.map((slug) => courseBySlug.get(slug)).filter(Boolean)
    };
  });

  return { courses: resolvedCourses, instructors: resolvedInstructors };
}

async function writeCourseOverride(db: D1Database, course: any, instructors: number[]): Promise<void> {
  const merged = { ...course, instructors: uniqueNumbers(instructors), id: course.id, slug: course.slug };
  await db.prepare(
    `INSERT INTO course_overrides (id, slug, data, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data, updated_at = datetime('now')`
  ).bind(course.id, course.slug, JSON.stringify(merged)).run();
}

export async function syncInstructorCourseRelations(db: D1Database, instructorId: number, courseSlugs: string[]): Promise<void> {
  const courses = await listCourses(db);
  const desired = new Set(uniqueStrings(courseSlugs));
  for (const course of courses as any[]) {
    const current = uniqueNumbers(Array.isArray(course.instructors) ? course.instructors : []);
    const hasInstructor = current.includes(instructorId);
    const shouldHaveInstructor = desired.has(String(course.slug));
    if (hasInstructor === shouldHaveInstructor) continue;
    const next = shouldHaveInstructor ? [...current, instructorId] : current.filter((id) => id !== instructorId);
    await writeCourseOverride(db, course, next);
  }
}

export async function syncCourseInstructorRelations(db: D1Database, courseSlug: string, instructorIds: number[]): Promise<void> {
  const desired = new Set(uniqueNumbers(instructorIds));
  const currentCourses = await listCourses(db);
  const course = (currentCourses as any[]).find((item) => item.slug === courseSlug);
  if (!course) return;

  const allInstructorIds = new Set<number>((await listInstructors(db, { page: 1, pageSize: 100 })).instructors.map((item) => Number(item.id)));
  for (const id of desired) allInstructorIds.add(id);

  for (const id of allInstructorIds) {
    const row = (await listInstructors(db, { page: 1, pageSize: 100 })).instructors.find((item) => Number(item.id) === id);
    if (!row) continue;
    const slugs = new Set(uniqueStrings(row.instruments || []));
    if (desired.has(id)) slugs.add(courseSlug);
    else slugs.delete(courseSlug);
    await db.prepare("UPDATE instructors SET instruments = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(JSON.stringify([...slugs]), id)
      .run();
  }
}
