/**
 * ============================================================
 * Fateh Music Academy
 * instructor-content.js
 * Long-form SEO / GEO content, keyed by instructor slug.
 *
 * Same rationale as course-content.js: instructors.js is marked
 * "Architecture: FROZEN v1.0", so this file is purely additive.
 * src/seo/resolvers/instructor.js looks up an entry here by
 * `instructor.slug` and merges it in as an optional `seoContent`
 * field. Instructors NOT listed here resolve `seoContent: null`
 * and the page renders without that section — safe to fill in
 * one instructor at a time.
 *
 * TRUST — read before adding another instructor:
 * - metrics.students / metrics.concerts / metrics.awards are
 *   `null` in instructors.js for every instructor. That is
 *   intentional (per AGENTS.md "TRUST": never invent facts, never
 *   fabricate awards, never fake statistics). Do not translate
 *   that null into an invented number or a vague-but-impressive
 *   claim here. Write about teaching method, subject coverage,
 *   and process instead — exactly the categories AGENTS.md and
 *   the project's own decision log say to lean on when hard data
 *   isn't available.
 * - Only use facts already present in instructors.js
 *   (professional.roles, professional.education,
 *   professional.experienceYears, relations.courses) or generic,
 *   well-established music-pedagogy knowledge that isn't a
 *   specific claim about this person or this school.
 *
 * Shape per entry (key names are gender-neutral — "Them" not
 * "Him"/"Her" — since this same shape will cover all 14
 * instructors, several of whom are women):
 * {
 *   quickSummary: string,
 *   teachingPhilosophy: string[],
 *   methodBySubject: { subject, description }[],
 *   whoShouldStudyWithThem: string[],
 *   typicalProgression: string[],
 *   commonStudentMistakes: { mistake, fix }[],
 *   whyStudentsChooseThem: string[],
 *   faqAdditions: { question, answer }[],
 *   summary: string[]
 * }
 * ============================================================
 */

export const instructorContent = {

  /* ======================================================================
     khalil-delavaran — fully worked template.
     Remaining 13 instructors intentionally left unset for now; see
     the chat response for the phased plan to fill these in.
  ====================================================================== */
  "khalil-delavaran": {

    quickSummary:
      "خلیل دلاوران در آموزشگاه موسیقی فاتح شوشتر، گیتار، سلفژ، تئوری موسیقی، ریتم و وزن‌خوانی و صداسازی تدریس می‌کند؛ ترکیبی که کمتر در یک مدرس واحد دیده می‌شود و به این معناست که هنرجویان او این پنج مهارت را جدا از هم یاد نمی‌گیرند، بلکه در دل یکدیگر تمرین می‌کنند. او دارای مدرک کارشناسی ارشد علوم کامپیوتر با گرایش هوش مصنوعی است و بیش از بیست سال سابقه تدریس موسیقی دارد. کلاس‌های او به‌صورت خصوصی و یک‌نفره برگزار می‌شود و برای کودکان، نوجوانان و بزرگسالان مبتدی تا نیمه‌پیشرفته مناسب است. در ادامه این صفحه، درباره روش تدریس او در هر یک از پنج حوزه، مسیر معمول پیشرفت هنرجویان، اشتباهات رایجی که در جلسات ابتدایی دیده می‌شود و پاسخ به پرسش‌های متداول می‌خوانید.",

    teachingPhilosophy: [
      "نقطه شروع خلیل دلاوران در تدریس این است که مهارت‌های موسیقایی را کاملاً جدا از هم آموزش ندهد. بسیاری از هنرجویان در کلاس‌های معمول گیتار، ریتم یا تئوری را به‌صورت جداگانه و بدون ارتباط مستقیم با نواختن یاد می‌گیرند؛ در حالی‌که در کلاس‌های او، یک الگوی ریتمیک تازه یا یک آکورد جدید، معمولاً همراه با توضیح منطق تئوریک همان لحظه ارائه می‌شود.",
      "پیشینه تحصیلی او در علوم کامپیوتر و هوش مصنوعی، به شکل‌گیری رویکردی ساختاریافته و گام‌به‌گام در تدریس کمک کرده است؛ مسیر آموزشی هر هنرجو بر اساس سطح واقعی او تعریف می‌شود، نه یک برنامه ثابت و یکسان برای همه."
    ],

    methodBySubject: [
      { subject: "گیتار", description: "آموزش از مبانی کوک، وضعیت نشستن و آکوردهای باز آغاز می‌شود و به‌تدریج به استرام، باره و فینگراستایل می‌رسد. بسته به علاقه هنرجو، مسیر می‌تواند به سمت گیتار کلاسیک، پاپ یا فلامنکو تخصصی شود." },
      { subject: "سلفژ", description: "تمرین‌های سلفژ برای تقویت دقت گوش در تشخیص فاصله‌های صوتی و خواندن نت به‌کار می‌رود؛ مهارتی که مستقیماً به کوک‌کردن ساز، همراهی با آواز و نواختن گوشی کمک می‌کند." },
      { subject: "تئوری موسیقی", description: "به‌جای حفظ مکانیکی قواعد، تئوری در کنار مثال‌های عملی از قطعاتی که هنرجو در حال یادگیری آن‌هاست آموزش داده می‌شود تا کاربرد هر مفهوم از همان ابتدا ملموس باشد." },
      { subject: "ریتم و وزن‌خوانی", description: "پیش از نواختن یک الگوی ریتمیک روی ساز، همان الگو ابتدا با کف‌زدن یا وزن‌خوانی تمرین می‌شود تا هنرجو منطق شمارش آن را کاملاً درک کرده باشد." },
      { subject: "صداسازی", description: "برای هنرجویانی که علاقه‌مند به خواندن هستند، تمرین‌های پایه صداسازی شامل تنفس دیافراگمی و کنترل صدا ارائه می‌شود، به‌ویژه برای کسانی که می‌خواهند هم‌زمان با نواختن گیتار، خودشان را همراهی کنند." }
    ],

    whoShouldStudyWithThem: [
      "هنرجویانی که می‌خواهند علاوه بر نواختن گیتار، مبانی تئوری و سلفژ را هم به‌صورت کاربردی یاد بگیرند",
      "کودکان و نوجوانانی که برای اولین‌بار با یک ساز آشنا می‌شوند و به آموزشی گام‌به‌گام و ساختاریافته نیاز دارند",
      "بزرگسالانی که پیش‌تر گیتار زده‌اند اما می‌خواهند مبانی تئوریک پشت آن‌چه می‌نوازند را هم درک کنند",
      "خوانندگانی که می‌خواهند بتوانند خودشان را با گیتار همراهی کنند"
    ],

    typicalProgression: [
      "هنرجویان معمولاً از آشنایی با ساز، کوک و اولین آکوردها آغاز می‌کنند و در کنار آن، تمرین‌های ساده سلفژ برای تقویت گوش وارد برنامه می‌شود. با تثبیت آکوردهای باز، الگوهای استرام و مبانی ریتم و وزن‌خوانی اضافه می‌شود. در ادامه، بسته به علاقه هنرجو، مسیر می‌تواند به سمت باره و فینگراستایل در گیتار، یا تمرکز بیشتر روی تئوری و صداسازی برای کسانی که به خواندن هم علاقه دارند، پیش برود."
    ],

    commonStudentMistakes: [
      { mistake: "نگاه‌کردن به تئوری و سلفژ به‌عنوان دروسی جدا و کم‌اهمیت‌تر از نواختن", fix: "در کلاس‌های او این دو، بخشی از تمرین گیتار هستند نه دروسی اضافه؛ نگاه‌کردن به آن‌ها به همین شکل، یادگیری را ساده‌تر می‌کند." },
      { mistake: "مقایسه سرعت پیشرفت خود با هنرجویان دیگر", fix: "چون کلاس‌ها خصوصی و متناسب با سن و پیش‌زمینه هر فرد برنامه‌ریزی می‌شود، سرعت پیشرفت افراد مختلف طبیعتاً متفاوت است." },
      { mistake: "کم‌کردن تمرین در خانه با این تصور که فقط زمان کلاس اهمیت دارد", fix: "تمرین منظم بین جلسات، حتی کوتاه، تاثیر مستقیمی روی سرعت پیشرفت در جلسه بعدی دارد." }
    ],

    whyStudentsChooseThem: [
      "انتخاب یک مدرس که هم‌زمان گیتار، سلفژ، تئوری موسیقی، ریتم و وزن‌خوانی و صداسازی را پوشش می‌دهد، به این معناست که هنرجو برای یادگیری کامل این مهارت‌ها نیازی به مراجعه به چند مدرس جداگانه ندارد. کلاس‌های خصوصی و یک‌نفره هم امکان تنظیم دقیق سرعت و محتوای آموزش را بر اساس وضعیت واقعی هر فرد فراهم می‌کند."
    ],

    faqAdditions: [
      { question: "آیا خلیل دلاوران فقط گیتار تدریس می‌کند؟", answer: "خیر. او علاوه بر گیتار، سلفژ، تئوری موسیقی، ریتم و وزن‌خوانی و صداسازی را هم تدریس می‌کند و این مباحث را در کنار گیتار به هنرجو منتقل می‌کند." },
      { question: "آیا برای شرکت در کلاس گیتار او باید سلفژ یا تئوری را جداگانه یاد بگیرم؟", answer: "نه؛ این مباحث در کنار خود دوره گیتار و متناسب با نیاز هر هنرجو ارائه می‌شود، نه به‌صورت پیش‌نیاز جداگانه." },
      { question: "کلاس‌های خلیل دلاوران خصوصی است یا گروهی؟", answer: "کلاس‌های او، مانند سایر دوره‌های آموزشگاه موسیقی فاتح، به‌صورت خصوصی و یک‌نفره برگزار می‌شود." },
      { question: "چه سنی برای شروع کلاس با ایشان مناسب است؟", answer: "او هم کودکان، هم نوجوانان و هم بزرگسالان را آموزش می‌دهد؛ برنامه دقیق بر اساس سن و هدف هر هنرجو در مشاوره پیش از ثبت‌نام تعیین می‌شود." },
      { question: "آیا کسی که قبلاً گیتار زده هم می‌تواند نزد او کلاس بگیرد؟", answer: "بله. بسیاری از هنرجویانی که پیش‌تر به‌صورت خودآموز گیتار زده‌اند، برای اصلاح مبانی و یادگیری تئوریک آن‌چه پیش‌تر فقط عملی یاد گرفته بودند، این کلاس را انتخاب می‌کنند." },
      { question: "سابقه تدریس خلیل دلاوران چقدر است؟", answer: "بیش از بیست سال سابقه تدریس موسیقی دارد." },
      { question: "چه دوره‌هایی را می‌توان نزد او گذراند؟", answer: "دوره‌های گیتار، سلفژ، تئوری موسیقی، ریتم و وزن‌خوانی، و صداسازی زیر نظر او در آموزشگاه موسیقی فاتح برگزار می‌شود." }
    ],

    summary: [
      "خلیل دلاوران با تدریس هم‌زمان گیتار، سلفژ، تئوری موسیقی، ریتم و وزن‌خوانی و صداسازی، مسیری یکپارچه برای یادگیری موسیقی در آموزشگاه فاتح فراهم کرده است؛ مسیری که در آن هر مهارت جدید، در ارتباط مستقیم با آن‌چه هنرجو در حال نواختن یا خواندن آن است آموزش داده می‌شود. برای اطلاع از زمان‌بندی کلاس‌ها یا مشاوره درباره دوره مناسب، می‌توانید پیش از ثبت‌نام با آموزشگاه تماس بگیرید."
    ]

  }

  // Remaining 13 slugs (reza-fateh, mohammadali-zafarani, vahid-bahman,
  // behnam-iravani, mojtaba-nejadsafari, gholamabbas-abbasi,
  // alireza-eydi-nejad, bahram-mousavi, farnaz-kadkhoda-moradi,
  // narges-fateh, mohsen-naghib, majid-jafarizade, reza-bashir)
  // intentionally omitted for now — see chat.

};
