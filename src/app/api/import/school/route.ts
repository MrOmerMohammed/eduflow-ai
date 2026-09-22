import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED=["academic_year","academic_year_start","academic_year_end","grade","section","admission_number","first_name"];
const OPTIONAL=["grade_code","section_capacity","subject","subject_code","roll_number","date_of_birth","gender","student_email","student_phone","student_status","guardian_name","guardian_relationship","guardian_phone","guardian_email","guardian_primary","teacher_name","teacher_first_name","teacher_last_name","teacher_email","teacher_phone","teacher_employee_number","teacher_designation","teacher_department","teacher_employment_type","teacher_joining_date","timetable_day","timetable_period","timetable_start","timetable_end","timetable_room"];

function parseCsv(text:string){
 const records:string[][]=[]; let row:string[]=[]; let value=""; let quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];
  if(ch==='"'){if(quoted&&next==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(value.trim());value="";}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(value.trim());value="";if(row.some(v=>v!==''))records.push(row);row=[];}
  else value+=ch;
 }
 if(value!==""||row.length){row.push(value.trim());if(row.some(v=>v!==''))records.push(row);}
 return records;
}
function normalizeEmploymentType(value: unknown): string {
 const raw=String(value ?? "").trim().toLowerCase().replace(/[-\\s]+/g,"_");
 if(!raw) return "full_time";
 const aliases:Record<string,string>={
  full_time:"full_time",fulltime:"full_time",full:"full_time",
  part_time:"part_time",parttime:"part_time",part:"part_time",
  contract:"contract",contractor:"contract",
  temporary:"temporary",temp:"temporary",
  intern:"intern",internship:"intern"
 };
 return aliases[raw] ?? "";
}
function parseRows(text:string){
 const records=parseCsv(text); if(!records.length) throw new Error("CSV has no rows");
 const headers=records[0].map(v=>v.toLowerCase().replace(/\s+/g,"_"));
 const missing=REQUIRED.filter(h=>!headers.includes(h)); if(missing.length) throw new Error("Missing required columns: "+missing.join(", "));
 const rows:Record<string,unknown>[]=[];
 records.slice(1).forEach(values=>{const out:Record<string,unknown>={}; for(const h of [...REQUIRED,...OPTIONAL]) if(headers.includes(h)) out[h]=values[headers.indexOf(h)]??""; if(Object.values(out).some(v=>String(v).trim()!=="")) rows.push(out);});
 if(!rows.length) throw new Error("No data rows were found"); if(rows.length>10000) throw new Error("CSV exceeds the 10,000-row safety limit");
 const errors:string[]=[]; const seen=new Map<string,string>();
 rows.forEach((r,i)=>{const line=i+2; for(const h of REQUIRED) if(!String(r[h]??"").trim()) errors.push(`Row ${line}: ${h} is required`);
  const admission=String(r.admission_number??"").trim().toLowerCase(); if(admission){
   const fingerprint=[r.first_name,r.middle_name,r.last_name,r.date_of_birth,r.grade,r.section,r.academic_year].map(v=>String(v??"").trim().toLowerCase()).join("|");
   const previous=seen.get(admission);
   if(previous && previous!==fingerprint) errors.push(`Row ${line}: admission_number ${r.admission_number} is reused with different student/enrollment details`);
   else if(!previous) seen.set(admission,fingerprint);
  }
  for(const h of ["date_of_birth","academic_year_start","academic_year_end","teacher_joining_date"]) if(r[h]&&Number.isNaN(Date.parse(String(r[h])))) errors.push(`Row ${line}: invalid ${h}`);
  if(r.teacher_email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.teacher_email))) errors.push(`Row ${line}: invalid teacher_email`);
  if(r.timetable_day){ const day=String(r.timetable_day).trim().toLowerCase(); if(!["mon","monday","tue","tuesday","wed","wednesday","thu","thursday","fri","friday","sat","saturday","sun","sunday","1","2","3","4","5","6","7"].includes(day)) errors.push(`Row ${line}: invalid timetable_day`); }
  if(r.timetable_period && (!/^\\d+$/.test(String(r.timetable_period)) || Number(r.timetable_period)<1)) errors.push(`Row ${line}: timetable_period must be a positive number`);
  for(const h of ["timetable_start","timetable_end"]) if(r[h] && !/^\\d{1,2}:\\d{2}$/.test(String(r[h]).trim())) errors.push(`Row ${line}: invalid ${h} (use HH:MM)`);
  if(r.teacher_employment_type){ const normalized=normalizeEmploymentType(r.teacher_employment_type); if(!normalized) errors.push(`Row ${line}: teacher_employment_type must be Full Time, Part Time, Contract, Temporary, or Intern`); else r.teacher_employment_type=normalized; }
 });
 return {rows,errors,headers};
}
async function load(request:Request){
 const form=await request.formData(); const file=form.get("file"); const schoolId=String(form.get("schoolId")??"");
 if(!(file instanceof File))throw new Error("CSV file is required"); if(!UUID.test(schoolId))throw new Error("schoolId must be a valid UUID");
 if(file.size>10*1024*1024)throw new Error("CSV must be 10 MB or smaller"); if(!/\.csv$/i.test(file.name))throw new Error("Only .csv files are supported");
 const text=Buffer.from(await file.arrayBuffer()).toString("utf8").replace(/^\uFEFF/,""); return {schoolId,...parseRows(text)};
}
export async function POST(request:Request){
 try{const supabase=await createSupabaseServerClient();const {data:claims,error}=await supabase.auth.getClaims();if(error||!claims?.claims?.sub)return NextResponse.json({error:"Authentication required"},{status:401});
  const {schoolId,rows,errors,headers}=await load(request); if(errors.length)return NextResponse.json({data:{valid:false,rowsParsed:rows.length,errorCount:errors.length,errors:errors.slice(0,100),columns:headers}},{status:422});
  return NextResponse.json({data:{valid:true,rowsParsed:rows.length,columns:headers,preview:rows.slice(0,10),message:"Preview only. No school records were written."}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to preview CSV"},{status:400});}
}
export async function PUT(request:Request){
 try{const supabase=await createSupabaseServerClient();const {data:claims,error}=await supabase.auth.getClaims();const actor=claims?.claims?.sub?String(claims.claims.sub):null;if(error||!actor)return NextResponse.json({error:"Authentication required"},{status:401});
  const {schoolId,rows,errors}=await load(request);if(errors.length)return NextResponse.json({error:"Fix validation errors before commit",errors:errors.slice(0,100)},{status:422});
  const admin=createSupabaseAdminClient();const {data:created,error:importError}=await admin.rpc("import_school_setup",{p_actor_user_id:actor,p_school_id:schoolId,p_rows:rows});if(importError)throw new Error(importError.message);
  const teacherEmails=[...new Set(rows.map(r=>String(r.teacher_email??"").trim().toLowerCase()).filter(Boolean))];const invitations:{email:string;invited:boolean;error?:string}[]=[]; const teacherUserByEmail=new Map<string,string>();
  const users=await admin.auth.admin.listUsers({page:1,perPage:1000});if(users.error)throw new Error(users.error.message);
  const userByEmail=new Map(users.data.users.map(u=>[(u.email??"").toLowerCase(),u]));
  for(const email of teacherEmails){try{const existing=userByEmail.get(email);
   if(existing){const a=await admin.rpc("assign_school_role",{p_actor_user_id:actor,p_school_id:schoolId,p_target_user_id:existing.id,p_role_key:"teacher"});if(a.error)throw new Error(a.error.message); teacherUserByEmail.set(email,existing.id); invitations.push({email,invited:false});}
   else{const invited=await admin.auth.admin.inviteUserByEmail(email,{data:{school_role:"teacher"}});if(invited.error)throw new Error(invited.error.message);if(invited.data.user?.id){const a=await admin.rpc("assign_school_role",{p_actor_user_id:actor,p_school_id:schoolId,p_target_user_id:invited.data.user.id,p_role_key:"teacher"});if(a.error)throw new Error(a.error.message); teacherUserByEmail.set(email,invited.data.user.id);}invitations.push({email,invited:true});}
  }catch(e){invitations.push({email,invited:false,error:e instanceof Error?e.message:"Unable to assign teacher access"});}}
  let timetableCreated=0;
  const dayMap:Record<string,number>={mon:1,monday:1,tue:2,tuesday:2,wed:3,wednesday:3,thu:4,thursday:4,fri:5,friday:5,sat:6,saturday:6,sun:7,sunday:7};
  for(const row of rows){
   const email=String(row.teacher_email??"").trim().toLowerCase(), dayRaw=String(row.timetable_day??"").trim().toLowerCase(), period=Number(row.timetable_period);
   const teacherUserId=teacherUserByEmail.get(email), day=dayMap[dayRaw]??Number(dayRaw);
   if(!teacherUserId || !day || !period) continue;
   const yearName=String(row.academic_year??"").trim(), gradeName=String(row.grade??"").trim(), sectionName=String(row.section??"").trim(), subjectName=String(row.subject??"").trim();
   if(!subjectName) continue;
   const [{data:year},{data:grade},{data:subject}]=await Promise.all([
    admin.from("academic_years").select("id").eq("school_id",schoolId).eq("name",yearName).maybeSingle(),
    admin.from("grades").select("id").eq("school_id",schoolId).eq("name",gradeName).maybeSingle(),
    admin.from("subjects").select("id").eq("school_id",schoolId).eq("name",subjectName).maybeSingle()
   ]);
   if(!grade?.id || !subject?.id) continue;
   const {data:section}=await admin.from("sections").select("id").eq("school_id",schoolId).eq("grade_id",grade.id).eq("name",sectionName).maybeSingle();
   if(!section?.id) continue;
   const {data:exists}=await admin.from("timetable_entries").select("id").eq("school_id",schoolId).eq("section_id",section.id).eq("subject_id",subject.id).eq("teacher_user_id",teacherUserId).eq("day_of_week",day).eq("period_no",period).maybeSingle();
   if(exists) continue;
   const {error:ttError}=await admin.from("timetable_entries").insert({school_id:schoolId,section_id:section.id,subject_id:subject.id,teacher_user_id:teacherUserId,day_of_week:day,period_no:period,starts_at:row.timetable_start||null,ends_at:row.timetable_end||null,room:row.timetable_room||null,is_active:true});
   if(!ttError) timetableCreated++;
  }
  return NextResponse.json({data:{created,timetable_created:timetableCreated,teacher_accounts:invitations,message:"School setup imported successfully."}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to commit school import"},{status:400});}
}