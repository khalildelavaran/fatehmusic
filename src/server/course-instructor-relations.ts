import { courses as staticCourses } from "../data/courses.js";
import { instructors as staticInstructors } from "../data/instructors.js";
import { listCourses } from "./courses";
import { listInstructors } from "./instructors";

export type CourseRelation = Record<string, any> & { instructorIds: number[]; instructors: any[] };
export type InstructorRelation = Record<string, any> & { courseSlugs: string[]; courses: any[] };

const uniqueNumbers = (values: unknown[]): number[] => [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
const uniqueStrings = (values: unknown[]): string[] => [...new Set(values.map(String).filter(Boolean))];

async function getInstructorCatalog(db?: D1Database): Promise<any[]> {
  if (!db) return staticInstructors as any[];
  try {
    const result = await listInstructors(db, { page: 1, pageSize: 100 });
    return result.instructors.length ? result.instructors : (staticInstructors as any[]);
  } catch {
    return staticInstructors as any[];
  }
}

export async function resolveCourseInstructorRelations(db?: D1Database): Promise<{ courses: CourseRelation[]; instructors: InstructorRelation[] }> {
  const courses = await listCourses(db);
  const instructors = await getInstructorCatalog(db);
  const instructorById = new Map<number, any>(instructors.map((item: any) => [Number(item.id), item]));
  const courseBySlug = new Map<string, any>((courses as any[]).map((item: any) => [String(item.slug), item]));

  const resolvedCourses = (courses as any[]).map((course) => {
    const explicitIds = Array.isArray(course.instructors) ? course.instructors : [];
    const reverseIds = instructors.filter((instructor: any) => Array.isArray(instructor.instruments) && instructor.instruments.includes(course.slug)).map((instructor: any) => instructor.id);
    const instructorIds = uniqueNumbers([...explicitIds, ...reverseIds]);
    return { ...course, instructorIds, instructors: instructorIds.map((id) => instructorById.get(id)).filter(Boolean) };
  });

  const resolvedInstructors = instructors.map((instructor: any) => {
    const explicitSlugs = Array.isArray(instructor.instruments) ? instructor.instruments : [];
    const reverseSlugs = resolvedCourses.filter((course: any) => course.instructorIds.includes(Number(instructor.id))).map((course: any) => course.slug);
    const courseSlugs = uniqueStrings([...explicitSlugs, ...reverseSlugs]);
    return { ...instructor, courseSlugs, courses: courseSlugs.map((slug) => courseBySlug.get(slug)).filter(Boolean) };
  });

  return { courses: resolvedCourses, instructors: resolvedInstructors };
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
    const merged = { ...course, id: course.id, slug: course.slug, instructors: next };
    await db.prepare(`INSERT INTO course_overrides (id, slug, data, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, data=excluded.data, updated_at=datetime('now')`).bind(course.id, course.slug, JSON.stringify(merged)).run();
  }
}

export async function syncCourseInstructorRelations(db: D1Database, courseSlug: string, instructorIds: number[]): Promise<void> {
  const desired = new Set(uniqueNumbers(instructorIds));
  const courseRows = await listCourses(db);
  const targetCourse = (courseRows as any[]).find((item) => item.slug === courseSlug);
  if (!targetCourse) return;

  const instructorRows = await listInstructors(db, { page: 1, pageSize: 100 });
  for (const instructor of instructorRows.instructors) {
    const slugs = new Set(uniqueStrings(instructor.instruments || []));
    if (desired.has(Number(instructor.id))) slugs.add(courseSlug);
    else slugs.delete(courseSlug);
    await db.prepare("UPDATE instructors SET instruments = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify([...slugs]), instructor.id).run();
  }
}
