import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const modules = [
  ["Students", "Student records, admissions and enrollment"],
  ["Academics", "Years, grades, sections and curriculum"],
  ["Attendance", "Daily attendance and absence workflows"],
  ["Exams", "Assessment planning and report cards"],
  ["Fees", "Invoices, balances and collections"],
  ["Staff", "Staff records, roles and HR workflows"],
  ["Admissions", "Applications and admission pipeline"],
  ["Communication", "School-wide and targeted messaging"],
  ["AI Assistant", "Authorized AI actions through the gateway"],
] as const;

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const [{ data: memberships }, { data: roles }] = await Promise.all([
    supabase.from("school_memberships").select("school_id, role, status, schools(id, organization_id, name, code, status)").eq("user_id", userId).eq("status", "active"),
    supabase.from("user_roles").select("roles(key, name, scope)").eq("user_id", userId),
  ]);
  const membership = memberships?.[0] as any;
  if (!membership?.schools) redirect("/setup");
  const school = membership.schools;
  const [{ count: yearCount }, { count: gradeCount }, { count: sectionCount }] = await Promise.all([
    supabase.from("academic_years").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("grades").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("sections").select("id", { count: "exact", head: true }).eq("school_id", school.id),
  ]);
  const roleNames = (roles ?? []).map((item: any) => item.roles?.name).filter(Boolean);

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">Workspace</p><nav className="side-nav"><a className="active" href="/">Overview</a><a href="#academics">Academics</a><a href="#modules">ERP Modules</a><a href="#gateway">Gateway</a></nav><div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div></aside><section className="dashboard"><header className="topbar"><div><p className="eyebrow">V2 · School Management</p><h1>School command center</h1></div><div className="user-chip"><span className="status-dot" />{roleNames.join(" · ") || membership.role}</div></header><section className="workspace-banner"><div><span className="muted">Active school</span><h2>{school.name}</h2><p>{school.code} · Multi-tenant workspace ready</p></div><div className="workspace-badge">Authenticated & protected</div></section><section className="metric-grid" id="academics"><article className="metric"><span>Academic years</span><strong>{yearCount ?? 0}</strong><small>Configured</small></article><article className="metric"><span>Grades</span><strong>{gradeCount ?? 0}</strong><small>Configured</small></article><article className="metric"><span>Sections</span><strong>{sectionCount ?? 0}</strong><small>Configured</small></article><article className="metric"><span>Access model</span><strong>RBAC</strong><small>RLS enforced</small></article></section><section className="section-heading" id="modules"><div><p className="eyebrow">Operating system</p><h2>ERP modules</h2></div><span>V2 foundation</span></section><section className="module-grid">{modules.map(([name, description]) => <article className="module-card" key={name}><div className="module-icon">{name.slice(0, 1)}</div><h3>{name}</h3><p>{description}</p><span>Version planned</span></article>)}</section><section className="gateway-card" id="gateway"><div><p className="eyebrow">Application gateway</p><h2>One controlled path for every action.</h2><p>Requests enter the Next.js gateway, identity and role checks run first, authorized operations execute through Supabase, and privileged mutations are recorded in the audit layer.</p></div><div className="gateway-flow"><span>Intent</span><b>→</b><span>Auth</span><b>→</b><span>Permission</span><b>→</b><span>Action</span><b>→</b><span>Audit</span></div></section></section></main>;
}
