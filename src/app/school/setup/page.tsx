import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcademicSetupPanel } from "./setup-panel";

export default async function SchoolSetupPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/auth/login");
  const userId = String(claimsData.claims.sub);
  const { data: memberships } = await supabase.from("school_memberships").select("school_id, role, schools(id, name, code)").eq("user_id", userId).eq("status", "active");
  const requestedSchoolId = (await searchParams).schoolId;
  const membership = ((memberships ?? []).find((item:any) => item.school_id === requestedSchoolId) ?? memberships?.[0]) as any;
  if (!membership?.schools) redirect("/setup");
  const school = membership.schools;
  const { data: grades } = await supabase.from("grades").select("id, name, code").eq("school_id", school.id).order("sort_order");
  const { data: years } = await supabase.from("academic_years").select("id, name, start_date, end_date, is_current").eq("school_id", school.id).order("start_date", { ascending: false });
  const { data: sections } = await supabase.from("sections").select("id, name, capacity, grades(name, code)").eq("school_id", school.id).order("name");

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">Workspace</p><nav className="side-nav"><a href={"/?schoolId="+school.id}>Overview</a><a href={"/analytics?schoolId="+school.id}>Analytics</a><a href={"/students?schoolId="+school.id}>Students</a><a href={"/academic?schoolId="+school.id}>Academic</a><a href={"/attendance?schoolId="+school.id}>Attendance</a><a href={"/exams?schoolId="+school.id}>Exams</a><a href={"/finance?schoolId="+school.id}>Finance</a><a href={"/hr?schoolId="+school.id}>Staff & HR</a><a href={"/communication?schoolId="+school.id}>Communication</a><a href={"/notifications?schoolId="+school.id}>Notifications</a><a href={"/parent?schoolId="+school.id}>Parent Portal</a><a href={"/import?schoolId="+school.id}>Data Import</a><a href={"/ai?schoolId="+school.id}>AI Assistant</a><a className="active" href={"/school/setup?schoolId="+school.id}>School setup</a></nav><div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div></aside><section className="dashboard"><header className="topbar"><div><p className="eyebrow">V2 · School Management</p><h1>School setup</h1></div></header><section className="workspace-banner"><div><span className="muted">Active school</span><h2>{school.name}</h2><p>Configure the academic structure before student and teaching modules.</p></div><div className="workspace-badge">Admin workflow</div></section><AcademicSetupPanel schoolId={school.id} grades={grades ?? []} /><section className="setup-lists"><article><p className="eyebrow">Academic years</p>{years?.length ? years.map((item) => <div className="list-row" key={item.id}><strong>{item.name}</strong><span>{item.start_date} → {item.end_date}{item.is_current ? " · Current" : ""}</span></div>) : <p className="empty">No academic years yet.</p>}</article><article><p className="eyebrow">Sections</p>{sections?.length ? sections.map((item: any) => <div className="list-row" key={item.id}><strong>{item.grades?.name ?? "Grade"} · {item.name}</strong><span>{item.capacity ? `${item.capacity} seats` : "Capacity not set"}</span></div>) : <p className="empty">No sections yet.</p>}</article></section></section></main>;
}
