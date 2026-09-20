"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    router.replace("/"); router.refresh();
  }

  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · V2</p><h1>Sign in</h1><p className="lead">Access your secure school workspace.</p><form onSubmit={onSubmit} className="auth-form"><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button><a className="auth-link" href="/auth/forgot-password">Forgot your password?</a><a className="auth-link" href="/auth/sign-up">New to EduFlow AI? Create an account</a></form></section></main>;
}
