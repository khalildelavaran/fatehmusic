export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { enrollStudent, getClassProfile, updateEnrollmentStatus, ENROLLMENT_STATUSES } from "../../../server/classes";
import { ensureNormalizedEnrollment, syncNormalizedEnrollmentStatus } from "../../../server/enrollment-service";

async function requireAdmin(request: Request): Promise<Response | null> { return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); }

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success:false,message:"دیتابیس در دسترس نیست." },503);
  let body:{classId?:number;studentId?:number}; try{body=await request.json()}catch{return json({success:false,message:"بدنه‌ی درخواست معتبر نیست."},400)}
  const classId=Number(body.classId),studentId=Number(body.studentId); if(!classId||!studentId)return json({success:false,message:"کلاس و هنرجو باید مشخص باشند."},422);
  const result=await enrollStudent(db,classId,studentId); if(!result.ok)return json({success:false,message:result.error},422);
  try{await ensureNormalizedEnrollment(db,classId,studentId)}catch(error){return json({success:false,message:error instanceof Error?error.message:"ایجاد ثبت‌نام عملیاتی ناموفق بود."},500)}
  return json({success:true,profile:await getClassProfile(db,classId)},201);
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success:false,message:"دیتابیس در دسترس نیست." },503);
  let body:{classId?:number;studentId?:number;status?:string}; try{body=await request.json()}catch{return json({success:false,message:"بدنه‌ی درخواست معتبر نیست."},400)}
  const classId=Number(body.classId),studentId=Number(body.studentId),status=body.status;
  if(!classId||!studentId)return json({success:false,message:"کلاس و هنرجو باید مشخص باشند."},422);
  if(!status||!(ENROLLMENT_STATUSES as readonly string[]).includes(status))return json({success:false,message:"وضعیت ثبت‌نام معتبر نیست."},422);
  const ok=await updateEnrollmentStatus(db,classId,studentId,status as (typeof ENROLLMENT_STATUSES)[number]); if(!ok)return json({success:false,message:"به‌روزرسانی ثبت‌نام با خطا مواجه شد."},500);
  try{await syncNormalizedEnrollmentStatus(db,classId,studentId,status as 'active'|'completed'|'withdrawn')}catch{return json({success:false,message:"همگام‌سازی ثبت‌نام عملیاتی ناموفق بود."},500)}
  return json({success:true,profile:await getClassProfile(db,classId)});
};
