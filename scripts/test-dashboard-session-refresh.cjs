const crypto = require("node:crypto");
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const appUrl = process.env.SESSION_REFRESH_TEST_APP_URL || "http://127.0.0.1:3110";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const testEmail = `codex-session-refresh-${Date.now()}@example.invalid`;
const testPassword = `T!${crypto.randomBytes(24).toString("base64url")}a9`;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let testUserId = null;

function encodeSession(session) {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

function decodeSession(value) {
  if (!value?.startsWith("base64-")) throw new Error("Unexpected auth cookie encoding");
  return JSON.parse(Buffer.from(value.slice(7), "base64url").toString("utf8"));
}

function setChunkedCookie(jar, name, value) {
  for (const key of [...jar.keys()]) {
    if (key === name || key.startsWith(`${name}.`)) jar.delete(key);
  }
  const encoded = encodeURIComponent(value);
  if (encoded.length <= 3180) {
    jar.set(name, value);
    return;
  }
  let offset = 0;
  let index = 0;
  while (offset < value.length) {
    let end = Math.min(value.length, offset + 3180);
    while (encodeURIComponent(value.slice(offset, end)).length > 3180) end--;
    jar.set(`${name}.${index++}`, value.slice(offset, end));
    offset = end;
  }
}

function getChunkedCookie(jar, name) {
  if (jar.has(name)) return jar.get(name);
  const chunks = [];
  for (let i = 0; jar.has(`${name}.${i}`); i++) chunks.push(jar.get(`${name}.${i}`));
  return chunks.length ? chunks.join("") : null;
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=\s*[^;,]+=)/) : [];
}

function applySetCookies(jar, headers) {
  for (const line of getSetCookies(headers)) {
    const pair = line.split(";", 1)[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (/Max-Age=0/i.test(line) || value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function requestWithJar(url, jar) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { cookie: cookieHeader(jar) },
  });
  applySetCookies(jar, response.headers);
  return response;
}

async function run() {
  const created = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Session Refresh Test" },
  });
  if (created.error || !created.data.user) throw created.error || new Error("Test user was not created");
  testUserId = created.data.user.id;

  const profileUpdate = await admin
    .from("profiles")
    .update({ role: "admin", global_role: "platform_admin", status: "active" })
    .eq("id", testUserId);
  if (profileUpdate.error) throw profileUpdate.error;

  const signedIn = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error || new Error("Test sign-in failed");

  const originalSession = signedIn.data.session;
  const expiredMetadataSession = { ...originalSession, expires_at: Math.floor(Date.now() / 1000) - 60 };
  const jar = new Map();
  setChunkedCookie(jar, cookieName, encodeSession(expiredMetadataSession));

  const first = await requestWithJar(`${appUrl}/platform/dashboard`, jar);
  const refreshedCookie = getChunkedCookie(jar, cookieName);
  const refreshedSession = decodeSession(refreshedCookie);
  const accessTokenChanged = refreshedSession.access_token !== originalSession.access_token;
  const expiryRestored = refreshedSession.expires_at > Math.floor(Date.now() / 1000);
  const refreshCookieWritten = getSetCookies(first.headers).some((line) => line.startsWith(cookieName));

  let currentUrl = new URL(
    first.headers.get("location") || "/platform/dashboard",
    appUrl
  ).toString();
  let finalResponse = first;
  for (let i = 0; i < 5 && finalResponse.status >= 300 && finalResponse.status < 400; i++) {
    finalResponse = await requestWithJar(currentUrl, jar);
    const location = finalResponse.headers.get("location");
    if (location) currentUrl = new URL(location, currentUrl).toString();
  }

  const remainedAuthenticated = !currentUrl.endsWith("/login") && finalResponse.status === 200;
  const reachedPlatformDashboard = new URL(currentUrl).pathname.startsWith("/platform/dashboard");

  console.log(JSON.stringify({
    middlewareResponseStatus: first.status,
    middlewareRedirectLocation: first.headers.get("location"),
    refreshCookieWritten,
    accessTokenChanged,
    expiryRestored,
    finalStatus: finalResponse.status,
    finalPath: new URL(currentUrl).pathname,
    remainedAuthenticated,
    reachedPlatformDashboard,
  }, null, 2));

  if (!refreshCookieWritten || !accessTokenChanged || !expiryRestored || !remainedAuthenticated || !reachedPlatformDashboard) {
    throw new Error("Session refresh integration test failed");
  }
}

(async () => {
  try {
    await run();
  } finally {
    if (testUserId) {
      const deleted = await admin.auth.admin.deleteUser(testUserId);
      if (deleted.error) throw new Error(`Test user cleanup failed: ${deleted.error.message}`);
      console.log("cleanup: temporary auth user deleted");
    }
  }
})().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
  );
  process.exitCode = 1;
});
