import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Award, Settings2, Drumstick, Check, Users } from 'lucide-react';
import { PetImage } from './WhiteCatPet';
import { MysteriousEgg } from './MysteriousEgg';
import { Badge } from '../types';
import { ALL_PETS, getPetById } from '../constants';

interface Theme {
  id: string;
  name: string;
  colors: {
    accent: string;
    light: string;
    text: string;
    border: string;
    shadow: string;
  };
}

interface StudentCardProps {
  name: string;
  studentId: string; // 学生ID，用于徽章定位
  currentCount: number; // 当前宠物阶段进度（= 累计食物 − 已毕业次数 × 毕业阈值）
  availablePoints: number; // 当前可用积分（= 累计食物 − 已消费食物）
  targetCount: number;  // 毕业所需总食物
  badges: Badge[];
  selectedPetId?: string; // 可能为undefined (蛋状态)
  petStage: number;
  stageThresholds: number[]; // 10个阶段的食物阈值
  onIncrement: (studentId: string) => void;
  onGraduate: (studentId: string) => void;
  onOpenSelection: (studentId: string) => void;
  onOpenBadgeWall: (studentId: string) => void;
  theme: Theme;
  isRevokeMode: boolean;
  isCollectingBadge?: boolean; // 是否正在收集徽章（触发闪烁动画）
  isBatchMode?: boolean; // 是否处于批量选择模式
  isSelected?: boolean; // 是否被选中（批量模式下）
  onToggleSelect?: (studentId: string) => void; // 切换选中状态（批量模式下）
  petNickname?: string | null;
  onOpenPetRename?: (studentId: string) => void;
  groupName?: string | null;
  onOpenGroupAssign?: (studentId: string) => void;
  performanceMode?: 'full' | 'lite';
  allowTransientEffects?: boolean;
}

// 食物表情列表
const FOOD_EMOJIS = ['🍎', '🍖', '🍕', '🍩', '🍪', '🧀', '🥕', '🍗', '🌮', '🍰'];
// 爱心粒子
const HEART_EMOJIS = ['💖', '💕', '✨', '⭐', '💫', '🌟', '💗', '💝'];

const StudentCardComponent: React.FC<StudentCardProps> = ({
  name,
  studentId,
  currentCount,
  availablePoints,
  targetCount,
  badges,
  selectedPetId,
  petStage,
  stageThresholds,
  onIncrement,
  onGraduate,
  onOpenSelection,
  onOpenBadgeWall,
  theme,
  isRevokeMode,
  isCollectingBadge = false,
  isBatchMode = false,
  isSelected = false,
  onToggleSelect,
  petNickname,
  onOpenPetRename,
  groupName,
  onOpenGroupAssign,
  performanceMode = 'full',
  allowTransientEffects = true,
}) => {
  const isLiteMode = performanceMode === 'lite';
  const [isHovered, setIsHovered] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [particles, setParticles] = useState<string[]>([]);
  const [foodEmoji, setFoodEmoji] = useState('🍎');
  const [isLevelUp, setIsLevelUp] = useState(false);
  const [badgeGlow, setBadgeGlow] = useState(false); // 徽章闪烁效果
  const [badgeBounce, setBadgeBounce] = useState(false); // 徽章数字跳动效果
  const prevStageRef = useRef(petStage);
  const prevCountRef = useRef(currentCount);
  const prevBadgeCountRef = useRef(badges.length);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  const isEgg = !selectedPetId;
  const canRunTransientEffects = allowTransientEffects && isInViewport;

  const queueTimeout = (fn: () => void, delayMs: number) => {
    const timerId = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter(id => id !== timerId);
      fn();
    }, delayMs);
    timeoutsRef.current.push(timerId);
    return timerId;
  };

  useEffect(() => {
    return () => {
      for (const timerId of timeoutsRef.current) {
        window.clearTimeout(timerId);
      }
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const element = cardRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInViewport(!!entry?.isIntersecting);
      },
      {
        root: null,
        rootMargin: '180px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 监听等级变化，触发升级特效
  useEffect(() => {
    if (canRunTransientEffects && petStage > prevStageRef.current && !isEgg) {
      setIsLevelUp(true);
      queueTimeout(() => setIsLevelUp(false), isLiteMode ? 1200 : 2000);
    }
    prevStageRef.current = petStage;
  }, [petStage, isEgg, canRunTransientEffects, isLiteMode]);

  // 监听食物数量变化，触发喂食特效
  useEffect(() => {
    if (canRunTransientEffects && currentCount > prevCountRef.current && !isRevokeMode && !isEgg) {
      // 食物增加了，触发喂食效果
      // 随机选择食物
      setFoodEmoji(FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]);
      // 触发食物飞入动画
      setIsFeeding(true);
      // 触发经验值飘出
      queueTimeout(() => setShowExp(true), isLiteMode ? 150 : 300);
      // 触发爱心粒子（Lite 模式减少粒子数量）
      queueTimeout(() => {
        const particleCount = isLiteMode ? 2 : 6;
        const randomParticles = Array.from({ length: particleCount }, () =>
          HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)]
        );
        setParticles(randomParticles);
      }, isLiteMode ? 120 : 200);
      // 清除动画状态
      queueTimeout(() => {
        setIsFeeding(false);
        setShowExp(false);
        setParticles([]);
      }, isLiteMode ? 700 : 1000);
    }
    prevCountRef.current = currentCount;
  }, [currentCount, isRevokeMode, isEgg, canRunTransientEffects, isLiteMode]);

  // 监听徽章数量变化，触发闪烁和跳动效果
  useEffect(() => {
    if (canRunTransientEffects && badges.length > prevBadgeCountRef.current) {
      // 徽章增加了，触发闪烁和跳动效果
      if (!isLiteMode) {
        setBadgeGlow(true);
      }
      setBadgeBounce(true);
      // 清除动画状态
      queueTimeout(() => {
        setBadgeGlow(false);
        setBadgeBounce(false);
      }, isLiteMode ? 900 : 1500);
    }
    prevBadgeCountRef.current = badges.length;
  }, [badges.length, canRunTransientEffects, isLiteMode]);

  const isComplete = petStage >= 10 && currentCount >= stageThresholds[9];
  const progress = Math.min(100, (currentCount / targetCount) * 100);

  // 计算下一阶段需要的食物
  const nextStageFood = petStage < 10 ? stageThresholds[petStage] : stageThresholds[9];
  const currentStageFood = petStage > 1 ? stageThresholds[petStage - 1] : 0;
  const stageProgress = petStage < 10
    ? Math.min(100, ((currentCount - currentStageFood) / (nextStageFood - currentStageFood)) * 100)
    : 100;

  const pet = selectedPetId ? (getPetById(selectedPetId) || ALL_PETS[0]) : null;
  const petIdForImage = pet?.id || selectedPetId;
  const petDisplayName = isEgg ? '神秘蛋' : (petNickname?.trim() || pet?.name || '宠物');

  const triggerRevokeEffect = () => {
    setIsRevoking(true);
    setTimeout(() => setIsRevoking(false), 600);
  };

  const handleClick = () => {
    // 批量模式下，点击切换选中状态
    if (isBatchMode) {
      onToggleSelect?.(studentId);
      return;
    }

    if (isRevokeMode) {
      triggerRevokeEffect();
      onIncrement(studentId); // 实际上是触发撤回
      return;
    }

    if (isEgg) {
      onOpenSelection(studentId);
      return;
    }

    if (isComplete) {
      onGraduate(studentId);
    } else {
      // 喂食特效由 useEffect 监听 currentCount 变化自动触发
      onIncrement(studentId);
    }
  };

  return (
    <div
      ref={cardRef}
      data-student-id={studentId}
      role="button"
      tabIndex={0}
      aria-label={`${name} - ${petDisplayName} - ${petStage}级 - ${currentCount}个食物`}
      className={`
        student-card relative group cursor-pointer transform
        ${isLiteMode ? '' : 'transition-all duration-300'}
        ${isHovered && !isLiteMode ? 'scale-105 -translate-y-1' : ''}
        ${isRevokeMode ? 'ring-2 ring-rose-400 ring-offset-2' : ''}
        ${isBatchMode && isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${isBatchMode && !isSelected ? 'opacity-70 hover:opacity-100' : ''}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400
      `}
      onMouseEnter={isLiteMode ? undefined : () => setIsHovered(true)}
      onMouseLeave={isLiteMode ? undefined : () => setIsHovered(false)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Batch Mode Checkbox */}
      {isBatchMode && (
        <div
          className={`
            absolute top-2 left-2 z-30 w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-200 touch-target
            ${isSelected
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
              : 'bg-white/90 border-2 border-slate-300'
            }
          `}
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`选择 ${name}`}
        >
          {isSelected && <Check size={16} strokeWidth={3} />}
        </div>
      )}

      {/* Card Container */}
      <div className={`
        relative rounded-3xl overflow-hidden
        ${theme.colors.light} ${theme.colors.border} border-2
        shadow-lg ${theme.colors.shadow}
        ${isLiteMode ? '' : 'transition-all duration-300'}
        ${isHovered && !isLiteMode ? 'shadow-xl' : ''}
        ${isFeeding ? 'card-feeding-glow' : ''}
        ${isRevoking ? 'animate-shake' : ''}
      `}>
        {/* Level Up Overlay */}
        {isLevelUp && (
          <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl animate-in fade-in duration-300 ${isLiteMode ? 'bg-black/30' : 'bg-black/40 backdrop-blur-sm'}`}>
            <div className="relative">
              {!isLiteMode && (
                <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-50 animate-pulse scale-150" />
              )}
              <div className={`relative z-10 text-center ${isLiteMode ? '' : 'animate-bounce'}`}>
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 drop-shadow-md pb-1">
                  升级啦！
                </div>
                <div className="text-white font-bold text-lg mt-1 text-shadow-sm">
                  晋升 {petStage} 级
                </div>
              </div>
            </div>
            {!isLiteMode && (
              <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-2xl animate-spin-slow opacity-0"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animation: `float-up 1.5s ease-out ${Math.random() * 0.5}s forwards`,
                    }}
                  >
                    {['✨', '⭐', '🌟'][Math.floor(Math.random() * 3)]}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Revoke Effect Overlay */}
        {isRevoking && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-rose-500/20 backdrop-blur-[1px] rounded-3xl">
            <div className="text-4xl animate-ping">⏪</div>
          </div>
        )}

        {/* Pet Selection Button - 仅在进度为0且非蛋状态时显示（严师模式：落子无悔） */}
        {currentCount === 0 && !isEgg && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSelection(studentId);
            }}
            className={`absolute top-1 right-1 z-20 p-2.5 bg-white/80 ${isLiteMode ? '' : 'backdrop-blur-sm'} rounded-full
                       transition-all duration-200
                       hover:bg-white hover:scale-110 shadow-sm touch-target
                       active:scale-95`}
            title="更换守护神兽（已有进度不可更换）"
            aria-label="更换宠物"
          >
            <Settings2 size={16} className="text-slate-500" />
          </button>
        )}

        {/* Pet Image Area */}
        <div className="relative pt-6 pb-2 px-4 flex items-center justify-center min-h-[120px]">
          {/* Background glow */}
          <div className={`
            absolute inset-0 opacity-30
            bg-gradient-to-b from-transparent via-white/50 to-white
          `} />

          {/* Level Badge - 蛋状态不显示 */}
          {!isEgg && (
            <div className={`
              absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full
              bg-white/80 ${isLiteMode ? '' : 'backdrop-blur-md'} shadow-sm border border-white/50
              flex items-center gap-1.5
            `}>
              <div className={`w-2 h-2 rounded-full ${isLiteMode ? '' : 'animate-pulse'} ${petStage >= 10 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
                petStage >= 7 ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
                  petStage >= 4 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' :
                    'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                }`} />
              <span className={`text-xs font-black ${petStage >= 10 ? 'text-amber-600' : 'text-slate-600'
                }`}>
                Lv.{petStage}
              </span>
            </div>
          )}

          {/* Food Animation */}
          {isFeeding && (
            <span className="food-animation" style={{ top: '40%', left: '50%' }}>
              {foodEmoji}
            </span>
          )}

          {/* Exp +1 Animation */}
          {showExp && (
            <span className="exp-animation">+1</span>
          )}

          {/* Heart Particles */}
          {particles.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {particles.map((emoji, i) => (
                <span key={i} className="particle">
                  {emoji}
                </span>
              ))}
            </div>
          )}

          {/* Pet Image OR Egg */}
          <div className={`
            relative z-10 w-24 h-24 flex items-center justify-center
            ${isFeeding ? 'pet-happy-animation' : ''}
          `}>
            {isEgg ? (
              <MysteriousEgg />
            ) : (
              <PetImage
                petId={petIdForImage}
                stage={petStage}
                className={`
                  w-full h-full object-contain drop-shadow-lg
                  ${!isFeeding && !isLiteMode && isInViewport ? 'pet-breathing' : ''}
                `}
              />
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className={`relative px-4 pb-4 pt-2 ${isLiteMode ? 'bg-white/90' : 'bg-white/60 backdrop-blur-sm'}`}>
          {/* Name */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3
              className={`font-black text-lg ${theme.colors.text} text-clamp-2 leading-tight flex-1 min-w-0`}
            >
              {name}
            </h3>
            {!isBatchMode && !isRevokeMode && onOpenPetRename ? (
              <button
                type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPetRename(studentId);
                  }}
                className="text-xs font-bold text-slate-400 shrink-0 hover:text-indigo-500 transition-colors px-1 py-0.5 rounded-md hover:bg-indigo-50"
                title={isEgg ? '请先领养宠物后再起名' : '点击给宠物起名'}
              >
                {petDisplayName}
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-400 shrink-0">
                {petDisplayName}
              </span>
            )}
          </div>

          {/* Progress Bar - 显示当前阶段进度 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-end text-xs font-bold px-0.5">
              <span className="text-slate-400">
                {isEgg ? '等待孵化' : '本级进度'}
              </span>
              <span className={isComplete ? 'text-amber-500' : 'text-indigo-500'}>
                {isEgg ? (
                  <span className="text-purple-500 animate-pulse">点击领养</span>
                ) : petStage < 10 ? (
                  <>还差 <span className="text-sm">{nextStageFood - currentCount}</span> 🍖</>
                ) : (
                  <span className="text-amber-500">已满级</span>
                )}
              </span>
            </div>

            <div className={`
              relative h-3 bg-slate-100 rounded-full overflow-hidden
              ${isFeeding ? 'progress-bar-flash' : ''}
            `}>
              {/* 蛋状态显示特殊进度条 */}
              {isEgg ? (
                <div className="absolute inset-0 bg-slate-200/50 flex items-center justify-center">
                  <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%)] bg-[length:10px_10px]" />
                </div>
              ) : (
                <div
                  className={`
                    absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out
                    ${isComplete ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : theme.colors.accent}
                  `}
                  style={{ width: `${stageProgress}%` }}
                />
              )}

              {isComplete && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={12} className="text-white animate-pulse" />
                </div>
              )}
            </div>
          </div>

          {/* Stats Footer */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mt-3 pt-3 border-t border-slate-100/50">
            <div className="flex items-center gap-1.5" title="可用积分（累计获得 − 已消费）">
              <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-xs">
                🍖
              </div>
              <span className="text-xs font-bold text-slate-500">
                {availablePoints}
              </span>
            </div>

            {!isBatchMode && !isRevokeMode && onOpenGroupAssign ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGroupAssign(studentId);
                }}
                className="justify-self-center px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border border-slate-200 bg-slate-50/80 text-slate-500 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 max-w-[92px]"
                title={groupName || '未分组'}
              >
                <Users size={11} />
                <span className="truncate">{groupName || '未分组'}</span>
              </button>
            ) : (
              <div />
            )}

            {/* Badges - 始终显示，用于光团定位 */}
            <button
              data-badge-target={studentId}
              onClick={(e) => {
                e.stopPropagation();
                if (badges.length > 0) onOpenBadgeWall(studentId);
              }}
              className={`
                justify-self-end flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full transition-all cursor-pointer group/badge
                ${badges.length > 0 ? 'hover:bg-amber-50' : 'opacity-50'}
                ${badgeGlow ? 'badge-glow-animation' : ''}
              `}
              title={badges.length > 0 ? '查看徽章墙' : '暂无徽章'}
            >
              <Award
                size={14}
                className={`
                  transition-colors
                  ${badges.length > 0 ? 'text-amber-400 group-hover/badge:text-amber-500' : 'text-slate-300'}
                  ${badgeGlow ? 'badge-icon-glow' : ''}
                `}
              />
              <span className={`
                text-xs font-bold transition-all
                ${badges.length > 0 ? 'text-amber-500/80 group-hover/badge:text-amber-600' : 'text-slate-400'}
                ${badgeBounce ? 'badge-number-bounce' : ''}
              `}>
                {badges.length}
              </span>
            </button>
          </div>

          {/* Completion State */}
          {isComplete && (
            <div className={`
              mt-2 py-1.5 px-3 rounded-full text-center
              bg-gradient-to-r from-yellow-400 to-amber-500
              text-white text-xs font-black
              ${isLiteMode ? '' : 'animate-pulse'}
            `}>
              召唤守护神兽
            </div>
          )}
        </div>
      </div>

      {/* Hover glow effect */}
      {isHovered && !isRevokeMode && !isLiteMode && (
        <div className={`
          absolute -inset-1 rounded-3xl opacity-20 blur-md -z-10
          ${theme.colors.accent}
        `} />
      )}
    </div>
  );
};

const areStageThresholdsEqual = (a: number[], b: number[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areStudentCardPropsEqual = (prev: StudentCardProps, next: StudentCardProps): boolean => {
  return (
    prev.studentId === next.studentId
    && prev.name === next.name
    && prev.currentCount === next.currentCount
    && prev.availablePoints === next.availablePoints
    && prev.targetCount === next.targetCount
    && prev.badges.length === next.badges.length
    && prev.selectedPetId === next.selectedPetId
    && prev.petStage === next.petStage
    && areStageThresholdsEqual(prev.stageThresholds, next.stageThresholds)
    && prev.theme.id === next.theme.id
    && prev.isRevokeMode === next.isRevokeMode
    && prev.isCollectingBadge === next.isCollectingBadge
    && prev.isBatchMode === next.isBatchMode
    && prev.isSelected === next.isSelected
    && prev.petNickname === next.petNickname
    && prev.groupName === next.groupName
    && prev.performanceMode === next.performanceMode
    && prev.allowTransientEffects === next.allowTransientEffects
  );
};

export const StudentCard = React.memo(StudentCardComponent, areStudentCardPropsEqual);

export default StudentCard;
