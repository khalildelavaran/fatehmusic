export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { createNotification } from "../../../server/in-app-notifications";

function hoursUntil(date:string,time:string){return (new Date(`${date}T${time}:00`).getTime()-Date.now())/3600000;}

export const POST: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({success:false,message:"ورود هنرجو معتبر نیست."},401);
  const db=env.DB;
  if(!db)return json({success:false,message:"دیتابیس در دسترس نیست."},503);
  const body=await request.json().catch(()=>null) as {enrollmentSessionId?:unknown;note?:unknown}|null;
  const id=Number(body?.enrollmentSessionId);
  if(!Number.isInteger(id)||id<=0)return json({success:false,message:"شناسه جلسه معتبر نیست."},422);

  const row=await db.prepare(`
    SELECT es.id,es.status,es.note, e.id AS enrollment_id,e.student_id,
      cs.session_date,cs.start_time,cs.end_time,cs.status AS session_status,c.title AS class_title
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id=es.enrollment_id
    JOIN class_sessions cs ON cs.id=es.session_id
    JOIN classes c ON c.id=cs.class_id
    WHERE es.id=? AND e.student_id=?
  `).bind(id,session.studentId).first<{id:number;status:string;note:string;enrollment_id:number;student_id:number;session_date:string;start_time:string;end_time:string;session_status:string;class_title:string}>();
  if(!row)return json({success:false,message:"جلسه یافت نشد."},404);
  if(row.session_status==='cancelled')return json({success:false,message:"جلسه لغو شده است."},409);
  if(row.status!=='pending')return json({success:false,message:"برای این جلسه قبلاً وضعیت حضور ثبت شده است."},409);
  if(hoursUntil(row.session_date,row.start_time)<24)return json({success:false,message:"ثبت مرخصی فقط تا حداقل ۲۴ ساعت پیش از شروع جلسه امکان‌پذیر است."},422);

  const note=typeof body?.note==='string'?body.note.trim():'';
  await db.prepare(`UPDATE enrollment_sessions SET status='excused',attendance_mode='student_leave',note=?,updated_at=? WHERE id=?`)
    .bind(note,new Date().toISOString(),id).run();

  await createNotification(db,{recipientType:'student',recipientId:session.studentId,type:'attendance',title:'مرخصی ثبت شد',body:`مرخصی شما برای کلاس «${row.class_title}» در تاریخ ${row.session_date} ثبت شد.`,entityType:'enrollment_session',entityId:id});

  return json({success:true,enrollmentSessionId:id,status:'excused'});
};
