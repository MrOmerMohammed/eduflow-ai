import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  try{
    const body=await request.json() as {schoolId?:unknown;academicYearId?:unknown};
    if(typeof body.schoolId!=="string"||!body.schoolId.trim()||typeof body.academicYearId!=="string"||!body.academicYearId.trim()) return NextResponse.json({error:"School and academic year are required"},{status:400});
    const supabase=await createSupabaseServerClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();
    const userId=claims?.claims?.sub?String(claims.claims.sub):null;
    if(claimsError||!userId)return NextResponse.json({error:"Authentication required"},{status:401});
    const admin=createSupabaseAdminClient();
    const {data,error}=await admin.rpc("get_management_dashboard",{p_actor_user_id:userId,p_school_id:body.schoolId,p_academic_year_id:body.academicYearId});
    if(error)throw new Error(error.message);
    return NextResponse.json({data});
  }catch(error){
    const message=error instanceof Error?error.message:"Analytics request failed";
    const safe=/required|not found|permission|access denied|unauthorized|forbidden/i.test(message)?message:"Unable to load management analytics";
    return NextResponse.json({error:safe},{status:400});
  }
}