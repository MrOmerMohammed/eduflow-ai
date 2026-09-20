import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeSchoolRole } from "@/lib/rbac";
import SchoolCsvForm from "./school-csv-form";

export default async function SchoolCsvSetupPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");

  const params = await searchParams;
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, role, schools(id, name, code)")
    .eq("user_id", userId)
    .eq("status", "active");

  const membership = ((memberships ?? []).find((item: any) => item.school_id === params.schoolId) ?? memberships?.[0]) as any;
  if (!membership?.schools) redirect("/setup");
  if (normalizeSchoolRole(membership.role) !== "admin") redirect("/?schoolId=" + membership.school_id);

  const school = membership.schools;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">School administration</p>
        <nav className="side-nav">
          <a href={"/?schoolId=" + school.id}>Overview</a>
          <a className="active" href={"/school/setup?schoolId=" + school.id}>School setup</a>
        </nav>
        <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code} · Administrator</span></div>
      </aside>
      <section className="dashboard csv-setup-dashboard">
        <header className="topbar csv-setup-topbar">
          <div>
            <p className="eyebrow">School setup · Fast onboarding</p>
            <h1>Create using CSV</h1>
            <p className="lead">Load your academic structure, students, guardians and teachers from one CSV file.</p>
          </div>
          <a className="secondary-button" href={"/school/setup?schoolId=" + school.id}>Back to setup</a>
        </header>
        <SchoolCsvForm schoolId={school.id} />
      </section>
    </main>
  );
}
