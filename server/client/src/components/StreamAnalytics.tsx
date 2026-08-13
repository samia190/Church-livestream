import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Eye, TrendingUp, Users, Clock, Zap, AlertCircle } from 'lucide-react';

interface AnalyticsData {
  timestamp: string;
  viewers: number;
  bitrate: number;
  fps: number;
  cpu: number;
  droppedFrames: number;
}

export default function StreamAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([
    { timestamp: '00:00', viewers: 0, bitrate: 0, fps: 0, cpu: 0, droppedFrames: 0 },
    { timestamp: '00:30', viewers: 45, bitrate: 4.2, fps: 60, cpu: 35, droppedFrames: 0 },
    { timestamp: '01:00', viewers: 120, bitrate: 4.8, fps: 60, cpu: 42, droppedFrames: 0 },
    { timestamp: '01:30', viewers: 280, bitrate: 5.2, fps: 60, cpu: 48, droppedFrames: 2 },
    { timestamp: '02:00', viewers: 450, bitrate: 5.5, fps: 60, cpu: 55, droppedFrames: 1 },
    { timestamp: '02:30', viewers: 680, bitrate: 5.8, fps: 60, cpu: 62, droppedFrames: 3 },
    { timestamp: '03:00', viewers: 920, bitrate: 6.0, fps: 60, cpu: 68, droppedFrames: 2 },
  ]);

  const [currentStats, setCurrentStats] = useState({
    viewers: 920,
    peakViewers: 920,
    avgViewers: 485,
    totalViews: 2850,
    bitrate: 6.0,
    fps: 60,
    cpu: 68,
    droppedFrames: 2,
    streamHealth: 'Excellent',
    uptime: '03:00:45',
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStats(prev => ({
        ...prev,
        viewers: Math.max(0, prev.viewers + Math.floor((Math.random() - 0.4) * 50)),
        bitrate: 5.8 + Math.random() * 0.4,
        fps: Math.random() > 0.95 ? 30 : 60,
        cpu: 60 + Math.random() * 15,
        droppedFrames: Math.random() > 0.9 ? prev.droppedFrames + 1 : prev.droppedFrames,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Excellent':
        return 'text-green-400';
      case 'Good':
        return 'text-blue-400';
      case 'Fair':
        return 'text-yellow-400';
      case 'Poor':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getHealthBg = (health: string) => {
    switch (health) {
      case 'Excellent':
        return 'bg-green-500/10 border-green-500/30';
      case 'Good':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'Fair':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'Poor':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-900/20 to-slate-900/20 rounded-lg p-4 border border-blue-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">{currentStats.viewers.toLocaleString()}</div>
          <p className="text-xs text-gray-400">Current Viewers</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-900/20 to-slate-900/20 rounded-lg p-4 border border-purple-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300">Peak</span>
          </div>
          <div className="text-2xl font-bold text-white">{currentStats.peakViewers.toLocaleString()}</div>
          <p className="text-xs text-gray-400">Peak Viewers</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-900/20 to-slate-900/20 rounded-lg p-4 border border-green-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-300">{currentStats.bitrate.toFixed(1)} Mbps</span>
          </div>
          <div className="text-2xl font-bold text-white">{currentStats.fps} FPS</div>
          <p className="text-xs text-gray-400">Stream Quality</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-900/20 to-slate-900/20 rounded-lg p-4 border border-orange-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-300">CPU</span>
          </div>
          <div className="text-2xl font-bold text-white">{currentStats.cpu.toFixed(0)}%</div>
          <p className="text-xs text-gray-400">System Usage</p>
        </motion.div>
      </div>

      {/* Stream Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg p-4 border ${getHealthBg(currentStats.streamHealth)}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-5 h-5 ${getHealthColor(currentStats.streamHealth)}`} />
            <div>
              <p className="font-semibold text-white">Stream Health</p>
              <p className="text-xs text-gray-400">Uptime: {currentStats.uptime}</p>
            </div>
          </div>
          <div className={`text-lg font-bold ${getHealthColor(currentStats.streamHealth)}`}>
            {currentStats.streamHealth}
          </div>
        </div>
      </motion.div>

      {/* Viewer Trend Chart */}
      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-900/20 border-purple-500/10 p-4">
        <h4 className="font-bold text-white mb-4">Viewer Trend</h4>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={analyticsData}>
            <defs>
              <linearGradient id="colorViewers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="timestamp" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Area
              type="monotone"
              dataKey="viewers"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorViewers)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-slate-900/40 to-slate-900/20 border-purple-500/10 p-4">
          <h4 className="font-bold text-white mb-4">Bitrate & FPS</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line
                type="monotone"
                dataKey="bitrate"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900/40 to-slate-900/20 border-purple-500/10 p-4">
          <h4 className="font-bold text-white mb-4">CPU & Dropped Frames</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-900/20 border-purple-500/10 p-4">
        <h4 className="font-bold text-white mb-4">Detailed Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-slate-800/50 rounded p-3">
            <p className="text-gray-400 mb-1">Total Views</p>
            <p className="text-xl font-bold text-white">{currentStats.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <p className="text-gray-400 mb-1">Avg Viewers</p>
            <p className="text-xl font-bold text-white">{currentStats.avgViewers.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <p className="text-gray-400 mb-1">Dropped Frames</p>
            <p className="text-xl font-bold text-white">{currentStats.droppedFrames}</p>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <p className="text-gray-400 mb-1">Uptime</p>
            <p className="text-xl font-bold text-white">{currentStats.uptime}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
