export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json, type AdminEnv } from "../../../server/admin-auth";
import { buildCertificateHtml, type CertificateData } from "../../../server/certificates/template";

interface CertRequestBody {
  registration_id: number;
  book_id?: number;
  national_id: string;
  completion_date_jalali: string;
  level?: string;
  curriculum_note?: string;
}

interface RegistrationRow { tracking_code:string; instrument_title:string; instrument_slug:string; instructor_name:string; student_first_name:string; student_last_name:string; student_gender:string|null; }
interface BookRow { title:string; author:string|null; cover_image:string|null; }
function honorificFor(gender:string|null):"آقای"|"خانم" { const g=(gender??"").trim().toLowerCase(); return g==="female"||g==="زن"||g==="دختر"?"خانم":"آقای"; }

export const POST: APIRoute = async ({ request }) => {
  const denied=await requireRole(request,env as AdminEnv,[ROLES.ADMIN]); if(denied)return denied;
  const db=env.DB; const browser=(env as unknown as {BROWSER?:unknown}).BROWSER;
  if(!db)return json({success:false,message:"دیتابیس در دسترس نیست."},503);
  if(!browser)return json({success:false,message:"BROWSER binding تنظیم نشده."},503);
  const body=(await request.json()) as CertRequestBody;
  if(!body.registration_id||!body.national_id||!body.completion_date_jalali)return json({success:false,message:"شناسه ثبت‌نام، کد ملی و تاریخ پایان دوره الزامی هستند."},422);
  const registration=await db.prepare(`SELECT tracking_code,instrument_title,instrument_slug,instructor_name,student_first_name,student_last_name,student_gender FROM registrations WHERE id = ?`).bind(body.registration_id).first<RegistrationRow>();
  if(!registration)return json({success:false,message:"ثبت‌نامی با این شناسه پیدا نشد."},404);
  let book:BookRow|null=null; if(body.book_id)book=await db.prepare("SELECT title,author,cover_image FROM course_books WHERE id = ?").bind(body.book_id).first<BookRow>();
  const data:CertificateData={title:"گواهی پایان دوره",disciplineLine:`نوازندگی ${registration.instrument_title.replace(/^آموزش\s+/,"")}${body.level?" دوره "+levelLabel(body.level):""}`,certNumber:registration.tracking_code,level:body.level??null,honorific:honorificFor(registration.student_gender),studentName:`${registration.student_first_name} ${registration.student_last_name}`.trim(),nationalId:body.national_id,completionDateJalali:body.completion_date_jalali,bookTitle:book?.title??null,bookAuthor:book?.author??null,curriculumNote:body.curriculum_note??null,bookCoverUrl:book?.cover_image?`https://fatehmusic.ir/images/books/${book.cover_image}`:null,instructorLabel:`مدرس ${registration.instrument_title.replace(/^آموزش\s+/,"")}`,instructorName:registration.instructor_name,instrumentPhotoUrl:`https://fatehmusic.ir/images/cert-photos/${registration.instrument_slug}.jpg`,logoUrl:"https://fatehmusic.ir/logo.png"};
  const html=buildCertificateHtml(data);
  try {
    const pdfResult=await (browser as any).quickAction("pdf",{html,pdfOptions:{format:"a4",landscape:true,margin:{top:0,bottom:0,left:0,right:0},printBackground:true,preferCSSPageSize:false,displayHeaderFooter:false,scale:1}});
    const pdfBytes:ArrayBuffer=pdfResult instanceof Response?await pdfResult.arrayBuffer():pdfResult;
    return new Response(pdfBytes,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="certificate-${registration.tracking_code}.pdf"`}});
  }catch(err){const detail=err instanceof Error?err.message:String(err);return json({success:false,message:`تولید PDF شکست خورد: ${detail}`},500);}
};
function levelLabel(level:string):string { const map:Record<string,string>={"1":"مقدماتی","2":"متوسط","3":"پیشرفته","4":"عالی"}; return map[level]??"مقدماتی"; }
