import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;

  if (!userId) redirect("/auth/login");

  const params = await searchParams;
  const { data: memberships, error } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error("Unable to load your school access.");
  const membership =
    (memberships ?? []).find((item) => item.school_id === params.schoolId) ??
    memberships?.[0];

  if (!membership) redirect("/setup");
  if (membership.role !== "admin") redirect("/?schoolId=" + membership.school_id);

  redirect("/school/setup/csv?schoolId=" + membership.school_id);
}
