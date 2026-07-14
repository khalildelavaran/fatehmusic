/**
 * ============================================================
 * Fateh Music Academy
 * instructors.js
 * Architecture: FROZEN v1.0
 * ============================================================
 */

export const instructors = [

/* ======================================================================
   1. رضا فاتح
====================================================================== */

{
  id: 1,

  slug: "reza-fateh",

  name: "رضا فاتح",

  featured: true,

  active: true,

  priority: 1,

  position: "مدیر آموزشگاه موسیقی فاتح",

  identity: {
    firstName: "رضا",
    lastName: "فاتح",
    schemaId: "instructor-reza-fateh"
  },

  professional: {
    roles: [
      "مدیر آموزشگاه",
      "مدرس ویولن",
      "مدرس کمانچه"
    ],
    education: "مدرس موسیقی",
    experienceYears: 20
  },

  media: {
    images: {
      profile: "/images/instructors/reza-fateh/profile.webp",
      cover: "/images/instructors/reza-fateh/cover.webp",
      gallery: [
        "/images/instructors/reza-fateh/gallery-01.webp",
        "/images/instructors/reza-fateh/gallery-02.webp",
        "/images/instructors/reza-fateh/gallery-03.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@reza.fateh.shushtar",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "violin-course",
      "kamancheh-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدیر آموزشگاه و مدرس ویولن و کمانچه",
    biography:
      "رضا فاتح مدیر آموزشگاه موسیقی فاتح و مدرس تخصصی ویولن و کمانچه در شوشتر است."
  },

  seo: {
    title: "رضا فاتح | مدیر آموزشگاه موسیقی فاتح",
    description:
      "رضا فاتح مدیر آموزشگاه موسیقی فاتح و مدرس تخصصی ویولن و کمانچه در شوشتر.",
    keywords: [
      "رضا فاتح",
      "مدرس ویولن شوشتر",
      "مدرس کمانچه شوشتر",
      "آموزش ویولن شوشتر",
      "آموزش کمانچه شوشتر"
    ]
  }

},

/* ======================================================================
   2. خلیل دلاوران
====================================================================== */

{
  id: 2,

  slug: "khalil-delavaran",

  name: "خلیل دلاوران",

  featured: true,

  active: true,

  priority: 2,

  position: "مدرس گیتار و دروس پایه موسیقی",

  identity: {
    firstName: "خلیل",
    lastName: "دلاوران",
    schemaId: "instructor-khalil-delavaran"
  },

  professional: {
    roles: [
      "مدرس گیتار",
      "مدرس سلفژ",
      "مدرس تئوری موسیقی",
      "مدرس ریتم و وزن خوانی",
      "مدرس صداسازی"
    ],
    education: "کارشناس ارشد علوم کامپیوتر - گرایش هوش مصنوعی",
    experienceYears: 20
  },

  media: {
    images: {
      profile: "/images/instructors/khalil-delavaran/profile.webp",
      cover: "/images/instructors/khalil-delavaran/cover.webp",
      gallery: [
        "/images/instructors/khalil-delavaran/gallery-01.webp",
        "/images/instructors/khalil-delavaran/gallery-02.webp",
        "/images/instructors/khalil-delavaran/gallery-03.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@khalildelavaran",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "guitar-course",
      "solfege-course",
      "music-theory-course",
      "rhythm-reading-course",
      "voice-training-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt:
      "مدرس گیتار، سلفژ، تئوری موسیقی، ریتم و وزن خوانی و صداسازی",
    biography:
      "خلیل دلاوران مدرس گیتار و دروس پایه موسیقی در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "خلیل دلاوران | بهترین مدرس گیتار در شوشتر",
    description:
      "خلیل دلاوران مدرس گیتار، سلفژ، تئوری موسیقی، ریتم و وزن خوانی و صداسازی.",
    keywords: [
      "خلیل دلاوران",
      "بهترین معلم گیتار در شوشتر",
      "بهترین مدرس گیتار شوشتر",
      "آموزش گیتار شوشتر",
      "سلفژ شوشتر",
      "تئوری موسیقی شوشتر",
      "صداسازی شوشتر"
    ]
  }

},

/* ======================================================================
   3. محمدعلی زعفرانی
====================================================================== */

{
  id: 3,

  slug: "mohammadali-zafarani",

  name: "محمدعلی زعفرانی",

  featured: true,

  active: true,

  priority: 3,

  position: "مدرس پیانو، ارگ و کیبورد",

  identity: {
    firstName: "محمدعلی",
    lastName: "زعفرانی",
    schemaId: "instructor-mohammadali-zafarani"
  },

  professional: {
    roles: [
      "مدرس پیانو",
      "مدرس ارگ",
      "مدرس کیبورد"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/mohammadali-zafarani/profile.webp",
      cover: "/images/instructors/mohammadali-zafarani/cover.webp",
      gallery: [
        "/images/instructors/mohammadali-zafarani/gallery-01.webp",
        "/images/instructors/mohammadali-zafarani/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@zafarani.ali.4",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "piano-course",
      "keyboard-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس پیانو، ارگ و کیبورد",
    biography:
      "محمدعلی زعفرانی مدرس پیانو، ارگ و کیبورد در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "محمدعلی زعفرانی | مدرس پیانو در شوشتر",
    description:
      "محمدعلی زعفرانی مدرس پیانو، ارگ و کیبورد در آموزشگاه موسیقی فاتح.",
    keywords: [
      "محمدعلی زعفرانی",
      "مدرس پیانو شوشتر",
      "آموزش پیانو شوشتر",
      "آموزش ارگ شوشتر",
      "آموزش کیبورد شوشتر"
    ]
  }

},

/* ======================================================================
   4. وحید بهمن
====================================================================== */

{
  id: 4,

  slug: "vahid-bahman",

  name: "وحید بهمن",

  featured: true,

  active: true,

  priority: 4,

  position: "مدرس تار و سه تار",

  identity: {
    firstName: "وحید",
    lastName: "بهمن",
    schemaId: "instructor-vahid-bahman"
  },

  professional: {
    roles: [
      "مدرس تار",
      "مدرس سه تار"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/vahid-bahman/profile.webp",
      cover: "/images/instructors/vahid-bahman/cover.webp",
      gallery: [
        "/images/instructors/vahid-bahman/gallery-01.webp",
        "/images/instructors/vahid-bahman/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@vahidbahmann",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "tar-course",
      "setar-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس تار و سه تار",
    biography:
      "وحید بهمن مدرس تار و سه تار در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "وحید بهمن | مدرس تار و سه تار در شوشتر",
    description:
      "وحید بهمن مدرس تار و سه تار در آموزشگاه موسیقی فاتح.",
    keywords: [
      "وحید بهمن",
      "مدرس تار شوشتر",
      "مدرس سه تار شوشتر",
      "آموزش تار شوشتر",
      "آموزش سه تار شوشتر"
    ]
  }

},
/* ======================================================================
   5. بهنام ایروانی
====================================================================== */

{
  id: 5,

  slug: "behnam-iravani",

  name: "بهنام ایروانی",

  featured: true,

  active: true,

  priority: 5,

  position: "مدرس سنتور",

  identity: {
    firstName: "بهنام",
    lastName: "ایروانی",
    schemaId: "instructor-behnam-iravani"
  },

  professional: {
    roles: [
      "مدرس سنتور"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/behnam-iravani/profile.webp",
      cover: "/images/instructors/behnam-iravani/cover.webp",
      gallery: [
        "/images/instructors/behnam-iravani/gallery-01.webp",
        "/images/instructors/behnam-iravani/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@behnam_iravani",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "santur-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس سنتور",
    biography:
      "بهنام ایروانی مدرس سنتور در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "بهنام ایروانی | مدرس سنتور در شوشتر",
    description:
      "بهنام ایروانی مدرس سنتور در آموزشگاه موسیقی فاتح.",
    keywords: [
      "بهنام ایروانی",
      "مدرس سنتور شوشتر",
      "آموزش سنتور شوشتر"
    ]
  }

},

/* ======================================================================
   6. مجتبی نژاد صفاری
====================================================================== */

{
  id: 6,

  slug: "mojtaba-nejadsafari",

  name: "مجتبی نژاد صفاری",

  featured: true,

  active: true,

  priority: 6,

  position: "مدرس دف و تنبک",

  identity: {
    firstName: "مجتبی",
    lastName: "نژاد صفاری",
    schemaId: "instructor-mojtaba-nejadsafari"
  },

  professional: {
    roles: [
      "مدرس دف",
      "مدرس تنبک"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/mojtaba-nejadsafari/profile.webp",
      cover: "/images/instructors/mojtaba-nejadsafari/cover.webp",
      gallery: [
        "/images/instructors/mojtaba-nejadsafari/gallery-01.webp",
        "/images/instructors/mojtaba-nejadsafari/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@khaneh_daf_tonbak",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "daf-course",
      "tonbak-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس دف و تنبک",
    biography:
      "مجتبی نژاد صفاری مدرس دف و تنبک در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "مجتبی نژاد صفاری | مدرس دف و تنبک در شوشتر",
    description:
      "مجتبی نژاد صفاری مدرس دف و تنبک در آموزشگاه موسیقی فاتح.",
    keywords: [
      "مجتبی نژاد صفاری",
      "مدرس دف شوشتر",
      "مدرس تنبک شوشتر",
      "آموزش دف شوشتر",
      "آموزش تنبک شوشتر"
    ]
  }

},
/* ======================================================================
   7. غلام عباس عباسی
====================================================================== */

{
  id: 7,

  slug: "gholamabbas-abbasi",

  name: "غلام عباس عباسی",

  featured: true,

  active: true,

  priority: 7,

  position: "مدرس ضرب تمپو",

  identity: {
    firstName: "غلام عباس",
    lastName: "عباسی",
    schemaId: "instructor-gholamabbas-abbasi"
  },

  professional: {
    roles: [
      "مدرس ضرب تمپو"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/gholamabbas-abbasi/profile.webp",
      cover: "/images/instructors/gholamabbas-abbasi/cover.webp",
      gallery: [
        "/images/instructors/gholamabbas-abbasi/gallery-01.webp",
        "/images/instructors/gholamabbas-abbasi/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "zarb-tempo-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس ضرب تمپو",
    biography:
      "غلام عباس عباسی مدرس ساز ضرب تمپو در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "غلام عباس عباسی | مدرس ضرب تمپو در شوشتر",
    description:
      "غلام عباس عباسی مدرس ساز ضرب تمپو در آموزشگاه موسیقی فاتح.",
    keywords: [
      "غلام عباس عباسی",
      "ضرب تمپو",
      "مدرس ضرب تمپو شوشتر",
      "آموزش ضرب تمپو شوشتر"
    ]
  }

},

/* ======================================================================
   8. علیرضا عیدی نژاد
====================================================================== */

{
  id: 8,

  slug: "alireza-eydi-nejad",

  name: "علیرضا عیدی نژاد",

  featured: true,

  active: true,

  priority: 8,

  position: "مدرس نی انبان",

  identity: {
    firstName: "علیرضا",
    lastName: "عیدی نژاد",
    schemaId: "instructor-alireza-eydi-nejad"
  },

  professional: {
    roles: [
      "مدرس نی انبان"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/alireza-eydi-nejad/profile.webp",
      cover: "/images/instructors/alireza-eydi-nejad/cover.webp",
      gallery: [
        "/images/instructors/alireza-eydi-nejad/gallery-01.webp",
        "/images/instructors/alireza-eydi-nejad/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@ali__eydi.nejad",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "ney-anban-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس نی انبان",
    biography:
      "علیرضا عیدی نژاد مدرس ساز نی انبان در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "علیرضا عیدی نژاد | مدرس نی انبان در شوشتر",
    description:
      "علیرضا عیدی نژاد مدرس نی انبان در آموزشگاه موسیقی فاتح.",
    keywords: [
      "علیرضا عیدی نژاد",
      "مدرس نی انبان شوشتر",
      "آموزش نی انبان شوشتر",
      "نی انبان شوشتر"
    ]
  }

},
/* ======================================================================
   9. بهرام موسوی
====================================================================== */

{
  id: 9,

  slug: "bahram-mousavi",

  name: "بهرام موسوی",

  featured: true,

  active: true,

  priority: 9,

  position: "مدرس نی",

  identity: {
    firstName: "بهرام",
    lastName: "موسوی",
    schemaId: "instructor-bahram-mousavi"
  },

  professional: {
    roles: [
      "مدرس نی"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/bahram-mousavi/profile.webp",
      cover: "/images/instructors/bahram-mousavi/cover.webp",
      gallery: [
        "/images/instructors/bahram-mousavi/gallery-01.webp",
        "/images/instructors/bahram-mousavi/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "ney-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس نی",
    biography:
      "بهرام موسوی مدرس ساز نی در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "بهرام موسوی | مدرس نی در شوشتر",
    description:
      "بهرام موسوی مدرس ساز نی در آموزشگاه موسیقی فاتح.",
    keywords: [
      "بهرام موسوی",
      "مدرس نی شوشتر",
      "آموزش نی شوشتر"
    ]
  }

},

/* ======================================================================
   10. فرناز کدخدا مرادی
====================================================================== */

{
  id: 10,

  slug: "farnaz-kadkhoda-moradi",

  name: "فرناز کدخدا مرادی",

  featured: true,

  active: true,

  priority: 10,

  position: "مدرس موسیقی کودک",

  identity: {
    firstName: "فرناز",
    lastName: "کدخدا مرادی",
    schemaId: "instructor-farnaz-kadkhoda-moradi"
  },

  professional: {
    roles: [
      "مدرس موسیقی کودک"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/farnaz-kadkhoda-moradi/profile.webp",
      cover: "/images/instructors/farnaz-kadkhoda-moradi/cover.webp",
      gallery: [
        "/images/instructors/farnaz-kadkhoda-moradi/gallery-01.webp",
        "/images/instructors/farnaz-kadkhoda-moradi/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@malakeviolon68",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "children-music-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس موسیقی کودک",
    biography:
      "فرناز کدخدا مرادی مدرس تخصصی موسیقی کودک در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "فرناز کدخدا مرادی | مدرس موسیقی کودک در شوشتر",
    description:
      "فرناز کدخدا مرادی مدرس موسیقی کودک در آموزشگاه موسیقی فاتح.",
    keywords: [
      "فرناز کدخدا مرادی",
      "موسیقی کودک شوشتر",
      "آموزش موسیقی کودک شوشتر",
      "کلاس موسیقی کودک شوشتر"
    ]
  }

},

/* ======================================================================
   11. نرگس فاتح
====================================================================== */

{
  id: 11,

  slug: "narges-fateh",

  name: "نرگس فاتح",

  featured: true,

  active: true,

  priority: 11,

  position: "مدرس تنبک",

  identity: {
    firstName: "نرگس",
    lastName: "فاتح",
    schemaId: "instructor-narges-fateh"
  },

  professional: {
    roles: [
      "مدرس تنبک"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/narges-fateh/profile.webp",
      cover: "/images/instructors/narges-fateh/cover.webp",
      gallery: [
        "/images/instructors/narges-fateh/gallery-01.webp",
        "/images/instructors/narges-fateh/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@nargesfateh8",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "tonbak-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس تنبک",
    biography:
      "نرگس فاتح مدرس تنبک در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "نرگس فاتح | مدرس تنبک در شوشتر",
    description:
      "نرگس فاتح مدرس تنبک در آموزشگاه موسیقی فاتح.",
    keywords: [
      "نرگس فاتح",
      "مدرس تنبک شوشتر",
      "آموزش تنبک شوشتر"
    ]
  }

},
/* ======================================================================
   12. محسن نقیب
====================================================================== */

{
  id: 12,

  slug: "mohsen-naghib",

  name: "محسن نقیب",

  featured: true,

  active: true,

  priority: 12,

  position: "مدرس هنگ درام",

  identity: {
    firstName: "محسن",
    lastName: "نقیب",
    schemaId: "instructor-mohsen-naghib"
  },

  professional: {
    roles: [
      "مدرس هنگ درام"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/mohsen-naghib/profile.webp",
      cover: "/images/instructors/mohsen-naghib/cover.webp",
      gallery: [
        "/images/instructors/mohsen-naghib/gallery-01.webp",
        "/images/instructors/mohsen-naghib/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@naghib_mohsen_smn",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "hangdrum-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس هنگ درام",
    biography:
      "محسن نقیب مدرس تخصصی هنگ درام در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "محسن نقیب | مدرس هنگ درام در شوشتر",
    description:
      "محسن نقیب مدرس هنگ درام در آموزشگاه موسیقی فاتح.",
    keywords: [
      "محسن نقیب",
      "هنگ درام شوشتر",
      "آموزش هنگ درام شوشتر"
    ]
  }

},

/* ======================================================================
   13. مجید جعفری زاده
====================================================================== */

{
  id: 13,

  slug: "majid-jafarizade",

  name: "مجید جعفری زاده",

  featured: true,

  active: true,

  priority: 13,

  position: "مدرس آواز سنتی و آواز محلی بختیاری",

  identity: {
    firstName: "مجید",
    lastName: "جعفری زاده",
    schemaId: "instructor-majid-jafarizade"
  },

  professional: {
    roles: [
      "مدرس آواز سنتی",
      "مدرس آواز محلی بختیاری"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/majid-jafarizade/profile.webp",
      cover: "/images/instructors/majid-jafarizade/cover.webp",
      gallery: [
        "/images/instructors/majid-jafarizade/gallery-01.webp",
        "/images/instructors/majid-jafarizade/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "traditional-vocal-course",
      "bakhtiari-vocal-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس آواز سنتی و محلی بختیاری",
    biography:
      "مجید جعفری زاده مدرس آواز سنتی ایرانی و آواز محلی بختیاری در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "مجید جعفری زاده | مدرس آواز سنتی در شوشتر",
    description:
      "مجید جعفری زاده مدرس آواز سنتی و آواز محلی بختیاری.",
    keywords: [
      "مجید جعفری زاده",
      "مدرس آواز سنتی شوشتر",
      "آواز بختیاری شوشتر"
    ]
  }

},

/* ======================================================================
   14. رضا بشیرزاده متولی
====================================================================== */

{
  id: 14,

  slug: "reza-bashir",

  name: "رضا بشیرزاده متولی",

  featured: true,

  active: true,

  priority: 14,

  position: "مدرس آواز سنتی، پاپ و محلی شوشتری",

  identity: {
    firstName: "رضا",
    lastName: "بشیرزاده متولی",
    schemaId: "instructor-reza-bashir"
  },

  professional: {
    roles: [
      "مدرس آواز سنتی",
      "مدرس آواز پاپ",
      "مدرس آواز محلی شوشتری"
    ],
    education: "مدرس موسیقی",
    experienceYears: null
  },

  media: {
    images: {
      profile: "/images/instructors/reza-bashir/profile.webp",
      cover: "/images/instructors/reza-bashir/cover.webp",
      gallery: [
        "/images/instructors/reza-bashir/gallery-01.webp",
        "/images/instructors/reza-bashir/gallery-02.webp"
      ]
    },
    videos: [],
    performances: [],
    interviews: []
  },

  social: {
    instagram: "@reza.bashiir",
    telegram: "",
    whatsapp: "",
    youtube: "",
    aparat: "",
    website: ""
  },

  metrics: {
    students: null,
    concerts: null,
    awards: null
  },

  relations: {
    courses: [
      "traditional-vocal-course",
      "pop-vocal-course",
      "shushtari-vocal-course"
    ],
    articles: [],
    faqs: [],
    testimonials: []
  },

  content: {
    excerpt: "مدرس آواز سنتی، پاپ و محلی شوشتری",
    biography:
      "رضا بشیرزاده متولی مدرس آواز سنتی، آواز پاپ و آواز محلی شوشتری در آموزشگاه موسیقی فاتح شوشتر است."
  },

  seo: {
    title: "رضا بشیرزاده متولی | مدرس آواز پاپ و سنتی در شوشتر",
    description:
      "رضا بشیرزاده متولی مدرس آواز سنتی، آواز پاپ و آواز محلی شوشتری.",
    keywords: [
      "رضا بشیرزاده متولی",
      "مدرس آواز شوشتر",
      "آواز پاپ شوشتر",
      "آواز سنتی شوشتر",
      "آواز محلی شوشتری"
    ]
  }

}

];