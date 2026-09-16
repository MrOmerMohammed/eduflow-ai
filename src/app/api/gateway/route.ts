import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stringValue, uuidValue, type GatewayRequest } from "@/lib/gateway/types";

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

    return NextResponse.json({ error: "Unsupported gateway action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
