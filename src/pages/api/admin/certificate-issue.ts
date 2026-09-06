export const prerender=false;
import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import {requireRole,ROLES,json,type AdminEnv} from "../../../server/admin-auth";

export const POST:APIRoute=async({request})=>{
 const denied=await requireRole(request,env as AdminEnv,[ROLES.ADMIN]);
 if(denied)return denied;
 try{
  const b=await request.json() as {registration_id:number;national_id:string;completion_date_jalali:string;level?:string|null;book_id?:number|null;curriculum_note?:string|null};
  if(!b.registration_id||!b.national_id||!b.completion_date_jalali)return json({success:false,message:"شناسه ثبت‌نام، کد ملی و تاریخ پایان دوره الزامی هستند."},422);
  const db=env.DB;
  const r=await db.prepare("SELECT id,tracking_code,student_national_code FROM registrations WHERE id=?").bind(b.registration_id).first<any>();
  if(!r)return json({success:false,message:"ثبت‌نامی پیدا نشد."},404);
  if(r.student_national_code&&r.student_national_code!==b.national_id)return json({success:false,message:"کد ملی با اطلاعات هنرجو مطابقت ندارد."},422);
  if(b.book_id){const book=await db.prepare("SELECT id FROM course_books WHERE id=?").bind(b.book_id).first<any>();if(!book)return json({success:false,message:"کتاب انتخاب‌شده پیدا نشد."},404);}
  await db.prepare("INSERT INTO issued_certificates (registration_id,national_code,cert_number,completion_date_jalali,level,book_id,curriculum_note) VALUES (?,?,?,?,?,?,?) ON CONFLICT(cert_number) DO UPDATE SET national_code=excluded.national_code,completion_date_jalali=excluded.completion_date_jalali,level=excluded.level,book_id=excluded.book_id,curriculum_note=excluded.curriculum_note").bind(b.registration_id,b.national_id,r.tracking_code,b.completion_date_jalali,b.level??null,b.book_id??null,b.curriculum_note??null).run();
  const issued=await db.prepare("SELECT id,cert_number,completion_date_jalali,level,book_id,curriculum_note FROM issued_certificates WHERE cert_number=? LIMIT 1").bind(r.tracking_code).first<any>();
  return json({success:true,certificate:issued});
 }catch(e){return json({success:false,message:`صدور گواهینامه شکست خورد: ${e instanceof Error?e.message:String(e)}`},500)}
};
