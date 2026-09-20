"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GradeConfig = { name: string; sections: number; students: number };
type Answers = {
  schoolType: string; board: string; medium: string; academicYear: string;
  gradeCount: number; gradeConfigs: GradeConfig[];
  staffCount: number; teacherCount: number; adminStaffCount: number;
  studentCount: number; attendanceMode: string; examMode: string;
  feeMode: string; transport: boolean; hostel: boolean; parentPortal: boolean;
};

const steps = [
  ["Profile","Tell us how your school operates."],
  ["Academic year","Set the academic calendar used by the school."],
  ["Classes","Define the class/grade structure and sections."],
  ["Students","Estimate the student population and enrollment shape."],
  ["Staff","Tell us how many teachers and staff will use EduFlow."],
  ["Operations","Choose attendance, exams and fee workflows."],
  ["Services","Enable optional school services."],
  ["Review","Confirm the setup before entering the workspace."]
] as const;

const defaults: Answers = {
  schoolType:"private_school", board:"state_board", medium:"english", academicYear:"2026/2027",
  gradeCount:10, gradeConfigs:Array.from({length:10},(_,i)=>({name:String(i+1),sections:2,students:30})),
  staffCount:25, teacherCount:18, adminStaffCount:7, studentCount:600,
  attendanceMode:"daily", examMode:"term", feeMode:"monthly", transport:false, hostel:false, parentPortal:true
};

async function save(schoolId:string,status:string,currentStep:number,answers:Answers){
  const response=await fetch("/api/gateway",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"school.onboarding.save",payload:{schoolId,status,currentStep,answers}
  })});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error??"Unable to save school setup");
  return result;
}

export function SchoolOnboarding({schoolId,schoolName,initialAnswers}:{schoolId:string;schoolName:string;initialAnswers?:Partial<Answers>|null}){
  const router=useRouter();
  const merged={...defaults,...(initialAnswers??{})} as Answers;
  const [step,setStep]=useState(1);
  const [answers,setAnswers]=useState<Answers>(merged);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);

  const totalStudents=useMemo(()=>answers.gradeConfigs.reduce((sum,g)=>sum+Math.max(0,g.sections)*Math.max(0,g.students),0),[answers.gradeConfigs]);
  const update=<K extends keyof Answers>(key:K,value:Answers[K])=>setAnswers(prev=>({...prev,[key]:value}));

  function setGradeCount(value:number){
    const count=Math.max(1,Math.min(20,value||1));
    const configs=Array.from({length:count},(_,i)=>answers.gradeConfigs[i]??{name:String(i+1),sections:2,students:30});
    update("gradeCount",count); update("gradeConfigs",configs);
  }

  async function next(){
    setError(""); setBusy(true); setSaved(false);
    try{
      await save(schoolId,step===8?"completed":"in_progress",Math.min(step+1,8),answers);
      if(step===8){router.replace("/?schoolId="+schoolId);router.refresh();return;}
      setStep(step+1);setSaved(true);
    }catch(e){setError(e instanceof Error?e.message:"Unable to save");}
    finally{setBusy(false);}
  }

  async function back(){
    if(step===1)return;
    setError("");setBusy(true);
    try{await save(schoolId,"in_progress",step-1,answers);setStep(step-1);}
    catch(e){setError(e instanceof Error?e.message:"Unable to save");}
    finally{setBusy(false);}
  }

  return <section className="onboarding-shell">
    <header className="onboarding-head">
      <div><p className="eyebrow">School onboarding</p><h1>Set up {schoolName}</h1><p>Answer these questions once. EduFlow will use them to shape the school workspace, permissions and setup.</p></div>
      <div className="onboarding-progress"><strong>{step} / {steps.length}</strong><span>{steps[step-1][0]}</span></div>
    </header>

    <div className="onboarding-layout">
      <aside className="onboarding-steps">{steps.map((item,i)=><div key={item[0]} className={"onboarding-step "+(i+1===step?"current ":"")+(i+1<step?"done":"")}><span>{i+1<step?"✓":i+1}</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div></div>)}</aside>

      <div className="onboarding-card">
        {step===1 && <div className="onboarding-section"><p className="eyebrow">01 · School profile</p><h2>What kind of school are you running?</h2><p className="section-copy">This helps us use the right terminology and defaults across the platform.</p><div className="choice-grid">
          {[["private_school","Private school"],["public_school","Government / public"],["international","International school"],["school_group","School group / campus"]].map(([v,l])=><button type="button" key={v} className={"choice-card "+(answers.schoolType===v?"selected":"")} onClick={()=>update("schoolType",v)}><strong>{l}</strong><span>{v==="school_group"?"You can configure each campus separately.":"Use one school workspace with role-based access."}</span></button>)}
        </div><div className="onboarding-grid three"><label>Board<select value={answers.board} onChange={e=>update("board",e.target.value)}><option value="state_board">State Board</option><option value="cbse">CBSE</option><option value="icse">ICSE</option><option value="ib">IB</option><option value="cambridge">Cambridge</option><option value="other">Other</option></select></label><label>Primary medium<select value={answers.medium} onChange={e=>update("medium",e.target.value)}><option value="english">English</option><option value="telugu">Telugu</option><option value="hindi">Hindi</option><option value="urdu">Urdu</option><option value="other">Other / mixed</option></select></label></div></div>}

        {step===2 && <div className="onboarding-section"><p className="eyebrow">02 · Academic calendar</p><h2>Which academic year should we configure?</h2><p className="section-copy">You can add future years later. This becomes the starting academic session.</p><div className="onboarding-grid"><label>Academic year<input value={answers.academicYear} onChange={e=>update("academicYear",e.target.value)} placeholder="2026/2027"/></label></div><div className="info-callout"><strong>Tip</strong><span>Most schools use one active academic year at a time. The workspace can store previous and future years without mixing their records.</span></div></div>}

        {step===3 && <div className="onboarding-section"><p className="eyebrow">03 · Class structure</p><h2>How many classes / grades do you have?</h2><p className="section-copy">Tell us the structure now so your Academic workspace starts with the right shape.</p><label className="onboarding-number">Number of grades<input type="number" min="1" max="20" value={answers.gradeCount} onChange={e=>setGradeCount(Number(e.target.value))}/></label><div className="grade-config-list">{answers.gradeConfigs.map((g,i)=><div className="grade-config" key={i}><div><span>Grade {i+1}</span><input value={g.name} onChange={e=>update("gradeConfigs",answers.gradeConfigs.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></div><label>Sections<input type="number" min="1" max="20" value={g.sections} onChange={e=>update("gradeConfigs",answers.gradeConfigs.map((x,j)=>j===i?{...x,sections:Number(e.target.value)}:x))}/></label><label>Students / section<input type="number" min="1" value={g.students} onChange={e=>update("gradeConfigs",answers.gradeConfigs.map((x,j)=>j===i?{...x,students:Number(e.target.value)}:x))}/></label></div>)}</div><div className="summary-strip"><span>Estimated capacity</span><strong>{totalStudents.toLocaleString()} students</strong></div></div>}

        {step===4 && <div className="onboarding-section"><p className="eyebrow">04 · Students</p><h2>How many students are currently enrolled?</h2><p className="section-copy">This is a planning number. Actual students can be imported or added later.</p><div className="onboarding-grid three"><label>Total students<input type="number" min="0" value={answers.studentCount} onChange={e=>update("studentCount",Number(e.target.value))}/></label><label>Estimated capacity<input value={totalStudents} readOnly/></label><label>Enrollment status<select defaultValue="active"><option>Active enrollment</option><option>Opening soon</option><option>New school</option></select></label></div><div className="info-callout"><strong>Import later</strong><span>You can bulk-import student records from Excel after setup. No student records are created by this questionnaire.</span></div></div>}

        {step===5 && <div className="onboarding-section"><p className="eyebrow">05 · Staff & teachers</p><h2>How many people will operate the school?</h2><p className="section-copy">These numbers help size your staff workspace. You will invite each person individually after setup.</p><div className="onboarding-grid three"><label>Total staff<input type="number" min="0" value={answers.staffCount} onChange={e=>update("staffCount",Number(e.target.value))}/></label><label>Teachers<input type="number" min="0" value={answers.teacherCount} onChange={e=>update("teacherCount",Number(e.target.value))}/></label><label>Administrative / support staff<input type="number" min="0" value={answers.adminStaffCount} onChange={e=>update("adminStaffCount",Number(e.target.value))}/></label></div><div className="role-preview"><div><span>Administrator</span><strong>School control</strong><small>Setup, users, finance and reports</small></div><div><span>Teacher</span><strong>Teaching workspace</strong><small>Attendance, students, academics and exams</small></div><div><span>Staff</span><strong>Operational workspace</strong><small>Read-only school operations</small></div></div></div>}

        {step===6 && <div className="onboarding-section"><p className="eyebrow">06 · Core operations</p><h2>How does your school run day to day?</h2><p className="section-copy">These choices become defaults. You can change them later.</p><div className="onboarding-grid three"><label>Attendance<select value={answers.attendanceMode} onChange={e=>update("attendanceMode",e.target.value)}><option value="daily">Daily class attendance</option><option value="period">Period-wise attendance</option><option value="both">Both</option></select></label><label>Exams<select value={answers.examMode} onChange={e=>update("examMode",e.target.value)}><option value="term">Term / semester exams</option><option value="monthly">Monthly assessments</option><option value="both">Both</option></select></label><label>Fees<select value={answers.feeMode} onChange={e=>update("feeMode",e.target.value)}><option value="monthly">Monthly</option><option value="term">Term-wise</option><option value="annual">Annual</option><option value="mixed">Mixed</option></select></label></div><div className="choice-grid compact">{[["attendanceMode","daily","Daily attendance"],["examMode","term","Term-based exams"],["feeMode","monthly","Monthly fees"]].map(([k,v,l])=><div className="mini-status" key={k}><span>Default</span><strong>{l}</strong></div>)}</div></div>}

        {step===7 && <div className="onboarding-section"><p className="eyebrow">07 · Optional services</p><h2>Which services does your school use?</h2><p className="section-copy">Turn these on now so the workspace can show the right modules and setup prompts.</p><div className="toggle-grid">{[["transport","Transport management","Routes, vehicles and transport operations",answers.transport],["hostel","Hostel / boarding","Residential student operations",answers.hostel],["parentPortal","Parent portal","Parent-facing student, attendance and communication access",answers.parentPortal]].map(([k,t,d,v])=><button type="button" key={String(k)} className={"toggle-card "+(v?"selected":"")} onClick={()=>update(k as keyof Answers,!v as never)}><span className="toggle-dot">{v?"✓":"+"}</span><div><strong>{String(t)}</strong><small>{String(d)}</small></div></button>)}</div></div>}

        {step===8 && <div className="onboarding-section"><p className="eyebrow">08 · Review</p><h2>Your school workspace is ready to be created.</h2><p className="section-copy">Review the operating profile below. You can change these settings later.</p><div className="review-grid">
          <div><span>School</span><strong>{schoolName}</strong></div><div><span>Academic year</span><strong>{answers.academicYear}</strong></div><div><span>Grades</span><strong>{answers.gradeCount}</strong></div><div><span>Students</span><strong>{answers.studentCount.toLocaleString()}</strong></div><div><span>Teachers</span><strong>{answers.teacherCount}</strong></div><div><span>Staff</span><strong>{answers.adminStaffCount}</strong></div><div><span>Attendance</span><strong>{answers.attendanceMode}</strong></div><div><span>Exams</span><strong>{answers.examMode}</strong></div><div><span>Fees</span><strong>{answers.feeMode}</strong></div><div><span>Services</span><strong>{[answers.transport&&"Transport",answers.hostel&&"Hostel",answers.parentPortal&&"Parent portal"].filter(Boolean).join(", ")||"Core only"}</strong></div>
        </div><div className="completion-callout"><strong>Next</strong><span>After completion you will enter the school command center. Your admin account can then add teachers, staff, subjects, sections, students and other records.</span></div></div>}

        {error&&<p className="error onboarding-error">{error}</p>}
        <footer className="onboarding-actions"><button type="button" className="secondary-button" onClick={back} disabled={busy||step===1}>Back</button><div><span className="save-state">{saved?"Saved":""}</span><button type="button" className="primary-button" onClick={next} disabled={busy}>{busy?"Saving…":step===8?"Finish school setup":"Save & continue"}</button></div></footer>
      </div>
    </div>
  </section>;
}
