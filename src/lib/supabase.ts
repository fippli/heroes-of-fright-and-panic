import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Extract a human-readable error message from a Supabase Edge Function error.
 * `supabase.functions.invoke` returns a generic message in `error.message`,
 * while the actual Edge Function response body is in `error.context`.
 */
export const getEdgeFunctionError = (error: {
  context?: unknown;
  message: string;
}): string => {
  const context = error.context;
  if (context != null && typeof context === "object" && "error" in context) {
    const errorValue = (context as { error: unknown }).error;
    if (typeof errorValue === "string") {
      return errorValue;
    }
  }
  return error.message;
};
