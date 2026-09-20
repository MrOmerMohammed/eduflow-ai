import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import CsvSetupForm from "./csv-setup-form";

export default async function CsvSetupPage() {
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
      <section className="auth-card setup-card setup-csv-card">
        <p className="eyebrow">EduFlow AI · CSV Onboarding</p>
        <h1 className="setup-title">Create your school from a CSV.</h1>
        <p className="lead">
          Enter the basic workspace details, upload the school CSV template, preview the data, and create the school foundation in one guided flow.
        </p>
        <div className="info-callout">
          <strong>How it works</strong>
          <span>Workspace → CSV validation → school data → teacher access → dashboard</span>
        </div>
        <CsvSetupForm />
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <a className="auth-link" href="/setup">← Back to setup options</a>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
