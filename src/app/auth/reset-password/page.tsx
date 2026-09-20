"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage(){
 const supabase=createClient(); const router=useRouter(); const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [done,setDone]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setError("");if(password.length<8){setError("Password must be at least 8 characters.");return}if(password!==confirm){setError("Passwords do not match.");return}setBusy(true);const {error}=await supabase.auth.updateUser({password});setBusy(false);if(error){setError("This reset link is invalid or has expired. Please request a new one.");return}setDone(true);setTimeout(()=>router.replace("/"),800);}
 if(done)return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · Account recovery</p><h1>Password updated</h1><p className="lead">Your password has been changed successfully. Returning to your workspace…</p></section></main>;
 return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">EduFlow AI · Account recovery</p><h1>Choose a new password</h1><p className="lead">Use a strong password you do not reuse elsewhere.</p><form className="auth-form" onSubmit={submit}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy?"Updating…":"Update password"}</button></form></section></main>;
}