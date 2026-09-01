import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function ReportsClient() {
  return <div>Reports</div>;
}

export default async function ReportsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    redirect("/login?redirectTo=%2Freports");
  }

  return <ReportsClient />;
}