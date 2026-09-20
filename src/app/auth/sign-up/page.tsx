"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter(); const supabase = createClient();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting) return; setSubmitting(true); setError(null); setMessage(null);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (signUpError) { setError(signUpError.message); setSubmitting(false); return; }
    if (data.session) { router.replace("/setup"); return; } setMessage("Account created. Check your email to confirm your account before signing in."); setSubmitting(false);
  }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · V2</p><h1>Create account</h1><p className="lead">Create an account, then set up your school workspace.</p><form onSubmit={onSubmit} className="auth-form"><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" /></label>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}<button type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button><a className="auth-link" href="/auth/login">Already have an account? Sign in</a></form></section></main>;
}
