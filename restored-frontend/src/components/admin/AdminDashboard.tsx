import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserPlus, Ban, LayoutGrid, BookOpen, Loader2 } from 'lucide-react';
import { getDashboardStats, DashboardStats } from '../../services/admin';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bgColor }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center">
        <p>{error}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">仪表盘</h1>
        <p className="text-slate-500 mt-1">工作室内部账号与教学数据概览</p>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-700 mb-4">账号统计</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="总用户数"
            value={stats.totalUsers}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<UserCheck className="w-6 h-6" />}
            label="正常用户"
            value={stats.activeUsers}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
          <StatCard
            icon={<Ban className="w-6 h-6" />}
            label="已禁用用户"
            value={stats.disabledUsers}
            color="text-red-600"
            bgColor="bg-red-50"
          />
          <StatCard
            icon={<UserPlus className="w-6 h-6" />}
            label="今日新增"
            value={stats.todayNewUsers}
            color="text-pink-600"
            bgColor="bg-pink-50"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-700 mb-4">业务数据</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={<LayoutGrid className="w-6 h-6" />}
            label="班级总数"
            value={stats.totalClasses}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
          />
          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            label="学生总数"
            value={stats.totalStudents}
            color="text-amber-600"
            bgColor="bg-amber-50"
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-6 text-white">
        <h3 className="font-bold text-lg mb-2">管理提示</h3>
        <ul className="space-y-1 text-sm text-white/90">
          <li>• 用户重置密码后，新密码为：<span className="font-mono bg-white/20 px-2 py-0.5 rounded">123456</span></li>
          <li>• 禁用账号后，用户会立即失去登录权限</li>
          <li>• 删除用户会同时删除该用户的班级、学生和成长记录</li>
        </ul>
      </div>
    </div>
  );
};
