import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudentForm from "./student-form";

export default async function NewStudentPage() {
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav"><Link href="/">Overview</Link><Link className="active" href="/students">Students</Link><Link href="/school/setup">School setup</Link></nav>
        <div className="sidebar-footer"><strong>{membership.schools.name}</strong><span>{membership.schools.code}</span></div>
      </aside>
      <section className="dashboard">
        <header className="topbar"><div><p className="eyebrow">V3 · Student Information System</p><h1>Add student</h1></div><Link className="secondary-link" href="/students">Back to students</Link></header>
        <section className="student-form-card"><div><p className="muted">Student record</p><h2>Create a new student</h2><p>Required identity data is validated by the secure server gateway before it reaches the database.</p></div><StudentForm schoolId={membership.school_id} /></section>
      </section>
    </main>
  );
}
