"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Year = { id: string; name: string; is_current: boolean; start_date: string; end_date: string };
type Section = { id: string; name: string; gradeName: string };
type Row = { enrollment_id: string; student_id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string | null; roll_number: string | null; status: "present" | "absent" | "late" | "excused"; remarks: string | null };
type Props = { schoolId: string; school: { name: string; code: string }; years: Year[]; sections: Section[] };
const statuses = ["present", "absent", "late", "excused"] as const;
function localDate() { const d = new Date(); const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10); }

export default function AttendanceBoard({ schoolId, school, years, sections }: Props) {
  const [yearId, setYearId] = useState(years.find((year) => year.is_current)?.id ?? years[0]?.id ?? "");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [date, setDate] = useState(localDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const selectedSection = useMemo(() => sections.find((section) => section.id === sectionId), [sections, sectionId]);
  const counts = useMemo(() => rows.reduce((acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }), { present: 0, absent: 0, late: 0, excused: 0 }), [rows]);

  async function loadRoster() {
    if (!yearId || !sectionId || !date) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attendance.roster", payload: { schoolId, academicYearId: yearId, sectionId, attendanceDate: date } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load attendance roster");
      setRows(body.data?.rows ?? []); setSessionId(body.data?.session_id ?? null); setDirty(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load attendance roster"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadRoster(); }, [yearId, sectionId, date]);

  function setStatus(enrollmentId: string, status: Row["status"]) {
    setRows((current) => current.map((row) => row.enrollment_id === enrollmentId ? { ...row, status } : row));
    setDirty(true);
  }

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attendance.save", payload: { schoolId, academicYearId: yearId, sectionId, attendanceDate: date, status: "submitted", records: rows.map((row) => ({ enrollmentId: row.enrollment_id, status: row.status, remarks: row.remarks })) } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save attendance");
      setSessionId(body.data?.session_id ?? sessionId); setDirty(false); setMessage(`${body.data?.record_count ?? rows.length} attendance records saved.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save attendance"); }
    finally { setSaving(false); }
  }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">Workspace</p><nav className="side-nav">
<Link href={`/?schoolId=${schoolId}`}>Overview</Link>
<Link href={`/analytics?schoolId=${schoolId}`}>Analytics</Link>
<Link className="" href={`/students?schoolId=${schoolId}`}>Students</Link>
<Link href={`/academic?schoolId=${schoolId}`}>Academic</Link>
<Link className="active" href={`/attendance?schoolId=${schoolId}`}>Attendance</Link>
<Link className="" href={`/exams?schoolId=${schoolId}`}>Exams</Link>
<Link className="" href={`/finance?schoolId=${schoolId}`}>Finance</Link>
<Link className="" href={`/hr?schoolId=${schoolId}`}>Staff & HR</Link>
<Link href={`/communication?schoolId=${schoolId}`}>Communication</Link>
<Link href={`/notifications?schoolId=${schoolId}`}>Notifications</Link>
<Link href={`/parent?schoolId=${schoolId}`}>Parent Portal</Link>
<Link href={`/import?schoolId=${schoolId}`}>Data Import</Link>
<Link href={`/ai?schoolId=${schoolId}`}>AI Assistant</Link>
<Link href="/school/setup">School setup</Link>
</nav><div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div></aside>
    <section className="dashboard">
      <header className="topbar"><div><p className="eyebrow">V4 · Attendance</p><h1>Daily attendance</h1></div><button className="primary-link" onClick={save} disabled={saving || loading || rows.length === 0}>{saving ? "Saving…" : "Save attendance"}</button></header>
      <section className="workspace-banner"><div><span className="muted">Class roster</span><h2>{selectedSection?.gradeName} · {selectedSection?.name}</h2><p>Mark present, absent, late or excused for the selected date.</p></div><div className="workspace-badge">RBAC + audit</div></section>
      <section className="student-toolbar"><select aria-label="Academic year" value={yearId} onChange={(event) => { if (dirty && !window.confirm("You have unsaved attendance changes. Change the selection and discard them?")) return; setYearId(event.target.value); }}>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " · Current" : ""}</option>)}</select><select aria-label="Section" value={sectionId} onChange={(event) => { if (dirty && !window.confirm("You have unsaved attendance changes. Change the selection and discard them?")) return; setSectionId(event.target.value); }}>{sections.map((section) => <option key={section.id} value={section.id}>{section.gradeName} · {section.name}</option>)}</select><input aria-label="Attendance date" type="date" value={date} onChange={(event) => { if (dirty && !window.confirm("You have unsaved attendance changes. Change the date and discard them?")) return; setDate(event.target.value); }} /></section>
      <section className="metric-grid"><article className="metric"><span>Present</span><strong>{counts.present}</strong><small>On time</small></article><article className="metric"><span>Absent</span><strong>{counts.absent}</strong><small>Needs follow-up</small></article><article className="metric"><span>Late</span><strong>{counts.late}</strong><small>Present but late</small></article><article className="metric"><span>Excused</span><strong>{counts.excused}</strong><small>Excluded from rate</small></article></section>
      {error && <p className="error page-message">{error}</p>}{message && <p className="success page-message">{message}</p>}
      <section className="student-table-card">{loading ? <p className="empty">Loading roster…</p> : rows.length === 0 ? <p className="empty">No active enrollments found for this section and academic year.</p> : <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Roll</th><th>Admission</th><th>Student</th><th>Attendance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.enrollment_id}><td>{row.roll_number || "—"}</td><td><strong>{row.admission_number}</strong></td><td>{[row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ")}</td><td><div className="attendance-actions">{statuses.map((status) => <button key={status} className={row.status === status ? "attendance-status active" : "attendance-status"} onClick={() => setStatus(row.enrollment_id, status)}>{status}</button>)}</div></td></tr>)}</tbody></table></div>}</section>
      {sessionId && <p className="muted page-message">Session {sessionId.slice(0, 8)}… · changes are audit logged when saved.</p>}
    </section>
  </main>;
}
