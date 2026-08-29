export const prerender=false;
import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import {requireRole,ROLES,json,type AdminEnv} from "../../../server/admin-auth";
import {generateCertificatePdf,type CertificateGenerateInput} from "../../../server/certificates/generate";
export const POST:APIRoute=async({request})=>{const denied=await requireRole(request,env as AdminEnv,[ROLES.ADMIN]);if(denied)return denied;const db=env.DB,browser=(env as any).BROWSER,assets=(env as any).ASSETS;if(!browser)return json({success:false,message:"BROWSER binding تنظیم نشده است."},503);if(!assets?.fetch)return json({success:false,message:"ASSETS binding در Worker تنظیم نشده است."},503);try{const b=await request.json() as CertificateGenerateInput;return await generateCertificatePdf(request,db,browser,assets,b);}catch(e){const status=Number((e as any)?.status)||500;return json({success:false,message:`تولید PDF شکست خورد: ${e instanceof Error?e.message:String(e)}`},status)}};
