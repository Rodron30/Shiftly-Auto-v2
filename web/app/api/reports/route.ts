import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";
import { generateShareToken } from "@/lib/shareToken";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type HistoryEventInput = {
  event_date: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
};

type CreateReportBody = {
  vehicleId: string;
  aiSummary: {
    quick_summary: string;
    salesperson_explanation: string;
    customer_summary: string;
    warnings: string[];
    facts: string[];
  };
};

const MAX_TOKEN_ATTEMPTS = 5;

export async function POST(request: Request) {
  let body: CreateReportBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body?.vehicleId || !body?.aiSummary) {
    return NextResponse.json(
      { success: false, error: "Missing vehicleId or aiSummary." },
      { status: 400 }
    );
  }

  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      { success: false, error: "You must be signed in to a dealership to create a report." },
      { status: 401 }
    );
  }

  const rateLimitKey = getRateLimitKey(request, profile.id);
  const { allowed } = checkRateLimit(rateLimitKey, 30, 60_000); // 30/min

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();

  // Re-fetch vehicle + history server-side rather than trusting a client
  // payload for the customer-facing snapshot. RLS also independently
  // guarantees this vehicle belongs to the caller's dealership.
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, dealership_id, vin, year, make, model, trim")
    .eq("id", body.vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { success: false, error: "Vehicle not found." },
      { status: 404 }
    );
  }

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("name, logo_url")
    .eq("id", vehicle.dealership_id)
    .maybeSingle();

  const { data: events, error: eventsError } = await supabase
    .from("history_events")
    .select("event_date, event_type, description, location, odometer, source")
    .eq("vehicle_id", vehicle.id)
    .order("event_date", { ascending: true });

  if (eventsError) {
    console.error("Report creation history lookup error:", eventsError);
    return NextResponse.json(
      { success: false, error: "Failed to load vehicle history." },
      { status: 500 }
    );
  }

  const rows = (events ?? []) as (HistoryEventInput & {
    event_type: "THEFT" | "ODOMETER" | "OTHER";
  })[];

  const theft = rows
    .filter((r) => r.event_type === "THEFT")
    .map((r) => ({
      date: r.event_date,
      description: r.description,
      location: r.location,
      odometer: r.odometer,
      source: r.source,
    }));

  const odometer = rows
    .filter((r) => r.event_type === "ODOMETER")
    .map((r) => ({
      date: r.event_date,
      description: r.description,
      location: r.location,
      odometer: r.odometer,
      source: r.source,
    }));

  const uniqueSources = Array.from(
    new Set(rows.map((r) => r.source).filter(Boolean))
  );

  const customerReport: CustomerReportPayload = {
    dealership: {
      name: dealership?.name ?? "Your Dealership",
      logo_url: dealership?.logo_url ?? null,
    },
    vehicle: {
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
    },
    history_highlights: {
      theft_found: theft.length > 0,
      odometer_available: odometer.length > 0,
    },
    theft,
    odometer,
    // Deliberately only the customer-facing summary + warnings — the
    // quick_summary/salesperson_explanation stay internal (ai_summary col).
    customer_summary: body.aiSummary.customer_summary,
    warnings: body.aiSummary.warnings,
    data_source: uniqueSources.length > 0 ? uniqueSources.join(", ") : "N/A",
    generated_at: new Date().toISOString(),
  };

  // share_token has a unique constraint — retry a few times on collision
  // rather than trusting an 8-char random string is always unique.
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    const shareToken = generateShareToken();

    const { data: inserted, error: insertError } = await supabase
      .from("reports")
      .insert({
        vehicle_id: vehicle.id,
        created_by: profile.id,
        ai_summary: body.aiSummary,
        customer_report: customerReport,
        source_information: {
          sources: uniqueSources,
          retrieved_at: new Date().toISOString(),
        },
        share_token: shareToken,
      })
      .select("id, share_token, created_at")
      .single();

    if (!insertError && inserted) {
      return NextResponse.json(
        { success: true, report: inserted },
        { status: 201 }
      );
    }

    lastError = insertError;

    // 23505 = unique_violation. Anything else, stop retrying.
    if (insertError?.code !== "23505") break;
  }

  console.error("Report creation error:", lastError);
  return NextResponse.json(
    { success: false, error: "Failed to create report." },
    { status: 500 }
  );
}

/**
 * GET /api/reports — lists reports for the caller's dealership, most
 * recent first, with the vehicle they belong to. Feeds the dashboard's
 * "Recent Reports" (Blueprint §6) and the Reports page. RLS's
 * `reports_select_own_dealership` policy scopes this automatically.
 */
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      { success: false, error: "Sign in to a dealership first." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 50;

  const supabase = await createSupabaseServerClient();

  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, vehicle_id, share_token, created_at, customer_report")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Reports list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load reports." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, reports: reports ?? [] });
}
