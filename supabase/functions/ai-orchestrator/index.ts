import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function searchStudents(schoolId: string, query: string) {
  const q = query.trim();
  if (!q) {
    const { data, error } = await admin.from("students")
      .select("id,school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status")
      .eq("school_id", schoolId).order("first_name").limit(25);
    if (error) throw error;
    return data ?? [];
  }
  const pattern = `%${q.replace(/[%_]/g, " ")}%`;
  const [admissions, firstNames, lastNames] = await Promise.all([
    admin.from("students").select("id,school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status").eq("school_id", schoolId).ilike("admission_number", pattern).limit(25),
    admin.from("students").select("id,school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status").eq("school_id", schoolId).ilike("first_name", pattern).limit(25),
    admin.from("students").select("id,school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status").eq("school_id", schoolId).ilike("last_name", pattern).limit(25),
  ]);
  for (const result of [admissions, firstNames, lastNames]) if (result.error) throw result.error;
  const byId = new Map<string, any>();
  for (const row of [...(admissions.data ?? []), ...(firstNames.data ?? []), ...(lastNames.data ?? [])]) byId.set(row.id, row);
  return [...byId.values()].slice(0, 25);
}

async function resolveStudent(schoolId: string, input: any, previous: any[]) {
  const ref = typeof input?.student_ref === "string" ? input.student_ref : "";
  const refType = typeof input?.student_ref_type === "string" ? input.student_ref_type : "";
  if (ref && refType === "uuid" && uuid.test(ref)) {
    const { data, error } = await admin.from("students").select("*").eq("school_id", schoolId).eq("id", ref).maybeSingle();
    if (error) throw error;
    return data;
  }
  if (ref && refType === "admission_number") {
    const { data, error } = await admin.from("students").select("*").eq("school_id", schoolId).ilike("admission_number", ref).maybeSingle();
    if (error) throw error;
    return data;
  }
  for (const prior of previous) {
    const value = prior?.result;
    if (value?.student?.id) return value.student;
    const rows = Array.isArray(value?.students) ? value.students : Array.isArray(value?.data) ? value.data : [];
    if (rows.length === 1 && rows[0]?.id) return rows[0];
  }
  const found = await searchStudents(schoolId, typeof input?.query === "string" ? input.query : "");
  if (found.length === 1) return found[0];
  if (found.length === 0) throw new Error("No matching student was found in this school.");
  throw new Error("More than one student matched. Ask with the admission number or a unique student name.");
}

async function runTool(handler: string, schoolId: string, input: any, previous: any[]) {
  if (handler === "student_search") {
    const students = await searchStudents(schoolId, typeof input?.query === "string" ? input.query : "");
    return { students, count: students.length };
  }
  if (handler === "student_get") {
    const student = await resolveStudent(schoolId, input, previous);
    if (!student) throw new Error("Student not found in this school.");
    const { data: enrollments, error } = await admin.from("student_enrollments")
      .select("id,academic_year_id,grade_id,section_id,roll_number,status,academic_years(name,start_date,end_date),grades(name,code),sections(name)")
      .eq("school_id", schoolId).eq("student_id", student.id).order("created_at", { ascending: false });
    if (error) throw error;
    return { student, enrollments: enrollments ?? [] };
  }
  if (handler === "attendance_student") {
    const hasStudentContext = Boolean(input?.student_ref) || previous.some((p: any) => p?.result && (Object.prototype.hasOwnProperty.call(p.result, "students") || Object.prototype.hasOwnProperty.call(p.result, "student")));
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
    const context = typeof input?.date_context === "string" ? input.date_context : "today";
    if (!hasStudentContext) {
      let sessionsQuery = admin.from("attendance_sessions").select("id,attendance_date,section_id,status").eq("school_id", schoolId).order("attendance_date", { ascending: false }).limit(200);
      if (context === "today") sessionsQuery = sessionsQuery.eq("attendance_date", today);
      else if (context === "this_week") {
        const from = new Date(now); from.setUTCDate(from.getUTCDate() - 6);
        sessionsQuery = sessionsQuery.gte("attendance_date", from.toISOString().slice(0, 10)).lte("attendance_date", today);
      } else if (context === "this_month") sessionsQuery = sessionsQuery.gte("attendance_date", `${today.slice(0, 7)}-01`).lte("attendance_date", today);
      const { data: sessions, error: sessionError } = await sessionsQuery;
      if (sessionError) throw sessionError;
      const sessionIds = (sessions ?? []).map((s: any) => s.id);
      const { data: records, error: recordError } = sessionIds.length
        ? await admin.from("attendance_records").select("status").eq("school_id", schoolId).in("session_id", sessionIds)
        : { data: [], error: null };
      if (recordError) throw recordError;
      const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0, other: 0 };
      for (const row of records ?? []) counts[counts[String(row.status)] !== undefined ? String(row.status) : "other"] += 1;
      return { scope: "school", date_context: context, date: context === "today" ? today : undefined, session_count: (sessions ?? []).length, record_count: (records ?? []).length, counts };
    }
    const student = await resolveStudent(schoolId, input, previous);
    if (!student) throw new Error("Student not found in this school.");
    const { data, error } = await admin.from("attendance_records")
      .select("status,remarks,marked_at,attendance_sessions!inner(attendance_date,academic_year_id,status,section_id)")
      .eq("school_id", schoolId).eq("student_id", student.id).order("marked_at", { ascending: false }).limit(100);
    if (error) throw error;
    let records = data ?? [];
    if (context) {
      if (context === "today") records = records.filter((r: any) => r.attendance_sessions?.attendance_date === today);
      else if (context === "this_week") {
        const from = new Date(now); from.setUTCDate(from.getUTCDate() - 6);
        const start = from.toISOString().slice(0, 10);
        records = records.filter((r: any) => r.attendance_sessions?.attendance_date >= start && r.attendance_sessions?.attendance_date <= today);
      } else if (context === "this_month") {
        const start = `${today.slice(0, 7)}-01`;
        records = records.filter((r: any) => r.attendance_sessions?.attendance_date >= start && r.attendance_sessions?.attendance_date <= today);
      }
    }
    return { student: { id: student.id, name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number }, records, count: records.length };
  }
  if (handler === "finance_student_balance") {
    const hasStudentContext = Boolean(input?.student_ref) || previous.some((p: any) => p?.result && (Object.prototype.hasOwnProperty.call(p.result, "students") || Object.prototype.hasOwnProperty.call(p.result, "student")));
    if (!hasStudentContext) {
      const { data: invoices, error: invoiceError } = await admin.from("fee_invoices")
        .select("id,invoice_number,invoice_date,due_date,subtotal,discount,total,status,enrollment_id")
        .eq("school_id", schoolId).order("due_date", { ascending: true }).limit(500);
      if (invoiceError) throw invoiceError;
      const invoiceIds = (invoices ?? []).map((i: any) => i.id);
      const { data: payments, error: paymentError } = invoiceIds.length
        ? await admin.from("fee_payments").select("invoice_id,amount,status,payment_date,receipt_number").eq("school_id", schoolId).in("invoice_id", invoiceIds)
        : { data: [], error: null };
      if (paymentError) throw paymentError;
      const paidByInvoice = new Map<string, number>();
      for (const payment of payments ?? []) if (!["failed", "cancelled", "voided", "refunded"].includes(String(payment.status ?? "").toLowerCase())) paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0));
      const details = (invoices ?? []).map((invoice: any) => ({ ...invoice, paid: paidByInvoice.get(invoice.id) ?? 0, outstanding: Math.max(0, Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0)) }));
      return { scope: "school", invoice_count: details.length, total_invoiced: details.reduce((sum: number, i: any) => sum + Number(i.total ?? 0), 0), total_paid: details.reduce((sum: number, i: any) => sum + i.paid, 0), outstanding: details.reduce((sum: number, i: any) => sum + i.outstanding, 0), invoices: details.slice(0, 50) };
    }
    const student = await resolveStudent(schoolId, input, previous);
    if (!student) throw new Error("Student not found in this school.");
    const { data: enrollments, error: enrollmentError } = await admin.from("student_enrollments")
      .select("id,academic_year_id,grade_id,section_id,roll_number,status").eq("school_id", schoolId).eq("student_id", student.id);
    if (enrollmentError) throw enrollmentError;
    const enrollmentIds = (enrollments ?? []).map((e: any) => e.id);
    if (!enrollmentIds.length) return { student: { id: student.id, name: [student.first_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number }, invoice_count: 0, total_invoiced: 0, total_paid: 0, outstanding: 0, invoices: [] };
    const { data: invoices, error: invoiceError } = await admin.from("fee_invoices")
      .select("id,invoice_number,invoice_date,due_date,subtotal,discount,total,status,enrollment_id")
      .eq("school_id", schoolId).in("enrollment_id", enrollmentIds).order("due_date", { ascending: true }).limit(100);
    if (invoiceError) throw invoiceError;
    const invoiceIds = (invoices ?? []).map((i: any) => i.id);
    const { data: payments, error: paymentError } = invoiceIds.length
      ? await admin.from("fee_payments").select("invoice_id,amount,status,payment_date,receipt_number").eq("school_id", schoolId).in("invoice_id", invoiceIds)
      : { data: [], error: null };
    if (paymentError) throw paymentError;
    const paidByInvoice = new Map<string, number>();
    for (const payment of payments ?? []) if (!["failed", "cancelled", "voided", "refunded"].includes(String(payment.status ?? "").toLowerCase())) paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0));
    const details = (invoices ?? []).map((invoice: any) => ({ ...invoice, paid: paidByInvoice.get(invoice.id) ?? 0, outstanding: Math.max(0, Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0)) }));
    return { student: { id: student.id, name: [student.first_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number }, invoice_count: details.length, total_invoiced: details.reduce((sum: number, i: any) => sum + Number(i.total ?? 0), 0), total_paid: details.reduce((sum: number, i: any) => sum + i.paid, 0), outstanding: details.reduce((sum: number, i: any) => sum + i.outstanding, 0), invoices: details };
  }
  if (handler === "exam_results") {
    const hasStudentContext = Boolean(input?.student_ref) || previous.some((p: any) => p?.result && (Object.prototype.hasOwnProperty.call(p.result, "students") || Object.prototype.hasOwnProperty.call(p.result, "student")));
    let student: any = null;
    let enrollmentIds: string[] = [];
    if (hasStudentContext) {
      student = await resolveStudent(schoolId, input, previous);
      if (!student) throw new Error("Student not found in this school.");
      const { data: enrollments, error: enrollmentError } = await admin.from("student_enrollments").select("id").eq("school_id", schoolId).eq("student_id", student.id);
      if (enrollmentError) throw enrollmentError;
      enrollmentIds = (enrollments ?? []).map((e: any) => e.id);
      if (!enrollmentIds.length) return { student: { id: student.id, name: [student.first_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number }, results: [] };
    }
    let resultsQuery = admin.from("exam_results").select("id,exam_subject_id,enrollment_id,marks,grade,remarks,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100);
    if (hasStudentContext) resultsQuery = resultsQuery.in("enrollment_id", enrollmentIds);
    const { data: results, error } = await resultsQuery;
    if (error) throw error;
    const subjectIds = [...new Set((results ?? []).map((x: any) => x.exam_subject_id))];
    const enrollmentRefs = [...new Set((results ?? []).map((x: any) => x.enrollment_id))];
    const [{ data: examSubjects, error: subjectError }, { data: allEnrollments, error: allEnrollmentError }] = await Promise.all([
      subjectIds.length ? admin.from("exam_subjects").select("id,exam_id,subject_id,exam_date,max_marks,pass_marks").eq("school_id", schoolId).in("id", subjectIds) : { data: [], error: null },
      (!hasStudentContext && enrollmentRefs.length) ? admin.from("student_enrollments").select("id,student_id").eq("school_id", schoolId).in("id", enrollmentRefs) : { data: [], error: null },
    ]);
    if (subjectError) throw subjectError;
    if (allEnrollmentError) throw allEnrollmentError;
    const examIds = [...new Set((examSubjects ?? []).map((x: any) => x.exam_id))];
    const curriculumIds = [...new Set((examSubjects ?? []).map((x: any) => x.subject_id))];
    const studentIds = [...new Set((allEnrollments ?? []).map((x: any) => x.student_id))];
    const [{ data: exams, error: examsError }, { data: subjects, error: subjectsError }, { data: schoolStudents, error: studentsError }] = await Promise.all([
      examIds.length ? admin.from("exams").select("id,name,exam_type,start_date,end_date").eq("school_id", schoolId).in("id", examIds) : { data: [], error: null },
      curriculumIds.length ? admin.from("subjects").select("id,name,code").eq("school_id", schoolId).in("id", curriculumIds) : { data: [], error: null },
      studentIds.length ? admin.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).in("id", studentIds) : { data: [], error: null },
    ]);
    if (examsError) throw examsError;
    if (subjectsError) throw subjectsError;
    if (studentsError) throw studentsError;
    const examMap = new Map((exams ?? []).map((x: any) => [x.id, x]));
    const subjectMap = new Map((subjects ?? []).map((x: any) => [x.id, x]));
    const examSubjectMap = new Map((examSubjects ?? []).map((x: any) => [x.id, x]));
    const enrollmentMap = new Map((allEnrollments ?? []).map((x: any) => [x.id, x]));
    const studentMap = new Map((schoolStudents ?? []).map((x: any) => [x.id, x]));
    const rows = (results ?? []).map((row: any) => {
      const es: any = examSubjectMap.get(row.exam_subject_id);
      const enrollment: any = enrollmentMap.get(row.enrollment_id);
      const studentRow: any = studentMap.get(enrollment?.student_id);
      return { ...row, student: student ? { name: [student.first_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number } : (studentRow ? { name: [studentRow.first_name, studentRow.last_name].filter(Boolean).join(" "), admission_number: studentRow.admission_number } : null), exam: examMap.get(es?.exam_id) ?? null, subject: subjectMap.get(es?.subject_id) ?? null, exam_date: es?.exam_date ?? null, max_marks: es?.max_marks ?? null, pass_marks: es?.pass_marks ?? null };
    });
    return hasStudentContext ? { student: { id: student.id, name: [student.first_name, student.last_name].filter(Boolean).join(" "), admission_number: student.admission_number }, results: rows } : { scope: "school", result_count: rows.length, results: rows };
  }
  if (handler === "timetable_lookup") {
    const { data: entries, error } = await admin.from("timetable_entries")
      .select("id,section_id,subject_id,day_of_week,period_no,starts_at,ends_at,room")
      .eq("school_id", schoolId).eq("is_active", true).order("day_of_week").order("period_no").limit(200);
    if (error) throw error;
    const sectionIds = [...new Set((entries ?? []).map((x: any) => x.section_id).filter(Boolean))];
    const subjectIds = [...new Set((entries ?? []).map((x: any) => x.subject_id).filter(Boolean))];
    const [{ data: sections, error: sectionError }, { data: subjects, error: subjectError }] = await Promise.all([
      sectionIds.length ? admin.from("sections").select("id,name,grade_id").eq("school_id", schoolId).in("id", sectionIds) : { data: [], error: null },
      subjectIds.length ? admin.from("subjects").select("id,name,code").eq("school_id", schoolId).in("id", subjectIds) : { data: [], error: null },
    ]);
    if (sectionError) throw sectionError;
    if (subjectError) throw subjectError;
    const gradeIds = [...new Set((sections ?? []).map((x: any) => x.grade_id).filter(Boolean))];
    const { data: grades, error: gradeError } = gradeIds.length ? await admin.from("grades").select("id,name,code").eq("school_id", schoolId).in("id", gradeIds) : { data: [], error: null };
    if (gradeError) throw gradeError;
    const sectionMap = new Map((sections ?? []).map((x: any) => [x.id, x]));
    const subjectMap = new Map((subjects ?? []).map((x: any) => [x.id, x]));
    const gradeMap = new Map((grades ?? []).map((x: any) => [x.id, x]));
    const q = typeof input?.query === "string" ? input.query.toLowerCase() : "";
    const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const rows = (entries ?? []).map((x: any) => { const section: any = sectionMap.get(x.section_id); const subject: any = subjectMap.get(x.subject_id); const grade: any = gradeMap.get(section?.grade_id); return { ...x, day_name: days[x.day_of_week] ?? "", section_name: section?.name ?? "", grade_name: grade?.name ?? "", subject_name: subject?.name ?? "" }; }).filter((x: any) => !q || [x.section_name, x.grade_name, x.subject_name, x.room].some((v: any) => String(v ?? "").toLowerCase().includes(q)));
    return { entries: rows.slice(0, 50), count: rows.length };
  }
  if (handler === "management_dashboard") {
    const count = async (table: string, column = "school_id") => {
      const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, schoolId);
      if (error) throw error;
      return count ?? 0;
    };
    const [students, staff, enrollments, invoices, attendanceSessions, exams] = await Promise.all([
      count("students"), count("staff_members"), count("student_enrollments"), count("fee_invoices"), count("attendance_sessions"), count("exams"),
    ]);
    return { students, staff, enrollments, invoices, attendance_sessions: attendanceSessions, exams };
  }
  throw new Error("This AI tool has no active handler.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Authentication required" }, 401);
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 128) : null;
    if (!uuid.test(schoolId) || !message || message.length > 2000) return json({ error: "A valid school and a request of 1–2,000 characters are required." }, 400);

    const { data: membership, error: membershipError } = await admin.from("school_memberships")
      .select("school_id,status,schools(id,status)").eq("school_id", schoolId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (membershipError) throw membershipError;
    const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
    if (!membership || !school || school.status !== "active") return json({ error: "You do not have access to this school workspace." }, 403);

    let activeConversationId = conversationId;
    if (activeConversationId && !uuid.test(activeConversationId)) return json({ error: "Invalid conversation ID." }, 400);
    if (!activeConversationId) {
      const { data, error } = await admin.rpc("ai_create_conversation", { p_actor_user_id: user.id, p_school_id: schoolId, p_title: message.slice(0, 120) });
      if (error) return json({ error: "AI access denied or conversation could not be created." }, 403);
      activeConversationId = data;
    }

    const { data: plan, error: planError } = await admin.rpc("ai_plan_request", {
      p_actor_user_id: user.id, p_school_id: schoolId, p_request_text: message,
      p_conversation_id: activeConversationId, p_idempotency_key: idempotencyKey,
    });
    if (planError) return json({ error: "AI planning failed. Check your role permissions and school configuration." }, 403);
    if (plan?.reused && plan?.result) {
      return json({ ok: true, plan, steps: plan.result.steps ?? [], result: plan.result, conversationId: activeConversationId });
    }

    const planSteps = Array.isArray(plan?.steps) ? plan.steps : [];
    if (!planSteps.length) return json({ ok: true, plan, steps: [], error: "The request could not be mapped to an available school operation.", conversationId: activeConversationId });
    const denied = planSteps.some((step: any) => !step?.authorization?.allowed);
    if (denied) {
      const results = planSteps.map((step: any) => ({ order: step.order, tool: step.tool?.name ?? step.tool?.slug ?? "AI operation", error: step.authorization?.reason ?? "This operation is not permitted." }));
      await admin.from("ai_execution_runs").update({ status: "failed", result: { steps: results }, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq("id", plan.run_id).eq("school_id", schoolId).eq("user_id", user.id);
      return json({ ok: true, plan: { ...plan, status: "failed" }, steps: results, error: "One or more requested operations are not authorized for your role.", conversationId: activeConversationId });
    }

    const results: any[] = [];
    for (const step of planSteps) {
      const started = new Date().toISOString();
      try {
        await admin.from("ai_execution_steps").update({ status: "running", started_at: started }).eq("run_id", plan.run_id).eq("step_order", step.order);
        const tool = step.tool ?? step.authorization?.tool;
        const handler = typeof tool?.handler_key === "string" ? tool.handler_key : "";
        const result = await runTool(handler, schoolId, step.input ?? plan.input ?? {}, results);
        const completed = new Date().toISOString();
        await admin.from("ai_execution_steps").update({ status: "succeeded", output: result, error_message: null, completed_at: completed }).eq("run_id", plan.run_id).eq("step_order", step.order);
        results.push({ order: step.order, tool: tool?.name ?? tool?.slug ?? handler, result });
      } catch (error) {
        const completed = new Date().toISOString();
        const message = error instanceof Error ? error.message : "The requested operation failed.";
        await admin.from("ai_execution_steps").update({ status: "failed", error_message: message, output: { error: message }, completed_at: completed }).eq("run_id", plan.run_id).eq("step_order", step.order);
        results.push({ order: step.order, tool: step.tool?.name ?? step.tool?.slug ?? "AI operation", error: message });
      }
    }
    const failed = results.some((step) => Boolean(step.error));
    const finished = new Date().toISOString();
    const resultPayload = { steps: results };
    const { error: updateError } = await admin.from("ai_execution_runs").update({
      status: failed ? "failed" : "succeeded", result: resultPayload, updated_at: finished, completed_at: finished,
    }).eq("id", plan.run_id).eq("school_id", schoolId).eq("user_id", user.id);
    if (updateError) throw updateError;
    const assistantContent = failed ? "Some parts of your request could not be completed. Review the step results." : "Request completed. Review the results below.";
    await admin.from("ai_messages").insert([
      { conversation_id: activeConversationId, role: "user", content: message },
      { conversation_id: activeConversationId, role: "assistant", content: assistantContent, tool_result: resultPayload },
    ]);
    return json({ ok: !failed, plan: { ...plan, status: failed ? "failed" : "succeeded" }, steps: results, result: results[0]?.result, conversationId: activeConversationId, error: failed ? assistantContent : undefined });
  } catch (error) {
    console.error("ai-orchestrator failed", error);
    return json({ error: "AI request could not be completed. Please retry or contact your school administrator." }, 500);
  }
});
