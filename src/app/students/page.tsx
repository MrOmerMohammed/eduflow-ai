import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudentList from "./student-list";

export default async function StudentsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, schools(id, name, code)")
    .eq("user_id", userId)
    .eq("status", "active");
  const membership = memberships?.[0] as any;
  if (!membership?.schools) redirect("/setup");

  return <StudentList schoolId={membership.school_id} school={membership.schools} />;
}
