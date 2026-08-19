import { FC, useEffect, useState } from "react";
import { TMod } from "./ui-modern";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps extends Toast {
  onRemove: (id: string) => void;
}

const ToastComponent: FC<ToastProps> = ({ id, message, type, duration = 3000, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(id), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, id, onRemove]);

  const typeStyles = {
    success: {
      bg: `${TMod.accentGreen}20`,
      border: `1px solid ${TMod.accentGreen}`,
      icon: "✓",
      color: TMod.accentGreen,
    },
    error: {
      bg: `${TMod.accentRed}20`,
      border: `1px solid ${TMod.accentRed}`,
      icon: "✕",
      color: TMod.accentRed,
    },
    info: {
      bg: `${TMod.accentBlue}20`,
      border: `1px solid ${TMod.accentBlue}`,
      icon: "ℹ",
      color: TMod.accentBlue,
    },
    warning: {
      bg: `${TMod.accentGold}20`,
      border: `1px solid ${TMod.accentGold}`,
      icon: "⚠",
      color: TMod.accentGold,
    },
  };

  const style = typeStyles[type];

  return (
    <div
      style={{
        background: style.bg,
        border: style.border,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(400px)" : "translateX(0)",
        transition: "all 0.3s ease",
        maxWidth: 400,
        animation: isExiting ? undefined : "slideIn 0.3s ease",
      }}
    >
      <span
        style={{
          fontSize: 18,
          color: style.color,
          fontWeight: "bold",
          minWidth: 24,
          textAlign: "center",
        }}
      >
        {style.icon}
      </span>
      <span style={{ color: TMod.textPrimary, fontSize: 13, fontWeight: 500, flex: 1 }}>
        {message}
      </span>
      <button
        aria-label="Dismiss notification"
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(id), 300);
        }}
        style={{
          background: "none",
          border: "none",
          color: style.color,
          fontSize: 18,
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: "auto" }}>
          <ToastComponent {...toast} onRemove={onRemove} />
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(400px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
