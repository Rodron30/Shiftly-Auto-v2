import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { decodeVin } from "@/lib/vinDecode";

type RouteContext = {
  params: Promise<{
    vin: string;
  }>;
};

const VEHICLE_COLUMNS = `
  id,
  dealership_id,
  vin,
  year,
  make,
  model,
  trim,
  body,
  engine,
  drivetrain,
  fuel,
  created_by,
  created_at,
  updated_at
`;

function normalizeVin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

/**
 * GET /api/vehicles/:vin
 */
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { vin } = await params;
    const normalizedVin = normalizeVin(vin);

    if (!isValidVin(normalizedVin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VIN format.",
          vin: normalizedVin,
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    /*
     * STEP 1
     * Find vehicle only inside current dealership.
     *
     * limit(1) prevents old duplicate VIN records
     * from causing PGRST116.
     */
    const { data: existingRows, error: lookupError } =
      await supabase
        .from("vehicles")
        .select(VEHICLE_COLUMNS)
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

    if (lookupError) {
      console.error(
        "Supabase vehicle lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: lookupError.message ||
            "Failed to load vehicle.",
        },
        { status: 500 }
      );
    }

    const existing = existingRows?.[0] ?? null;

    if (existing) {
      let checkedByName: string | null = null;

      if (existing.created_by) {
        const { data: creator } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", existing.created_by)
          .maybeSingle();

        checkedByName =
          creator?.name ||
          creator?.email ||
          null;
      }

      return NextResponse.json(
        {
          success: true,
          vehicle: existing,
          source: "database",
          checkedByName,
        },
        { status: 200 }
      );
    }

    /*
     * STEP 2
     * Decode VIN.
     */
    const decoded = await decodeVin(normalizedVin);

    if (!decoded || (!decoded.make && !decoded.model)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle could not be decoded. Please verify the VIN and try again.",
          vin: normalizedVin,
        },
        { status: 404 }
      );
    }

    /*
     * STEP 3
     * Save decoded vehicle.
     */
    const { data: inserted, error: insertError } =
      await supabase
        .from("vehicles")
        .insert({
          dealership_id: profile.dealership_id,
          vin: normalizedVin,
          year: decoded.year,
          make: decoded.make,
          model: decoded.model,
          trim: decoded.trim,
          body: decoded.body,
          engine: decoded.engine,
          drivetrain: decoded.drivetrain,
          fuel: decoded.fuel,
          created_by: profile.id,
        })
        .select(VEHICLE_COLUMNS)
        .single();

    if (insertError) {
      console.error(
        "Supabase vehicle insert error:",
        {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message ||
            "Failed to save vehicle.",
          details: insertError.details || null,
          hint: insertError.hint || null,
          code: insertError.code || null,
        },
        { status: 500 }
      );
    }

    if (!inserted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle was decoded but could not be saved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicle: inserted,
        source: "decoded_and_saved",
        checkedByName:
          profile.name ||
          profile.email ||
          null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vehicles/:vin
 *
 * Refreshes vehicle timestamp.
 */
export async function PATCH(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { vin } = await params;
    const normalizedVin = normalizeVin(vin);

    if (!isValidVin(normalizedVin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VIN format.",
        },
        { status: 400 }
      );
    }

    const supabase =
      await createSupabaseServerClient();

    const profile =
      await getCurrentUserProfile();

    if (!profile?.id || !profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const { data: existingRows, error: lookupError } =
      await supabase
        .from("vehicles")
        .select("id")
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

    if (lookupError) {
      console.error(
        "Supabase vehicle PATCH lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: lookupError.message ||
            "Failed to find vehicle.",
        },
        { status: 500 }
      );
    }

    const vehicle = existingRows?.[0];

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found.",
        },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicle.id)
      .eq("dealership_id", profile.dealership_id)
      .select(VEHICLE_COLUMNS)
      .single();

    if (error) {
      console.error(
        "Supabase vehicle update error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Failed to refresh vehicle.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicle: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}
