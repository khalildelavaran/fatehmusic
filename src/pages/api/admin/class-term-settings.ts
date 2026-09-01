export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { getClassTermSettings, saveClassTermSettings, type ClassBillingType } from '../../../server/class-term-settings';

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); if (denied) return denied;
  const db=env.DB; if(!db) return json({success:false,message:'دیتابیس در دسترس نیست.'},503);
  const id=Number(new URL(request.url).searchParams.get('classId'));
  if(!Number.isInteger(id)||id<=0) return json({success:false,message:'شناسه کلاس معتبر نیست.'},422);
  return json({success:true,settings:await getClassTermSettings(db,id)});
};

export const PUT: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); if (denied) return denied;
  const db=env.DB; if(!db) return json({success:false,message:'دیتابیس در دسترس نیست.'},503);
  let body:{classId?:number;billingType?:ClassBillingType;plannedSessions?:number|null;tuitionAmount?:number|null;tuitionDueDays?:number|null};
  try{body=await request.json();}catch{return json({success:false,message:'بدنه درخواست معتبر نیست.'},400);}
  const classId=Number(body.classId);
  if(!Number.isInteger(classId)||classId<=0||!body.billingType)return json({success:false,message:'کلاس و نوع محاسبه الزامی است.'},422);
  try{
    await saveClassTermSettings(db,{classId,billingType:body.billingType,plannedSessions:body.plannedSessions??null,tuitionAmount:body.tuitionAmount??null,tuitionDueDays:body.tuitionDueDays??null});
    return json({success:true,settings:await getClassTermSettings(db,classId)});
  }catch(error){return json({success:false,code:error instanceof Error?error.message:'TERM_SETTINGS_FAILED',message:'تنظیمات ترم معتبر نیست.'},422);}
};
