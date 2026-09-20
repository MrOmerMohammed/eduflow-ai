"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage(){
 const supabase=createClient(); const [email,setEmail]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/reset-password`});setBusy(false);if(error)setError("We could not send the reset email. Please verify the address and try again.");else setMessage("If an account exists for this email, a password reset link has been sent.");}
 return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · Account recovery</p><h1>Reset your password</h1><p className="lead">Enter your account email and we’ll send a secure recovery link.</p><form className="auth-form" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}<button type="submit" disabled={busy}>{busy?"Sending…":"Send reset link"}</button><a className="auth-link" href="/auth/login">Back to sign in</a></form></section></main>;
}