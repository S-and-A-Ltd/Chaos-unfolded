'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'purple' | 'teal' | 'amber' | 'none';
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  bgVariant?: 'blue' | 'pink' | 'lavender' | 'yellow' | 'mint' | 'white';
}

const glowClasses: Record<string, string> = {
  purple: 'glow-purple',
  teal: 'glow-teal',
  amber: 'glow-amber',
  none: '',
};

const paddingClasses: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
  none: 'p-0',
};

const bgClasses: Record<string, { hover: string; static: string }> = {
  blue: { hover: 'glass-card-blue', static: 'glass-card-blue-static' },
  pink: { hover: 'glass-card-pink', static: 'glass-card-pink-static' },
  lavender: { hover: 'glass-card-lavender', static: 'glass-card-lavender-static' },
  yellow: { hover: 'glass-card-yellow', static: 'glass-card-yellow-static' },
  mint: { hover: 'glass-card-mint', static: 'glass-card-mint-static' },
  white: { hover: 'glass-card', static: 'glass-card-static' },
};

export default function Card({
  children,
  className = '',
  glowColor = 'none',
  hover = true,
  padding = 'md',
  bgVariant = 'white',
}: CardProps) {
  const cardClass = bgClasses[bgVariant][hover ? 'hover' : 'static'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        ${cardClass}
        ${glowClasses[glowColor]}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
