const TTL = 60 * 60 * 8;
const COOKIE = "__Host-student_session";
const ITERATIONS = 100_000;

export interface StudentEnv { DB: D1Database; SESSION: KVNamespace; }
export interface StudentSession { accountId:number; nationalCode:string; expiresAt:number; token?:string; }

export function json(body:unknown,status=200,headers:HeadersInit={}):Response{return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",...headers}})}
function hex(b:Uint8Array){return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")}
function bytes(s:string){if(!/^[0-9a-f]+$/i.test(s)||s.length%2)throw Error("invalid");const b=new Uint8Array(s.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(s.slice(i*2,i*2+2),16);return b}
async function derive(p:string,s:Uint8Array,n=ITERATIONS){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(p),"PBKDF2",false,["deriveBits"]);return crypto.subtle.deriveBits({name:"PBKDF2",salt:s,iterations:n,hash:"SHA-256"},k,256)}
export async function hashStudentPassword(p:string){const s=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2-sha256$${ITERATIONS}$${hex(s)}$${hex(new Uint8Array(await derive(p,s)))}`}
async function verify(p:string,e:string){const x=e.split("$");if(x.length!==4||x[0]!=="pbkdf2-sha256")return false;const n=Number(x[1]);if(!Number.isInteger(n)||n<10000||n>ITERATIONS)return false;try{const a=new Uint8Array(await derive(p,bytes(x[2]),n)),b=bytes(x[3]);if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}catch{return false}}
export function normalizeNationalCode(v:string){return v.replace(/\D/g,"").trim()}
function token(){const b=crypto.getRandomValues(new Uint8Array(32));let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function cookie(r:Request){for(const p of r.headers.get("Cookie")?.split(";")??[]){const i=p.indexOf("=");if(i>=0&&p.slice(0,i).trim()===COOKIE)return decodeURIComponent(p.slice(i+1).trim())}return null}
function setCookie(t:string,maxAge=TTL){return `${COOKIE}=${encodeURIComponent(t)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`}
export async function authenticateStudent(input:string,password:string,env:StudentEnv):Promise<StudentSession|null>{
 const nationalCode=normalizeNationalCode(input);if(!/^\d{10}$/.test(nationalCode)||!password)return null;
 let a=await env.DB.prepare("SELECT id,national_code,password_hash,is_active FROM student_accounts WHERE national_code=? LIMIT 1").bind(nationalCode).first<{id:number;national_code:string;password_hash:string;is_active:number}>();
 if(!a){const r=await env.DB.prepare("SELECT 1 AS found FROM registrations WHERE student_national_code=? LIMIT 1").bind(nationalCode).first();if(!r)return null;const h=await hashStudentPassword(nationalCode);await env.DB.prepare("INSERT OR IGNORE INTO student_accounts (national_code,password_hash,must_change_password) VALUES (?,?,1)").bind(nationalCode,h).run();a=await env.DB.prepare("SELECT id,national_code,password_hash,is_active FROM student_accounts WHERE national_code=? LIMIT 1").bind(nationalCode).first<{id:number;national_code:string;password_hash:string;is_active:number}>()}
 if(!a||a.is_active!==1||!(await verify(password,a.password_hash)))return null;
 const t=token(),s={accountId:a.id,nationalCode:a.national_code,expiresAt:Date.now()+TTL*1000,token:t};const {token:_,...stored}=s;await env.SESSION.put(`student:${t}`,JSON.stringify(stored),{expirationTtl:TTL});await env.DB.prepare("UPDATE student_accounts SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(a.id).run();return s;
}
export function createStudentSessionResponse(s:StudentSession){const {token:_,...user}=s;return json({success:true,user},200,{"Set-Cookie":setCookie(s.token??"")})}
export async function getStudentSession(r:Request,env:StudentEnv){const t=cookie(r);if(!t)return null;const raw=await env.SESSION.get(`student:${t}`);if(!raw)return null;try{const s=JSON.parse(raw) as StudentSession;if(s.expiresAt<=Date.now()){await env.SESSION.delete(`student:${t}`);return null}return s}catch{await env.SESSION.delete(`student:${t}`);return null}}
export async function requireStudent(r:Request,env:StudentEnv){return (await getStudentSession(r,env))??json({success:false,message:"ورود هنرجو معتبر نیست."},401)}
export async function logoutStudent(r:Request,env:StudentEnv){const t=cookie(r);if(t)await env.SESSION.delete(`student:${t}`)}
export function clearStudentCookie(){return setCookie("",0)}
