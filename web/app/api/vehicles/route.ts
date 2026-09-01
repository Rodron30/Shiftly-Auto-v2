import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select(`
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
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase vehicles lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load vehicles.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicles: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vehicles API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}