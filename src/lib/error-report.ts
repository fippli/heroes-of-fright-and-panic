import { supabase } from "./supabase";

declare const __APP_VERSION__: string;

const MAX_REPORTS_PER_PAGE = 20;
let reported = 0;

export type ClientErrorReport = {
  readonly gameId?: string | null;
  readonly player?: string | null;
  readonly message: string;
  readonly stack?: string;
  readonly context?: unknown;
};

/** Store a browser-side error so it can be inspected with `pnpm debug:game errors`. Never throws. */
export const reportClientError = (report: ClientErrorReport): void => {
  if (reported >= MAX_REPORTS_PER_PAGE) return;
  reported += 1;
  console.error("[reported]", report.message, report.context ?? "");
  void supabase
    .from("client_errors")
    .insert({
      game_id: report.gameId ?? null,
      player: report.player ?? null,
      message: report.message.slice(0, 2000),
      stack: report.stack?.slice(0, 8000) ?? null,
      context: report.context ?? null,
      user_agent: navigator.userAgent,
      app_version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
    })
    .then(({ error }) => {
      if (error !== null) console.warn("Could not store error report:", error.message);
    });
};

/** Report uncaught errors and unhandled promise rejections while a game is open */
export const installErrorReporting = (scope: { readonly gameId: string; readonly player: string | null }): (() => void) => {
  const onError = (event: ErrorEvent) =>
    reportClientError({
      ...scope,
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: { source: "window.error", file: event.filename, line: event.lineno },
    });
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    reportClientError({
      ...scope,
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      context: { source: "unhandledrejection" },
    });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
};
