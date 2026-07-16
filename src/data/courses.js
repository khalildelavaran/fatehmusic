/**
 * ============================================================
 * Fateh Music Academy
 * courses.js
 * Architecture: FROZEN v1.0
 * ============================================================
 */

export const courses = [

/* ======================================================================
   1. آموزش گیتار
====================================================================== */

{
  id: 1,

  slug: "guitar-course",

  title: "آموزش گیتار",

  featured: true,

  active: true,

  priority: 1,

  instrument: "guitar",

  instructor: 2,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای زهی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image:
      "/images/courses/guitar.webp",

    cover: null,

    gallery: [

    ],

    videos: [

    ]

  },

  content: {

    excerpt:
      "دوره جامع آموزش گیتار از مبتدی تا پیشرفته",

    description:
      "آموزش گیتار کلاسیک، پاپ، فلامنکو - از مقدماتی تا پیشرفته با خلیل دلاوران در آموزشگاه موسیقی فاتح."

  },

  seo: {

    title:
      "آموزش گیتار در شوشتر | آموزشگاه موسیقی فاتح",

    description:
      "ثبت نام کلاس آموزش گیتار در شوشتر با تدریس خلیل دلاوران در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش گیتار شوشتر",

      "کلاس گیتار شوشتر",

      "بهترین آموزشگاه گیتار شوشتر",

      "خلیل دلاوران"

    ]

  }

},

/* ======================================================================
   2. آموزش ویولن
====================================================================== */

{
  id: 2,

  slug: "violin-course",

  title: "آموزش ویولن",

  featured: true,

  active: true,

  priority: 2,

  instrument: "violin",

  instructor: 1,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای آرشه ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image:
      "/images/courses/violin.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt:
      "دوره آموزش ویولن",

    description:
      "آموزش تخصصی ویولن با رضا فاتح در آموزشگاه موسیقی فاتح."

  },

  seo: {

    title:
      "آموزش ویولن در شوشتر",

    description:
      "ثبت نام کلاس آموزش ویولن در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش ویولن شوشتر",

      "کلاس ویولن شوشتر",

      "رضا فاتح"

    ]

  }

},

/* ======================================================================
   3. آموزش کمانچه
====================================================================== */

{
  id: 3,

  slug: "kamancheh-course",

  title: "آموزش کمانچه",

  featured: true,

  active: true,

  priority: 3,

  instrument: "kamancheh",

  instructor: 1,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای آرشه ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image:
      "/images/courses/kamancheh.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt:
      "دوره آموزش کمانچه",

    description:
      "آموزش تخصصی کمانچه با رضا فاتح."

  },

  seo: {

    title:
      "آموزش کمانچه در شوشتر",

    description:
      "ثبت نام کلاس آموزش کمانچه در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش کمانچه شوشتر",

      "رضا فاتح",

      "کلاس کمانچه"

    ]

  }

},
/* ======================================================================
   4. آموزش پیانو
====================================================================== */

{
  id: 4,

  slug: "piano-course",

  title: "آموزش پیانو",

  featured: true,

  active: true,

  priority: 4,

  instrument: "piano",

  instructor: 3,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کلاویه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/piano.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش پیانو",

    description:
      "آموزش پیانو از مبتدی تا پیشرفته با محمدعلی زعفرانی."

  },

  seo: {

    title: "آموزش پیانو در شوشتر",

    description:
      "ثبت نام کلاس آموزش پیانو در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش پیانو شوشتر",

      "کلاس پیانو شوشتر",

      "محمدعلی زعفرانی"

    ]

  }

},

/* ======================================================================
   5. آموزش ارگ و کیبورد
====================================================================== */

{
  id: 5,

  slug: "keyboard-course",

  title: "آموزش ارگ و کیبورد",

  featured: true,

  active: true,

  priority: 5,

  instrument: "keyboard",

  instructor: 3,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کلاویه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/keyboard.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش ارگ و کیبورد",

    description:
      "آموزش ارگ و کیبورد با محمدعلی زعفرانی."

  },

  seo: {

    title: "آموزش ارگ در شوشتر",

    description:
      "ثبت نام کلاس ارگ و کیبورد در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش ارگ شوشتر",

      "آموزش کیبورد شوشتر"

    ]

  }

},

/* ======================================================================
   6. آموزش تار
====================================================================== */

{
  id: 6,

  slug: "tar-course",

  title: "آموزش تار",

  featured: true,

  active: true,

  priority: 6,

  instrument: "tar",

  instructor: 4,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای زهی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/tar.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش تار",

    description:
      "آموزش تخصصی تار با وحید بهمن."

  },

  seo: {

    title: "آموزش تار در شوشتر",

    description:
      "ثبت نام کلاس آموزش تار در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش تار شوشتر",

      "مدرس تار شوشتر",

      "وحید بهمن"

    ]

  }

},

/* ======================================================================
   7. آموزش سه تار
====================================================================== */

{
  id: 7,

  slug: "setar-course",

  title: "آموزش سه تار",

  featured: true,

  active: true,

  priority: 7,

  instrument: "setar",

  instructor: 4,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای زهی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/setar.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش سه تار",

    description:
      "آموزش تخصصی سه تار با وحید بهمن."

  },

  seo: {

    title: "آموزش سه تار در شوشتر",

    description:
      "ثبت نام کلاس سه تار در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش سه تار شوشتر",

      "وحید بهمن"

    ]

  }

},
/* ======================================================================
   8. آموزش سنتور
====================================================================== */

{
  id: 8,

  slug: "santur-course",

  title: "آموزش سنتور",

  featured: true,

  active: true,

  priority: 8,

  instrument: "santur",

  instructor: 5,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای زهی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/santur.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش سنتور",

    description:
      "آموزش تخصصی سنتور از مبتدی تا پیشرفته با بهنام ایروانی."

  },

  seo: {

    title: "آموزش سنتور در شوشتر",

    description:
      "ثبت نام کلاس آموزش سنتور در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش سنتور شوشتر",

      "مدرس سنتور شوشتر",

      "بهنام ایروانی"

    ]

  }

},

/* ======================================================================
   9. آموزش دف
====================================================================== */

{
  id: 9,

  slug: "daf-course",

  title: "آموزش دف",

  featured: true,

  active: true,

  priority: 9,

  instrument: "daf",

  instructor: 6,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کوبه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/daf.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش دف",

    description:
      "آموزش تخصصی دف با مجتبی نژاد صفاری."

  },

  seo: {

    title: "آموزش دف در شوشتر",

    description:
      "ثبت نام کلاس آموزش دف در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش دف شوشتر",

      "مجتبی نژاد صفاری",

      "مدرس دف شوشتر"

    ]

  }

},

/* ======================================================================
   10. آموزش تنبک
====================================================================== */

{
  id: 10,

  slug: "tonbak-course",

  title: "آموزش تنبک",

  featured: true,

  active: true,

  priority: 10,

  instrument: "tonbak",

  instructor: 6,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کوبه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/tonbak.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش تنبک",

    description:
      "آموزش تخصصی تنبک با مجتبی نژاد صفاری."

  },

  seo: {

    title: "آموزش تنبک در شوشتر",

    description:
      "ثبت نام کلاس آموزش تنبک در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش تنبک شوشتر",

      "مدرس تنبک شوشتر",

      "مجتبی نژاد صفاری"

    ]

  }

},
/* ======================================================================
   11. آموزش ضرب تمپو
====================================================================== */

{
  id: 11,

  slug: "zarb-tempo-course",

  title: "آموزش ضرب تمپو",

  featured: true,

  active: true,

  priority: 11,

  instrument: "zarb-tempo",

  instructor: 7,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کوبه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/zarb-tempo.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش ضرب تمپو",

    description:
      "آموزش تخصصی ساز ضرب تمپو در آموزشگاه موسیقی فاتح."

  },

  seo: {

    title: "آموزش ضرب تمپو در شوشتر",

    description:
      "ثبت نام کلاس آموزش ضرب تمپو در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش ضرب تمپو شوشتر",

      "کلاس ضرب تمپو",

      "غلام عباس عباسی"

    ]

  }

},

/* ======================================================================
   12. آموزش نی انبان
====================================================================== */

{
  id: 12,

  slug: "ney-anban-course",

  title: "آموزش نی انبان",

  featured: true,

  active: true,

  priority: 12,

  instrument: "ney-anban",

  instructor: 8,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای بادی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/ney-anban.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش نی انبان",

    description:
      "آموزش تخصصی نی انبان با علیرضا عیدی نژاد."

  },

  seo: {

    title: "آموزش نی انبان در شوشتر",

    description:
      "ثبت نام کلاس نی انبان در آموزشگاه موسیقی فاتح.",

    keywords: [

      "نی انبان شوشتر",

      "آموزش نی انبان",

      "علیرضا عیدی نژاد"

    ]

  }

},

/* ======================================================================
   13. آموزش نی
====================================================================== */

{
  id: 13,

  slug: "ney-course",

  title: "آموزش نی",

  featured: true,

  active: true,

  priority: 13,

  instrument: "ney",

  instructor: 9,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای بادی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/ney.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش نی",

    description:
      "آموزش تخصصی ساز نی با بهرام موسوی."

  },

  seo: {

    title: "آموزش نی در شوشتر",

    description:
      "ثبت نام کلاس نی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش نی شوشتر",

      "مدرس نی شوشتر",

      "بهرام موسوی"

    ]

  }

},
/* ======================================================================
   14. آموزش موسیقی کودک
====================================================================== */

{
  id: 14,

  slug: "children-music-course",

  title: "آموزش موسیقی کودک",

  featured: true,

  active: true,

  priority: 14,

  instrument: "children-music",

  instructor: 10,

  level: [
    "مبتدی"
  ],

  ageGroup: [
    "۳ تا ۷ سال",
    "۷ تا ۱۲ سال"
  ],

  category: "آموزش کودک",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/children-music.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش موسیقی کودک",

    description:
      "آموزش موسیقی کودک همراه با بازی، ریتم، آواز، سازهای آموزشی و پرورش خلاقیت."

  },

  seo: {

    title: "آموزش موسیقی کودک در شوشتر",

    description:
      "ثبت نام کلاس موسیقی کودک در آموزشگاه موسیقی فاتح.",

    keywords: [

      "موسیقی کودک شوشتر",

      "کلاس موسیقی کودک",

      "فرناز کدخدا مرادی"

    ]

  }

},

/* ======================================================================
   15. آموزش هنگ درام
====================================================================== */

{
  id: 15,

  slug: "hangdrum-course",

  title: "آموزش هنگ درام",

  featured: true,

  active: true,

  priority: 15,

  instrument: "hangdrum",

  instructor: 12,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "سازهای کوبه‌ای",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/hangdrum.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش هنگ درام",

    description:
      "آموزش تخصصی هنگ درام از مبتدی تا پیشرفته."

  },

  seo: {

    title: "آموزش هنگ درام در شوشتر",

    description:
      "ثبت نام کلاس هنگ درام در آموزشگاه موسیقی فاتح.",

    keywords: [

      "هنگ درام شوشتر",

      "آموزش هنگ درام",

      "محسن نقیب"

    ]

  }

},

/* ======================================================================
   16. آموزش آواز سنتی
====================================================================== */

{
  id: 16,

  slug: "traditional-vocal-course",

  title: "آموزش آواز سنتی",

  featured: true,

  active: true,

  priority: 16,

  instrument: "voice",

  instructor: 13,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "آواز",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/traditional-vocal.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش آواز سنتی",

    description:
      "آموزش ردیف آوازی، تکنیک‌های خوانندگی و اجرای آواز سنتی ایرانی."

  },

  seo: {

    title: "آموزش آواز سنتی در شوشتر",

    description:
      "ثبت نام کلاس آواز سنتی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آواز سنتی شوشتر",

      "کلاس آواز سنتی",

      "مجید جعفری زاده"

    ]

  }

},
/* ======================================================================
   17. آموزش آواز محلی بختیاری
====================================================================== */

{
  id: 17,

  slug: "bakhtiari-vocal-course",

  title: "آموزش آواز محلی بختیاری",

  featured: true,

  active: true,

  priority: 17,

  instrument: "voice",

  instructor: 13,

  level: [
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "آواز",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/bakhtiari-vocal.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش آواز محلی بختیاری",

    description:
      "آموزش اصول آواز محلی بختیاری، تکنیک‌های اجرایی و شناخت مقام‌ها."

  },

  seo: {

    title: "آموزش آواز بختیاری در شوشتر",

    description:
      "ثبت نام کلاس آواز محلی بختیاری در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آواز بختیاری",

      "آموزش آواز بختیاری",

      "مجید جعفری زاده"

    ]

  }

},

/* ======================================================================
   18. آموزش آواز پاپ
====================================================================== */

{
  id: 18,

  slug: "pop-vocal-course",

  title: "آموزش آواز پاپ",

  featured: true,

  active: true,

  priority: 18,

  instrument: "voice",

  instructor: 14,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "آواز",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/pop-vocal.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش آواز پاپ",

    description:
      "آموزش تکنیک‌های خوانندگی پاپ، تنفس، بیان و اجرای صحنه."

  },

  seo: {

    title: "آموزش آواز پاپ در شوشتر",

    description:
      "ثبت نام کلاس آواز پاپ در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آواز پاپ شوشتر",

      "آموزش آواز پاپ",

      "رضا بشیر"

    ]

  }

},

/* ======================================================================
   19. آموزش آواز محلی شوشتری
====================================================================== */

{
  id: 19,

  slug: "shushtari-vocal-course",

  title: "آموزش آواز محلی شوشتری",

  featured: true,

  active: true,

  priority: 19,

  instrument: "voice",

  instructor: 14,

  level: [
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "آواز",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/shushtari-vocal.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش آواز محلی شوشتری",

    description:
      "آموزش شیوه‌های اصیل آواز محلی شوشتری و اجرای مقام‌های بومی."

  },

  seo: {

    title: "آموزش آواز محلی شوشتری",

    description:
      "ثبت نام کلاس آواز محلی شوشتری در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آواز شوشتری",

      "آواز محلی شوشتر",

      "رضا بشیر"

    ]

  }

},

/* ======================================================================
   20. دوره سلفژ
====================================================================== */

{
  id: 20,

  slug: "solfege-course",

  title: "دوره سلفژ",

  featured: true,

  active: true,

  priority: 20,

  instrument: "theory",

  instructor: 2,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "دروس پایه موسیقی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/solfege.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره آموزش سلفژ",

    description:
      "آموزش کامل سلفژ، دیکته موسیقی، تربیت شنوایی و نت‌خوانی."

  },

  seo: {

    title: "دوره سلفژ در شوشتر",

    description:
      "ثبت نام دوره سلفژ در آموزشگاه موسیقی فاتح.",

    keywords: [

      "سلفژ شوشتر",

      "نت خوانی",

      "خلیل دلاوران"

    ]

  }

},
/* ======================================================================
   21. دوره ریتم و وزن خوانی
====================================================================== */

{
  id: 21,

  slug: "rhythm-reading-course",

  title: "دوره ریتم و وزن خوانی",

  featured: true,

  active: true,

  priority: 21,

  instrument: "theory",

  instructor: 2,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "دروس پایه موسیقی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/rhythm-reading.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره ریتم و وزن خوانی",

    description:
      "آموزش کامل ریتم، وزن‌خوانی، درک میزان‌ها، سکوت‌ها و تمرینات عملی."

  },

  seo: {

    title: "دوره ریتم و وزن خوانی در شوشتر",

    description:
      "ثبت نام دوره ریتم و وزن خوانی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "ریتم خوانی",

      "وزن خوانی",

      "آموزش ریتم شوشتر",

      "خلیل دلاوران"

    ]

  }

},

/* ======================================================================
   22. دوره تئوری موسیقی
====================================================================== */

{
  id: 22,

  slug: "music-theory-course",

  title: "دوره تئوری موسیقی",

  featured: true,

  active: true,

  priority: 22,

  instrument: "theory",

  instructor: 2,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "دروس پایه موسیقی",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/music-theory.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره تئوری موسیقی",

    description:
      "آموزش نت‌خوانی، فواصل، گام‌ها، آکوردها، ریتم، فرم موسیقی و مبانی علمی موسیقی."

  },

  seo: {

    title: "دوره تئوری موسیقی در شوشتر",

    description:
      "ثبت نام دوره تئوری موسیقی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "تئوری موسیقی",

      "آموزش تئوری موسیقی",

      "خلیل دلاوران"

    ]

  }

},

/* ======================================================================
   23. دوره صداسازی
====================================================================== */

{
  id: 23,

  slug: "voice-training-course",

  title: "دوره صداسازی",

  featured: true,

  active: true,

  priority: 23,

  instrument: "voice",

  instructor: 2,

  level: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  category: "آواز",

  classType: "حضوری",

  duration: "آموزش ترمیک",

  media: {

    image: "/images/courses/voice-training.webp",

    cover: null,

    gallery: [],

    videos: []

  },

  content: {

    excerpt: "دوره صداسازی",

    description:
      "آموزش تنفس صحیح، رزونانس، وسعت صدا، کنترل حنجره و تکنیک‌های صداسازی."

  },

  seo: {

    title: "دوره صداسازی در شوشتر",

    description:
      "ثبت نام دوره صداسازی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "صداسازی",

      "آموزش صداسازی",

      "کلاس صداسازی شوشتر",

      "خلیل دلاوران"

    ]

  }

}

];