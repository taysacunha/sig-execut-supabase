import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "despesas:showValues";
const MASK = "R$ ******";

type DespesasValuesContextType = {
  showValues: boolean;
  toggleValues: () => void;
  setShowValues: (v: boolean) => void;
  /** Format a number as BRL currency, or return a mask when hidden. */
  formatValue: (n: number | string | null | undefined, options?: Intl.NumberFormatOptions) => string;
  /** Mask string when hidden, otherwise return provided formatted string. */
  maskIfHidden: (formatted: string) => string;
};

const DespesasValuesContext = createContext<DespesasValuesContextType | null>(null);

export function DespesasValuesProvider({ children }: { children: ReactNode }) {
  const [showValues, setShowValuesState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, showValues ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [showValues]);

  const toggleValues = useCallback(() => setShowValuesState((v) => !v), []);
  const setShowValues = useCallback((v: boolean) => setShowValuesState(v), []);

  const formatValue = useCallback(
    (n: number | string | null | undefined, options?: Intl.NumberFormatOptions) => {
      if (!showValues) return MASK;
      const num = Number(n ?? 0);
      return num.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        ...options,
      });
    },
    [showValues],
  );

  const maskIfHidden = useCallback(
    (formatted: string) => (showValues ? formatted : MASK),
    [showValues],
  );

  const value = useMemo<DespesasValuesContextType>(
    () => ({ showValues, toggleValues, setShowValues, formatValue, maskIfHidden }),
    [showValues, toggleValues, setShowValues, formatValue, maskIfHidden],
  );

  return <DespesasValuesContext.Provider value={value}>{children}</DespesasValuesContext.Provider>;
}

export function useDespesasValues() {
  const ctx = useContext(DespesasValuesContext);
  if (!ctx) {
    // Safe fallback so components can be rendered outside the provider (e.g., previews)
    return {
      showValues: true,
      toggleValues: () => {},
      setShowValues: () => {},
      formatValue: (n: number | string | null | undefined, options?: Intl.NumberFormatOptions) =>
        Number(n ?? 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 2,
          ...options,
        }),
      maskIfHidden: (formatted: string) => formatted,
    } satisfies DespesasValuesContextType;
  }
  return ctx;
}