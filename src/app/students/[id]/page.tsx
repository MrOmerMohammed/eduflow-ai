import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudentDetail from "./student-detail";

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ schoolId?: string }> }) {
  const { id } = await params;
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

  const [{ data: years }, { data: grades }] = await Promise.all([
    supabase.from("academic_years").select("id, name, start_date, end_date, is_current").eq("school_id", membership.school_id).order("start_date", { ascending: false }),
    supabase.from("grades").select("id, name, code, sort_order").eq("school_id", membership.school_id).order("sort_order", { ascending: true }),
  ]);

  const school = membership.schools as { id: string; name: string; code: string };
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav"><Link href="/">Overview</Link><Link className="active" href={`/students?schoolId=${membership.school_id}`}>Students</Link><Link href="/school/setup">School setup</Link></nav>
        <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div>
      </aside>
      <section className="dashboard">
        <header className="topbar"><div><p className="eyebrow">V3 · Student Information System</p><h1>Student 360</h1></div><Link className="secondary-link" href={`/students?schoolId=${membership.school_id}`}>Back to students</Link></header>
        <StudentDetail schoolId={membership.school_id} studentId={id} academicYears={years ?? []} grades={grades ?? []} />
      </section>
    </main>
  );
}
