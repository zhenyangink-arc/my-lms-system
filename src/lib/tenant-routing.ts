export const RESERVED_TENANT_SLUGS = [
  "platform",
  "dashboard",
  "login",
  "register",
  "api",
  "access-denied",
  "account-disabled",
  "dev-preview",
] as const;

const reservedTenantSlugs = new Set<string>(RESERVED_TENANT_SLUGS);

export function isReservedTenantSlug(value: string) {
  return reservedTenantSlugs.has(value.trim().toLowerCase());
}
