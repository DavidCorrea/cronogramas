"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

type UnsavedConfigContextValue = {
  dirty: boolean;
  setDirty: (value: boolean) => void;
};

const UnsavedConfigContext = createContext<UnsavedConfigContextValue | null>(
  null
);

export function UnsavedConfigProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return (
    <UnsavedConfigContext.Provider value={value}>
      {children}
    </UnsavedConfigContext.Provider>
  );
}

export function useUnsavedConfig() {
  const ctx = useContext(UnsavedConfigContext);
  if (!ctx) return { dirty: false, setDirty: () => {} };
  return ctx;
}
