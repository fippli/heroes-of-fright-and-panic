import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Extract a human-readable error message from a Supabase Edge Function error.
 * In supabase-js v2, `FunctionsHttpError.context` is the raw `Response` object
 * whose body contains the JSON error payload from the Edge Function.
 */
export const getEdgeFunctionError = async (error: {
  context?: unknown;
  message: string;
}): Promise<string> => {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body: unknown = await context.json();
      if (
        body != null &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
      ) {
        return (body as { error: string }).error;
      }
    } catch {
      // Response body could not be parsed — fall through to default message
    }
  }
  return error.message;
};
