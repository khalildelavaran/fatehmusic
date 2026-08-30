import { courses as staticCourses } from "../data/courses.js";

export type Course = Record<string, any>;

function parseOverride(data: string | null): Course {
  if (!data) return {};
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function listCourses(db: D1Database | undefined): Promise<Course[]> {
  if (!db) return staticCourses as Course[];

  try {
    const result = await db.prepare("SELECT slug, data FROM course_overrides").all<{ slug: string; data: string }>();
    const overrides = new Map(result.results.map((row) => [row.slug, parseOverride(row.data)]));
    return (staticCourses as Course[]).map((course) => ({ ...course, ...(overrides.get(course.slug) ?? {}) }));
  } catch (error) {
    console.error("[courses] D1 read failed; using static catalog", error);
    return staticCourses as Course[];
  }
}

export async function getCourse(db: D1Database | undefined, id: number): Promise<Course | null> {
  const courses = await listCourses(db);
  return courses.find((course) => Number(course.id) === id) ?? null;
}

export async function updateCourse(db: D1Database, id: number, patch: Course): Promise<boolean> {
  const base = (staticCourses as Course[]).find((course) => Number(course.id) === id);
  if (!base) return false;

  const current = await getCourse(db, id);
  if (!current) return false;

  const merged: Course = {
    ...current,
    ...patch,
    id: base.id,
    slug: base.slug
  };

  await db.prepare(
    `INSERT INTO course_overrides (id, slug, data, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data, updated_at = datetime('now')`
  ).bind(id, base.slug, JSON.stringify(merged)).run();

  return true;
}

export function validateCoursePatch(input: Course): string[] {
  const errors: string[] = [];
  if (typeof input.title !== "string" || !input.title.trim()) errors.push("عنوان دوره الزامی است.");
  if (typeof input.category !== "string" || !input.category.trim()) errors.push("دسته‌بندی دوره الزامی است.");
  if (!Array.isArray(input.instructors)) errors.push("مدرس دوره باید به‌صورت فهرست انتخاب شود.");
  if (!Array.isArray(input.level)) errors.push("سطح دوره نامعتبر است.");
  if (!Array.isArray(input.ageGroup)) errors.push("گروه سنی دوره نامعتبر است.");
  if (typeof input.featured !== "boolean") errors.push("وضعیت ویژه نامعتبر است.");
  if (typeof input.active !== "boolean") errors.push("وضعیت فعال نامعتبر است.");
  if (!Number.isInteger(Number(input.priority)) || Number(input.priority) < 0) errors.push("اولویت باید یک عدد صحیح صفر یا بیشتر باشد.");
  if (!input.content || typeof input.content !== "object") errors.push("محتوای دوره نامعتبر است.");
  if (!input.seo || typeof input.seo !== "object") errors.push("اطلاعات SEO نامعتبر است.");
  return errors;
}
