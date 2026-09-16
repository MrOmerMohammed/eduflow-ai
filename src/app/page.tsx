import { requireAuth } from "@/lib/auth/guards";

const modules = [
  "Students", "Academics", "Attendance", "Exams", "Fees", "Staff", "Admissions", "Communication", "AI Assistant",
];

export default async function HomePage() {
  const context = await requireAuth();
  const roleNames = context.roles.map((item: any) => item.roles?.name).filter(Boolean);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">EduFlow AI · School ERP</p>
        <h1>One intelligent operating system for your school.</h1>
        <p className="lead">Welcome{context.profile?.full_name ? `, ${context.profile.full_name}` : ""}. Your authenticated workspace is ready.</p>
        <div className="status">Authenticated · {roleNames.length ? roleNames.join(" · ") : "Role pending assignment"}</div>
      </section>
      <section className="grid" aria-label="ERP modules">
        {modules.map((module) => <article className="card" key={module}><span className="dot" /><h2>{module}</h2><p>Module foundation planned for the EduFlow AI workflow engine.</p></article>)}
      </section>
    </main>
  );
}
