import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Snark } from '@/shared/config/constants';
import { loadLS, saveLS } from '@/shared/lib/storage';

interface Vibes {
  motion: boolean;
  snark: Snark;
  setMotion: (v: boolean) => void;
  setSnark: (v: Snark) => void;
}

const VibesContext = createContext<Vibes | null>(null);

const LS_KEY = 'msg_vibes_v1';

interface StoredVibes {
  motion?: boolean;
  snark?: Snark;
}

/** Replaces the legacy component's `motion` and `snark` props. Copy rule:
    every user-facing string ships a savage AND a polite variant. */
export function VibesProvider({ children }: { children: ReactNode }) {
  const stored = loadLS<StoredVibes>(LS_KEY);
  const [motion, setMotionState] = useState(stored?.motion ?? true);
  const [snark, setSnarkState] = useState<Snark>(stored?.snark ?? 'savage');

  const value = useMemo<Vibes>(
    () => ({
      motion,
      snark,
      setMotion: (v) => {
        setMotionState(v);
        saveLS(LS_KEY, { motion: v, snark });
      },
      setSnark: (v) => {
        setSnarkState(v);
        saveLS(LS_KEY, { motion, snark: v });
      },
    }),
    [motion, snark],
  );

  return <VibesContext.Provider value={value}>{children}</VibesContext.Provider>;
}

export function useVibes(): Vibes {
  const ctx = useContext(VibesContext);
  if (!ctx) throw new Error('useVibes must be used inside VibesProvider');
  return ctx;
}

export function useSavage(): boolean {
  return useVibes().snark !== 'polite';
}
