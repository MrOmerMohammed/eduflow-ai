import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotificationsBoard from "./notifications-board";

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, status, schools(id, name, code, status)")
    .eq("user_id", userId)
    .eq("status", "active");
  const membership = memberships?.[0] as any;
  if (!membership?.schools) redirect("/setup");
  return <NotificationsBoard schoolId={membership.schools.id} schoolName={membership.schools.name} />;
}
