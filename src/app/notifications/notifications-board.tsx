"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
};

type Preferences = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
};

async function gateway(action: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/gateway", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result.data;
}

export default function NotificationsBoard({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [notifications, prefs] = await Promise.all([
        gateway("notification.list", { schoolId, limit: 100 }),
        gateway("notification.preferences.get", { schoolId }),
      ]);
      setItems((notifications ?? []) as Notification[]);
      setPreferences(prefs as Preferences);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    try {
      await gateway("notification.read", { schoolId, notificationId: id });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to mark notification");
    }
  }

  async function markAllRead() {
    try {
      const count = await gateway("notification.read_all", { schoolId });
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      setMessage(`${Number(count ?? 0)} notification(s) marked read.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to mark notifications");
    }
  }

  async function savePreferences() {
    if (!preferences) return;
    setSaving(true);
    setError("");
    try {
      await gateway("notification.preferences.set", { schoolId, ...preferences });
      setMessage("Notification preferences saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav"><Link href={`/?schoolId=${schoolId}`}>Overview</Link>
<Link href={`/analytics?schoolId=${schoolId}`}>Analytics</Link>
<Link href={`/students?schoolId=${schoolId}`}>Students</Link>
<Link href={`/academic?schoolId=${schoolId}`}>Academic</Link>
<Link href={`/attendance?schoolId=${schoolId}`}>Attendance</Link>
<Link href={`/exams?schoolId=${schoolId}`}>Exams</Link>
<Link href={`/finance?schoolId=${schoolId}`}>Finance</Link>
<Link href={`/hr?schoolId=${schoolId}`}>Staff & HR</Link>
<Link href={`/communication?schoolId=${schoolId}`}>Communication</Link>
<Link className="active" href={`/notifications?schoolId=${schoolId}`}>Notifications</Link>
<Link href={`/parent?schoolId=${schoolId}`}>Parent Portal</Link>
<Link href={`/import?schoolId=${schoolId}`}>Data Import</Link>
<Link href={`/ai?schoolId=${schoolId}`}>AI Assistant</Link>
<Link href="/school/setup">School setup</Link></nav>
        <div className="sidebar-footer"><strong>{schoolName}</strong><span>Notification Center</span></div>
      </aside>
      <section className="dashboard">
        <header className="topbar">
          <div><p className="eyebrow">V10 · Notification Center</p><h1>Notifications</h1></div>
          <div className="user-chip"><span className="status-dot" />{unread} unread</div>
        </header>

        {error && <p className="error page-message">{error}</p>}
        {message && <p className="success page-message">{message}</p>}

        <section className="workspace-banner">
          <div><span className="muted">Personal inbox</span><h2>School alerts and announcements</h2><p>Unread notifications stay tied to your authenticated school workspace.</p></div>
          <button className="primary-link" onClick={markAllRead} disabled={!unread}>Mark all read</button>
        </section>

        <section className="student-table-card">
          <div className="section-heading"><div><p className="eyebrow">Inbox</p><h2>Recent notifications</h2></div><button className="table-link" onClick={() => void load()}>Refresh</button></div>
          {loading ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="muted">No notifications yet. In-app communication sent to your account will appear here.</p> :
            items.map((item) => (
              <article key={item.id} className="module-card" style={{ marginBottom: 10, opacity: item.read_at ? 0.72 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div><h3>{item.title}</h3><p>{item.body}</p><small>{item.notification_type} · {new Date(item.created_at).toLocaleString()}</small></div>
                  {!item.read_at && <button className="table-link" onClick={() => void markRead(item.id)}>Mark read</button>}
                </div>
              </article>
            ))
          }
        </section>

        <section className="student-table-card">
          <div className="section-heading"><div><p className="eyebrow">Preferences</p><h2>Delivery controls</h2></div></div>
          {preferences && <div style={{ display: "grid", gap: 12 }}>
            {([
              ["in_app_enabled", "In-app notifications"],
              ["email_enabled", "Email notifications"],
              ["sms_enabled", "SMS notifications"],
              ["whatsapp_enabled", "WhatsApp notifications"],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} />
              </label>
            ))}
            <button className="primary-link" onClick={() => void savePreferences()} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
          </div>}
        </section>
      </section>
    </main>
  );
}
