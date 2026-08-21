import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const sessionId = getSessionId(req.headers);

  // No session id means proxy.ts didn't run for this request (shouldn't
  // happen under normal routing) — fail closed rather than falling back to
  // the old "everyone's analyses" behavior this scoping exists to remove.
  if (!sessionId) {
    return NextResponse.json({ analyses: [] });
  }

  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, file_name, analysis")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch analyses from Supabase:", error);
    return NextResponse.json({ error: "Failed to load analyses" }, { status: 500 });
  }

  return NextResponse.json({ analyses: data });
}
