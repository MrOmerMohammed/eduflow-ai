import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ImportBoard from "./import-board";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ schoolId?: string; academicYearId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id,schools(id,name,code)").eq("user_id", userId).eq("status", "active");
  const params = await searchParams;
  const membership = (memberships ?? []).find((m:any) => m.school_id === params.schoolId) ?? memberships?.[0];
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  if (!membership?.school_id || !school) redirect("/setup");
  const { data: years } = await supabase.from("academic_years").select("id,name,is_current,start_date,end_date").eq("school_id", membership.school_id).order("start_date", { ascending: false });
  const yearId = params.academicYearId && (years ?? []).some((y:any) => y.id === params.academicYearId) ? params.academicYearId : (years ?? []).find((y:any) => y.is_current)?.id ?? years?.[0]?.id ?? "";
  return <ImportBoard schoolId={membership.school_id} school={{name:school.name,code:school.code}} years={years ?? []} initialYearId={yearId} />;
}