// src/components/pages/Admin/LoginAnalyticsChart.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import { ref, onValue } from 'firebase/database';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const LoginAnalyticsChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const todayStr = new Date().toISOString().split('T')[0];

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push(dateStr);
    }
    return days;
  };

  useEffect(() => {
    try {
      const usersRef = ref(db, 'userDailyLogins');
      const unsubscribe = onValue(
        usersRef,
        (snapshot) => {
          try {
            const rawData = snapshot.val() || {};
            const last7 = getLast7Days();

            const chartData = last7.map((date) => {
              let count = 0;
              for (const uid in rawData) {
                if (rawData[uid] && rawData[uid][date] === true) {
                  count++;
                }
              }
              return {
                date,
                label: formatDateLabel(date),
                count,
                isToday: date === todayStr,
              };
            });

            setData(chartData);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('Error processing chart data:', err);
            setError('Failed to process chart data');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Firebase listener error:', err);
          if (err.code === 'PERMISSION_DENIED') {
            setError('Permission denied. Make sure your Firebase rules allow admin read access to userDailyLogins.');
          } else {
            setError('Failed to load chart data: ' + err.message);
          }
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Chart initialization error:', err);
      setError('Failed to initialize chart');
      setLoading(false);
      return () => {};
    }
  }, []);

  if (error) {
    return (
      <div className="login-chart-wrapper" style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#EF4444' }}>⚠️ {error}</p>
        <p style={{ color: '#888', fontSize: '14px' }}>Please check the console for details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="login-chart-wrapper">
        <div className="chart-loading-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      </div>
    );
  }

  const hasData = data.some(d => d.count > 0);
  if (!hasData) {
    return (
      <div className="login-chart-wrapper" style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#888' }}>📊 No login data available yet.</p>
        <p style={{ color: '#666', fontSize: '13px' }}>Data will appear here as users log in.</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">{payload[0].value} logins</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="login-chart-wrapper">
      <div className="chart-header">
        <h3>📈 Daily Active Users (7 Days)</h3>
        <span className="today-badge">Live</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C3CE1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6C3CE1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, Math.ceil(maxCount * 1.1)]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6C3CE1"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorCount)"
              activeDot={{ r: 6, fill: '#6C3CE1' }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <style>{`
        .chart-loading-skeleton {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px 0;
        }
        .skeleton-line {
          height: 16px;
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        .skeleton-line:first-child { height: 120px; }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .login-chart-wrapper {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 24px;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .chart-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #eee;
        }
        .today-badge {
          font-size: 11px;
          font-weight: 600;
          background: #10B981;
          color: #fff;
          padding: 2px 10px;
          border-radius: 12px;
          letter-spacing: 0.5px;
        }
        .chart-tooltip {
          background: #1a1a24;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .tooltip-label {
          color: #aaa;
          font-size: 12px;
          margin: 0;
        }
        .tooltip-value {
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default LoginAnalyticsChart;