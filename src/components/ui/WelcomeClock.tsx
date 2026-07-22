'use client';

import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';

interface WeatherData {
  temp: number;
  description: string;
  emoji: string;
  boxColor: string;
  textColor: string;
  iconBg: string;
}

const getWeatherVisuals = (code: number, isDay: number): { emoji: string, description: string, boxColor: string, textColor: string, iconBg: string } => {
  // Sunny / Clear Sky (1000)
  if (code === 1000) {
    if (isDay === 1) return { emoji: '☀️', description: 'Sunny', boxColor: 'bg-[#FDB201]', textColor: 'text-[#5d5770]', iconBg: 'bg-white/40' };
    return { emoji: '✨', description: 'Clear Sky', boxColor: 'bg-[#AADCF2]', textColor: 'text-[#5d5770]', iconBg: 'bg-white/40' };
  }
  
  // Cloudy (1003, 1006, 1009, 1030, 1135, 1147)
  const cloudyCodes = [1003, 1006, 1009, 1030, 1135, 1147];
  if (cloudyCodes.includes(code)) {
    return { emoji: '☁️', description: 'Cloudy', boxColor: 'bg-[#9197AA]', textColor: 'text-white', iconBg: 'bg-white/20' };
  }
  
  // Snowy (1066, 1069, 1114, 1117, 1210 to 1237, 1249 to 1264)
  const snowyCodes = [1066, 1069, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264, 1279, 1282];
  if (snowyCodes.includes(code)) {
    return { emoji: '❄️', description: 'Snowy', boxColor: 'bg-[#FDFFF4]', textColor: 'text-[#5d5770]', iconBg: 'bg-[#7c6a75]/10' };
  }
  
  // Thunderstorm / Stormy
  const stormyCodes = [1087, 1273, 1276, 1279, 1282];
  if (stormyCodes.includes(code)) {
    return { emoji: '🌩️', description: 'Stormy', boxColor: 'bg-[#2E3E6D]', textColor: 'text-white', iconBg: 'bg-white/10' };
  }

  // Default to Rainy for all other precipitation
  return { emoji: '🌧️', description: 'Rainy', boxColor: 'bg-[#2E3E6D]', textColor: 'text-white', iconBg: 'bg-white/10' };
};

export default function WelcomeClock() {
  const { displayName, level, currentXP, xpToNextLevel, currentStreak, totalStudyHours } = useUserStore();
  const { focus } = useSessionStore();
  const [time, setTime] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.weatherapi.com/v1/current.json?key=99017624499747b997a10357262104&q=auto:ip');
        const data = await res.json();
        if (data.current) {
          const visual = getWeatherVisuals(data.current.condition.code, data.current.is_day);
          setWeather({
            temp: Math.round(data.current.temp_c),
            ...visual
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, []);

  if (!time) {
    return (
      <div className="w-full bg-white/30 border-3 border-[#7c6a75] rounded-2xl p-4 flex flex-col gap-4 animate-pulse min-h-[120px]">
        <div className="h-4 bg-slate-300 rounded w-2/3" />
        <div className="h-10 bg-slate-300 rounded" />
      </div>
    );
  }

  // Formatting hours, minutes, am/pm
  let hours = time.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  const minutesStr = String(time.getMinutes()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');

  // Sliders XP progress
  const xpProgress = xpToNextLevel > 0 ? Math.min(100, (currentXP / xpToNextLevel) * 100) : 0;
  // Focus score progress
  const focusProgress = focus.focusScore;
  // Streak progress (clamped up to 30 days)
  const streakProgress = Math.min(100, (currentStreak / 30) * 100);
  // Total hours progress (clamped up to 100 hours)
  const hoursProgress = Math.min(100, (totalStudyHours / 100) * 100);

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Clock card widget - Cozy Blue */}
      <div className="w-full glass-card-blue-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col gap-6">
        {/* Title */}
        <div className="text-center text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3 font-fredoka">
          ★ welcome {displayName || 'student'} ★
        </div>

        {/* Large digital blocks */}
        <div className="flex gap-4 justify-center items-center py-2 font-fredoka">
          {/* Hours block */}
          <div className="bg-[#b7d3f4] border-3 border-[#7c6a75] rounded-2xl px-8 py-5 flex flex-col items-center relative shadow-[0_4px_0_#7c6a75]">
            <span className="text-6xl font-black text-[#5d5770]">{hoursStr}</span>
            <span className="text-xs font-black text-[#5d5770]/60 absolute bottom-1.5 right-2.5">{ampm}</span>
          </div>

          <span className="text-5xl font-black text-[#7c6a75] animate-pulse select-none">:</span>

          {/* Minutes block */}
          <div className="bg-[#f1cfed] border-3 border-[#7c6a75] rounded-2xl px-8 py-5 flex flex-col items-center shadow-[0_4px_0_#7c6a75]">
            <span className="text-6xl font-black text-[#5d5770]">{minutesStr}</span>
          </div>
        </div>

        {/* Quote placeholder */}
        <div className="text-sm text-[#5d5770]/90 font-bold text-center italic leading-relaxed bg-white/50 border-2 border-[#7c6a75]/15 rounded-xl p-4 mt-1">
          &ldquo;Tell the computer what you want, not what to do.&rdquo;
        </div>
      </div>

      {/* System info slider widget - Cozy Pink */}
      <div className="w-full glass-card-pink-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col gap-6 font-fredoka">
        <div className="text-center text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3">
          Weather
        </div>

        {/* Weather Widget */}
        <div className={`${weather ? weather.boxColor : 'bg-white/60'} border-2 border-[#7c6a75]/15 rounded-2xl p-5 flex items-center justify-between shadow-sm mt-2 hover:shadow-md transition-all duration-300`}>
          {weatherLoading ? (
            <span className="text-[#5d5770] text-sm animate-pulse font-bold tracking-wide w-full text-center py-4">Checking skies... 🌤️</span>
          ) : weather ? (
            <div className="flex items-center gap-5 w-full">
              <div className={`w-16 h-16 rounded-2xl ${weather.iconBg} border-3 border-[#7c6a75]/15 flex items-center justify-center text-3xl shadow-inner shrink-0 transform transition-transform hover:rotate-6 hover:scale-105 duration-300`}>
                {weather.emoji}
              </div>
              <div className="flex flex-col flex-1 justify-center">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black ${weather.textColor} tracking-tighter`}>{weather.temp}°</span>
                  <span className={`text-sm font-bold ${weather.textColor} opacity-60 uppercase`}>C</span>
                </div>
                <span className={`text-sm font-bold ${weather.textColor} opacity-80 tracking-wide uppercase leading-tight mt-0.5`}>{weather.description}</span>
              </div>
            </div>
          ) : (
            <span className="text-[#5d5770]/60 text-sm italic font-bold w-full text-center py-4">Weather unavailable ☁️</span>
          )}
        </div>
      </div>
    </div>
  );
}