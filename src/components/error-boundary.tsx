import React, { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { TMod } from "@/components/ui-modern";
import { reportError } from "@/lib/error-reporting";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { boundary: "game_error_boundary", componentStack: info.componentStack });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: TMod.bgPrimary,
            color: TMod.textPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "900", marginBottom: "16px" }}>
              Something went wrong
            </h1>
            <p style={{ color: TMod.textSecondary, marginBottom: "24px", lineHeight: "1.6" }}>
              {this.state.error?.message ||
                "An unexpected error occurred. Please refresh the page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: TMod.accentCyan,
                color: TMod.bgPrimary,
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for route components
export function WithErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
