import { createContext, useContext, useState, useCallback, FC, ReactNode } from "react";
import { Toast, ToastType } from "@/components/toast";

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType, duration = 3000): string => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, "success", duration),
    [addToast],
  );
  const error = useCallback(
    (message: string, duration?: number) => addToast(message, "error", duration),
    [addToast],
  );
  const info = useCallback(
    (message: string, duration?: number) => addToast(message, "info", duration),
    [addToast],
  );
  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, "warning", duration),
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
