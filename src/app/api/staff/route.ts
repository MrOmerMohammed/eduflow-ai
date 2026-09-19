import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, stringValue, uuidValue } from "@/lib/gateway/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string; payload?: Record<string, unknown> };
    const payload = body.payload ?? {};
    const supabase = await createSupabaseServerClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub ? String(claims.claims.sub) : null;
    if (claimsError || !userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const admin = createSupabaseAdminClient();
    const schoolId = uuidValue(payload, "schoolId");
    const { data: membership, error: membershipError } = await supabase.from("school_memberships").select("school_id").eq("school_id", schoolId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ error: "The requested operation is not permitted" }, { status: 403 });

    if (body.action === "staff.list") {
      const { data, error } = await admin.rpc("get_staff", { p_actor_user_id: userId, p_school_id: schoolId, p_status: optionalString(payload, "status") });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }
    if (body.action === "staff.create") {
      const { data, error } = await admin.rpc("create_staff", {
        p_actor_user_id: userId, p_school_id: schoolId, p_employee_number: stringValue(payload, "employeeNumber"),
        p_first_name: stringValue(payload, "firstName"), p_middle_name: optionalString(payload, "middleName"),
        p_last_name: optionalString(payload, "lastName"), p_email: optionalString(payload, "email"), p_phone: optionalString(payload, "phone"),
        p_designation: stringValue(payload, "designation"), p_department: optionalString(payload, "department"),
        p_employment_type: optionalString(payload, "employmentType") ?? "full_time", p_joining_date: optionalString(payload, "joiningDate"),
        p_salary: payload.salary === null || payload.salary === undefined || payload.salary === "" ? null : Number(payload.salary),
        p_user_id: null
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.type.create") {
      const { data, error } = await admin.rpc("create_leave_type", {
        p_actor_user_id: userId, p_school_id: schoolId, p_name: stringValue(payload, "name"),
        p_code: stringValue(payload, "code"), p_annual_limit: payload.annualLimit === null || payload.annualLimit === undefined || payload.annualLimit === "" ? null : Number(payload.annualLimit),
        p_is_paid: payload.isPaid === undefined ? true : Boolean(payload.isPaid)
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.type.list") {
      const { data, error } = await supabase.from("leave_types").select("id,name,code,annual_limit,is_paid,is_active").eq("school_id", schoolId).order("name");
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: data ?? [] });
    }
    if (body.action === "leave.request.create") {
      const { data, error } = await admin.rpc("create_leave_request", {
        p_actor_user_id: userId, p_school_id: schoolId, p_staff_id: uuidValue(payload, "staffId"),
        p_leave_type_id: uuidValue(payload, "leaveTypeId"), p_start_date: stringValue(payload, "startDate"),
        p_end_date: stringValue(payload, "endDate"), p_reason: optionalString(payload, "reason")
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    if (body.action === "leave.request.status") {
      const { data, error } = await admin.rpc("set_leave_request_status", {
        p_actor_user_id: userId, p_school_id: schoolId, p_leave_request_id: uuidValue(payload, "leaveRequestId"), p_status: stringValue(payload, "status")
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ data });
    }
    return NextResponse.json({ error: "Unsupported staff action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete the request";
    const safe = /required|valid UUID|text|permission|not found|overlapping|already exists|invalid leave status|on or after/i.test(message) ? message : "Unable to complete the request. Please try again.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
