import { create } from 'zustand';

interface CortisolStore {
  /** Cortisol level 0-100. 0 = very calm (LOW), 100 = very stressed (HIGH). */
  level: number;
  /** Increase cortisol (wrong answer, stress). Clamped to 0-100. */
  increase: (amount: number) => void;
  /** Decrease cortisol (correct answer, relaxation). Clamped to 0-100. */
  decrease: (amount: number) => void;
  /** Set cortisol to an exact value. */
  set: (value: number) => void;
}

export const useCortisolStore = create<CortisolStore>((set) => ({
  level: 15, // default: low / relaxed

  increase: (amount) =>
    set((state) => ({
      level: Math.min(100, state.level + amount),
    })),

  decrease: (amount) =>
    set((state) => ({
      level: Math.max(0, state.level - amount),
    })),

  set: (value) =>
    set({ level: Math.max(0, Math.min(100, value)) }),
}));
