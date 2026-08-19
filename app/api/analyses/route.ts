import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, file_name, analysis")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch analyses from Supabase:", error);
    return NextResponse.json({ error: "Failed to load analyses" }, { status: 500 });
  }

  return NextResponse.json({ analyses: data });
}
