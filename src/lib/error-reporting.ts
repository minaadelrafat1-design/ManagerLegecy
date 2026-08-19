type ErrorOptions = { mechanism?: string; severity?: "error" | "warning" | "info" };

declare global {
  interface Window {
    __appEvents?: {
      captureException?: (err: unknown, ctx?: Record<string, unknown>, opts?: ErrorOptions) => void;
    };
    __appReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.__appEvents?.captureException?.(
      error,
      { route: window.location.pathname, ...context },
      { mechanism: "react_error_boundary", severity: "error" },
    );
  } catch (e) {
    // swallow
  }

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  try {
    window.__appReportRuntimeError?.({
      message,
      ...(stack ? { stack } : {}),
      filename: window.location.pathname,
    });
  } catch (e) {
    // swallow
  }
  // Always log locally too

  console.error("Captured error:", error, context);
}
