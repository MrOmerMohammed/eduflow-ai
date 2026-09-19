import Link from "next/link";

const plans = [
  {name:"Starter",price:"₹1,999",period:"/month",desc:"For small schools getting off spreadsheets.",features:["Up to 500 active students","Students & admissions","Attendance","Exams & report cards","Fee tracking","Basic analytics","Email support"]},
  {name:"Growth",price:"₹4,999",period:"/month",desc:"For growing schools that need the full operating layer.",features:["Up to 1,500 active students","All Starter modules","Staff & HR workflows","Communication & notifications","Data import","AI Assistant","Priority support"],featured:true},
  {name:"Pro",price:"₹9,999",period:"/month",desc:"For larger schools and multi-campus operators.",features:["Up to 5,000 active students","Up to 5 schools","Advanced analytics","Higher AI allowance","Priority onboarding","Dedicated support","Custom integrations"]},
];

export default function PricingPage(){
  return <main className="marketing-shell">
    <nav className="marketing-nav"><Link className="brand" href="/"><span className="brand-mark">E</span><span>EduFlow AI</span></Link><div className="marketing-links"><Link href="/pricing">Pricing</Link><Link href="/auth/login">Sign in</Link><Link className="marketing-cta" href="/auth/sign-up">Start free trial</Link></div></nav>
    <section className="pricing-hero"><p className="eyebrow">Simple school SaaS pricing</p><h1>One platform for the daily work of a school.</h1><p className="lead">Start with a 14-day trial. No payment is required to create your workspace. Plans scale with the number of active students and schools.</p></section>
    <section className="pricing-grid">{plans.map(p=><article className={`pricing-card ${p.featured?"featured":""}`} key={p.name}>{p.featured&&<span className="pricing-badge">Most complete</span>}<h2>{p.name}</h2><p>{p.desc}</p><div className="price">{p.price}<small>{p.period}</small></div><ul>{p.features.map(f=><li key={f}>✓ {f}</li>)}</ul><Link className="primary-link" href="/auth/sign-up">Start trial</Link></article>)}</section>
    <section className="pricing-note"><strong>Need a school group?</strong><span>Pro can be configured for multi-school operations, custom onboarding and integrations. Contact us for an enterprise proposal.</span></section>
    <footer className="marketing-footer"><span>© {new Date().getFullYear()} EduFlow AI</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/security">Security</Link></div></footer>
  </main>;
}
