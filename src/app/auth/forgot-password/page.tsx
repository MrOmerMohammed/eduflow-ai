"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage(){
 const [email,setEmail]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 async function submit(e:FormEvent){
  e.preventDefault();
  if(busy) return;
  setBusy(true);setError("");setMessage("");
  try {
   const supabase=createClient();
   const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:`${window.location.origin}/auth/callback?next=/auth/reset-password`});
   if(resetError)setError(/rate limit|too many requests|email send/i.test(resetError.message) ? "Password reset emails are temporarily rate-limited. Please wait before requesting another link, then use only the newest email." : "We could not send the reset email. Please verify the address and try again.");
   else setMessage("If an account exists for this email, a password reset link has been sent.");
  } catch {
   setError("Unable to request a reset link right now. Check your connection and try again.");
  } finally { setBusy(false); }
 }
 return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · Account recovery</p><h1>Reset your password</h1><p className="lead">Enter your account email and we’ll send a secure recovery link.</p><form className="auth-form" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}<button type="submit" disabled={busy}>{busy?"Sending…":"Send reset link"}</button><a className="auth-link" href="/auth/login">Back to sign in</a></form></section></main>;
}