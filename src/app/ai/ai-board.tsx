"use client";
import Link from "next/link";
import {useState} from "react";

type Tool={name?:string;slug?:string;risk_level?:string;handler_key?:string};
type PlanStep={order?:number;intent?:string;tool?:Tool;authorization?:{allowed?:boolean;reason?:string}};
type Plan={run_id?:string;status?:string;intent?:string;tool?:Tool;authorization?:{allowed?:boolean;reason?:string};input?:{request?:string};steps?:PlanStep[];reused?:boolean};
type ResponseData={ok?:boolean;plan?:Plan;result?:unknown;steps?:{order?:number;tool?:string;result?:unknown;error?:string}[];error?:string;conversationId?:string};
type ChatItem={role:"user"|"assistant";content:string};

export default function AiBoard({schoolId,school}:{schoolId:string;school:{name:string;code:string}}){
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<ResponseData|null>(null);
 const [error,setError]=useState("");
 const [conversationId,setConversationId]=useState<string|null>(null);
 const [history,setHistory]=useState<ChatItem[]>([]);
 const ask=async()=>{
  const text=message.trim();if(!text)return;
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({schoolId,message:text,conversationId,idempotencyKey:crypto.randomUUID()})});
   const b=await r.json();if(!r.ok)throw new Error(b.error||"AI request failed");
   setData(b);
   if(b.conversationId)setConversationId(b.conversationId);
   const reply=b.error||((b.result!==undefined)?JSON.stringify(b.result):b.plan?.authorization?.reason||("Planned: "+(b.plan?.intent||"request")));
   setHistory(h=>[...h,{role:"user",content:text},{role:"assistant",content:reply}]);
   setMessage("");
  }catch(e){setError(e instanceof Error?e.message:"AI request failed")}finally{setLoading(false)}
 };
 const plan=data?.plan,steps=plan?.steps||[];
 return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>EduFlow AI</span></div><p className="sidebar-label">AI</p><nav className="side-nav"><Link href="/">Overview</Link><Link className="active" href={"/ai?schoolId="+schoolId}>AI Assistant</Link><Link href={"/students?schoolId="+schoolId}>Students</Link><Link href={"/analytics?schoolId="+schoolId}>Analytics</Link><Link href={"/attendance?schoolId="+schoolId}>Attendance</Link></nav><div className="sidebar-footer"><strong>{school.name}</strong><span>{school.code}</span></div></aside><section className="dashboard"><header className="topbar"><div><p className="eyebrow">V17 · Multi-step AI Assistant</p><h1>School AI Assistant</h1></div></header><section className="workspace-banner"><div><span className="muted">Controlled execution</span><h2>Understand → authorize → execute → audit</h2><p>Compound requests can now execute up to three authorized tools in order while preserving conversation history, idempotency, and an execution ledger for every step.</p></div><div className="workspace-badge">Tool Registry</div></section><section className="workspace-banner"><div style={{width:"100%"}}>{history.length>0&&<div style={{marginBottom:"16px"}}><span className="muted">Conversation</span>{history.slice(-6).map((m,i)=><p key={i}><strong>{m.role==="user"?"You":"EduFlow AI"}:</strong> {m.content}</p>)}</div>}<textarea aria-label="AI request" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Try: Show student 1001's details, attendance, and exam results" rows={5} style={{width:"100%",padding:"14px",borderRadius:"12px",border:"1px solid #ddd"}}/><button className="primary-link" disabled={!message.trim()||loading} onClick={()=>void ask()}>{loading?"Working…":"Ask EduFlow AI"}</button></div></section>{error&&<p className="error page-message">{error}</p>}{plan&&<section className="workspace-banner"><div style={{width:"100%"}}><span className="muted">Execution plan</span><h2>{steps.length>1?`${steps.length} authorized steps`:plan.tool?.name||"AI tool"}</h2><p>Primary intent: {plan.intent||"—"} · Status: {plan.status||"—"} · {plan.reused?"Reused execution":"New execution"}</p>{steps.length>0&&<div style={{marginTop:"16px"}}>{steps.map((step,i)=><div key={step.order||i} style={{padding:"10px 0",borderTop:"1px solid #eee"}}><strong>Step {step.order||i+1}: {step.tool?.name||step.tool?.slug||"AI tool"}</strong><p>Intent: {step.intent||"—"} · Authorization: {step.authorization?.allowed?"Allowed":"Denied"}{step.authorization?.reason?" · "+step.authorization.reason:""}</p></div>)}</div>}{data?.steps&&data.steps.length>0&&<div style={{marginTop:"16px"}}><span className="muted">Execution results</span>{data.steps.map((step,i)=><div key={step.order||i} style={{padding:"10px 0",borderTop:"1px solid #eee"}}><strong>Step {step.order||i+1}: {step.tool||"tool"}</strong>{step.error?<p className="error">{step.error}</p>:<pre style={{whiteSpace:"pre-wrap",overflowX:"auto"}}>{JSON.stringify(step.result,null,2)}</pre>}</div>)}</div>}{data?.result!==undefined&&(!data.steps||data.steps.length===0)&&<pre style={{whiteSpace:"pre-wrap",marginTop:"16px",overflowX:"auto"}}>{JSON.stringify(data.result,null,2)}</pre>}{data?.error&&<p className="error">{data.error}</p>}</div></section>}</section></main>;
}
