import { env } from "cloudflare:workers";

export interface BlogPost {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  topic: string;
  related_course_slug?: string | null;
  related_course_title?: string | null;
  status: "draft" | "published";
  meta_title?: string | null;
  meta_description?: string | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
}

export const fallbackBlogPosts: BlogPost[] = [
  {
    slug: "how-to-choose-music-course-in-shushtar",
    title: "چطور دوره مناسب آموزش موسیقی در شوشتر را انتخاب کنیم؟",
    excerpt: "راهنمای کوتاه آموزشگاه موسیقی فاتح برای انتخاب ساز، استاد و مسیر یادگیری مناسب در شوشتر.",
    content:
      "انتخاب دوره موسیقی بهتر است با علاقه هنرجو، سن، زمان تمرین و هدف آموزشی شروع شود. در آموزشگاه موسیقی فاتح شوشتر، مسیر یادگیری برای سازهایی مثل گیتار، پیانو، ویولن، دف و آواز به‌صورت مرحله‌ای بررسی می‌شود تا هنرجو از ابتدا مسیر روشن‌تری داشته باشد. اگر هنوز ساز مناسب خود را انتخاب نکرده‌اید، مشاوره ثبت‌نام کمک می‌کند بین دوره‌های سازی، آواز، سلفژ و موسیقی کودک انتخاب دقیق‌تری داشته باشید.",
    topic: "راهنمای آموزش موسیقی",
    related_course_slug: "music-theory-course",
    related_course_title: "تئوری موسیقی",
    status: "published",
    published_at: "2026-08-03 00:00:00"
  }
];

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const db = env.DB;

  if (!db) {
    return fallbackBlogPosts;
  }

  try {
    const result = await db
      .prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC")
      .all<BlogPost>();

    return result.results.length ? result.results : fallbackBlogPosts;
  } catch {
    return fallbackBlogPosts;
  }
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  const db = env.DB;

  if (!db) {
    return fallbackBlogPosts.find((post) => post.slug === slug) ?? null;
  }

  try {
    const post = await db
      .prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' LIMIT 1")
      .bind(slug)
      .first<BlogPost>();

    return post ?? fallbackBlogPosts.find((item) => item.slug === slug) ?? null;
  } catch {
    return fallbackBlogPosts.find((post) => post.slug === slug) ?? null;
  }
}