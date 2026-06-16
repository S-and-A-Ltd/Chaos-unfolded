'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserStore } from '@/stores/useUserStore';

export default function AchievementPopup() {
  const { recentAchievement, clearRecentAchievement } = useUserStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (recentAchievement) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        // Delay clearing from store slightly to let the exit animation finish
        setTimeout(clearRecentAchievement, 400);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [recentAchievement, clearRecentAchievement]);

  return (
    <AnimatePresence>
      {visible && recentAchievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <div className="relative glass-card-static glow-purple p-5 rounded-2xl flex items-center gap-4 border border-purple-500/30 bg-purple-950/20 overflow-hidden">
            {/* Confetti Particles (CSS based) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(12)].map((_, idx) => {
                const randomX = Math.random() * 100;
                const randomDelay = Math.random() * 2;
                const randomDuration = 1.5 + Math.random() * 1.5;
                const colors = ['#8b5cf6', '#2dd4bf', '#f59e0b', '#ec4899'];
                const randomColor = colors[idx % colors.length];

                return (
                  <span
                    key={idx}
                    className="absolute bottom-full w-1.5 h-1.5 rounded-full opacity-60 animate-[float-confetti_3s_infinite]"
                    style={{
                      left: `${randomX}%`,
                      backgroundColor: randomColor,
                      animationDelay: `${randomDelay}s`,
                      animationDuration: `${randomDuration}s`,
                    }}
                  />
                );
              })}
            </div>

            {/* Achievement Icon */}
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-3xl shadow-inner animate-[pulse-glow_2s_infinite]">
              {recentAchievement.icon}
            </div>

            {/* Achievement Details */}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                Achievement Unlocked!
              </span>
              <h4 className="text-sm font-bold text-white truncate mt-0.5">
                {recentAchievement.name}
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                {recentAchievement.description}
              </p>
            </div>

            {/* XP Badge */}
            <div className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-[10px] px-2 py-1 rounded-full shadow-lg">
              +200 XP
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
