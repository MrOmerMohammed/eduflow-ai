import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function uuid(value: unknown, name: string) {
  const v = requiredString(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw new Error(`${name} must be a valid UUID`);
  return v;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; payload?: Record<string, unknown> };
    const payload = body.payload ?? {};
    const supabase = await createSupabaseServerClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    const actorUserId = claims?.claims?.sub ? String(claims.claims.sub) : null;
    if (claimsError || !actorUserId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const schoolId = uuid(payload.schoolId, "schoolId");
    const admin = createSupabaseAdminClient();
    const { data: membership, error: membershipError } = await supabase.from("school_memberships").select("school_id").eq("school_id", schoolId).eq("user_id", actorUserId).eq("status", "active").maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ error: "The requested operation is not permitted" }, { status: 403 });

    if (body.action === "staff.list") {
      const { data, error } = await admin.rpc("get_staff", { p_actor_user_id: actorUserId, p_school_id: schoolId, p_status: typeof payload.status === "string" && payload.status ? payload.status : null });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }
    if (body.action === "staff.create") {
      const { data, error } = await admin.rpc("create_staff", {
        p_actor_user_id: actorUserId, p_school_id: schoolId,
        p_employee_number: requiredString(payload.employeeNumber, "employeeNumber"),
        p_first_name: requiredString(payload.firstName, "firstName"),
        p_middle_name: typeof payload.middleName === "string" && payload.middleName.trim() ? payload.middleName.trim() : null,
        p_last_name: typeof payload.lastName === "string" && payload.lastName.trim() ? payload.lastName.trim() : null,
        p_email: typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : null,
        p_phone: typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : null,
        p_designation: requiredString(payload.designation, "designation"),
        p_department: typeof payload.department === "string" && payload.department.trim() ? payload.department.trim() : null,
        p_employment_type: requiredString(payload.employmentType, "employmentType"),
        p_joining_date: requiredString(payload.joiningDate, "joiningDate"),
        p_salary: payload.salary === "" || payload.salary == null ? null : Number(payload.salary),
        p_user_id: typeof payload.userId === "string" && payload.userId ? uuid(payload.userId, "userId") : null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.types") {
      const { data, error } = await supabase.from("leave_types").select("id,name,code,annual_limit,is_paid,is_active").eq("school_id", schoolId).order("name");
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }
    if (body.action === "leave.type.create") {
      const { data, error } = await admin.rpc("create_leave_type", {
        p_actor_user_id: actorUserId, p_school_id: schoolId,
        p_name: requiredString(payload.name, "name"), p_code: requiredString(payload.code, "code"),
        p_annual_limit: payload.annualLimit === "" || payload.annualLimit == null ? null : Number(payload.annualLimit),
        p_is_paid: Boolean(payload.isPaid),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.request.create") {
      const { data, error } = await admin.rpc("create_leave_request", {
        p_actor_user_id: actorUserId, p_school_id: schoolId,
        p_staff_id: uuid(payload.staffId, "staffId"), p_leave_type_id: uuid(payload.leaveTypeId, "leaveTypeId"),
        p_start_date: requiredString(payload.startDate, "startDate"), p_end_date: requiredString(payload.endDate, "endDate"),
        p_reason: typeof payload.reason === "string" ? payload.reason.trim() || null : null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.request.status") {
      const { data, error } = await admin.rpc("set_leave_request_status", {
        p_actor_user_id: actorUserId, p_school_id: schoolId,
        p_leave_request_id: uuid(payload.leaveRequestId, "leaveRequestId"), p_status: requiredString(payload.status, "status"),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.requests") {
      const { data, error } = await supabase.from("leave_requests").select("id,staff_id,leave_type_id,start_date,end_date,days,reason,status,approved_by,approved_at,created_at,staff_members(employee_number,first_name,last_name),leave_types(name,code,is_paid)").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }
    return NextResponse.json({ error: "Unsupported HR action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete HR request";
    if (/already exists|duplicate key/i.test(message)) return NextResponse.json({ error: "This HR record already exists for this school" }, { status: 400 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
