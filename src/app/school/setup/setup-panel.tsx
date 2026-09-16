"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Grade = { id: string; name: string; code: string };

type Props = { schoolId: string; grades: Grade[] };

async function send(action: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}

export function AcademicSetupPanel({ schoolId, grades }: Props) {
  const router = useRouter();
  const [year, setYear] = useState({ name: "2026/2027", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true });
  const [grade, setGrade] = useState({ name: "", code: "", sortOrder: "0" });
  const [section, setSection] = useState({ gradeId: grades[0]?.id ?? "", name: "", capacity: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, action: string, payload: Record<string, unknown>, reset: () => void) {
    event.preventDefault(); setBusy(action); setMessage("");
    try { await send(action, payload); reset(); setMessage("Saved successfully."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(""); }
  }

  return <section className="setup-grid">
    <form className="management-card" onSubmit={(e) => submit(e, "academic_year.create", { schoolId, ...year }, () => setYear({ ...year, name: "", isCurrent: false }))}>
      <p className="eyebrow">Academic year</p><h2>Create session</h2><p>Define the school's operating year and active session.</p>
      <input required value={year.name} onChange={(e) => setYear({ ...year, name: e.target.value })} placeholder="2026/2027" />
      <div className="two-inputs"><input required type="date" value={year.startDate} onChange={(e) => setYear({ ...year, startDate: e.target.value })} /><input required type="date" value={year.endDate} onChange={(e) => setYear({ ...year, endDate: e.target.value })} /></div>
      <label className="check"><input type="checkbox" checked={year.isCurrent} onChange={(e) => setYear({ ...year, isCurrent: e.target.checked })} /> Set as current</label>
      <button disabled={busy === "academic_year.create"}>{busy === "academic_year.create" ? "Saving…" : "Create academic year"}</button>
    </form>
    <form className="management-card" onSubmit={(e) => submit(e, "grade.create", { schoolId, name: grade.name, code: grade.code, sortOrder: Number(grade.sortOrder) }, () => setGrade({ name: "", code: "", sortOrder: "0" }))}>
      <p className="eyebrow">Classes</p><h2>Add grade</h2><p>Create the grade/class level used by the school.</p>
      <input required value={grade.name} onChange={(e) => setGrade({ ...grade, name: e.target.value })} placeholder="Grade 10" />
      <div className="two-inputs"><input required value={grade.code} onChange={(e) => setGrade({ ...grade, code: e.target.value.toUpperCase() })} placeholder="G10" /><input type="number" value={grade.sortOrder} onChange={(e) => setGrade({ ...grade, sortOrder: e.target.value })} placeholder="Order" /></div>
      <button disabled={busy === "grade.create"}>{busy === "grade.create" ? "Saving…" : "Create grade"}</button>
    </form>
    <form className="management-card" onSubmit={(e) => submit(e, "section.create", { schoolId, gradeId: section.gradeId, name: section.name, capacity: section.capacity }, () => setSection({ ...section, name: "", capacity: "" }))}>
      <p className="eyebrow">Sections</p><h2>Add section</h2><p>Attach a classroom section to an existing grade.</p>
      <select required value={section.gradeId} onChange={(e) => setSection({ ...section, gradeId: e.target.value })}><option value="" disabled>Select grade</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select>
      <div className="two-inputs"><input required value={section.name} onChange={(e) => setSection({ ...section, name: e.target.value })} placeholder="Section A" /><input type="number" min="1" value={section.capacity} onChange={(e) => setSection({ ...section, capacity: e.target.value })} placeholder="Capacity" /></div>
      <button disabled={busy === "section.create"}>{busy === "section.create" ? "Saving…" : "Create section"}</button>
    </form>
    {message ? <p className="setup-message">{message}</p> : null}
  </section>;
}
