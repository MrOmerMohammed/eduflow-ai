"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "", schoolName: "", schoolCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const payload = {
        organizationName: form.organizationName.trim(),
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim().toUpperCase(),
      };
      const response = await fetch("/api/workspace/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Workspace setup failed");
        return;
      }

      const schoolId = typeof result.data?.school_id === "string" ? result.data.school_id : "";
      router.replace(schoolId ? "/school/setup?schoolId=" + encodeURIComponent(schoolId) : "/school/setup");
      router.refresh();
    } catch {
      setError("Unable to reach the workspace service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <label>Organization name<input required value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="EduFlow Schools Group" /></label>
      <label>School name<input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} placeholder="EduFlow International School" /></label>
      <label>School code<input required maxLength={20} value={form.schoolCode} onChange={(e) => setForm({ ...form, schoolCode: e.target.value.toUpperCase() })} placeholder="EIS01" /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" disabled={busy}>{busy ? "Creating workspace…" : "Create school workspace"}</button>
    </form>
  );
}
