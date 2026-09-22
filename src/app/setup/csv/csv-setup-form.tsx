"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  valid?: boolean;
  rowsParsed?: number;
  errors?: string[];
};

export default function CsvSetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "", schoolName: "", schoolCode: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file) return;

    setBusy(true);
    setError("");
    setPreview(null);

    try {
      const bootstrapResponse = await fetch("/api/workspace/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          schoolName: form.schoolName.trim(),
          schoolCode: form.schoolCode.trim().toUpperCase(),
        }),
      });
      const bootstrap = await bootstrapResponse.json().catch(() => ({}));

      if (!bootstrapResponse.ok) {
        throw new Error(bootstrap.error ?? "Workspace setup failed");
      }

      const schoolId = typeof bootstrap.data?.school_id === "string" ? bootstrap.data.school_id : "";
      if (!schoolId) throw new Error("Workspace was created but no school ID was returned.");

      const previewForm = new FormData();
      previewForm.append("file", file);
      previewForm.append("schoolId", schoolId);

      const previewResponse = await fetch("/api/import/school", {
        method: "POST",
        body: previewForm,
      });
      const previewBody = await previewResponse.json().catch(() => ({}));

      if (previewResponse.status === 422) {
        setPreview(previewBody.data ?? { valid: false, errors: ["The CSV could not be validated."] });
        setError("The workspace was created, but the CSV needs corrections. You can fix the file and continue from Data Import.");
        return;
      }

      if (!previewResponse.ok) {
        throw new Error(previewBody.error ?? "CSV validation failed");
      }

      const validated = previewBody.data;
      setPreview(validated);
      if (!validated?.valid) {
        setError("The CSV needs corrections before school data can be created.");
        return;
      }

      const commitForm = new FormData();
      commitForm.append("file", file);
      commitForm.append("schoolId", schoolId);

      const commitResponse = await fetch("/api/import/school", {
        method: "PUT",
        body: commitForm,
      });
      const commitBody = await commitResponse.json().catch(() => ({}));

      if (!commitResponse.ok) {
        throw new Error(commitBody.error ?? "School CSV import failed");
      }

      router.replace(`/?schoolId=${encodeURIComponent(schoolId)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the school from CSV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <label>
        Organization name
        <input required value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="EduFlow Schools Group" />
      </label>
      <label>
        School name
        <input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} placeholder="EduFlow International School" />
      </label>
      <label>
        School code
        <input required maxLength={20} value={form.schoolCode} onChange={(e) => setForm({ ...form, schoolCode: e.target.value.toUpperCase() })} placeholder="EIS01" />
      </label>
      <label>
        School CSV file
        <input required type="file" accept=".csv,text/csv" onChange={onFileChange} />
      </label>

      <a className="secondary-button" href="/school-import-template.csv" download>
        Download CSV template
      </a>

      {preview ? (
        <div className={preview.valid ? "completion-callout" : "onboarding-error"}>
          <strong>{preview.valid ? "CSV ready" : "Fix CSV"}</strong>
          <span>
            {preview.valid
              ? `${preview.rowsParsed ?? 0} rows validated. School data is ready to be created.`
              : (preview.errors ?? []).slice(0, 8).join(" • ")}
          </span>
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}

      <button type="submit" disabled={busy || !file}>
        {busy ? "Creating school from CSV…" : "Create school using CSV"}
      </button>
    </form>
  );
}
