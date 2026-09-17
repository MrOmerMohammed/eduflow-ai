import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, optionalUuid, stringValue, uuidValue, type GatewayRequest } from "@/lib/gateway/types";

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Gateway request failed";
  if (/required|must be|valid UUID|text/i.test(message)) return message;
  if (/Admission number already exists/i.test(message)) return "Admission number already exists in this school";
  if (/already enrolled for this academic year/i.test(message)) return "Student is already enrolled for this academic year";
  if (/not found|does not belong|not active|permission|access denied|unauthorized|forbidden/i.test(message)) return "The requested operation is not permitted";
  return "Unable to complete the request. Please try again.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GatewayRequest;
    const payload = body.payload ?? {};
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
    if (claimsError || !userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    if (body.action === "workspace.context") {
      const [{ data: organizations }, { data: schools }, { data: roles }] = await Promise.all([
        supabase.from("organization_memberships").select("organization_id, role, status, organizations(id, name, slug, status)").eq("user_id", userId),
        supabase.from("school_memberships").select("school_id, role, status, schools(id, organization_id, name, code, status)").eq("user_id", userId),
        supabase.from("user_roles").select("id, organization_id, school_id, roles(key, name, scope)").eq("user_id", userId),
      ]);
      return NextResponse.json({ organizations: organizations ?? [], schools: schools ?? [], roles: roles ?? [] });
    }

    if (body.action === "school.sections") {
      const schoolId = uuidValue(payload, "schoolId");
      const gradeId = uuidValue(payload, "gradeId");
      const { data, error } = await supabase.from("sections").select("id, name, capacity").eq("school_id", schoolId).eq("grade_id", gradeId).order("name");
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }

    if (body.action === "student.search") {
      const schoolId = uuidValue(payload, "schoolId");
      const query = optionalString(payload, "query");
      const status = optionalString(payload, "status");
      const limitValue = Number(payload.limit ?? 50);
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 100) : 50;
      let requestQuery = supabase.from("students").select("id, school_id, admission_number, first_name, middle_name, last_name, date_of_birth, gender, email, phone, status, created_at, updated_at").eq("school_id", schoolId).order("first_name").order("last_name").limit(limit);
      if (status) requestQuery = requestQuery.eq("status", status);
      if (query) { const safe = query.replace(/[%_,]/g, " ").trim(); if (safe) requestQuery = requestQuery.or(`admission_number.ilike.%${safe}%,first_name.ilike.%${safe}%,middle_name.ilike.%${safe}%,last_name.ilike.%${safe}%`); }
      const { data, error } = await requestQuery;
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }

    if (body.action === "student.get") {
      const schoolId = uuidValue(payload, "schoolId");
      const studentId = uuidValue(payload, "studentId");
      const [{ data: student, error: studentError }, { data: guardians, error: guardianError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
        supabase.from("students").select("id, school_id, admission_number, first_name, middle_name, last_name, date_of_birth, gender, email, phone, status, metadata, created_at, updated_at").eq("id", studentId).eq("school_id", schoolId).maybeSingle(),
        supabase.from("student_guardians").select("is_primary, guardians(id, full_name, relationship, phone, email, address, user_id)").eq("student_id", studentId),
        supabase.from("student_enrollments").select("id, academic_year_id, grade_id, section_id, roll_number, status, created_at, academic_years(name, start_date, end_date, is_current), grades(name, code), sections(name, capacity)").eq("student_id", studentId).eq("school_id", schoolId).order("created_at", { ascending: false }),
      ]);
      if (studentError) throw new Error(studentError.message);
      if (guardianError) throw new Error(guardianError.message);
      if (enrollmentError) throw new Error(enrollmentError.message);
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      return NextResponse.json({ data: { student, guardians: guardians ?? [], enrollments: enrollments ?? [] } });
    }

    const admin = createSupabaseAdminClient();
    if (body.action === "attendance.roster") {
      const { data, error } = await admin.rpc("get_attendance_roster", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_section_id: uuidValue(payload, "sectionId"), p_academic_year_id: uuidValue(payload, "academicYearId"), p_attendance_date: stringValue(payload, "attendanceDate") });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "attendance.save") {
      if (!Array.isArray(payload.records)) throw new Error("records must be an array");
      const { data, error } = await admin.rpc("save_attendance", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_academic_year_id: uuidValue(payload, "academicYearId"), p_section_id: uuidValue(payload, "sectionId"), p_attendance_date: stringValue(payload, "attendanceDate"), p_records: payload.records, p_status: optionalString(payload, "status") ?? "submitted", p_notes: optionalString(payload, "notes") });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "attendance.student.summary") {
      const { data, error } = await admin.rpc("get_student_attendance_summary", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_student_id: uuidValue(payload, "studentId"), p_academic_year_id: uuidValue(payload, "academicYearId") });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "workspace.bootstrap") {
      const { data, error } = await admin.rpc("bootstrap_school_workspace", { p_actor_user_id: userId, p_org_name: stringValue(payload, "organizationName"), p_school_name: stringValue(payload, "schoolName"), p_school_code: stringValue(payload, "schoolCode") });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "academic_year.create") {
      const { data, error } = await admin.rpc("create_academic_year", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_name: stringValue(payload, "name"), p_start_date: stringValue(payload, "startDate"), p_end_date: stringValue(payload, "endDate"), p_is_current: Boolean(payload.isCurrent) });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "grade.create") {
      const sortOrder = Number(payload.sortOrder ?? 0);
      const { data, error } = await admin.rpc("create_grade", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_name: stringValue(payload, "name"), p_code: stringValue(payload, "code"), p_sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "section.create") {
      const rawCapacity = payload.capacity === undefined || payload.capacity === "" ? null : Number(payload.capacity);
      const { data, error } = await admin.rpc("create_section", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_grade_id: uuidValue(payload, "gradeId"), p_name: stringValue(payload, "name"), p_capacity: rawCapacity === null || Number.isFinite(rawCapacity) ? rawCapacity : null });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "student.create") {
      const { data, error } = await admin.rpc("create_student", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_admission_number: stringValue(payload, "admissionNumber"), p_first_name: stringValue(payload, "firstName"), p_middle_name: optionalString(payload, "middleName"), p_last_name: optionalString(payload, "lastName"), p_date_of_birth: optionalString(payload, "dateOfBirth"), p_gender: optionalString(payload, "gender"), p_email: optionalString(payload, "email"), p_phone: optionalString(payload, "phone"), p_status: optionalString(payload, "status") ?? "active" });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "student.update") {
      const { data, error } = await admin.rpc("update_student", { p_actor_user_id: userId, p_student_id: uuidValue(payload, "studentId"), p_school_id: uuidValue(payload, "schoolId"), p_admission_number: stringValue(payload, "admissionNumber"), p_first_name: stringValue(payload, "firstName"), p_middle_name: optionalString(payload, "middleName"), p_last_name: optionalString(payload, "lastName"), p_date_of_birth: optionalString(payload, "dateOfBirth"), p_gender: optionalString(payload, "gender"), p_email: optionalString(payload, "email"), p_phone: optionalString(payload, "phone"), p_status: optionalString(payload, "status") ?? "active" });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "guardian.create") {
      const address = payload.address && typeof payload.address === "object" ? payload.address : {};
      const { data, error } = await admin.rpc("create_guardian", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_full_name: stringValue(payload, "fullName"), p_relationship: optionalString(payload, "relationship"), p_phone: optionalString(payload, "phone"), p_email: optionalString(payload, "email"), p_address: address, p_user_id: optionalUuid(payload, "userId") });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "student.guardian.link") {
      const { data, error } = await admin.rpc("link_student_guardian", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_student_id: uuidValue(payload, "studentId"), p_guardian_id: uuidValue(payload, "guardianId"), p_is_primary: Boolean(payload.isPrimary) });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    if (body.action === "enrollment.create") {
      const { data, error } = await admin.rpc("create_student_enrollment", { p_actor_user_id: userId, p_school_id: uuidValue(payload, "schoolId"), p_student_id: uuidValue(payload, "studentId"), p_academic_year_id: uuidValue(payload, "academicYearId"), p_grade_id: uuidValue(payload, "gradeId"), p_section_id: optionalUuid(payload, "sectionId"), p_roll_number: optionalString(payload, "rollNumber"), p_status: optionalString(payload, "status") ?? "active" });
      if (error) throw new Error(error.message); return NextResponse.json({ data });
    }
    return NextResponse.json({ error: "Unsupported gateway action" }, { status: 400 });
  } catch (error) {
    console.error("Gateway request failed", error);
    return NextResponse.json({ error: safeError(error) }, { status: 400 });
  }
}
