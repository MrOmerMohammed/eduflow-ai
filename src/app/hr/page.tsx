import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import HRBoard from "./hr-board";

export default async function HRPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id,role,status,schools(id,name,code)").eq("user_id", userId).eq("status", "active");
  const requested = (await searchParams).schoolId;
  const membership = (memberships ?? []).find((m) => m.school_id === requested) ?? memberships?.[0];
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  if (!membership?.school_id || !school) redirect("/setup");
  return <HRBoard schoolId={membership.school_id} school={{ name: school.name, code: school.code }} />;
}
