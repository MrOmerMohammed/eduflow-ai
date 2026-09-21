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
  ["AI Assistant","Authorized AI actions through the gateway","/ai"],
] as const;

function MarketingHome() {
  const features = [
    ["Student Management", "Admissions, student profiles, enrollment and school records in one place."],
    ["Attendance", "Give teachers a fast daily workflow for marking and reviewing attendance."],
    ["Academics & Exams", "Organize grades, sections, subjects, assessments and results."],
    ["Fees & Finance", "Track fee structures, student balances, invoices and collections workflows."],
    ["Staff & HR", "Manage staff records, school roles and operational HR workflows."],
    ["AI Assistant", "Ask authorized school questions and get structured answers from your workspace data."],
  ];

  const plans = [
    { name: "Starter", price: "₹1,999", students: "Up to 500 students", text: "Core school operations", featured: false },
    { name: "Growth", price: "₹4,999", students: "Up to 1,500 students", text: "Full operating layer + AI", featured: true },
    { name: "Pro", price: "₹9,999", students: "Up to 5,000 students", text: "Multi-school & advanced operations", featured: false },
  ];

  return <main className="marketing-shell">
    <nav className="marketing-nav">
      <a className="brand" href="/"><span className="brand-mark">E</span><span>EduFlow AI</span></a>
      <div className="marketing-links">
        <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="/security">Security</a><a href="/auth/login">Sign in</a>
        <a className="marketing-cta" href="/auth/sign-up">Try EduFlow AI</a>
      </div>
    </nav>

    <section className="hero marketing-hero">
      <div className="hero-copy">
        <p className="eyebrow">Modern school management software</p>
        <h1>Everything your school needs. <span className="hero-highlight">One simple workspace.</span></h1>
        <p className="hero-lead">EduFlow AI helps administrators, teachers and staff manage students, academics, attendance, exams, fees, communication and school operations without jumping between disconnected systems.</p>
        <div className="hero-actions">
          <a className="primary-link" href="/auth/sign-up">Start your free 14-day trial →</a>
          <a className="secondary-link" href="#pricing">See plans & pricing</a>
        </div>
        <div className="hero-proof"><span>✓ No payment required to start</span><span>✓ Role-based access</span><span>✓ Built for growing schools</span></div>
      </div>
      <div className="hero-panel marketing-dashboard-preview">
        <div className="hero-panel-head"><span>EduFlow AI command center</span><b>Live workspace</b></div>
        <div className="preview-welcome"><span>Good morning</span><strong>School overview</strong><small>Everything important at a glance.</small></div>
        <div className="hero-metrics">
          <div><span>Students</span><strong>600+</strong><small>Active records</small></div>
          <div><span>Attendance</span><strong>94.8%</strong><small>This month</small></div>
          <div><span>Staff</span><strong>42</strong><small>Active staff</small></div>
          <div><span>Fees</span><strong>₹8.4L</strong><small>Tracked</small></div>
        </div>
        <div className="preview-ai"><span>AI Assistant</span><strong>“Give me today's attendance summary.”</strong><small>Authorized school data → structured answer</small></div>
      </div>
    </section>

    <section className="marketing-section marketing-trust">
      <p className="eyebrow">Designed around school roles</p>
      <h2>One platform, different views for different people.</h2>
      <div className="role-strip">
        <article><span className="role-icon">A</span><strong>Administrator</strong><p>School-wide control, setup, finance, staff and analytics.</p></article>
        <article><span className="role-icon">T</span><strong>Teacher</strong><p>Students, academics, attendance, exams and teaching workflows.</p></article>
        <article><span className="role-icon">S</span><strong>Staff</strong><p>Operational access to the information needed for daily work.</p></article>
      </div>
    </section>

    <section id="features" className="marketing-section">
      <p className="eyebrow">What you can manage</p>
      <h2>Replace scattered spreadsheets and disconnected tools with one operating layer.</h2>
      <div className="value-grid">{features.map(([title, description], index) => <article className="value-card feature-card" key={title}><span className="feature-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>

    <section id="how-it-works" className="marketing-section how-section">
      <div className="split">
        <div><p className="eyebrow">Get started in minutes</p><h2>From signup to school workspace.</h2><p className="lead">Create your administrator account, set up the school workspace, import your school data, invite teachers and staff, then start using the modules your role allows.</p><a className="primary-link" href="/auth/sign-up">Create a school workspace →</a></div>
        <div className="feature-list">
          <p><strong>01 · Create</strong><br/>Create your administrator account and school workspace.</p>
          <p><strong>02 · Import</strong><br/>Use the one-CSV onboarding flow to load grades, sections, subjects, students and staff records.</p>
          <p><strong>03 · Assign</strong><br/>Assign teacher and staff access with role-based permissions.</p>
          <p><strong>04 · Operate</strong><br/>Run attendance, academics, exams, communication, HR and other daily workflows.</p>
        </div>
      </div>
    </section>

    <section id="pricing" className="marketing-pricing">
      <div className="marketing-pricing-head"><div><p className="eyebrow">Simple, transparent pricing</p><h2>Start small. Scale with your school.</h2></div><a className="secondary-link" href="/pricing">Compare all plan details →</a></div>
      <div className="marketing-price-grid">{plans.map(plan => <article className={`marketing-price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <span className="pricing-badge">Recommended for growing schools</span>}<span className="plan-name">{plan.name}</span><div className="marketing-price">{plan.price}<small>/month</small></div><strong>{plan.students}</strong><p>{plan.text}</p><a className={plan.featured ? "primary-link" : "secondary-link"} href="/auth/sign-up">Try this plan →</a></article>)}</div>
      <p className="pricing-disclaimer">14-day trial. No payment required to create a workspace. Pricing shown is the current listed monthly plan pricing.</p>
    </section>

    <section className="marketing-bottom">
      <div><p className="eyebrow">Ready to see it in action?</p><h2>Build your school's workspace and explore EduFlow AI.</h2><p>Create a trial workspace, load your school data, and experience the role-based school management workflow.</p><div className="hero-actions"><a className="primary-link" href="/auth/sign-up">Try EduFlow AI free →</a><a className="secondary-link dark-secondary" href="/pricing">View pricing</a></div></div>
    </section>

    <footer className="marketing-footer"><span>© {new Date().getFullYear()} EduFlow AI</span><div><a href="/pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a><a href="/auth/login">Sign in</a></div></footer>
  </main>;
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
  if (!role) redirect("/setup");
  const nav = SCHOOL_NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => ({
    ...item,
    href: `${item.href}?schoolId=${school.id}`,
  }));

  let teacherSchedule: any[] = [];
  if (role === "teacher") {
    const { data } = await supabase
      .from("timetable_entries")
      .select("id,day_of_week,period_no,starts_at,ends_at,room,sections(name,grades(name)),subjects(name,code)")
      .eq("school_id", school.id)
      .eq("teacher_user_id", userId)
      .eq("is_active", true)
      .order("day_of_week")
      .order("period_no");
    teacherSchedule = data ?? [];
  }

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
      {role === "teacher" && (
        <section className="teacher-home-card">
          <div className="section-heading"><div><p className="eyebrow">Teaching workflow</p><h2>Your teaching day</h2></div><span>{teacherSchedule.length} scheduled classes</span></div>
          <div className="teacher-quick-actions">
            <a className="primary-link" href={`/attendance?schoolId=${school.id}`}>Take attendance →</a>
            <a className="secondary-link" href={`/exams?schoolId=${school.id}`}>Enter marks</a>
            <a className="secondary-link" href={`/academic?schoolId=${school.id}`}>Plan lessons</a>
            <a className="secondary-link" href={`/students?schoolId=${school.id}`}>View students</a>
          </div>
          {teacherSchedule.length ? (
            <div className="teacher-schedule-list">{teacherSchedule.map((item: any) => {
              const section = Array.isArray(item.sections) ? item.sections[0] : item.sections;
              const grade = Array.isArray(section?.grades) ? section.grades[0] : section?.grades;
              const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
              const day = ["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][item.day_of_week] ?? "Day";
              return <div className="teacher-schedule-row" key={item.id}><strong>{day} · Period {item.period_no}</strong><span>{grade?.name ? grade.name + " · " : ""}{section?.name ?? "Section"}</span><span>{subject?.name ?? "Subject"}</span><small>{item.starts_at && item.ends_at ? item.starts_at + "–" + item.ends_at : "Time not set"}{item.room ? " · " + item.room : ""}</small></div>;
            })}</div>
          ) : <p className="empty">No teaching timetable has been assigned yet. Ask the administrator to assign your classes.</p>}
        </section>
      )}

      <section className="section-heading"><div><p className="eyebrow">Your permissions</p><h2>Available modules</h2></div><span>{nav.length} modules</span></section>
      <section className="module-grid">{visibleModules.map(([name, description, href]) => <article className="module-card" key={name}><div className="module-icon">{name.slice(0, 1)}</div><h3>{name}</h3><p>{description}</p><a className="table-link" href={`${href}?schoolId=${school.id}`}>Open →</a></article>)}</section>
    </section>
  </main>;
}
