import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  optionalString,
  optionalUuid,
  stringValue,
  uuidValue,
  type GatewayRequest,
} from "@/lib/gateway/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GatewayRequest;
    const payload = body.payload ?? {};
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;

    if (claimsError || !userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (body.action === "workspace.context") {
      const [{ data: organizations }, { data: schools }, { data: roles }] = await Promise.all([
        supabase
          .from("organization_memberships")
          .select("organization_id, role, status, organizations(id, name, slug, status)")
          .eq("user_id", userId),
        supabase
          .from("school_memberships")
          .select("school_id, role, status, schools(id, organization_id, name, code, status)")
          .eq("user_id", userId),
        supabase
          .from("user_roles")
          .select("id, organization_id, school_id, roles(key, name, scope)")
          .eq("user_id", userId),
      ]);

      return NextResponse.json({ organizations: organizations ?? [], schools: schools ?? [], roles: roles ?? [] });
    }

    if (body.action === "student.search") {
      const schoolId = uuidValue(payload, "schoolId");
      const query = optionalString(payload, "query");
      const status = optionalString(payload, "status");
      const limitValue = Number(payload.limit ?? 50);
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 100) : 50;

      let requestQuery = supabase
        .from("students")
        .select("id, school_id, admission_number, first_name, middle_name, last_name, date_of_birth, gender, email, phone, status, created_at, updated_at")
        .eq("school_id", schoolId)
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true })
        .limit(limit);

      if (status) requestQuery = requestQuery.eq("status", status);
      if (query) {
        const safe = query.replace(/[%_,]/g, " ").trim();
        if (safe) {
          requestQuery = requestQuery.or(
            `admission_number.ilike.%${safe}%,first_name.ilike.%${safe}%,middle_name.ilike.%${safe}%,last_name.ilike.%${safe}%`,
          );
        }
      }

      const { data, error } = await requestQuery;
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }

    if (body.action === "student.get") {
      const schoolId = uuidValue(payload, "schoolId");
      const studentId = uuidValue(payload, "studentId");
      const [{ data: student, error: studentError }, { data: guardians, error: guardianError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
        supabase
          .from("students")
          .select("id, school_id, admission_number, first_name, middle_name, last_name, date_of_birth, gender, email, phone, status, metadata, created_at, updated_at")
          .eq("id", studentId)
          .eq("school_id", schoolId)
          .maybeSingle(),
        supabase
          .from("student_guardians")
          .select("is_primary, guardians(id, full_name, relationship, phone, email, address, user_id)")
          .eq("student_id", studentId),
        supabase
          .from("student_enrollments")
          .select("id, academic_year_id, grade_id, section_id, roll_number, status, created_at, academic_years(name, start_date, end_date, is_current), grades(name, code), sections(name, capacity)")
          .eq("student_id", studentId)
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
      ]);

      if (studentError) throw new Error(studentError.message);
      if (guardianError) throw new Error(guardianError.message);
      if (enrollmentError) throw new Error(enrollmentError.message);
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      return NextResponse.json({ data: { student, guardians: guardians ?? [], enrollments: enrollments ?? [] } });
    }

    const admin = createSupabaseAdminClient();

    if (body.action === "workspace.bootstrap") {
      const orgName = stringValue(payload, "organizationName");
      const schoolName = stringValue(payload, "schoolName");
      const schoolCode = stringValue(payload, "schoolCode");
      const { data, error } = await admin.rpc("bootstrap_school_workspace", {
        p_actor_user_id: userId,
        p_org_name: orgName,
        p_school_name: schoolName,
        p_school_code: schoolCode,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "academic_year.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const name = stringValue(payload, "name");
      const startDate = stringValue(payload, "startDate");
      const endDate = stringValue(payload, "endDate");
      const isCurrent = Boolean(payload.isCurrent);
      const { data, error } = await admin.rpc("create_academic_year", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_name: name,
        p_start_date: startDate,
        p_end_date: endDate,
        p_is_current: isCurrent,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "grade.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const name = stringValue(payload, "name");
      const code = stringValue(payload, "code");
      const sortOrder = Number(payload.sortOrder ?? 0);
      const { data, error } = await admin.rpc("create_grade", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_name: name,
        p_code: code,
        p_sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "section.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const gradeId = uuidValue(payload, "gradeId");
      const name = stringValue(payload, "name");
      const capacity = payload.capacity === undefined || payload.capacity === "" ? null : Number(payload.capacity);
      const { data, error } = await admin.rpc("create_section", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_grade_id: gradeId,
        p_name: name,
        p_capacity: capacity === null || Number.isFinite(capacity) ? capacity : null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "student.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const { data, error } = await admin.rpc("create_student", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_admission_number: stringValue(payload, "admissionNumber"),
        p_first_name: stringValue(payload, "firstName"),
        p_middle_name: optionalString(payload, "middleName"),
        p_last_name: optionalString(payload, "lastName"),
        p_date_of_birth: optionalString(payload, "dateOfBirth"),
        p_gender: optionalString(payload, "gender"),
        p_email: optionalString(payload, "email"),
        p_phone: optionalString(payload, "phone"),
        p_status: optionalString(payload, "status") ?? "active",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "student.update") {
      const schoolId = uuidValue(payload, "schoolId");
      const studentId = uuidValue(payload, "studentId");
      const { data, error } = await admin.rpc("update_student", {
        p_actor_user_id: userId,
        p_student_id: studentId,
        p_school_id: schoolId,
        p_admission_number: stringValue(payload, "admissionNumber"),
        p_first_name: stringValue(payload, "firstName"),
        p_middle_name: optionalString(payload, "middleName"),
        p_last_name: optionalString(payload, "lastName"),
        p_date_of_birth: optionalString(payload, "dateOfBirth"),
        p_gender: optionalString(payload, "gender"),
        p_email: optionalString(payload, "email"),
        p_phone: optionalString(payload, "phone"),
        p_status: optionalString(payload, "status") ?? "active",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "guardian.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const address = payload.address && typeof payload.address === "object" ? payload.address : {};
      const { data, error } = await admin.rpc("create_guardian", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_full_name: stringValue(payload, "fullName"),
        p_relationship: optionalString(payload, "relationship"),
        p_phone: optionalString(payload, "phone"),
        p_email: optionalString(payload, "email"),
        p_address: address,
        p_user_id: optionalUuid(payload, "userId"),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "student.guardian.link") {
      const schoolId = uuidValue(payload, "schoolId");
      const { data, error } = await admin.rpc("link_student_guardian", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_student_id: uuidValue(payload, "studentId"),
        p_guardian_id: uuidValue(payload, "guardianId"),
        p_is_primary: Boolean(payload.isPrimary),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    if (body.action === "enrollment.create") {
      const schoolId = uuidValue(payload, "schoolId");
      const { data, error } = await admin.rpc("create_student_enrollment", {
        p_actor_user_id: userId,
        p_school_id: schoolId,
        p_student_id: uuidValue(payload, "studentId"),
        p_academic_year_id: uuidValue(payload, "academicYearId"),
        p_grade_id: uuidValue(payload, "gradeId"),
        p_section_id: optionalUuid(payload, "sectionId"),
        p_roll_number: optionalString(payload, "rollNumber"),
        p_status: optionalString(payload, "status") ?? "active",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unsupported gateway action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
