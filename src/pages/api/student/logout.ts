export const prerender=false;
import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import {clearStudentCookie,getStudentSession,logoutStudent,json,type StudentEnv} from "../../../server/student-auth";
export const POST:APIRoute=async({request})=>{await logoutStudent(request,env as StudentEnv);return json({success:true},200,{"Set-Cookie":clearStudentCookie()})};
