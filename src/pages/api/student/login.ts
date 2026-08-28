export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authenticateStudent, createStudentSessionResponse, json, type StudentEnv } from "../../../server/student-auth";
export const POST:APIRoute=async({request})=>{try{const b=await request.json() as {national_code?:string;password?:string};const s=await authenticateStudent(b.national_code??"",b.password??"",env as StudentEnv);if(!s)return json({success:false,message:"کد ملی یا رمز عبور نادرست است."},401);return createStudentSessionResponse(s)}catch{return json({success:false,message:"ورود انجام نشد."},400)}};
