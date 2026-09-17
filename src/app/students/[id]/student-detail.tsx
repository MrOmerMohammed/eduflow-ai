"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string | null; date_of_birth: string | null; gender: string | null; email: string | null; phone: string | null; status: string; metadata: Record<string, unknown> };
type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };
type Grade = { id: string; name: string; code: string | null; sort_order: number };
type Section = { id: string; name: string; capacity: number | null };

type Props = { schoolId: string; studentId: string; academicYears: Year[]; grades: Grade[] };

export default function StudentDetail({ schoolId, studentId, academicYears, grades }: Props) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [form, setForm] = useState({ admissionNumber: "", firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "", email: "", phone: "", status: "active" });
  const [guardian, setGuardian] = useState({ fullName: "", relationship: "", phone: "", email: "" });
  const [enroll, setEnroll] = useState({ academicYearId: academicYears.find((x) => x.is_current)?.id ?? academicYears[0]?.id ?? "", gradeId: grades[0]?.id ?? "", sectionId: "", rollNumber: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "student.get", payload: { schoolId, studentId } }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load student");
    setStudent(body.data.student); setGuardians(body.data.guardians ?? []); setEnrollments(body.data.enrollments ?? []);
    const s = body.data.student;
    setForm({ admissionNumber: s.admission_number, firstName: s.first_name, middleName: s.middle_name ?? "", lastName: s.last_name ?? "", dateOfBirth: s.date_of_birth ?? "", gender: s.gender ?? "", email: s.email ?? "", phone: s.phone ?? "", status: s.status });
  }, [schoolId, studentId]);

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load student")); }, [load]);
  useEffect(() => {
    if (!enroll.gradeId) return;
    fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "school.sections", payload: { schoolId, gradeId: enroll.gradeId } }) })
      .then((r) => r.json()).then((b) => setSections(b.data ?? [])).catch(() => setSections([]));
  }, [schoolId, enroll.gradeId]);

  async function call(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Request failed"); return body.data;
  }
  async function saveStudent(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(""); setMessage(""); try { await call("student.update", { schoolId, studentId, ...form }); await load(); setMessage("Student profile updated."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update student"); } finally { setSaving(false); } }
  async function addGuardian(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(""); setMessage(""); try { const g = await call("guardian.create", { schoolId, ...guardian }); await call("student.guardian.link", { schoolId, studentId, guardianId: g.id, isPrimary: guardians.length === 0 }); setGuardian({ fullName: "", relationship: "", phone: "", email: "" }); await load(); setMessage("Guardian added and linked."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to add guardian"); } finally { setSaving(false); } }
  async function addEnrollment(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(""); setMessage(""); try { await call("enrollment.create", { schoolId, studentId, ...enroll, status: "active" }); await load(); setMessage("Enrollment created."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to create enrollment"); } finally { setSaving(false); } }

  if (!student) return <section className="student-table-card"><p className="empty">Loading student profile…</p></section>;
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
  return <>
    <section className="workspace-banner"><div><span className="muted">{student.admission_number}</span><h2>{fullName}</h2><p>{student.email || student.phone || "No contact details"}</p></div><span className={`status-pill status-${student.status}`}>{student.status}</span></section>
    {message && <p className="setup-message">{message}</p>}{error && <p className="error page-message">{error}</p>}
    <section className="student-360-grid">
      <form className="management-card" onSubmit={saveStudent}><h2>Profile</h2><p>Edit the student's core identity and contact data.</p><div className="student-form-grid">
        <label>Admission number<input required value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} /></label><label>First name<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label><label>Middle name<input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></label><label>Last name<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label><label>Gender<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option><option value="transferred">Transferred</option><option value="withdrawn">Withdrawn</option></select></label>
      </div><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></form>
      <section className="management-card"><h2>Guardians</h2><p>Family contacts linked to this student.</p>{guardians.length === 0 ? <p className="empty">No guardians linked yet.</p> : guardians.map((g) => <div className="list-row" key={g.guardians.id}><strong>{g.guardians.full_name}</strong><span>{g.guardians.relationship || "Guardian"}{g.is_primary ? " · Primary" : ""}</span></div>)}<form onSubmit={addGuardian} className="inline-form"><input required placeholder="Full name" value={guardian.fullName} onChange={(e) => setGuardian({ ...guardian, fullName: e.target.value })} /><input placeholder="Relationship" value={guardian.relationship} onChange={(e) => setGuardian({ ...guardian, relationship: e.target.value })} /><input placeholder="Phone" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} /><button className="secondary-button" disabled={saving}>Add guardian</button></form></section>
      <section className="management-card"><h2>Enrollment history</h2><p>Academic-year, class and section placement.</p>{enrollments.length === 0 ? <p className="empty">No enrollment records yet.</p> : enrollments.map((e) => <div className="list-row" key={e.id}><strong>{e.grades?.name ?? "Class"}{e.sections?.name ? ` · ${e.sections.name}` : ""}</strong><span>{e.academic_years?.name ?? "Year"} · Roll {e.roll_number || "—"}</span></div>)}<form onSubmit={addEnrollment} className="inline-form"><select value={enroll.academicYearId} onChange={(e) => setEnroll({ ...enroll, academicYearId: e.target.value })}>{academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " · Current" : ""}</option>)}</select><select value={enroll.gradeId} onChange={(e) => setEnroll({ ...enroll, gradeId: e.target.value, sectionId: "" })}>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><select value={enroll.sectionId} onChange={(e) => setEnroll({ ...enroll, sectionId: e.target.value })}><option value="">No section</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input placeholder="Roll number" value={enroll.rollNumber} onChange={(e) => setEnroll({ ...enroll, rollNumber: e.target.value })} /><button className="secondary-button" disabled={saving || !enroll.academicYearId || !enroll.gradeId}>Enroll student</button></form></section>
    </section>
    <button className="text-button" onClick={() => router.push("/students")}>← Return to student registry</button>
  </>;
}
