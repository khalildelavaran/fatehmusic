import { instructors as staticInstructors } from "../data/instructors.js";

export interface InstructorsEnv { DB: D1Database; }
export interface InstructorRecord { id:number; slug:string; firstName:string; lastName:string; phone:string; email:string; specialty:string; instruments:string[]; biography:string; notes:string; isActive:boolean; createdAt:string; updatedAt:string; }
export interface InstructorStudentSummary { studentId:number; firstName:string; lastName:string; nationalCode:string; studentStatus:string; course:string; termCount:number; startDate:string; lastActivity:string; }
export interface InstructorProfile { instructor:InstructorRecord; students:InstructorStudentSummary[]; }
export interface InstructorListParams { search?:string|null; status?:string|null; page?:number|null; pageSize?:number|null; }
export interface NormalizedInstructorListParams { search:string; isActive:boolean|null; page:number; pageSize:number; offset:number; }
export interface InstructorListItem extends InstructorRecord { studentCount:number; }
export interface InstructorListResult { instructors:InstructorListItem[]; total:number; page:number; pageSize:number; }
export interface InstructorInput { firstName?:string; lastName?:string; phone?:string; email?:string; specialty?:string; instruments?:string[]; biography?:string; notes?:string; isActive?:boolean; }
export interface ValidationResult { valid:boolean; errors:string[]; }

const COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseInstruments(value:unknown):string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed:any = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const result:string[] = [];
    for (let i=0; i<parsed.length; i++) if (typeof parsed[i] === "string") result.push(parsed[i]);
    return result;
  } catch (_) { return []; }
}

function mapDbInstructor(row:any):InstructorRecord {
  return { id:Number(row.id), slug:String(row.slug||""), firstName:String(row.first_name||""), lastName:String(row.last_name||""), phone:String(row.phone||""), email:String(row.email||""), specialty:String(row.specialty||""), instruments:parseInstruments(row.instruments), biography:String(row.biography||""), notes:String(row.notes||""), isActive:Number(row.is_active)===1, createdAt:String(row.created_at||""), updatedAt:String(row.updated_at||"") };
}

function mapStaticInstructor(item:any):InstructorRecord {
  const name=typeof item.name==="string"?item.name.trim():"";
  const parts=name?name.split(/\s+/):[];
  const identity=item.identity||{};
  const content=item.content||{};
  const relations=item.relations||{};
  return { id:Number(item.id), slug:String(item.slug||""), firstName:String(identity.firstName||(parts.length?parts[0]:"")), lastName:String(identity.lastName||parts.slice(1).join(" ")), phone:String(item.phone||""), email:String(item.email||""), specialty:String(item.position||content.excerpt||""), instruments:Array.isArray(relations.courses)?relations.courses:[], biography:String(content.biography||""), notes:"", isActive:item.active!==false, createdAt:"", updatedAt:"" };
}

export function normalizeInstructorListParams(params:InstructorListParams):NormalizedInstructorListParams {
  const search=String(params.search||"").trim();
  let isActive:boolean|null=null;
  if(params.status==="active") isActive=true;
  else if(params.status==="inactive") isActive=false;
  const pageNumber=Number(params.page); const sizeNumber=Number(params.pageSize);
  const page=Number.isFinite(pageNumber)?Math.max(1,Math.floor(pageNumber)):1;
  const pageSize=Number.isFinite(sizeNumber)?Math.min(MAX_PAGE_SIZE,Math.max(1,Math.floor(sizeNumber))):DEFAULT_PAGE_SIZE;
  return {search,isActive,page,pageSize,offset:(page-1)*pageSize};
}

export async function listInstructors(db:D1Database, params:InstructorListParams):Promise<InstructorListResult> {
  const normalized=normalizeInstructorListParams(params); const where:string[]=[]; const bindings:any[]=[];
  if(normalized.isActive!==null){where.push("is_active = ?");bindings.push(normalized.isActive?1:0);}
  if(normalized.search){where.push("((first_name || ' ' || last_name) LIKE ? OR specialty LIKE ? OR phone LIKE ?)");const term="%"+normalized.search+"%";bindings.push(term,term,term);}
  const whereSql=where.length?"WHERE "+where.join(" AND "):"";
  try {
    const totalRow:any=await db.prepare("SELECT COUNT(*) AS count FROM instructors "+whereSql).bind(...bindings).first();
    const sql="SELECT "+COLUMNS+", (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors "+whereSql+" ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?";
    const rows:any=await db.prepare(sql).bind(...bindings,normalized.pageSize,normalized.offset).all();
    if(rows&&Array.isArray(rows.results)){
      const instructors:InstructorListItem[]=[];
      for(let i=0;i<rows.results.length;i++){const r=rows.results[i],x=mapDbInstructor(r);instructors.push({id:x.id,slug:x.slug,firstName:x.firstName,lastName:x.lastName,phone:x.phone,email:x.email,specialty:x.specialty,instruments:x.instruments,biography:x.biography,notes:x.notes,isActive:x.isActive,createdAt:x.createdAt,updatedAt:x.updatedAt,studentCount:Number(r.student_count)||0});}
      return {instructors,total:Number(totalRow&&totalRow.count)||0,page:normalized.page,pageSize:normalized.pageSize};
    }
  } catch(error){console.error("[admin/instructors] list query failed",error);}
  const filtered:any[]=[];
  for(let i=0;i<staticInstructors.length;i++){const item:any=staticInstructors[i],identity=item.identity||{},name=String(item.name||((identity.firstName||"")+" "+(identity.lastName||"")).trim()),position=String(item.position||""),matchesSearch=!normalized.search||name.includes(normalized.search)||position.includes(normalized.search),matchesStatus=normalized.isActive===null||item.active===normalized.isActive;if(matchesSearch&&matchesStatus)filtered.push(item);}
  const pageItems=filtered.slice(normalized.offset,normalized.offset+normalized.pageSize); const instructors:InstructorListItem[]=[];
  for(let i=0;i<pageItems.length;i++){const x=mapStaticInstructor(pageItems[i]);instructors.push({id:x.id,slug:x.slug,firstName:x.firstName,lastName:x.lastName,phone:x.phone,email:x.email,specialty:x.specialty,instruments:x.instruments,biography:x.biography,notes:x.notes,isActive:x.isActive,createdAt:x.createdAt,updatedAt:x.updatedAt,studentCount:0});}
  return {instructors,total:filtered.length,page:normalized.page,pageSize:normalized.pageSize};
}

export async function getInstructorProfile(db:D1Database,id:number):Promise<InstructorProfile|null>{
  let instructor:InstructorRecord|null=null;
  try{const row:any=await db.prepare("SELECT "+COLUMNS+" FROM instructors WHERE id = ?").bind(id).first();if(row)instructor=mapDbInstructor(row);}catch(error){console.error("[admin/instructors] profile instructor query failed",error);}
  if(!instructor)for(let i=0;i<staticInstructors.length;i++)if(Number((staticInstructors[i] as any).id)===Number(id)){instructor=mapStaticInstructor(staticInstructors[i]);break;}
  if(!instructor)return null;
  const students:InstructorStudentSummary[]=[];
  try{const sql="SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC";const result:any=await db.prepare(sql).bind(id).all();if(result&&Array.isArray(result.results))for(let i=0;i<result.results.length;i++){const s:any=result.results[i];students.push({studentId:Number(s.student_id),firstName:String(s.first_name||""),lastName:String(s.last_name||""),nationalCode:String(s.national_code||""),studentStatus:String(s.student_status||""),course:String(s.course||""),termCount:Number(s.term_count)||0,startDate:String(s.start_date||""),lastActivity:String(s.last_activity||"")});}}catch(error){console.error("[admin/instructors] profile student query failed",error);}
  return {instructor,students};
}

export function validateInstructorInput(input:InstructorInput,options:{isCreate?:boolean}={}):ValidationResult{
  const errors:string[]=[];const isCreate=options.isCreate===true;const firstName=typeof input.firstName==="string"?input.firstName.trim():"";const lastName=typeof input.lastName==="string"?input.lastName.trim():"";
  if(isCreate&&!firstName)errors.push("نام مدرس الزامی است.");if(isCreate&&!lastName)errors.push("نام خانوادگی مدرس الزامی است.");
  if(input.email!==undefined&&input.email!==""){const email=String(input.email),at=email.indexOf("@"),dot=email.lastIndexOf(".");if(at<=0||dot<=at+1||dot>=email.length-1)errors.push("ایمیل معتبر نیست.");}
  if(input.instruments!==undefined&&!Array.isArray(input.instruments))errors.push("فهرست سازهای آموزشی معتبر نیست.");return {valid:errors.length===0,errors};
}

function slugify(firstName:string,lastName:string):string{return encodeURIComponent((firstName+"-"+lastName).trim().toLowerCase()).replace(/%[0-9A-F]{2}/gi,"").replace(/%20/g,"-")||"instructor-"+Date.now();}

export async function createInstructor(db:D1Database,input:InstructorInput):Promise<number>{
  const values:any[]=[slugify(input.firstName||"",input.lastName||""),input.firstName||"",input.lastName||"",input.phone||"",input.email||"",input.specialty||"",JSON.stringify(input.instruments||[]),input.biography||"",input.notes||""];
  const result:any=await db.prepare("INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)").bind(...values).run();
  if(!result||!result.meta||typeof result.meta.last_row_id!=="number")throw new Error("Failed to create instructor");return result.meta.last_row_id;
}

export async function updateInstructor(db:D1Database,id:number,patch:InstructorInput):Promise<boolean>{
  const columnMap:any={firstName:"first_name",lastName:"last_name",phone:"phone",email:"email",specialty:"specialty",biography:"biography",notes:"notes"};const setClauses:string[]=[];const bindings:any[]=[];const keys=Object.keys(columnMap);
  for(let i=0;i<keys.length;i++){const key=keys[i],value:any=(patch as any)[key];if(value!==undefined){setClauses.push(columnMap[key]+" = ?");bindings.push(value);}}
  if(patch.instruments!==undefined){setClauses.push("instruments = ?");bindings.push(JSON.stringify(patch.instruments));}if(patch.isActive!==undefined){setClauses.push("is_active = ?");bindings.push(patch.isActive?1:0);}if(!setClauses.length)return true;
  bindings.push(id);const result:any=await db.prepare("UPDATE instructors SET "+setClauses.join(", ")+", updated_at = datetime('now') WHERE id = ?").bind(...bindings).run();return !!(result&&result.success);
}
