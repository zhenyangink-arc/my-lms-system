const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const INTERNAL_LOGIN_DOMAIN = "accounts.puffy.invalid";

export function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidLoginId(value: string) {
  return LOGIN_ID_PATTERN.test(normalizeLoginId(value));
}

export function loginIdToInternalEmail(loginId: string) {
  const normalized = normalizeLoginId(loginId);
  if (!isValidLoginId(normalized)) {
    throw new Error("账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。");
  }

  return `${normalized}@${INTERNAL_LOGIN_DOMAIN}`;
}
