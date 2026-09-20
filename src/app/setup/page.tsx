import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";
import SignOutButton from "@/components/sign-out-button";

export default async function SetupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");

  const { count } = await supabase
    .from("school_memberships")
    .select("school_id", { count: "exact", head: true })
    .eq("user_id", String(claimsData.claims.sub));

  if (count && count > 0) redirect("/");

  return (
    <main className="auth-shell">
      <section className="auth-card setup-card">
        <p className="eyebrow">EduFlow AI · V2 School Management</p>
        <h1 className="setup-title">Create your school workspace.</h1>
        <p className="lead">Set up the organization and first school. V2 will use this workspace as the boundary for every ERP module.</p>
        <div className="setup-choice-grid">
          <a className="setup-choice selected" href="#manual-setup">
            <span className="setup-choice-icon">1</span>
            <span><strong>Create manually</strong><small>Enter your school details and complete guided setup.</small></span>
          </a>
          <a className="setup-choice" href="/setup/csv">
            <span className="setup-choice-icon">CSV</span>
            <span><strong>Create using CSV file</strong><small>Upload one school CSV to create the foundation in one flow.</small></span>
          </a>
        </div>
        <div id="manual-setup">
          <p className="setup-section-label">Manual school setup</p>
          <SetupForm />
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}><SignOutButton /></div>
      </section>
    </main>
  );
}
