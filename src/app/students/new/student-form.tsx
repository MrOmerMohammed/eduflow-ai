"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ admissionNumber: "", firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "", email: "", phone: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "student.create", payload: { schoolId, ...form } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to create student");
      router.push(`/students/${body.data.id}?schoolId=${schoolId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create student");
    } finally {
      setSaving(false);
    }
  }

  return <form className="student-form" onSubmit={submit}>
    <div className="form-section"><div><h3>Identity</h3><p>Use the school's official admission number.</p></div><div className="student-form-grid">
      <label>Admission number<input required value={form.admissionNumber} onChange={(e) => update("admissionNumber", e.target.value)} /></label>
      <label>First name<input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></label>
      <label>Middle name<input value={form.middleName} onChange={(e) => update("middleName", e.target.value)} /></label>
      <label>Last name<input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></label>
      <label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} /></label>
      <label>Gender<select value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
    </div></div>
    <div className="form-section"><div><h3>Contact</h3><p>Optional contact details for the student.</p></div><div className="student-form-grid">
      <label>Email<input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
      <label>Phone<input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
      <label>Status<select value={form.status} onChange={(e) => update("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option><option value="transferred">Transferred</option><option value="withdrawn">Withdrawn</option></select></label>
    </div></div>
    {error && <p className="error">{error}</p>}
    <button className="primary-button" disabled={saving}>{saving ? "Creating student…" : "Create student"}</button>
  </form>;
}
