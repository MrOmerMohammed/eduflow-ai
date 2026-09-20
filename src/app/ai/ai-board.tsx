"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SCHOOL_NAV } from "@/lib/rbac";

type Tool={name?:string;slug?:string;risk_level?:string;handler_key?:string};
type PlanStep={order?:number;intent?:string;tool?:Tool;authorization?:{allowed?:boolean;reason?:string}};
type Plan={run_id?:string;status?:string;intent?:string;tool?:Tool;authorization?:{allowed?:boolean;reason?:string};input?:{request?:string};steps?:PlanStep[];reused?:boolean};
type StepResult={order?:number;tool?:string;result?:unknown;error?:string};
type ResponseData={ok?:boolean;plan?:Plan;result?:unknown;steps?:StepResult[];error?:string;conversationId?:string};
type ChatItem={role:"user"|"assistant";content:string;time:string};

function formatValue(value:unknown):string{
  if(value===null||value===undefined)return "No data";
  if(typeof value==="string")return value;
  if(typeof value==="number"||typeof value==="boolean")return String(value);
  return JSON.stringify(value,null,2);
}

function ResultView({value}:{value:unknown}){
  if(Array.isArray(value)){
    if(value.length===0)return <div className="ai-empty-result"><span>0</span><div><strong>No matching records</strong><p>The request executed successfully, but no records matched the search.</p></div></div>;
    const objects=value.filter(v=>v&&typeof v==="object"&&!Array.isArray(v)) as Record<string,unknown>[];
    if(objects.length===value.length){
      const keys=Array.from(new Set(objects.flatMap(o=>Object.keys(o)))).slice(0,7);
      return <div className="ai-result-table"><div className="ai-table-scroll"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{objects.map((row,i)=><tr key={i}>{keys.map(k=><td key={k}>{formatValue(row[k])}</td>)}</tr>)}</tbody></table></div></div>;
    }
  }
  if(value&&typeof value==="object")return <div className="ai-object-grid">{Object.entries(value as Record<string,unknown>).slice(0,12).map(([k,v])=><div key={k}><span>{k.replaceAll("_"," ")}</span><strong>{formatValue(v)}</strong></div>)}</div>;
  return <div className="ai-text-result">{formatValue(value)}</div>;
}

function toolLabel(step:PlanStep|StepResult){
  const tool="tool" in step?step.tool:undefined;
  return typeof tool==="string"?tool:tool?.name||tool?.slug||"AI operation";
}

export default function AiBoard({schoolId,school,role="admin"}:{schoolId:string;school:{name:string;code:string};role?:string}){
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<ResponseData|null>(null);
 const [error,setError]=useState("");
 const [conversationId,setConversationId]=useState<string|null>(null);
 const [history,setHistory]=useState<ChatItem[]>([]);
 const [showPlan,setShowPlan]=useState(false);

 const nav=SCHOOL_NAV.filter(item=>(item.roles as readonly string[]).includes(role));
 const plan=data?.plan;
 const steps=plan?.steps||[];
 const lastResult=useMemo(()=>data?.steps?.find(s=>s.result!==undefined)||null,[data]);

 const ask=async()=>{
  const request=message.trim();if(!request||loading)return;
  setLoading(true);setError("");setShowPlan(false);
  const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  setHistory(h=>[...h,{role:"user",content:request,time:now}]);
  try{
   const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({schoolId,message:request,conversationId,idempotencyKey:crypto.randomUUID()})});
   const b=await r.json() as ResponseData;
   if(!r.ok)throw new Error(b.error||"AI request failed");
   setData(b);
   if(b.conversationId)setConversationId(b.conversationId);
   const reply=b.error||"Request completed. Review the result below.";
   setHistory(h=>[...h,{role:"assistant",content:reply,time:now}]);
   setMessage("");
  }catch(e){
   const msg=e instanceof Error?e.message:"AI request failed";
   setError(msg);
   setHistory(h=>[...h,{role:"assistant",content:msg,time:now}]);
  }finally{setLoading(false)}
 };

 return <main className="app-shell">
  <aside className="sidebar">
   <div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div>
   <p className="sidebar-label">School workspace</p>
   <nav className="side-nav">{nav.map(item=><Link key={item.href} className={item.href==="/ai"?"active":""} href={item.href+"?schoolId="+schoolId}>{item.label}</Link>)}</nav>
   <div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code} · {role}</span></div>
  </aside>

  <section className="dashboard ai-dashboard">
   <header className="topbar ai-topbar">
    <div><p className="eyebrow">AI assistant</p><h1>School intelligence</h1><p className="ai-subtitle">Ask questions, find records and run authorized school operations in plain language.</p></div>
    <div className="ai-status"><span></span><strong>Secure workspace</strong></div>
   </header>

   <section className="ai-hero">
    <div className="ai-hero-copy"><span className="ai-kicker">EDUFLOW AI</span><h2>Your school assistant</h2><p>Search students, check attendance, review exam results and explore school information without navigating through multiple screens.</p></div>
    <div className="ai-hero-stats"><div><strong>{history.length/2||0}</strong><span>Requests</span></div><div><strong>{steps.length||0}</strong><span>Steps</span></div><div><strong>{data?.plan?.authorization?.allowed?"Ready":"—"}</strong><span>Authorization</span></div></div>
   </section>

   <section className="ai-workspace">
    <div className="ai-chat-panel">
      <div className="ai-panel-head"><div><strong>Ask EduFlow</strong><span>Natural language school queries</span></div><span className="ai-live-dot">● Live</span></div>
      <div className="ai-conversation">
       {history.length===0?<div className="ai-welcome"><div className="ai-welcome-icon">✦</div><h3>What would you like to know?</h3><p>Start with a student, attendance, exam, timetable or dashboard question.</p><div className="ai-suggestions">{["Find student 1001","Show today's attendance","Show exam results","Give me today's dashboard"].map(q=><button key={q} type="button" onClick={()=>setMessage(q)}>{q}</button>)}</div></div>:
       history.slice(-8).map((item,i)=><div key={i} className={"ai-message "+item.role}><div className="ai-avatar">{item.role==="user"?"You":"✦"}</div><div><div className="ai-message-bubble">{item.content}</div><small>{item.time}</small></div></div>)}
      </div>
      <div className="ai-composer">
       <textarea value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void ask()}}} placeholder="Ask something about your school…" rows={3} disabled={loading}/>
       <div className="ai-composer-footer"><span>Enter to send · Shift + Enter for new line</span><button type="button" className="ai-send" disabled={!message.trim()||loading} onClick={()=>void ask()}>{loading?"Working…":"Ask AI"} <span>↗</span></button></div>
      </div>
    </div>

    <aside className="ai-inspector">
      <div className="ai-panel-head"><div><strong>Request details</strong><span>Execution transparency</span></div></div>
      {!data&&!loading?<div className="ai-inspector-empty"><div>◎</div><strong>Nothing running</strong><p>Your execution plan and results will appear here after you submit a request.</p></div>:
      <div className="ai-inspector-body">
       {loading?<div className="ai-loading"><span></span><span></span><span></span><p>Understanding your request…</p></div>:
       <>
        {plan&&<div className="ai-request-card"><span>PRIMARY INTENT</span><strong>{plan.intent||"School request"}</strong><div><b>{plan.status||"completed"}</b><span>{plan.reused?"Reused execution":"New execution"}</span></div></div>}
        {plan&&<button className="ai-plan-toggle" type="button" onClick={()=>setShowPlan(v=>!v)}><span>Execution plan · {steps.length||1} step{steps.length===1?"":"s"}</span><b>{showPlan?"Hide":"View"} plan</b></button>}
        {showPlan&&<div className="ai-step-list">{steps.length?steps.map((step,i)=><div className="ai-step" key={step.order||i}><span>{step.order||i+1}</span><div><strong>{toolLabel(step)}</strong><p>{step.intent||"Authorized operation"}</p></div><em className={step.authorization?.allowed?"allowed":"denied"}>{step.authorization?.allowed?"Allowed":"Denied"}</em></div>):<div className="ai-step">No execution steps returned.</div>}</div>}
        {(data?.steps?.length||data?.result!==undefined)&&<div className="ai-results"><div className="ai-results-head"><span>RESULT</span><strong>{lastResult?.tool||"Execution result"}</strong></div>{data?.steps?.map((step,i)=><div className="ai-result-block" key={step.order||i}>{step.error?<div className="ai-error-result"><strong>Could not complete this step</strong><p>{step.error}</p></div>:<ResultView value={step.result}/>}</div>)}{(!data.steps||data.steps.length===0)&&data.result!==undefined&&<ResultView value={data.result}/>}</div>}
        {data?.error&&<div className="ai-error-result"><strong>Request needs attention</strong><p>{data.error}</p></div>}
       </>}
      </div>}
      {error&&!data?<div className="ai-error-result"><strong>Request failed</strong><p>{error}</p></div>:null}
    </aside>
   </section>
   {conversationId?<div className="ai-session">Conversation active · {conversationId.slice(0,8)}…</div>:null}
  </section>
 </main>;
}
