import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";
import { generateInviteToken } from "@/lib/shareToken";

type InviteBody = {
  email: string;
  role: "manager" | "salesperson";
};

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      { success: false, error: "Sign in to a dealership first." },
      { status: 401 }
    );
  }

  if (profile.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Only dealership admins can invite teammates." },
      { status: 403 }
    );
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role || "salesperson";

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, error: "Enter a valid email." },
      { status: 400 }
    );
  }

  if (!["manager", "salesperson"].includes(role)) {
    return NextResponse.json(
      { success: false, error: "Role must be manager or salesperson." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  // Prevent duplicate active invites for the same dealership/email.
  // This keeps the invite table clean and avoids confusing staff with
  // multiple live links.
  const { data: existingInvite, error: existingInviteError } = await supabase
    .from("dealership_invites")
    .select("id, email, role, token, created_at, expires_at, used_at")
    .eq("dealership_id", profile.dealership_id)
    .ilike("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInviteError) {
    console.error("Existing invite lookup error:", existingInviteError);
    return NextResponse.json(
      { success: false, error: "Failed to check existing invites." },
      { status: 500 }
    );
  }

  if (existingInvite) {
    return NextResponse.json(
      {
        success: false,
        error: "An active invite already exists for this email.",
        invite: existingInvite,
      },
      { status: 409 }
    );
  }

  const token = generateInviteToken();

  const { data: invite, error } = await supabase
    .from("dealership_invites")
    .insert({
      dealership_id: profile.dealership_id,
      email,
      role,
      token,
      created_by: profile.id,
    })
    .select("id, email, role, token, expires_at")
    .single();

  if (error || !invite) {
    console.error("Invite creation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create invite." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "Invite link created successfully.",
      invite,
    },
    { status: 201 }
  );
}

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
    .from("dealership_invites")
    .select("id, email, role, token, created_at, expires_at, used_at")
    .eq("dealership_id", profile.dealership_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Invite list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load invites." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, invites: data ?? [] });
}
