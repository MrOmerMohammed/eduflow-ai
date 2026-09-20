import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GradeConfig = { name?: unknown; sections?: unknown; students?: unknown };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validate(currentStep: number, answers: Record<string, unknown>) {
  if (currentStep >= 1 && (!text(answers.schoolType) || !text(answers.board) || !text(answers.medium))) throw new Error("Please complete the school profile before continuing");
  if (currentStep >= 2 && !text(answers.academicYear)) throw new Error("Academic year is required");

  const grades = Array.isArray(answers.gradeConfigs) ? answers.gradeConfigs as GradeConfig[] : [];
  if (currentStep >= 3) {
    const gradeCount = Number(answers.gradeCount);
    if (!Number.isInteger(gradeCount) || gradeCount < 1 || gradeCount > 20) throw new Error("Number of grades must be between 1 and 20");
    if (grades.length !== gradeCount) throw new Error("Please configure every grade");
    const names = grades.map(g => text(g.name).toLowerCase());
    if (names.some(n => !n)) throw new Error("Every grade must have a name");
    if (new Set(names).size !== names.length) throw new Error("Grade names must be unique");
    for (const g of grades) {
      const sections = Number(g.sections), students = Number(g.students);
      if (!Number.isInteger(sections) || sections < 1 || sections > 20) throw new Error("Each grade must have between 1 and 20 sections");
      if (!Number.isInteger(students) || students < 1) throw new Error("Students per section must be at least 1");
    }
  }
  if (currentStep >= 4 && (!Number.isInteger(Number(answers.studentCount)) || Number(answers.studentCount) < 0)) throw new Error("Student count must be zero or greater");
  if (currentStep >= 5) {
    const staff = Number(answers.staffCount), teachers = Number(answers.teacherCount), admin = Number(answers.adminStaffCount);
    if ([staff, teachers, admin].some(v => !Number.isInteger(v) || v < 0)) throw new Error("Staff counts must be zero or greater");
    if (teachers + admin > staff) throw new Error("Teachers and administrative staff cannot exceed total staff");
  }
  if (currentStep >= 6) {
    if (!["daily","period","both"].includes(text(answers.attendanceMode))) throw new Error("Invalid attendance mode");
    if (!["term","monthly","both"].includes(text(answers.examMode))) throw new Error("Invalid exam mode");
    if (!["monthly","term","annual","mixed"].includes(text(answers.feeMode))) throw new Error("Invalid fee mode");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { schoolId?: unknown; status?: unknown; currentStep?: unknown; answers?: unknown };
    const schoolId = text(body.schoolId);
    if (!schoolId) return NextResponse.json({ error: "School workspace is required" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : "";
    if (claimsError || !userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from("school_memberships")
      .select("school_id,role,status,schools(id,organization_id,status)")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership?.schools || membership.role !== "admin") throw new Error("Only school administrators can complete school setup");

    const schoolRecord = Array.isArray(membership.schools) ? membership.schools[0] : membership.schools;
    if (!schoolRecord || schoolRecord.status !== "active") throw new Error("School not found or inactive");

    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, unknown> : {};
    const currentStep = Math.max(1, Math.min(8, Number(body.currentStep ?? 1)));
    validate(currentStep, answers);

    const status = text(body.status) === "completed" ? "completed" : "in_progress";
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("school_onboarding_profiles")
      .upsert({
        school_id: schoolId,
        status,
        current_step: currentStep,
        answers,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" })
      .select("school_id,status,current_step,answers,completed_at,updated_at")
      .single();
    if (error) throw new Error(error.message);

    const { error: auditError } = await admin.from("audit_logs").insert({
      organization_id: schoolRecord.organization_id,
      school_id: schoolId,
      actor_user_id: userId,
      action: "school.onboarding.save",
      entity_type: "school_onboarding",
      entity_id: schoolId,
      metadata: { status, current_step: currentStep },
    });
    if (auditError) throw new Error(auditError.message);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("School onboarding save failed", error);
    const message = error instanceof Error ? error.message : "Unable to save school setup";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
