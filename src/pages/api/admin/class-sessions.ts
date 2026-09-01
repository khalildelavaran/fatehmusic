export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { createClassSession, getSession, listSessionsForDate, cancelClassSession, completeClassSession, type ClassSessionInput } from '../../../server/class-sessions';
import { provisionEnrollmentSessionsForClassSession } from '../../../server/session-provisioning';

async function access(request: Request) { return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); }

export const GET: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' },503);
  const url = new URL(request.url); const id = url.searchParams.get('id');
  if (id) {
    const session = await getSession(db, Number(id));
    return session ? json({ success:true, session }) : json({ success:false, message:'جلسه یافت نشد.' },404);
  }
  const date = url.searchParams.get('date');
  if (!date) return json({ success:false, message:'پارامتر date الزامی است.' },422);
  return json({ success:true, date, sessions:await listSessionsForDate(db,date) });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' },503);
  let body: ClassSessionInput; try { body = await request.json(); } catch { return json({success:false,message:'بدنه درخواست معتبر نیست.'},400); }
  try {
    const id = await createClassSession(db, body);
    await provisionEnrollmentSessionsForClassSession(db, id);
    const session = await getSession(db,id);
    return json({success:true,session},201);
  } catch (error) { return json({success:false,message:error instanceof Error ? error.message : 'ایجاد جلسه ناموفق بود.'},422); }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({success:false,message:'دیتابیس در دسترس نیست.'},503);
  let body: {id?:number; sessionDate?:string; startTime?:string; endTime?:string; instructorId?:number; roomId?:number|null; locationType?:'in_person'|'online'|'hybrid'; onlinePlatform?:string|null; meetingUrl?:string|null; notes?:string; status?:'scheduled'|'completed'|'cancelled'; cancellationReason?:string};
  try { body = await request.json(); } catch { return json({success:false,message:'بدنه درخواست معتبر نیست.'},400); }
  const id=Number(body.id); if(!Number.isInteger(id)||id<=0) return json({success:false,message:'شناسه جلسه معتبر نیست.'},422);
  const current=await getSession(db,id); if(!current) return json({success:false,message:'جلسه یافت نشد.'},404);
  try {
    if (body.status === 'cancelled') {
      const ok=await cancelClassSession(db,id,body.cancellationReason?.trim()||'لغو جلسه');
      if(!ok) throw new Error('جلسه قابل لغو نیست.');
    } else if (body.status === 'completed') {
      const ok=await completeClassSession(db,id); if(!ok) throw new Error('جلسه قابل تکمیل نیست.');
    } else {
      const next={classId:current.classId,sessionDate:body.sessionDate??current.sessionDate,startTime:body.startTime??current.startTime,endTime:body.endTime??current.endTime,instructorId:body.instructorId??current.instructorId,roomId:body.roomId===undefined?current.roomId:body.roomId,locationType:body.locationType??current.locationType,onlinePlatform:body.onlinePlatform===undefined?current.onlinePlatform:body.onlinePlatform,meetingUrl:body.meetingUrl===undefined?current.meetingUrl:body.meetingUrl,type:current.type,originalSessionId:current.originalSessionId,notes:body.notes??current.notes};
      const errors = (await import('../../../server/class-sessions')).validateClassSession(next); if(errors.length) throw new Error(errors.join(' '));
      await db.prepare(`UPDATE class_sessions SET session_date=?,start_time=?,end_time=?,instructor_id=?,room_id=?,location_type=?,online_platform=?,meeting_url=?,notes=?,updated_at=datetime('now') WHERE id=? AND status='scheduled'`).bind(next.sessionDate,next.startTime,next.endTime,next.instructorId,next.roomId,next.locationType,next.onlinePlatform,next.meetingUrl,next.notes,id).run();
      await provisionEnrollmentSessionsForClassSession(db,id);
    }
    return json({success:true,session:await getSession(db,id)});
  } catch(error) { return json({success:false,message:error instanceof Error?error.message:'به‌روزرسانی جلسه ناموفق بود.'},422); }
};
