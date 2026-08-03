import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AssignablePermissionKey } from "./catalog";

export async function hasExplicitPermission(
  supabase: SupabaseClient,
  userId: string,
  permissionKey: AssignablePermissionKey,
  tenantId: string | null
) {
  let query = supabase
    .from("permission_grants")
    .select("id")
    .eq("subject_user_id", userId)
    .eq("permission_key", permissionKey)
    .is("revoked_at", null);

  query = tenantId
    ? query.eq("scope_type", "tenant").eq("tenant_id", tenantId)
    : query.eq("scope_type", "platform").is("tenant_id", null);

  const { data, error } = await query.limit(1).maybeSingle();
  return !error && Boolean(data);
}
