import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const server = await createSupabaseServerClient();
    const { data: { session }, error: sessionError } = await server.auth.getSession();
    if (sessionError || !session?.access_token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const schoolId = typeof body.schoolId === "string" ? body.schoolId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;

    if (!schoolId || !message) {
      return NextResponse.json({ error: "schoolId and message are required" }, { status: 400 });
    }

    const { data, error } = await server.functions.invoke("ai-orchestrator", {
      body: { schoolId, message, conversationId, idempotencyKey },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      console.error("AI orchestrator invocation failed", error);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("AI route failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
