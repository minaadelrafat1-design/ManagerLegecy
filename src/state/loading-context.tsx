import React, { createContext, useContext, useState, useCallback } from "react";

export type LoadingActionType =
  | "ADVANCE_DAY"
  | "HIRE_SCOUT"
  | "HIRE_STAFF"
  | "FIRE_STAFF"
  | "MARK_INBOX_READ"
  | "DELETE_INBOX"
  | "SET_TRAINING_PLAN"
  | "SET_TACTICS"
  | "ADD_TO_SHORTLIST"
  | "REMOVE_FROM_SHORTLIST"
  | "CREATE_NEGOTIATION"
  | "ACCEPT_CONTRACT"
  | "SAVE_GAME";

interface LoadingContextType {
  isLoading: (action: LoadingActionType) => boolean;
  setLoading: (action: LoadingActionType, loading: boolean) => void;
  startLoading: (action: LoadingActionType) => void;
  stopLoading: (action: LoadingActionType) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loadingStates, setLoadingStates] = useState<Record<LoadingActionType, boolean>>({
    ADVANCE_DAY: false,
    HIRE_SCOUT: false,
    HIRE_STAFF: false,
    FIRE_STAFF: false,
    MARK_INBOX_READ: false,
    DELETE_INBOX: false,
    SET_TRAINING_PLAN: false,
    SET_TACTICS: false,
    ADD_TO_SHORTLIST: false,
    REMOVE_FROM_SHORTLIST: false,
    CREATE_NEGOTIATION: false,
    ACCEPT_CONTRACT: false,
    SAVE_GAME: false,
  });

  const isLoading = useCallback(
    (action: LoadingActionType) => loadingStates[action] ?? false,
    [loadingStates],
  );

  const setLoading = useCallback((action: LoadingActionType, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [action]: loading }));
  }, []);

  const startLoading = useCallback(
    (action: LoadingActionType) => {
      setLoading(action, true);
    },
    [setLoading],
  );

  const stopLoading = useCallback(
    (action: LoadingActionType) => {
      setLoading(action, false);
    },
    [setLoading],
  );

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading, startLoading, stopLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
}
