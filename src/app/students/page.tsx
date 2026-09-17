import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudentList from "./student-list";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, schools(id, name, code)")
    .eq("user_id", userId)
    .eq("status", "active");
  const requestedSchoolId = (await searchParams).schoolId;
  const membership = (memberships ?? []).find((item) => item.school_id === requestedSchoolId) ?? memberships?.[0];
  if (!membership?.schools) redirect("/setup");

  return <StudentList schoolId={membership.school_id} school={membership.schools as { name: string; code: string }} />;
}
