import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

export type NotificationType = "success" | "warning" | "error" | "info";

export interface EventNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface NotificationContextType {
  notifications: EventNotification[];
  notify: (notification: Omit<EventNotification, "id">) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function EventNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<EventNotification[]>([]);

  const notify = useCallback((notification: Omit<EventNotification, "id">) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const duration = notification.duration ?? 4000;

    setNotifications((prev) => [...prev, { ...notification, id }]);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
      <NotificationStack />
    </NotificationContext.Provider>
  );
}

export function useEventNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useEventNotification must be used within EventNotificationProvider");
  }
  return context;
}

function NotificationStack() {
  const { notifications, dismiss } = useEventNotification();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: "calc(100vw - 32px)" }}
    >
      {notifications.map((notif) => (
        <NotificationCard key={notif.id} notification={notif} onDismiss={() => dismiss(notif.id)} />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: EventNotification;
  onDismiss: () => void;
}) {
  const bgColor = {
    success: "bg-emerald-900/90 border-emerald-700",
    warning: "bg-amber-900/90 border-amber-700",
    error: "bg-red-900/90 border-red-700",
    info: "bg-blue-900/90 border-blue-700",
  }[notification.type];

  const textColor = {
    success: "text-emerald-100",
    warning: "text-amber-100",
    error: "text-red-100",
    info: "text-blue-100",
  }[notification.type];

  const borderColor = {
    success: "border-l-emerald-400",
    warning: "border-l-amber-400",
    error: "border-l-red-400",
    info: "border-l-blue-400",
  }[notification.type];

  return (
    <div
      className={`
        ${bgColor} border border-l-4 ${borderColor} rounded-lg p-4
        max-w-sm pointer-events-auto shadow-lg
        animate-in slide-in-from-right-4 fade-in duration-300
      `}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className={`font-semibold ${textColor} text-sm`}>{notification.title}</h3>
          {notification.message && (
            <p className={`text-xs ${textColor} opacity-90 mt-1`}>{notification.message}</p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`${textColor} underline text-xs mt-2 hover:opacity-75 transition-opacity`}
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className={`${textColor} opacity-60 hover:opacity-100 transition-opacity flex-shrink-0`}
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
