import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AttendanceBoard from "./attendance-board";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id, schools(id, name, code)").eq("user_id", userId).eq("status", "active");
  const requestedSchoolId = (await searchParams).schoolId;
  const membership = (memberships ?? []).find((item) => item.school_id === requestedSchoolId) ?? memberships?.[0];
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  if (!membership?.school_id || !school) redirect("/setup");

  const [{ data: years }, { data: sections }] = await Promise.all([
    supabase.from("academic_years").select("id, name, is_current, start_date, end_date").eq("school_id", membership.school_id).order("start_date", { ascending: false }),
    supabase.from("sections").select("id, name, grade_id, grades(name, code)").eq("school_id", membership.school_id).order("grade_id").order("name"),
  ]);

  return <AttendanceBoard schoolId={membership.school_id} school={{ name: school.name, code: school.code }} years={years ?? []} sections={(sections ?? []).map((section: any) => ({ id: section.id, name: section.name, gradeName: Array.isArray(section.grades) ? section.grades[0]?.name ?? "" : section.grades?.name ?? "" }))} />;
}
