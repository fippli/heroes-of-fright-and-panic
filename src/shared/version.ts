/**
 * Engine version reported by edge functions. This placeholder is overwritten
 * in the deployed copy (supabase/functions/shared/version.ts) by
 * `pnpm copy:shared`, which stamps the current git SHA and time so a running
 * function can say which commit it was deployed from.
 */
export const engineVersion = "dev";
