import React, { useEffect, useMemo, useState } from 'react';
import { X, Trophy, Medal, Award, Star } from 'lucide-react';
import { Badge, Group, HistoryRecord, Student } from '../types';
import { ALL_PETS, getPetById, calculateStageFromFood } from '../constants';
import { sortStudentsByMode } from '../lib/studentSort';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  groups: Group[];
  progress: Record<string, number>;
  petSelections: Record<string, string>;
  badges: Record<string, Badge[]>;
  targetCount: number;
  stageThresholds: number[];
  history: HistoryRecord[];
  theme: {
    colors: {
      leaderboardHeader: string;
    };
  };
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  students,
  groups,
  progress,
  petSelections,
  badges,
  targetCount,
  stageThresholds,
  history,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'group'>('student');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('student');
    }
  }, [isOpen]);

  // 按统一排行榜规则排序（与主页面“排行榜排序”保持一致）
  const rankedStudents = useMemo(() => {
    return sortStudentsByMode(students, 'leaderboard', { progress, badges, history })
      .map(student => ({
        id: student.id,
        name: student.name,
        progress: progress[student.id] || 0,
        badgeCount: (badges[student.id] || []).length,
        petId: getPetById(petSelections[student.id])?.id || ALL_PETS[0].id,
      }));
  }, [students, progress, badges, petSelections, history]);

  const rankedGroups = useMemo(() => {
    const stats = groups
      .map(group => {
        const members = students.filter(student => student.groupId === group.id);
        const totalScore = members.reduce((sum, student) => sum + (progress[student.id] || 0), 0);
        const averageScore = members.length > 0 ? totalScore / members.length : 0;

        return {
          ...group,
          memberCount: members.length,
          totalScore,
          averageScore,
        };
      })
      .filter(group => group.memberCount > 0)
      .sort((a, b) => {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.sortOrder - b.sortOrder;
      });

    return stats;
  }, [groups, students, progress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-content">

        {/* Header */}
        <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${theme.colors.leaderboardHeader}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">光荣榜</h2>
              <p className="text-white/80 text-sm">个人榜 + 小组榜</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="inline-flex p-1 rounded-full bg-slate-100 border border-slate-200">
            <button
              onClick={() => setActiveTab('student')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors min-h-[44px] ${activeTab === 'student'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              个人榜
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors min-h-[44px] ${activeTab === 'group'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              小组榜
            </button>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'student' && rankedStudents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Star size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">暂无数据</p>
            </div>
          )}

          {activeTab === 'student' && rankedStudents.length > 0 && (
            <div className="space-y-4">
              {rankedStudents.map((student, index) => {
                const pet = getPetById(student.petId) || ALL_PETS[0];
                const stage = calculateStageFromFood(student.progress, stageThresholds);

                // 前三名特殊设计 - 单行布局但更精美
                if (index < 3) {
                  const topThreeStyles = [
                    {
                      // 🥇 第一名 - 金色
                      container: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 shadow-lg shadow-yellow-200/50',
                      badge: 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md',
                      icon: Trophy,
                      iconColor: 'text-yellow-500',
                      statsColor: 'text-yellow-700',
                    },
                    {
                      // 🥈 第二名 - 银色
                      container: 'bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-slate-300 shadow-lg shadow-slate-200/50',
                      badge: 'bg-gradient-to-br from-slate-400 to-gray-500 text-white shadow-md',
                      icon: Medal,
                      iconColor: 'text-slate-400',
                      statsColor: 'text-slate-700',
                    },
                    {
                      // 🥉 第三名 - 铜色
                      container: 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 shadow-lg shadow-orange-200/50',
                      badge: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md',
                      icon: Award,
                      iconColor: 'text-orange-500',
                      statsColor: 'text-orange-700',
                    },
                  ];

                  const style = topThreeStyles[index];
                  const RankIcon = style.icon;

                  return (
                    <div
                      key={student.name}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all hover:shadow-xl ${style.container}`}
                    >
                      {/* Rank Badge */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${style.badge}`}>
                        <RankIcon className="w-6 h-6" strokeWidth={2.5} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-800 text-clamp-2 leading-tight">{student.name}</h3>
                        <p className="text-xs text-slate-500">{pet.name} · Lv.{stage}</p>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 sm:gap-6 text-sm">
                        {/* Progress */}
                        <div className="text-center">
                          <div className={`font-bold ${style.statsColor}`}>{student.progress}/{targetCount}</div>
                          <div className="text-xs text-slate-400">进度</div>
                        </div>

                        {/* Badges */}
                        <div className="text-center">
                          <div className={`font-bold ${style.statsColor} flex items-center gap-1`}>
                            <Award size={14} className={style.iconColor} />
                            {student.badgeCount}
                          </div>
                          <div className="text-xs text-slate-400">徽章</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 第4名及以后 - 简洁列表样式
                return (
                  <div
                    key={student.name}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 bg-white border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    {/* Rank Number */}
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      <span className="w-8 h-8 flex items-center justify-center text-base font-black text-slate-400 bg-slate-50 rounded-full">
                        {index + 1}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-800 text-clamp-2 leading-tight">{student.name}</h3>
                      <p className="text-xs text-slate-400">{pet.name} · Lv.{stage}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 sm:gap-6 text-sm">
                      {/* Progress */}
                      <div className="text-center">
                        <div className="font-bold text-indigo-600">{student.progress}/{targetCount}</div>
                        <div className="text-xs text-slate-400">进度</div>
                      </div>

                      {/* Badges */}
                      <div className="text-center">
                        <div className="font-bold text-amber-500 flex items-center gap-1">
                          <Award size={14} />
                          {student.badgeCount}
                        </div>
                        <div className="text-xs text-slate-400">徽章</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'group' && rankedGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Star size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">暂无小组数据</p>
            </div>
          )}

          {activeTab === 'group' && rankedGroups.length > 0 && (
            <div className="space-y-3">
              {rankedGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 bg-white shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center font-black">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-lg truncate">{group.name}</h3>
                    <p className="text-xs text-slate-500">{group.memberCount} 人</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">平均分</p>
                    <p className="text-lg font-black text-indigo-600">{group.averageScore.toFixed(1)}</p>
                  </div>
                  <div className="text-right min-w-[74px]">
                    <p className="text-sm text-slate-500">总分</p>
                    <p className="text-base font-bold text-slate-700">{group.totalScore}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-400">
            完成打卡任务，收集更多徽章吧
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
