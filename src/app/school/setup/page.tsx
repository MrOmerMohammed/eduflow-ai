import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SchoolOnboarding } from "./school-onboarding";
import { normalizeSchoolRole, SCHOOL_NAV } from "@/lib/rbac";

export default async function SchoolSetupPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const params = await searchParams;
  const { data: memberships } = await supabase.from("school_memberships")
    .select("school_id, role, schools(id, name, code)")
    .eq("user_id", userId).eq("status", "active");
  const membership = ((memberships ?? []).find((item:any)=>item.school_id===params.schoolId) ?? memberships?.[0]) as any;
  if (!membership?.schools) redirect("/setup");
  if (normalizeSchoolRole(membership.role) !== "admin") redirect("/?schoolId="+membership.school_id);

  const school = membership.schools;
  const { data: profile } = await supabase.from("school_onboarding_profiles")
    .select("answers,status,current_step").eq("school_id",school.id).maybeSingle();

  const nav = SCHOOL_NAV.filter(item => (item.roles as readonly string[]).includes("admin"));
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
      <p className="sidebar-label">School administration</p>
      <nav className="side-nav">{nav.map(item=><a key={item.href} className={item.href==="/school/setup"?"active":""} href={item.href+"?schoolId="+school.id}>{item.label}</a>)}</nav>
      <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code} · Administrator</span></div>
    </aside>
    <section className="dashboard setup-dashboard">
      <header className="topbar"><div><p className="eyebrow">Administrator setup</p><h1>School setup</h1></div><div className="user-chip"><span className="status-dot"/>Admin</div></header>
      <SchoolOnboarding schoolId={school.id} schoolName={school.name} initialAnswers={profile?.answers as any} />
    </section>
  </main>;
}
