'use client';

import { useEffect, useRef } from 'react';
import CharacterAvatar from './CharacterAvatar';
import CharacterDialogue from './CharacterDialogue';
import MoodMeter from '@/components/mood/MoodMeter';
import { useCharacterStore } from '@/stores/useCharacterStore';

/* Animated particle/star background for the panel */
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface Star {
      x: number;
      y: number;
      r: number;
      alpha: number;
      speed: number;
      da: number;
    }

    const stars: Star[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.3 + 0.1,
      da: (Math.random() - 0.5) * 0.02,
    }));

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        s.alpha += s.da;
        if (s.alpha > 1 || s.alpha < 0.1) s.da = -s.da;
        s.y -= s.speed;
        if (s.y < -5) {
          s.y = canvas.height + 5;
          s.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${s.alpha * 0.5})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

export default function CharacterPanel() {
  const { currentDialogue } = useCharacterStore();

  return (
    <div className="relative h-full flex flex-col items-center overflow-hidden rounded-2xl">
      {/* Starfield BG */}
      <StarField />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full h-full px-4 py-6 overflow-y-auto">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <CharacterAvatar />
        </div>

        {/* Dialogue */}
        <div className="w-full flex-shrink-0">
          {!currentDialogue ? (
            <div className="text-center text-xs text-[#5d5770]/60 italic font-semibold py-4">
              Start studying and Dazai will join you…
            </div>
          ) : (
            <CharacterDialogue />
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mood Meter */}
        <div className="flex-shrink-0 w-full">
          <MoodMeter />
        </div>
      </div>
    </div>
  );
}
