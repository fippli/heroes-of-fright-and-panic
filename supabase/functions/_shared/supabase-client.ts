import { createClient } from "@supabase/supabase-js";

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
