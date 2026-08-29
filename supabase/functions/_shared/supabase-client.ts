import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";

// One JWKS fetch per isolate; jose caches and refreshes the key set itself.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getJwks = (supabaseUrl: string) => {
  if (jwks === null) {
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
};

/**
 * Verify the access token's signature against the project's public keys and
 * read the user from its claims. No network round-trip to the Auth API.
 * Returns null when the token can't be verified this way (e.g. legacy
 * HS256-signed tokens), so callers can fall back to auth.getUser.
 */
const userFromVerifiedToken = async (
  token: string,
  supabaseUrl: string,
): Promise<{ email: string; id: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl));
    if (
      payload.role === "authenticated" &&
      typeof payload.sub === "string" &&
      typeof payload.email === "string"
    ) {
      return { email: payload.email, id: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
};

export const createAdminClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined) {
    throw new Error("SUPABASE_URL is not set");
  }
  if (serviceRoleKey === undefined) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const getUserFromRequest = async (
  request: Request,
): Promise<{ email: string; id: string } | null> => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader === null) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || anonKey === undefined) {
    return null;
  }

  // Fast path: local signature check, no call to the Auth API.
  const verified = await userFromVerifiedToken(token, supabaseUrl);
  if (verified !== null) {
    return verified;
  }

  // Slow path for tokens the local check can't handle.

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error !== null || user === null || user.email === undefined) {
    return null;
  }

  return { email: user.email, id: user.id };
};
