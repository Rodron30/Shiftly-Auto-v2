import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Invalid or expired password reset link. Please request a new one."
      )}`
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Password reset code exchange error:", error);

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "This password reset link is invalid or expired. Please request a new one."
      )}`
    );
  }

  return NextResponse.redirect(`${origin}/reset-password`);
}