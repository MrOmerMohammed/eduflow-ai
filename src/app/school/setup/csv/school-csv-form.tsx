"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = { valid?: boolean; rowsParsed?: number; errors?: string[] };

export default function SchoolCsvForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setResult(null);
    setError("");
    setMessage("");
  }

  async function previewFile() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("schoolId", schoolId);
      const response = await fetch("/api/import/school", { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (response.status === 422) {
        setPreview(body.data ?? { valid: false, errors: ["CSV validation failed."] });
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "CSV validation failed");
      setPreview(body.data);
      setMessage("CSV validated. No school data has been changed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function createSchoolData() {
    if (!file || !preview?.valid || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("schoolId", schoolId);
      const response = await fetch("/api/import/school", { method: "PUT", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "School CSV creation failed");
      setResult(body.data);
      setMessage("School data created successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "School CSV creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="csv-setup-shell">
      <section className="csv-setup-hero">
        <div>
          <span className="muted">One file · One guided action</span>
          <h2>Build the school foundation from CSV</h2>
          <p>Use the EduFlow template. One row represents a student enrollment and can also carry subject, guardian and teacher information.</p>
        </div>
        <a className="primary-link" href="/school-import-template.csv" download>Download template</a>
      </section>

      <section className="csv-steps">
        <div><strong>01</strong><span>Fill template</span></div>
        <div><strong>02</strong><span>Validate</span></div>
        <div><strong>03</strong><span>Create data</span></div>
      </section>

      <section className="csv-upload-card">
        <label className="csv-dropzone">
          <span className="csv-upload-icon">CSV</span>
          <strong>{file ? file.name : "Choose your school CSV"}</strong>
          <small>{file ? "Ready to validate" : "CSV only · up to 10 MB · up to 10,000 rows"}</small>
          <input type="file" accept=".csv,text/csv" onChange={chooseFile} />
        </label>
        <div className="csv-upload-actions">
          <button className="secondary-button" type="button" onClick={() => { setFile(null); setPreview(null); setResult(null); setError(""); setMessage(""); }}>Clear</button>
          <button className="primary-link" type="button" disabled={!file || busy} onClick={() => void previewFile()}>
            {busy ? "Processing…" : "Validate CSV"}
          </button>
        </div>
      </section>

      {preview ? (
        <section className={"csv-result " + (preview.valid ? "valid" : "invalid")}>
          <div>
            <span className="muted">Validation</span>
            <h3>{preview.valid ? "Ready to create" : "CSV needs corrections"}</h3>
            {preview.valid ? <p>{preview.rowsParsed ?? 0} rows passed validation. No records were written during validation.</p> : <ul>{(preview.errors ?? []).slice(0, 12).map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>
          {preview.valid ? <button className="primary-link" type="button" disabled={busy} onClick={() => void createSchoolData()}>{busy ? "Creating…" : "Create school data"}</button> : null}
        </section>
      ) : null}

      {error ? <p className="error page-message">{error}</p> : null}
      {message ? <p className="success page-message">{message}</p> : null}

      {result ? (
        <section className="csv-created">
          <div><span className="muted">Completed</span><h3>School foundation created</h3><p>Your CSV has been processed. Teacher accounts are handled below.</p></div>
          <div className="csv-created-grid">{Object.entries(result.created ?? {}).map(([key, value]) => <article key={key}><span>{key.replace(/_/g, " ")}</span><strong>{String(value)}</strong></article>)}</div>
          {result.teacher_accounts?.length ? <div className="csv-teachers"><strong>Teacher access</strong><p>Invitations are sent for new teacher emails; existing accounts are assigned the Teacher role.</p>{result.teacher_accounts.map((teacher: any) => <div key={teacher.email}>{teacher.email} · {teacher.error ? "Needs attention" : teacher.invited ? "Invitation sent" : "Existing account assigned"}</div>)}</div> : null}
          <button className="primary-link" type="button" onClick={() => router.replace("/?schoolId=" + encodeURIComponent(schoolId))}>Go to school dashboard</button>
        </section>
      ) : null}
    </div>
  );
}
