'use client';

import { useUserStore } from '@/stores/useUserStore';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';

// Helper to generate the last 7 days of dates
const getLast7Days = () => {
  const days = [];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      dateStr,
      label: weekdayNames[d.getDay()],
    });
  }
  return days;
};

export default function ProgressCharts() {
  const { dailyStats } = useUserStore();

  // Generate chart data by mapping last 7 days and combining with actual stats if available
  const dateList = getLast7Days();
  const data = dateList.map((day) => {
    const actual = dailyStats.find((s) => s.date === day.dateStr);
    
    return {
      name: day.label,
      hours: actual ? parseFloat((actual.studyMinutes / 60).toFixed(1)) : 0,
      focusScore: actual ? actual.focusScore : 0,
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Study Hours Bar Chart */}
      <Card padding="lg" hover={false} className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#5d5770]">Study Time</h3>
          <p className="text-xs text-[#5d5770]/60 mt-0.5">Hours studied per day</p>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,129,200,0.15)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(113,129,200,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(113,129,200,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(113,129,200,0.25)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#5d5770',
                }}
              />
              <Bar dataKey="hours" fill="#7181c8" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Focus Score Line Chart */}
      <Card padding="lg" hover={false} className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#5d5770]">Focus Performance</h3>
          <p className="text-xs text-[#5d5770]/60 mt-0.5">Average focus score (%)</p>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,129,200,0.15)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(113,129,200,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(113,129,200,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(113,129,200,0.25)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#5d5770',
                }}
              />
              <Line
                type="monotone"
                dataKey="focusScore"
                stroke="#76c8c0"
                strokeWidth={2}
                dot={{ stroke: '#76c8c0', strokeWidth: 2, r: 3, fill: '#ffffff' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
