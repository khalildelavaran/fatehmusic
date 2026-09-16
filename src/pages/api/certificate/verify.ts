import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  const number = new URL(request.url).searchParams.get("number")?.trim();
  if (!number) return new Response(JSON.stringify({ success:false, message:"شماره گواهی الزامی است." }),{status:400,headers:{"Content-Type":"application/json; charset=utf-8"}});
  const certificate=await env.DB.prepare(`SELECT c.cert_number,c.certificate_type,c.completion_date_jalali,c.level,c.book_id,c.curriculum_note,c.event_title,c.event_date_jalali,c.event_role,c.event_details,c.event_instructor,c.workshop_hours,r.student_first_name,r.student_last_name,r.instrument_title,r.instructor_name FROM issued_certificates c JOIN registrations r ON r.id=c.registration_id WHERE c.cert_number=? LIMIT 1`).bind(number).first<any>();
  if(!certificate)return new Response(JSON.stringify({success:false,valid:false,message:"گواهی‌ای با این شماره یافت نشد."}),{status:404,headers:{"Content-Type":"application/json; charset=utf-8"}});
  return new Response(JSON.stringify({success:true,valid:true,certificate:{certNumber:certificate.cert_number,certificateType:certificate.certificate_type,studentName:`${certificate.student_first_name} ${certificate.student_last_name}`.trim(),discipline:certificate.instrument_title,instructor:certificate.event_instructor||certificate.instructor_name,completionDate:certificate.completion_date_jalali,eventTitle:certificate.event_title,eventDate:certificate.event_date_jalali,eventRole:certificate.event_role,eventDetails:certificate.event_details,workshopHours:certificate.workshop_hours,level:certificate.level,curriculumNote:certificate.curriculum_note}}),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=300"}});
};
