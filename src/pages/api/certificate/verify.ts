import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const number = new URL(request.url).searchParams.get("number")?.trim();
  if (!number) {
    return new Response(JSON.stringify({ success: false, message: "شماره گواهینامه الزامی است." }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const certificate = await env.DB.prepare(`SELECT c.cert_number, c.completion_date_jalali, c.level, c.book_id, c.curriculum_note, r.student_first_name, r.student_last_name, r.instrument_title, r.instructor_name FROM issued_certificates c JOIN registrations r ON r.id=c.registration_id WHERE c.cert_number=? LIMIT 1`).bind(number).first<{ cert_number:string; completion_date_jalali:string; level:string|null; book_id:number|null; curriculum_note:string|null; student_first_name:string; student_last_name:string; instrument_title:string; instructor_name:string }>();
  if (!certificate) {
    return new Response(JSON.stringify({ success: false, valid: false, message: "گواهینامه‌ای با این شماره یافت نشد." }), { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  return new Response(JSON.stringify({ success: true, valid: true, certificate: { certNumber: certificate.cert_number, studentName: `${certificate.student_first_name} ${certificate.student_last_name}`.trim(), discipline: certificate.instrument_title, instructor: certificate.instructor_name, completionDate: certificate.completion_date_jalali, level: certificate.level, curriculumNote: certificate.curriculum_note } }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } });
};
