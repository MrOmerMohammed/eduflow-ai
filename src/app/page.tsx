import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import { SCHOOL_NAV, normalizeSchoolRole } from "@/lib/rbac";

const modules = [
  ["Students","Student records, admissions and enrollment","/students"],
  ["Academics","Years, grades, sections and curriculum","/academic"],
  ["Attendance","Daily attendance and absence workflows","/attendance"],
  ["Exams","Assessment planning and report cards","/exams"],
  ["Fees","Invoices, balances and collections","/finance"],
  ["Staff","Staff records, roles and HR workflows","/hr"],
  ["Communication","School-wide and targeted messaging","/communication"],
  ["Analytics","Management KPIs and operational intelligence","/analytics"],
  ["Data Import","Safe workbook staging, validation and migration","/import"],
  ["AI Assistant","Authorized AI actions through the gateway","/ai"],
] as const;

function MarketingHome() {
  return <main className="marketing-shell"><nav className="marketing-nav"><a className="brand" href="/"><span className="brand-mark">E</span><span>EduFlow AI</span></a><div className="marketing-links"><a href="/pricing">Pricing</a><a href="/security">Security</a><a href="/auth/login">Sign in</a><a className="marketing-cta" href="/auth/sign-up">Start free trial</a></div></nav><section className="hero"><div className="hero-copy"><p className="eyebrow">AI-native school ERP</p><h1>Run your school from one command center.</h1><p className="hero-lead">EduFlow AI brings students, attendance, exams, fees, staff, communication, analytics and an authorized AI assistant into one multi-tenant workspace.</p><div className="hero-actions"><a className="primary-link" href="/auth/sign-up">Start 14-day trial</a><a className="secondary-link" href="/pricing">View pricing</a></div><p className="trust-line">Built for private schools, school groups and growing education operators.</p></div><div className="hero-panel"><div className="hero-panel-head"><span>School command center</span><b>Role-aware workspace</b></div><div className="hero-metrics"><div><span>Students</span><strong>600+</strong></div><div><span>Attendance</span><strong>Today</strong></div><div><span>Fees</span><strong>Tracked</strong></div><div><span>Access</span><strong>RBAC</strong></div></div><div className="hero-flow"><span>Sign in</span><b>→</b><span>Role</span><b>→</b><span>Permissions</span><b>→</b><span>Workspace</span></div></div></section><section className="marketing-section"><p className="eyebrow">Everything schools need</p><h2>One operating layer for every school role.</h2></section><footer className="marketing-footer"><span>© 2026 EduFlow AI</span><div><a href="/pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a></div></footer></main>;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return <MarketingHome />;
  const userId = String(claimsData.claims.sub);
  const params = await searchParams;

  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, role, status, schools(id, organization_id, name, code, status)")
    .eq("user_id", userId)
    .eq("status", "active");

  const membership = ((memberships ?? []).find((item: any) => item.school_id === params.schoolId) ?? memberships?.[0]) as any;
  if (!membership?.schools) redirect("/setup");

  const school = membership.schools;
  const role = normalizeSchoolRole(membership.role);
  const nav = SCHOOL_NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => ({
    ...item,
    href: `${item.href}?schoolId=${school.id}`,
  }));

  const [{ count: yearCount }, { count: gradeCount }, { count: sectionCount }, { count: staffCount }] = await Promise.all([
    supabase.from("academic_years").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("grades").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("sections").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "active"),
  ]);

  const visibleModules = modules.filter(([, , href]) => nav.some((item) => item.href.startsWith(href + "?")));

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
      <p className="sidebar-label">Workspace</p>
      <nav className="side-nav">{nav.map((item) => <a key={item.href} className={item.href.startsWith("/?") ? "active" : ""} href={item.href}>{item.label}</a>)}</nav>
      <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code} · {role}</span></div>
    </aside>
    <section className="dashboard">
      <header className="topbar"><div><p className="eyebrow">Role-based school workspace</p><h1>{role === "admin" ? "School command center" : role === "teacher" ? "Teacher workspace" : "Staff workspace"}</h1></div><div className="user-chip"><span className="status-dot"/>{role}<SignOutButton /></div></header>
      <section className="workspace-banner"><div><span className="muted">Active school</span><h2>{school.name}</h2><p>{school.code} · Access is restricted to your assigned role.</p></div><div className="workspace-badge">{role.toUpperCase()} ACCESS</div></section>
      <section className="metric-grid"><article className="metric"><span>Academic years</span><strong>{yearCount ?? 0}</strong><small>Visible to your role</small></article><article className="metric"><span>Grades</span><strong>{gradeCount ?? 0}</strong><small>Visible to your role</small></article><article className="metric"><span>Sections</span><strong>{sectionCount ?? 0}</strong><small>Visible to your role</small></article><article className="metric"><span>Active staff</span><strong>{staffCount ?? 0}</strong><small>Workspace records</small></article></section>
      <section className="section-heading"><div><p className="eyebrow">Your permissions</p><h2>Available modules</h2></div><span>{nav.length} modules</span></section>
      <section className="module-grid">{visibleModules.map(([name, description, href]) => <article className="module-card" key={name}><div className="module-icon">{name.slice(0, 1)}</div><h3>{name}</h3><p>{description}</p><a className="table-link" href={`${href}?schoolId=${school.id}`}>Open →</a></article>)}</section>
    </section>
  </main>;
}
