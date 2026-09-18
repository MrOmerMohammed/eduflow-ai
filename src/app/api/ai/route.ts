import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function extractAdmission(text:string){ const m=text.match(/\b(?:admission(?: number)?|adm(?:ission)? no\.?)\s*[:#-]?\s*([A-Za-z0-9-]+)/i); return m?.[1]??null; }
function extractUuid(text:string){ const m=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i); return m?.[0]??null; }

export async function POST(request:Request){
 try{
  const server=await createSupabaseServerClient();
  const {data:claims}=await server.auth.getClaims();
  const userId=claims?.claims?.sub?String(claims.claims.sub):null;
  if(!userId) return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json();
  const schoolId=String(body.schoolId??"");
  const message=String(body.message??"").trim();
  if(!schoolId||!message) return NextResponse.json({error:"schoolId and message are required"},{status:400});
  const admin=createSupabaseAdminClient();

  const {data:authz,error:authzError}=await admin.rpc("ai_authorize_tool",{p_actor_user_id:userId,p_school_id:schoolId,p_tool_slug:"student.search",p_input:{query:message}});
  if(authzError) throw new Error(authzError.message);

  let toolSlug:string;
  let input:Record<string,unknown>={};
  const lower=message.toLowerCase();
  const admission=extractAdmission(message);
  const uuid=extractUuid(message);

  if(admission||uuid){
    toolSlug="student.get"; input=uuid?{studentId:uuid}:{admissionNumber:admission};
  } else if(lower.includes("attendance")||lower.includes("present")||lower.includes("absent")){
    toolSlug="attendance.student"; input={studentId:uuid};
  } else if(lower.includes("dashboard")||lower.includes("kpi")||lower.includes("analytics")||lower.includes("overview")){
    toolSlug="management.dashboard"; input={};
  } else {
    toolSlug="student.search"; input={query:message};
  }

  const {data:authorization,error:authorizationError}=await admin.rpc("ai_authorize_tool",{p_actor_user_id:userId,p_school_id:schoolId,p_tool_slug:toolSlug,p_input:input});
  if(authorizationError) throw new Error(authorizationError.message);
  if(!authorization?.allowed) return NextResponse.json({data:{status:"denied",tool:toolSlug,reason:authorization?.reason}},{status:403});

  let result:any=null;
  if(toolSlug==="student.search"){
    const q=String(input.query??"").replace(/[%_]/g,"");
    const {data,error}=await admin.from("students").select("id,admission_number,first_name,middle_name,last_name,phone,status").eq("school_id",schoolId).or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%,phone.ilike.%${q}%`).limit(20);
    if(error) throw new Error(error.message); result=data??[];
  } else if(toolSlug==="student.get"){
    let query=admin.from("students").select("id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status").eq("school_id",schoolId).limit(1);
    query=uuid?query.eq("id",uuid):query.eq("admission_number",String(input.admissionNumber));
    const {data,error}=await query.maybeSingle(); if(error) throw new Error(error.message); result=data??null;
  } else if(toolSlug==="attendance.student"){
    if(!uuid) return NextResponse.json({data:{status:"needs_input",message:"Please provide the student's UUID for attendance lookup."}});
    const {data,error}=await admin.rpc("get_student_attendance_summary",{p_actor_user_id:userId,p_school_id:schoolId,p_student_id:uuid});
    if(error) throw new Error(error.message); result=data;
  } else if(toolSlug==="management.dashboard"){
    const {data:year,error:yearError}=await admin.from("academic_years").select("id").eq("school_id",schoolId).eq("is_current",true).maybeSingle();
    if(yearError) throw new Error(yearError.message); if(!year) throw new Error("No current academic year configured");
    const {data,error}=await admin.rpc("get_management_dashboard",{p_actor_user_id:userId,p_school_id:schoolId,p_academic_year_id:year.id});
    if(error) throw new Error(error.message); result=data;
  }

  const {data:conversation,error:conversationError}=await admin.rpc("ai_create_conversation",{p_actor_user_id:userId,p_school_id:schoolId,p_title:message.slice(0,120)});
  if(conversationError) throw new Error(conversationError.message);
  const {error:messageError}=await admin.from("ai_messages").insert({conversation_id:conversation,role:"assistant",content:JSON.stringify({tool:toolSlug,result}),tool_name:toolSlug,tool_result:result});
  if(messageError) throw new Error(messageError.message);
  return NextResponse.json({data:{status:"success",tool:toolSlug,result}});
 }catch(e){
  const message=e instanceof Error?e.message:"AI request failed";
  return NextResponse.json({error:message},{status:400});
 }
}