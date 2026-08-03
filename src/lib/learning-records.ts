import "server-only";
import { redirect } from "next/navigation";
import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { hasExplicitPermission } from "@/lib/permissions/access";
export type LearningRecordScope = "institution" | "platform" | null;
export type LearningRecordAccess = { canManage: boolean; scope: LearningRecordScope; tenantId: string | null; role: UserRole; supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"]; user: Awaited<ReturnType<typeof requireActiveUser>>["user"] };
export async function getLearningRecordAccess(): Promise<LearningRecordAccess> { const { supabase, user, profile, tenant } = await requireActiveUser(); const role = isValidRole(profile?.role) ? profile.role : "student"; const tenantId = tenant?.id ?? null; if (!tenantId && role === "platform_super_admin") return { canManage: true, scope: "platform", tenantId, role, supabase, user }; if (!tenantId) return { canManage: false, scope: null, tenantId, role, supabase, user }; if (role === "tenant_super_admin" || role === "ceo") return { canManage: true, scope: "institution", tenantId, role, supabase, user }; if (role !== "admin") return { canManage: false, scope: null, tenantId, role, supabase, user }; const canManage = await hasExplicitPermission(supabase, user.id, "learning_records.manage", tenantId); return { canManage, scope: canManage ? "institution" : null, tenantId, role, supabase, user }; }
export async function requireLearningRecordOverviewAccess() { const access = await getLearningRecordAccess(); if (!access.canManage || !access.scope) redirect("/dashboard"); return access; }
export async function requireLearningRecordManager() { const access = await getLearningRecordAccess(); if (!access.canManage || access.scope !== "institution" || !access.tenantId) redirect("/dashboard"); return { ...access, scope: "institution" as const, tenantId: access.tenantId }; }
