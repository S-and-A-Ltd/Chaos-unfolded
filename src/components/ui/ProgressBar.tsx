'use client';

import { motion } from 'motion/react';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showValue?: boolean;
  color?: 'purple' | 'teal' | 'amber' | 'green' | 'red';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorGradients: Record<string, string> = {
  purple: 'from-[#7181c8] to-[#ababdc]',
  teal: 'from-[#76c8c0] to-[#a1e5df]',
  amber: 'from-[#e2b761] to-[#f9d48b]',
  green: 'from-[#76c8c0] to-[#a1e5df]',
  red: 'from-[#f98e8b] to-[#fcd89b]',
};

const sizeClasses: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export default function ProgressBar({
  value,
  label,
  showValue = false,
  color = 'purple',
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs font-medium text-[#5d5770]/80">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-semibold text-[#5d5770]/90">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`
          w-full ${sizeClasses[size]} rounded-full
          bg-[#ababdc]/20 overflow-hidden backdrop-blur-sm
        `}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`
            h-full rounded-full bg-gradient-to-r ${colorGradients[color]}
            shadow-sm
          `}
        />
      </div>
    </div>
  );
}
