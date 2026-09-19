"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  status: string;
  phone: string | null;
  email: string | null;
};

type Props = { schoolId: string; school: { name: string; code: string } };

export default function StudentList({ schoolId, school }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "student.search",
          payload: { schoolId, query, status, limit: 100 },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load students");
      setStudents(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students");
    } finally {
      setLoading(false);
    }
  }, [schoolId, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav">
<Link href="/">Overview</Link>
<Link href={`/analytics?schoolId=${schoolId}`}>Analytics</Link>
<Link className="active" href={`/students?schoolId=${schoolId}`}>Students</Link>
<Link href={`/academic?schoolId=${schoolId}`}>Academic</Link>
<Link className="" href={`/attendance?schoolId=${schoolId}`}>Attendance</Link>
<Link className="" href={`/exams?schoolId=${schoolId}`}>Exams</Link>
<Link className="" href={`/finance?schoolId=${schoolId}`}>Finance</Link>
<Link className="" href={`/hr?schoolId=${schoolId}`}>Staff & HR</Link>
<Link href={`/communication?schoolId=${schoolId}`}>Communication</Link>
<Link href={`/notifications?schoolId=${schoolId}`}>Notifications</Link>
<Link href={`/parent?schoolId=${schoolId}`}>Parent Portal</Link>
<Link href={`/import?schoolId=${schoolId}`}>Data Import</Link>
<Link href={`/ai?schoolId=${schoolId}`}>AI Assistant</Link>
<Link href="/school/setup">School setup</Link>
</nav>
        <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div>
      </aside>
      <section className="dashboard">
        <header className="topbar">
          <div><p className="eyebrow">V3 · Student Information System</p><h1>Students</h1></div>
          <Link className="primary-link" href={`/students/new?schoolId=${schoolId}`}>+ Add student</Link>
        </header>
        <section className="workspace-banner">
          <div><span className="muted">Student registry</span><h2>{students.length} visible records</h2><p>Search by admission number or student name.</p></div>
          <div className="workspace-badge">RLS protected</div>
        </section>
        <section className="student-toolbar">
          <input aria-label="Search students" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or admission number…" />
          <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </section>
        {error && <p className="error page-message">{error}</p>}
        <section className="student-table-card">
          {loading ? <p className="empty">Loading students…</p> : students.length === 0 ? <p className="empty">No students match the current filters.</p> : (
            <div className="student-table-wrap">
              <table className="student-table">
                <thead><tr><th>Admission</th><th>Student</th><th>Status</th><th>Contact</th><th /></tr></thead>
                <tbody>
                  {students.map((student) => <tr key={student.id}>
                    <td><strong>{student.admission_number}</strong></td>
                    <td>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</td>
                    <td><span className={`status-pill status-${student.status}`}>{student.status}</span></td>
                    <td>{student.phone || student.email || "—"}</td>
                    <td><Link className="table-link" href={`/students/${student.id}?schoolId=${schoolId}`}>Open</Link></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
