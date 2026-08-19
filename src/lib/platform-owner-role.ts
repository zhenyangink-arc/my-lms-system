export function isPlatformOwnerRole(role: string | null | undefined) {
  return role === "platform_super_admin";
}
