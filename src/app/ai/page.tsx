import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AiBoard from "./ai-board";

export default async function AiPage({searchParams}:{searchParams:Promise<{schoolId?:string}>}){
 const supabase=await createSupabaseServerClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub) redirect("/auth/login");
 const userId=String(claims.claims.sub);
 const params=await searchParams;
 const {data:memberships}=await supabase.from("school_memberships").select("school_id,role,schools(id,name,code)").eq("user_id",userId).eq("status","active");
 const membership=(memberships??[]).find((m:any)=>m.school_id===params.schoolId)??memberships?.[0];
 const school=Array.isArray(membership?.schools)?membership.schools[0]:membership?.schools;
 if(!membership?.school_id||!school) redirect("/setup");
 return <AiBoard schoolId={membership.school_id} role={membership.role} school={{name:school.name,code:school.code}} />;
}