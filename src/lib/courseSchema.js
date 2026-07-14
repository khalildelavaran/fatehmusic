export function generateCourseSchema(course) {

  return {
    "@context": "https://schema.org",

    "@type": "Course",

    "@id": `https://fatehmusic.ir/courses/${course.slug}/#course`,

    "name": course.title,

    "description": course.content.description,

    "provider": {
      "@type": [
        "LocalBusiness",
        "MusicSchool"
      ],

      "name": "آموزشگاه موسیقی فاتح",

      "@id": "https://fatehmusic.ir/#organization",

      "url": "https://fatehmusic.ir"
    },


    "courseMode": course.lessonInfo?.format || "حضوری",


    "educationalLevel": course.level,


    "audience": {
      "@type": "Audience",
      "audienceType": course.ageGroup
    },


    "hasCourseInstance": {

      "@type": "CourseInstance",

      "courseMode": "Private",

      "description":
        `${course.lessonInfo.type} - ${course.lessonInfo.sessions}`

    }

  };

}