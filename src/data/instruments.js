/**
 * ============================================================
 * Fateh Music Academy
 * instruments.js
 * Architecture: FROZEN v1.0
 * ============================================================
 */

export const instruments = [

/* ======================================================================
   1. گیتار
====================================================================== */

{
  id: 1,

  slug: "guitar",

  name: "گیتار",

  englishName: "Guitar",

  featured: true,

  active: true,

  priority: 1,

  family: "سازهای زهی",

  icon: "guitar",

  image: "/images/courses/guitar.webp",

  cover: "/images/courses/guitar-cover.webp",

  instructors: [
    2
  ],

  courses: [
    1
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش گیتار کلاسیک، پاپ و مقدماتی",

    description:
      "دوره آموزش گیتار در آموزشگاه موسیقی فاتح شامل آموزش گیتار کلاسیک، پاپ، تکنیک، نت‌خوانی، ریتم، آکورد، سولو و اجرای قطعات می‌باشد."

  },

  media: {

    gallery: [

      "/images/courses/guitar/gallery-01.webp",

      "/images/courses/guitar/gallery-02.webp"

    ],

    videos: [

    ]

  },

  seo: {

    title:
      "آموزش گیتار در شوشتر",

    description:
      "ثبت نام کلاس آموزش گیتار در آموزشگاه موسیقی فاتح با تدریس خلیل دلاوران.",

    keywords: [

      "آموزش گیتار شوشتر",

      "کلاس گیتار شوشتر",

      "گیتار کلاسیک",

      "گیتار پاپ",

      "خلیل دلاوران"

    ]

  }

},

/* ======================================================================
   2. ویولن
====================================================================== */

{
  id: 2,

  slug: "violin",

  name: "ویولن",

  englishName: "Violin",

  featured: true,

  active: true,

  priority: 2,

  family: "سازهای آرشه‌ای",

  icon: "violin",

  image: "/images/courses/violin.webp",

  cover: "/images/courses/violin-cover.webp",

  instructors: [
    1
  ],

  courses: [
    2
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی ویولن",

    description:
      "دوره آموزش ویولن شامل آموزش تکنیک، آرشه‌کشی، نت‌خوانی، اتود و اجرای قطعات کلاسیک و ایرانی است."

  },

  media: {

    gallery: [

      "/images/courses/violin/gallery-01.webp",

      "/images/courses/violin/gallery-02.webp"

    ],

    videos: [

    ]

  },

  seo: {

    title:
      "آموزش ویولن در شوشتر",

    description:
      "ثبت نام کلاس ویولن در آموزشگاه موسیقی فاتح با تدریس رضا فاتح.",

    keywords: [

      "آموزش ویولن شوشتر",

      "ویولن",

      "رضا فاتح"

    ]

  }

},

/* ======================================================================
   3. کمانچه
====================================================================== */

{
  id: 3,

  slug: "kamancheh",

  name: "کمانچه",

  englishName: "Kamancheh",

  featured: true,

  active: true,

  priority: 3,

  family: "سازهای آرشه‌ای",

  icon: "kamancheh",

  image: "/images/courses/kamancheh.webp",

  cover: "/images/courses/kamancheh-cover.webp",

  instructors: [
    1
  ],

  courses: [
    3
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی کمانچه",

    description:
      "آموزش کامل کمانچه از مقدماتی تا پیشرفته همراه با ردیف موسیقی ایرانی."

  },

  media: {

    gallery: [

      "/images/courses/kamancheh/gallery-01.webp",

      "/images/courses/kamancheh/gallery-02.webp"

    ],

    videos: [

    ]

  },

  seo: {

    title:
      "آموزش کمانچه در شوشتر",

    description:
      "ثبت نام کلاس کمانچه در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش کمانچه",

      "کمانچه شوشتر",

      "رضا فاتح"

    ]

  }

},
/* ======================================================================
   4. پیانو
====================================================================== */

{
  id: 4,

  slug: "piano",

  name: "پیانو",

  englishName: "Piano",

  featured: true,

  active: true,

  priority: 4,

  family: "سازهای کلاویه‌ای",

  icon: "piano",

  image: "/images/courses/piano.webp",

  cover: "/images/courses/piano-cover.webp",

  instructors: [
    3
  ],

  courses: [
    4
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش پیانو کلاسیک و پاپ",

    description:
      "آموزش تخصصی پیانو شامل نت‌خوانی، تکنیک، هارمونی، اجرای قطعات کلاسیک و پاپ."

  },

  media: {

    gallery: [

      "/images/courses/piano/gallery-01.webp",

      "/images/courses/piano/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش پیانو در شوشتر",

    description:
      "ثبت نام کلاس پیانو در آموزشگاه موسیقی فاتح.",

    keywords: [

      "پیانو",

      "آموزش پیانو شوشتر",

      "محمدعلی زعفرانی"

    ]

  }

},

/* ======================================================================
   5. ارگ و کیبورد
====================================================================== */

{
  id: 5,

  slug: "keyboard",

  name: "ارگ و کیبورد",

  englishName: "Keyboard",

  featured: true,

  active: true,

  priority: 5,

  family: "سازهای کلاویه‌ای",

  icon: "keyboard",

  image: "/images/courses/keyboard.webp",

  cover: "/images/courses/keyboard-cover.webp",

  instructors: [
    3
  ],

  courses: [
    5
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش ارگ و کیبورد",

    description:
      "آموزش ارگ و کیبورد از پایه تا پیشرفته همراه با اجرای قطعات، آکوردشناسی و ریتم."

  },

  media: {

    gallery: [

      "/images/courses/keyboard/gallery-01.webp",

      "/images/courses/keyboard/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش ارگ در شوشتر",

    description:
      "ثبت نام کلاس ارگ و کیبورد در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش ارگ",

      "آموزش کیبورد",

      "محمدعلی زعفرانی"

    ]

  }

},

/* ======================================================================
   6. تار
====================================================================== */

{
  id: 6,

  slug: "tar",

  name: "تار",

  englishName: "Tar",

  featured: true,

  active: true,

  priority: 6,

  family: "سازهای زهی",

  icon: "tar",

  image: "/images/courses/tar.webp",

  cover: "/images/courses/tar-cover.webp",

  instructors: [
    4
  ],

  courses: [
    6
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی تار",

    description:
      "آموزش تار ایرانی از مقدماتی تا پیشرفته شامل ردیف، تکنیک و اجرای قطعات."

  },

  media: {

    gallery: [

      "/images/courses/tar/gallery-01.webp",

      "/images/courses/tar/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش تار در شوشتر",

    description:
      "ثبت نام کلاس تار در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آموزش تار",

      "تار شوشتر",

      "وحید بهمن"

    ]

  }

},
/* ======================================================================
   7. سه تار
====================================================================== */

{
  id: 7,

  slug: "setar",

  name: "سه تار",

  englishName: "Setar",

  featured: true,

  active: true,

  priority: 7,

  family: "سازهای زهی",

  icon: "setar",

  image: "/images/courses/setar.webp",

  cover: "/images/courses/setar-cover.webp",

  instructors: [
    4
  ],

  courses: [
    7
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی سه تار",

    description:
      "آموزش سه تار ایرانی از مقدماتی تا پیشرفته شامل ردیف، تکنیک، بداهه‌نوازی و اجرای قطعات."

  },

  media: {

    gallery: [

      "/images/courses/setar/gallery-01.webp",

      "/images/courses/setar/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش سه تار در شوشتر",

    description:
      "ثبت نام کلاس سه تار در آموزشگاه موسیقی فاتح.",

    keywords: [

      "سه تار",

      "آموزش سه تار شوشتر",

      "وحید بهمن"

    ]

  }

},

/* ======================================================================
   8. سنتور
====================================================================== */

{
  id: 8,

  slug: "santur",

  name: "سنتور",

  englishName: "Santur",

  featured: true,

  active: true,

  priority: 8,

  family: "سازهای زهی",

  icon: "santur",

  image: "/images/courses/santur.webp",

  cover: "/images/courses/santur-cover.webp",

  instructors: [
    5
  ],

  courses: [
    8
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی سنتور",

    description:
      "آموزش سنتور ایرانی همراه با تکنیک، ردیف، مضراب‌گذاری و اجرای قطعات."

  },

  media: {

    gallery: [

      "/images/courses/santur/gallery-01.webp",

      "/images/courses/santur/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش سنتور در شوشتر",

    description:
      "ثبت نام کلاس سنتور در آموزشگاه موسیقی فاتح.",

    keywords: [

      "سنتور",

      "آموزش سنتور شوشتر",

      "بهنام ایروانی"

    ]

  }

},

/* ======================================================================
   9. دف
====================================================================== */

{
  id: 9,

  slug: "daf",

  name: "دف",

  englishName: "Daf",

  featured: true,

  active: true,

  priority: 9,

  family: "سازهای کوبه‌ای",

  icon: "daf",

  image: "/images/courses/daf.webp",

  cover: "/images/courses/daf-cover.webp",

  instructors: [
    6
  ],

  courses: [
    9
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی دف",

    description:
      "آموزش دف از پایه تا پیشرفته شامل ریتم، تکنیک و اجرای گروه‌نوازی."

  },

  media: {

    gallery: [

      "/images/courses/daf/gallery-01.webp",

      "/images/courses/daf/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش دف در شوشتر",

    description:
      "ثبت نام کلاس دف در آموزشگاه موسیقی فاتح.",

    keywords: [

      "دف",

      "آموزش دف شوشتر",

      "مجتبی نژاد صفاری"

    ]

  }

},
/* ======================================================================
   10. تنبک
====================================================================== */

{
  id: 10,

  slug: "tonbak",

  name: "تنبک",

  englishName: "Tonbak",

  featured: true,

  active: true,

  priority: 10,

  family: "سازهای کوبه‌ای",

  icon: "tonbak",

  image: "/images/courses/tonbak.webp",

  cover: "/images/courses/tonbak-cover.webp",

  instructors: [
    6,
    11
  ],

  courses: [
    10
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی تنبک",

    description:
      "آموزش تنبک از مقدماتی تا پیشرفته شامل تکنیک‌های نوازندگی، ریتم، همنوازی و اجرای صحنه."

  },

  media: {

    gallery: [

      "/images/courses/tonbak/gallery-01.webp",

      "/images/courses/tonbak/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش تنبک در شوشتر",

    description:
      "ثبت نام کلاس تنبک در آموزشگاه موسیقی فاتح.",

    keywords: [

      "تنبک",

      "آموزش تنبک شوشتر",

      "مجتبی نژاد صفاری",

      "نرگس فاتح"

    ]

  }

},

/* ======================================================================
   11. ضرب تمپو
====================================================================== */

{
  id: 11,

  slug: "zarb-tempo",

  name: "ضرب تمپو",

  englishName: "Tempo Drum",

  featured: false,

  active: true,

  priority: 11,

  family: "سازهای کوبه‌ای",

  icon: "drum",

  image: "/images/courses/zarb-tempo.webp",

  cover: "/images/courses/zarb-tempo-cover.webp",

  instructors: [
    7
  ],

  courses: [
    11
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "کودک",
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش ضرب تمپو",

    description:
      "آموزش ساز ضرب تمپو همراه با آموزش ریتم، هماهنگی دست‌ها و اجرای قطعات."

  },

  media: {

    gallery: [

      "/images/courses/zarb-tempo/gallery-01.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش ضرب تمپو در شوشتر",

    description:
      "ثبت نام کلاس ضرب تمپو در آموزشگاه موسیقی فاتح.",

    keywords: [

      "ضرب تمپو",

      "آموزش ضرب تمپو",

      "غلام عباس عباسی"

    ]

  }

},

/* ======================================================================
   12. نی انبان
====================================================================== */

{
  id: 12,

  slug: "ney-anban",

  name: "نی انبان",

  englishName: "Ney Anban",

  featured: true,

  active: true,

  priority: 12,

  family: "سازهای بادی",

  icon: "wind",

  image: "/images/courses/ney-anban.webp",

  cover: "/images/courses/ney-anban-cover.webp",

  instructors: [
    8
  ],

  courses: [
    12
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی نی انبان",

    description:
      "آموزش ساز نی انبان از پایه تا اجرای قطعات محلی جنوب ایران."

  },

  media: {

    gallery: [

      "/images/courses/ney-anban/gallery-01.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش نی انبان در شوشتر",

    description:
      "ثبت نام کلاس نی انبان در آموزشگاه موسیقی فاتح.",

    keywords: [

      "نی انبان",

      "آموزش نی انبان",

      "علیرضا عیدی نژاد"

    ]

  }

},
/* ======================================================================
   13. نی
====================================================================== */

{
  id: 13,

  slug: "ney",

  name: "نی",

  englishName: "Ney",

  featured: true,

  active: true,

  priority: 13,

  family: "سازهای بادی",

  icon: "ney",

  image: "/images/courses/ney.webp",

  cover: "/images/courses/ney-cover.webp",

  instructors: [
    9
  ],

  courses: [
    13
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی نی",

    description:
      "آموزش ساز نی ایرانی از پایه تا پیشرفته شامل تکنیک نفس، صداسازی و اجرای ردیف."

  },

  media: {

    gallery: [

      "/images/courses/ney/gallery-01.webp",

      "/images/courses/ney/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش نی در شوشتر",

    description:
      "ثبت نام کلاس آموزش نی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "نی",

      "آموزش نی شوشتر",

      "بهرام موسوی"

    ]

  }

},

/* ======================================================================
   14. هنگ درام
====================================================================== */

{
  id: 14,

  slug: "hangdrum",

  name: "هنگ درام",

  englishName: "Handpan",

  featured: true,

  active: true,

  priority: 14,

  family: "سازهای کوبه‌ای",

  icon: "handpan",

  image: "/images/courses/hangdrum.webp",

  cover: "/images/courses/hangdrum-cover.webp",

  instructors: [
    12
  ],

  courses: [
    15
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش تخصصی هنگ درام",

    description:
      "آموزش هنگ درام از پایه تا پیشرفته همراه با تکنیک‌های اجرا، ریتم و بداهه‌نوازی."

  },

  media: {

    gallery: [

      "/images/courses/hangdrum/gallery-01.webp",

      "/images/courses/hangdrum/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش هنگ درام در شوشتر",

    description:
      "ثبت نام کلاس هنگ درام در آموزشگاه موسیقی فاتح.",

    keywords: [

      "هنگ درام",

      "هندپن",

      "آموزش هنگ درام شوشتر",

      "محسن نقیب"

    ]

  }

},

/* ======================================================================
   15. آواز
====================================================================== */

{
  id: 15,

  slug: "voice",

  name: "آواز",

  englishName: "Voice",

  featured: true,

  active: true,

  priority: 15,

  family: "آواز",

  icon: "microphone",

  image: "/images/courses/voice.webp",

  cover: "/images/courses/voice-cover.webp",

  instructors: [
    13,
    14
  ],

  courses: [
    16,
    17,
    18,
    19,
    23
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "آموزش انواع آواز سنتی، پاپ و محلی",

    description:
      "دوره‌های تخصصی آواز سنتی، پاپ، محلی شوشتری، محلی بختیاری و صداسازی."

  },

  media: {

    gallery: [

      "/images/courses/voice/gallery-01.webp",

      "/images/courses/voice/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش آواز در شوشتر",

    description:
      "ثبت نام کلاس آواز و صداسازی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "آواز",

      "آموزش آواز شوشتر",

      "صداسازی",

      "رضا بشیر",

      "مجید جعفری زاده",

      "خلیل دلاوران"

    ]

  }

},
/* ======================================================================
   16. موسیقی کودک
====================================================================== */

{
  id: 16,

  slug: "children-music",

  name: "موسیقی کودک",

  englishName: "Children Music",

  featured: true,

  active: true,

  priority: 16,

  family: "آموزش کودک",

  icon: "children",

  image: "/images/courses/children-music.webp",

  cover: "/images/courses/children-music-cover.webp",

  instructors: [
    10
  ],

  courses: [
    14
  ],

  levels: [
    "پیش دبستانی",
    "دبستان"
  ],

  ageGroup: [
    "۳ تا ۷ سال",
    "۷ تا ۱۲ سال"
  ],

  content: {

    excerpt:
      "آموزش موسیقی کودک همراه با بازی و خلاقیت",

    description:
      "دوره موسیقی کودک با هدف افزایش هوش موسیقایی، ریتم، خلاقیت، اعتماد به نفس، هماهنگی حرکتی و آمادگی ورود به ساز تخصصی."

  },

  media: {

    gallery: [

      "/images/courses/children-music/gallery-01.webp",

      "/images/courses/children-music/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "آموزش موسیقی کودک در شوشتر",

    description:
      "ثبت نام کلاس موسیقی کودک در آموزشگاه موسیقی فاتح.",

    keywords: [

      "موسیقی کودک",

      "کلاس موسیقی کودک شوشتر",

      "ارف شوشتر",

      "فرناز کدخدا مرادی"

    ]

  }

},

/* ======================================================================
   17. دروس پایه موسیقی
====================================================================== */

{
  id: 17,

  slug: "music-theory",

  name: "دروس پایه موسیقی",

  englishName: "Music Theory",

  featured: true,

  active: true,

  priority: 17,

  family: "آموزش تئوری",

  icon: "theory",

  image: "/images/courses/music-theory.webp",

  cover: "/images/courses/music-theory-cover.webp",

  instructors: [
    2
  ],

  courses: [
    20,
    21,
    22
  ],

  levels: [
    "مبتدی",
    "متوسط",
    "پیشرفته"
  ],

  ageGroup: [
    "نوجوان",
    "بزرگسال"
  ],

  content: {

    excerpt:
      "سلفژ، تئوری موسیقی و ریتم خوانی",

    description:
      "دروس پایه موسیقی شامل سلفژ، نت خوانی، تربیت شنوایی، ریتم و وزن خوانی، تئوری موسیقی و مبانی علمی موسیقی."

  },

  media: {

    gallery: [

      "/images/courses/music-theory/gallery-01.webp",

      "/images/courses/music-theory/gallery-02.webp"

    ],

    videos: []

  },

  seo: {

    title:
      "دروس پایه موسیقی در شوشتر",

    description:
      "ثبت نام دوره سلفژ، تئوری موسیقی و ریتم خوانی در آموزشگاه موسیقی فاتح.",

    keywords: [

      "سلفژ",

      "تئوری موسیقی",

      "ریتم خوانی",

      "نت خوانی",

      "خلیل دلاوران"

    ]

  }

}

];