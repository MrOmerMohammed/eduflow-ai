const modules = [
  "Students",
  "Academics",
  "Attendance",
  "Exams",
  "Fees",
  "Staff",
  "Admissions",
  "Communication",
  "AI Assistant",
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">EduFlow AI · School ERP</p>
        <h1>One intelligent operating system for your school.</h1>
        <p className="lead">
          A secure, multi-tenant ERP foundation with an AI orchestration layer for school operations.
        </p>
        <div className="status">Infrastructure connected · Database secured · Foundation building</div>
      </section>

      <section className="grid" aria-label="ERP modules">
        {modules.map((module) => (
          <article className="card" key={module}>
            <span className="dot" />
            <h2>{module}</h2>
            <p>Module foundation planned for the EduFlow AI workflow engine.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
