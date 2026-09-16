import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcademicSetupPanel } from "./setup-panel";

export default async function SchoolSetupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id, role, schools(id, name, code)").eq("user_id", userId).eq("status", "active");
  const membership = memberships?.[0] as any;
  if (!membership?.schools) redirect("/setup");
  const school = membership.schools;
  const { data: grades } = await supabase.from("grades").select("id, name, code").eq("school_id", school.id).order("sort_order");
  const { data: years } = await supabase.from("academic_years").select("id, name, start_date, end_date, is_current").eq("school_id", school.id).order("start_date", { ascending: false });
  const { data: sections } = await supabase.from("sections").select("id, name, capacity, grades(name, code)").eq("school_id", school.id).order("name");

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">Workspace</p><nav className="side-nav"><a href="/">Overview</a><a className="active" href="/school/setup">School setup</a></nav><div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div></aside><section className="dashboard"><header className="topbar"><div><p className="eyebrow">V2 · School Management</p><h1>School setup</h1></div></header><section className="workspace-banner"><div><span className="muted">Active school</span><h2>{school.name}</h2><p>Configure the academic structure before student and teaching modules.</p></div><div className="workspace-badge">Admin workflow</div></section><AcademicSetupPanel schoolId={school.id} grades={grades ?? []} /><section className="setup-lists"><article><p className="eyebrow">Academic years</p>{years?.length ? years.map((item) => <div className="list-row" key={item.id}><strong>{item.name}</strong><span>{item.start_date} → {item.end_date}{item.is_current ? " · Current" : ""}</span></div>) : <p className="empty">No academic years yet.</p>}</article><article><p className="eyebrow">Sections</p>{sections?.length ? sections.map((item: any) => <div className="list-row" key={item.id}><strong>{item.grades?.name ?? "Grade"} · {item.name}</strong><span>{item.capacity ? `${item.capacity} seats` : "Capacity not set"}</span></div>) : <p className="empty">No sections yet.</p>}</article></section></section></main>;
}
