import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(field + " is required");
  return value.trim();
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Workspace setup failed";
  if (/required|already belongs|already exists|duplicate|valid|not found|configured/i.test(message)) return message;
  return "Unable to create the school workspace. Please try again.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const organizationName = requiredText(body.organizationName, "Organization name");
    const schoolName = requiredText(body.schoolName, "School name");
    const schoolCode = requiredText(body.schoolCode, "School code").toUpperCase();

    if (schoolCode.length > 20) throw new Error("School code must be 20 characters or fewer");

    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
    if (claimsError || !userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // Initial workspace creation is deliberately pre-school-scoped: there is no schoolId yet.
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("bootstrap_school_workspace", {
      p_actor_user_id: userId,
      p_org_name: organizationName,
      p_school_name: schoolName,
      p_school_code: schoolCode,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Workspace bootstrap failed", error);
    return NextResponse.json({ error: safeError(error) }, { status: 400 });
  }
}
