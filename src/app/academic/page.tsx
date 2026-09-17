import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AcademicBoard from "./academic-board";

export default async function AcademicPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id, schools(id,name,code)").eq("user_id", userId).eq("status", "active");
  const requested = (await searchParams).schoolId;
  const membership = (memberships ?? []).find((m) => m.school_id === requested) ?? memberships?.[0];
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  if (!membership?.school_id || !school) redirect("/setup");
  const [{ data: grades }, { data: sections }, { data: subjects }, { data: units }, { data: lessons }, { data: timetable }] = await Promise.all([
    supabase.from("grades").select("id,name,code").eq("school_id", membership.school_id).order("sort_order"),
    supabase.from("sections").select("id,name,grade_id,grades(name)").eq("school_id", membership.school_id).order("name"),
    supabase.from("subjects").select("id,name,code,description,is_active").eq("school_id", membership.school_id).order("name"),
    supabase.from("curriculum_units").select("id,name,grade_id,subject_id,sequence_no,description,grades(name),subjects(name,code)").eq("school_id", membership.school_id).order("sequence_no"),
    supabase.from("lessons").select("id,title,section_id,subject_id,scheduled_date,status,content,sections(name),subjects(name,code)").eq("school_id", membership.school_id).order("scheduled_date", { ascending: false }).limit(50),
    supabase.from("timetable_entries").select("id,section_id,subject_id,teacher_user_id,day_of_week,period_no,starts_at,ends_at,room,sections(name),subjects(name,code)").eq("school_id", membership.school_id).eq("is_active", true).order("day_of_week").order("period_no"),
  ]);
  return <AcademicBoard schoolId={membership.school_id} school={{name:school.name,code:school.code}} grades={grades ?? []} sections={(sections ?? []).map((s:any)=>({id:s.id,name:s.name,gradeId:s.grade_id,gradeName:Array.isArray(s.grades)?s.grades[0]?.name??"":s.grades?.name??""}))} subjects={subjects ?? []} units={(units ?? []).map((u:any)=>({id:u.id,name:u.name,gradeId:u.grade_id,subjectId:u.subject_id,sequenceNo:u.sequence_no,description:u.description,gradeName:Array.isArray(u.grades)?u.grades[0]?.name??"":u.grades?.name??"",subjectName:Array.isArray(u.subjects)?u.subjects[0]?.name??"":u.subjects?.name??""}))} lessons={(lessons ?? []).map((l:any)=>({id:l.id,title:l.title,sectionId:l.section_id,subjectId:l.subject_id,scheduledDate:l.scheduled_date,status:l.status,content:l.content,sectionName:Array.isArray(l.sections)?l.sections[0]?.name??"":l.sections?.name??"",subjectName:Array.isArray(l.subjects)?l.subjects[0]?.name??"":l.subjects?.name??""}))} timetable={(timetable ?? []).map((t:any)=>({id:t.id,sectionId:t.section_id,subjectId:t.subject_id,teacherUserId:t.teacher_user_id,day:t.day_of_week,period:t.period_no,startsAt:t.starts_at,endsAt:t.ends_at,room:t.room,sectionName:Array.isArray(t.sections)?t.sections[0]?.name??"":t.sections?.name??"",subjectName:Array.isArray(t.subjects)?t.subjects[0]?.name??"":t.subjects?.name??""}))} />;
}
