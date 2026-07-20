import "server-only";
import { redirect } from "next/navigation";
import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
export type LibraryAccess={canManage:boolean;canAssignAdmins:boolean;role:UserRole;supabase:Awaited<ReturnType<typeof requireActiveUser>>["supabase"];user:Awaited<ReturnType<typeof requireActiveUser>>["user"]};
export async function getLibraryAccess():Promise<LibraryAccess>{const{supabase,user,profile}=await requireActiveUser();const role=isValidRole(profile?.role)?profile.role:"student";if(role==="tenant_super_admin"||role==="platform_super_admin"||role==="ceo")return{canManage:true,canAssignAdmins:role==="tenant_super_admin"||role==="platform_super_admin",role,supabase,user};if(role!=="admin")return{canManage:false,canAssignAdmins:false,role,supabase,user};const{data,error}=await supabase.from("library_admin_assignments").select("admin_id").eq("admin_id",user.id).is("revoked_at",null).maybeSingle();return{canManage:!error&&Boolean(data),canAssignAdmins:false,role,supabase,user};}
export async function requireLibraryManager(){const access=await getLibraryAccess();if(!access.canManage)redirect("/dashboard");return access;}
