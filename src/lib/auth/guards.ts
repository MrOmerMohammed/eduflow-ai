import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const userId = String(data.claims.sub);
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, phone, avatar_url, metadata")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: roles } = await supabase
    .from("user_roles")
    .select("id, role_id, organization_id, school_id, roles(key, name, scope)")
    .eq("user_id", userId);

  return { userId, profile, roles: roles ?? [] };
}

export async function requireAuth() {
  const context = await getAuthContext();
  if (!context) redirect("/auth/login");
  return context;
}
