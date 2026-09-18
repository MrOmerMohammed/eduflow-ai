import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SCHOOL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textCell(value: ExcelJS.CellValue) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
    if (claimsError || !userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const schoolId = String(form.get("schoolId") ?? "");
    const academicYearId = String(form.get("academicYearId") ?? "");

    if (!(file instanceof File)) throw new Error("An Excel workbook is required");
    if (!SCHOOL_ID_RE.test(schoolId)) throw new Error("schoolId must be a valid UUID");
    if (!SCHOOL_ID_RE.test(academicYearId)) throw new Error("academicYearId must be a valid UUID");
    if (file.size > 10 * 1024 * 1024) throw new Error("Workbook must be 10 MB or smaller");
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error("Only .xlsx or .xlsm workbooks are supported");

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("Workbook has no worksheets");

    const sourceSchoolName = textCell(worksheet.getCell(1, 1).value);
    const headerRow = worksheet.getRow(2);
    const headers = headerRow.values as ExcelJS.CellValue[];
    const normalizedHeaders = headers.map((v) => textCell(v).toLowerCase());
    const required = ["class", "name", "father name", "mobile no."];
    if (!required.every((header) => normalizedHeaders.includes(header))) {
      throw new Error("Expected columns: Class, Name, Father Name, Mobile No.");
    }

    const column = (header: string) => normalizedHeaders.indexOf(header) + 1;
    const rows: Array<Record<string, unknown>> = [];
    const rawRows: Array<Record<string, string>> = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const className = textCell(row.getCell(column("class")).value);
      const name = normalizeName(textCell(row.getCell(column("name")).value));
      const fatherName = normalizeName(textCell(row.getCell(column("father name")).value));
      const mobile = normalizeMobile(textCell(row.getCell(column("mobile no.")).value));
      if (!className && !name && !fatherName && !mobile) return;
      rawRows.push({
        Class: className,
        Name: name,
        "Father Name": fatherName,
        "Mobile No.": mobile,
      });
      rows.push({
        row_number: rowNumber,
        raw_data: rawRows[rawRows.length - 1],
        normalized_data: {
          class: className.trim(),
          name,
          father_name: fatherName,
          mobile,
        },
      });
    });

    if (rows.length === 0) throw new Error("No student rows were found");
    if (rows.length > 10000) throw new Error("Workbook exceeds the 10,000-row safety limit");

    const admin = createSupabaseAdminClient();
    const { data: batchId, error: createError } = await admin.rpc("create_import_batch", {
      p_actor_user_id: userId,
      p_school_id: schoolId,
      p_source_filename: file.name,
      p_source_type: "xlsx",
      p_academic_year_id: academicYearId,
    });
    if (createError) throw new Error(createError.message);

    const { error: stageError } = await admin.rpc("stage_import_rows", {
      p_actor_user_id: userId,
      p_school_id: schoolId,
      p_batch_id: batchId,
      p_rows: rows,
    });
    if (stageError) throw new Error(stageError.message);

    const { data: validation, error: validationError } = await admin.rpc("validate_import_batch", {
      p_actor_user_id: userId,
      p_school_id: schoolId,
      p_batch_id: batchId,
    });
    if (validationError) throw new Error(validationError.message);

    return NextResponse.json({
      data: {
        batchId,
        sourceSchoolName,
        worksheet: worksheet.name,
        rowsParsed: rows.length,
        validation,
        safeMode: true,
        writesPerformed: false,
      },
    });
  } catch (error) {
    console.error("Import preview failed", error);
    const message = error instanceof Error ? error.message : "Unable to preview workbook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}