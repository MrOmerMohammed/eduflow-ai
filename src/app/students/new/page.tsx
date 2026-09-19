import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudentForm from "./student-form";

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav"><Link href={`/?schoolId=${membership.school_id}`}>Overview</Link><Link href={`/analytics?schoolId=${membership.school_id}`}>Analytics</Link><Link className="active" href={`/students?schoolId=${membership.school_id}`}>Students</Link><Link href={`/academic?schoolId=${membership.school_id}`}>Academic</Link><Link href={`/attendance?schoolId=${membership.school_id}`}>Attendance</Link><Link href={`/exams?schoolId=${membership.school_id}`}>Exams</Link><Link href={`/finance?schoolId=${membership.school_id}`}>Finance</Link><Link href={`/hr?schoolId=${membership.school_id}`}>Staff & HR</Link><Link href={`/communication?schoolId=${membership.school_id}`}>Communication</Link><Link href={`/notifications?schoolId=${membership.school_id}`}>Notifications</Link><Link href={`/parent?schoolId=${membership.school_id}`}>Parent Portal</Link><Link href={`/import?schoolId=${membership.school_id}`}>Data Import</Link><Link href={`/ai?schoolId=${membership.school_id}`}>AI Assistant</Link><Link href="/school/setup">School setup</Link></nav>
        <div className="sidebar-footer"><strong>{(membership.schools as any).name}</strong><span>{(membership.schools as any).code}</span></div>
      </aside>
      <section className="dashboard">
        <header className="topbar"><div><p className="eyebrow">V3 · Student Information System</p><h1>Add student</h1></div><Link className="secondary-link" href={`/students?schoolId=${membership.school_id}`}>Back to students</Link></header>
        <section className="student-form-card"><div><p className="muted">Student record</p><h2>Create a new student</h2><p>Required identity data is validated by the secure server gateway before it reaches the database.</p></div><StudentForm schoolId={membership.school_id} /></section>
      </section>
    </main>
  );
}
