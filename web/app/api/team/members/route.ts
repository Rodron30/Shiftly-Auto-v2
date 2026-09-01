import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";

export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      { success: false, error: "Sign in to a dealership first." },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, created_at")
    .eq("dealership_id", profile.dealership_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Team members lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load team members." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, members: data ?? [] });
}
