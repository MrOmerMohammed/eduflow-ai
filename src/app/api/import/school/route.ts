import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED=["academic_year","academic_year_start","academic_year_end","grade","section","admission_number","first_name"];
const OPTIONAL=["grade_code","section_capacity","subject","subject_code","roll_number","date_of_birth","gender","student_email","student_phone","student_status","guardian_name","guardian_relationship","guardian_phone","guardian_email","guardian_primary","teacher_name","teacher_first_name","teacher_last_name","teacher_email","teacher_phone","teacher_employee_number","teacher_designation","teacher_department","teacher_employment_type","teacher_joining_date"];

function cell(v:ExcelJS.CellValue){return v===null||v===undefined?"":String(v).trim();}
function parseRows(workbook:ExcelJS.Workbook){
 const ws=workbook.worksheets[0]; if(!ws) throw new Error("CSV has no rows");
 const headers=(ws.getRow(1).values as ExcelJS.CellValue[]).map(v=>cell(v).toLowerCase().replace(/\s+/g,"_"));
 const missing=REQUIRED.filter(h=>!headers.includes(h));
 if(missing.length) throw new Error("Missing required columns: "+missing.join(", "));
 const col=(h:string)=>headers.indexOf(h)+1;
 const rows:Record<string,unknown>[]=[];
 ws.eachRow((row,n)=>{
   if(n===1)return;
   const out:Record<string,unknown>={};
   for(const h of [...REQUIRED,...OPTIONAL]) if(headers.includes(h)) out[h]=cell(row.getCell(col(h)).value);
   if(Object.values(out).every(v=>v==="")) return;
   rows.push(out);
 });
 if(!rows.length) throw new Error("No data rows were found");
 if(rows.length>10000) throw new Error("CSV exceeds the 10,000-row safety limit");
 const errors:string[]=[];
 const seen=new Set<string>();
 rows.forEach((r,i)=>{
   const line=i+2;
   for(const h of REQUIRED) if(!String(r[h]??"").trim()) errors.push(`Row ${line}: ${h} is required`);
   const admission=String(r.admission_number??"").trim().toLowerCase();
   if(admission){if(seen.has(admission)) errors.push(`Row ${line}: duplicate admission_number ${r.admission_number} in CSV`);seen.add(admission);}
   if(r.date_of_birth && Number.isNaN(Date.parse(String(r.date_of_birth)))) errors.push(`Row ${line}: invalid date_of_birth`);
   if(r.academic_year_start && Number.isNaN(Date.parse(String(r.academic_year_start)))) errors.push(`Row ${line}: invalid academic_year_start`);
   if(r.academic_year_end && Number.isNaN(Date.parse(String(r.academic_year_end)))) errors.push(`Row ${line}: invalid academic_year_end`);
   if(r.teacher_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.teacher_email))) errors.push(`Row ${line}: invalid teacher_email`);
 });
 return {rows,errors,worksheet:ws.name,headers};
}

async function load(request:Request){
 const form=await request.formData(); const file=form.get("file"); const schoolId=String(form.get("schoolId")??"");
 if(!(file instanceof File)) throw new Error("CSV file is required");
 if(!UUID.test(schoolId)) throw new Error("schoolId must be a valid UUID");
 if(file.size>10*1024*1024) throw new Error("CSV must be 10 MB or smaller");
 if(!/\.csv$/i.test(file.name)) throw new Error("Only .csv files are supported");
 const workbook=new ExcelJS.Workbook(); await workbook.csv.load(Buffer.from(await file.arrayBuffer()).toString("utf8"));
 return {form,schoolId,file,workbook,...parseRows(workbook)};
}

export async function POST(request:Request){
 try{
  const supabase=await createSupabaseServerClient(); const {data:claims,error:claimError}=await supabase.auth.getClaims();
  const actor=claims?.claims?.sub?String(claims.claims.sub):null; if(claimError||!actor)return NextResponse.json({error:"Authentication required"},{status:401});
  const {schoolId,rows,errors,worksheet}=await load(request);
  if(errors.length)return NextResponse.json({data:{valid:false,rowsParsed:rows.length,errorCount:errors.length,errors:errors.slice(0,100),worksheet}}, {status:422});
  return NextResponse.json({data:{valid:true,rowsParsed:rows.length,columns:Object.keys(rows[0]??{}),worksheet,preview:rows.slice(0,10),message:"Preview only. No school records were written."}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to preview CSV"},{status:400});}
}

export async function PUT(request:Request){
 try{
  const supabase=await createSupabaseServerClient(); const {data:claims,error:claimError}=await supabase.auth.getClaims();
  const actor=claims?.claims?.sub?String(claims.claims.sub):null; if(claimError||!actor)return NextResponse.json({error:"Authentication required"},{status:401});
  const {schoolId,rows,errors}=await load(request);
  if(errors.length)return NextResponse.json({error:"Fix validation errors before commit",errors:errors.slice(0,100)},{status:422});
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("import_school_setup",{p_actor_user_id:actor,p_school_id:schoolId,p_rows:rows});
  if(error)throw new Error(error.message);
  const teacherEmails=[...new Set(rows.map(r=>String(r.teacher_email??"").trim().toLowerCase()).filter(Boolean))];
  const invitations:{email:string;invited:boolean;error?:string}[]=[];
  for(const email of teacherEmails){
    try{
      const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
      const existing=users.data.users.find(u=>u.email?.toLowerCase()===email);
      if(existing){
        await admin.rpc("assign_school_role",{p_actor_user_id:actor,p_school_id:schoolId,p_target_user_id:existing.id,p_role_key:"teacher"});
        invitations.push({email,invited:false});
      }else{
        const invited=await admin.auth.admin.inviteUserByEmail(email,{data:{school_role:"teacher"}});
        if(invited.error) throw new Error(invited.error.message);
        if(invited.data.user?.id) await admin.rpc("assign_school_role",{p_actor_user_id:actor,p_school_id:schoolId,p_target_user_id:invited.data.user.id,p_role_key:"teacher"});
        invitations.push({email,invited:true});
      }
    }catch(e){invitations.push({email,invited:false,error:e instanceof Error?e.message:"Unable to assign teacher access"});}
  }
  return NextResponse.json({data:{created:data,teacher_accounts:invitations,message:"School setup imported successfully."}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to commit school import"},{status:400});}
}