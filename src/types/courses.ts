export interface CourseMedia {
  image?: string;
  cover?: string;
  gallery?: string[];
  videos?: string[];
}

export interface CourseContent {
  excerpt: string;
  description: string;
}

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string[];
  robots: string;
  author: string;
  themeColor: string;
}

export interface CourseSEO {
  metadata: SeoMetadata;

  canonical: string;

  openGraph: Record<string, string>;

  twitter: Record<string, string>;

  schemaGraph: unknown;
}

export interface CourseFAQ {
  question: string;
  answer: string;
}

export interface Instructor {
  id: number;

  name: string;

  slug: string;

  position?: string;

  media?: {
    images?: {
      profile?: string;
    };
  };
}

export interface PricingPlan {
  id?: string;

  title?: string;

  price?: number;

  sessions?: number;

  [key: string]: unknown;
}

export interface CourseSeoContent {
  [key: string]: unknown;

  faqAdditions?: CourseFAQ[];
}

export interface Course {
  id: number;

  slug: string;

  title: string;

  featured?: boolean;

  active?: boolean;

  priority?: number;

  instrument: string;

  instructor?: number;

  instructors?: number[];

  level: string[];

  ageGroup: string[];

  category: string;

  classType: string;

  duration?: string;

  media: CourseMedia;

  content: CourseContent;

  seo: CourseSEO;
}

export interface ResolvedCourse {
  id: number;

  slug: string;

  title: string;

  featured?: boolean;

  active?: boolean;

  priority?: number;

  instrument: string;

  instructor?: number;

  instructors: Instructor[];

  level: string[];

  ageGroup: string[];

  category: string;

  classType: string;

  duration?: string;

  media: CourseMedia;

  content: CourseContent;

  seo: CourseSEO;

  plan: PricingPlan | null;

  seoContent: CourseSeoContent | null;

  faqs: CourseFAQ[];

  url: string;
}