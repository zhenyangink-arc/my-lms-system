import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";

export default async function LoginRedirectPage() {
  const { profile, tenant } = await requireActiveUser();

  if (profile?.role === "student" && tenant?.slug) {
    redirect(`/${encodeURIComponent(tenant.slug)}`);
  }

  redirect("/dashboard");
}
