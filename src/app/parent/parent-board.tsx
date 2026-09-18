"use client";

import { useEffect, useState } from "react";

type Child = {
  student: { id:string; admission_number:string; first_name:string; middle_name:string|null; last_name:string; date_of_birth:string|null; gender:string|null; status:string };
  is_primary:boolean;
  enrollment: { academic_year:string|null; grade:string|null; section:string|null; roll_number:string|null; status:string }|null;
  attendance: { total:number; present:number; absent:number; late:number; excused:number };
  fees: { invoiced:number; paid:number; balance:number };
};
type Dashboard = { guardian:{full_name:string;relationship:string|null;phone:string|null;email:string|null}; children:Child[] };

async function gateway(action:string,payload:Record<string,unknown>) {
  const response=await fetch("/api/gateway",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,payload})});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error??"Request failed");
  return result.data;
}

export default function ParentBoard({schoolId,schoolName}:{schoolId:string;schoolName:string}) {
  const [data,setData]=useState<Dashboard|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{void (async()=>{try{setData(await gateway("parent.dashboard",{schoolId}) as Dashboard);}catch(e){setError(e instanceof Error?e.message:"Unable to load parent portal");}finally{setLoading(false);}})();},[schoolId]);
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">Parent workspace</p>
      <nav className="side-nav"><a href="/">Overview</a><a className="active" href={`/parent?schoolId=${schoolId}`}>Parent Portal</a><a href={`/notifications?schoolId=${schoolId}`}>Notifications</a><a href={`/communication?schoolId=${schoolId}`}>Communication</a></nav>
      <div className="sidebar-footer"><strong>{schoolName}</strong><span>Parent Management</span></div>
    </aside>
    <section className="dashboard"><header className="topbar"><div><p className="eyebrow">V11 · Parent Management</p><h1>Parent Portal</h1></div><div className="user-chip"><span className="status-dot"/>{data?.children.length??0} linked child{data?.children.length===1?"":"ren"}</div></header>
      {error&&<p className="error page-message">{error}</p>}
      {loading?<section className="workspace-banner"><div><span className="muted">Loading</span><h2>Preparing your family dashboard…</h2></div></section>:
      data&&<><section className="workspace-banner"><div><span className="muted">Parent account</span><h2>{data.guardian.full_name}</h2><p>{data.guardian.relationship??"Guardian"} · {data.guardian.phone??data.guardian.email??"Contact details not provided"}</p></div><div className="workspace-badge">Authenticated & protected</div></section>
      <section className="section-heading"><div><p className="eyebrow">Family</p><h2>Children</h2></div></section>
      <section className="module-grid">{data.children.map(child=>{const a=child.attendance;const rate=a.total?Math.round((a.present/a.total)*100):0;return <article className="module-card" key={child.student.id}>
        <div className="module-icon">{child.student.first_name.slice(0,1)}</div><h3>{child.student.first_name} {child.student.last_name}</h3><p>{child.student.admission_number} · {child.enrollment?.grade??"Grade not assigned"} · {child.enrollment?.section??"Section not assigned"}</p>
        <div style={{display:"grid",gap:8,marginTop:12}}><span>Attendance: <strong>{rate}%</strong> ({a.present}/{a.total})</span><span>Fee balance: <strong>{Number(child.fees.balance).toFixed(2)}</strong></span><span>Status: {child.student.status}</span></div>
      </article>})}</section></>}
    </section>
  </main>;
}
