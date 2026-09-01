import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * Public, unauthenticated endpoint — a customer opens this link with no
 * dealership login (Blueprint §23). Deliberately selects ONLY
 * `customer_report` + `created_at`, never `ai_summary` (which can hold
 * more candid internal/salesperson-only notes) or any vehicles/
 * history_events join. RLS additionally only allows rows where
 * share_token is set (see migration 0004).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const cleanToken = token.trim().toUpperCase();

    if (!cleanToken) {
      return NextResponse.json(
        { success: false, error: "Missing report token." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("reports")
      .select("customer_report, created_at")
      .eq("share_token", cleanToken)
      .maybeSingle();

    if (error) {
      console.error("Public report lookup error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to load report." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Report not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        report: data.customer_report,
        created_at: data.created_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Public report API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/:token — revokes a share link by nulling out
 * share_token, without deleting the report row itself (dealer keeps their
 * internal record; the public link just stops resolving). Dealer-only via
 * getCurrentUserProfile + RLS's `reports_update_own_dealership` policy.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      { success: false, error: "Sign in to a dealership first." },
      { status: 401 }
    );
  }

  const { token } = await params;
  const cleanToken = token.trim().toUpperCase();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reports")
    .update({ share_token: null, updated_at: new Date().toISOString() })
    .eq("share_token", cleanToken)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Report revoke error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke report." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "Report not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
