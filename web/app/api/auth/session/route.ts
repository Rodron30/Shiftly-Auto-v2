import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function corsHeaders(origin: string | null) {
  const headers = new Headers();

  if (origin && origin.startsWith("chrome-extension://")) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");

  return headers;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json(
        { loggedIn: false },
        { status: 200, headers }
      );
    }

    let dealershipName: string | null = null;

    if (profile.dealership_id) {
      try {
        const admin = createSupabaseAdminClient();

        const { data: dealership, error } = await admin
          .from("dealerships")
          .select("name")
          .eq("id", profile.dealership_id)
          .maybeSingle();

        if (error) {
          console.error(
            "Session dealership lookup error:",
            error
          );
        } else {
          dealershipName = dealership?.name ?? null;
        }
      } catch (error) {
        console.error(
          "Session dealership admin lookup error:",
          error
        );
      }
    }

    return NextResponse.json(
      {
        loggedIn: true,
        user: {
          name: profile.name,
          email: profile.email,
          role: profile.role,
        },
        dealershipName,
      },
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error("Session check error:", error);

    return NextResponse.json(
      {
        loggedIn: false,
        error: "Session check failed.",
      },
      {
        status: 200,
        headers,
      }
    );
  }
}
