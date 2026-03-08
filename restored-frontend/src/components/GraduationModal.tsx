import React from 'react';
import { Sparkles, Award, PartyPopper, Star } from 'lucide-react';
import { PetBreed } from '../types';
import { getPetImagePath } from '../constants';

interface GraduationModalProps {
  isOpen: boolean;
  studentName: string;
  pet: PetBreed;
  onCollect: () => void;
  onClose: () => void;
  studentId?: string;
}

// 烟花粒子组件
const Firework: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-yellow-400 animate-ping"
      style={{
        animationDelay: `${delay}ms`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 50}%`,
      }}
    />
  );
};

// 飘落星星组件
const FallingStar: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const left = Math.random() * 100;
  const duration = 2 + Math.random() * 2;

  return (
    <div
      className="absolute animate-fall opacity-0"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}s`,
      }}
    >
      <Star className="w-4 h-4 text-yellow-300 fill-yellow-200" />
    </div>
  );
};

export const GraduationModal: React.FC<GraduationModalProps> = ({
  isOpen,
  studentName,
  pet,
  onCollect,
  onClose,
}) => {
  if (!isOpen) return null;

  // 直接调用 onCollect，所有动画逻辑由 App.tsx 处理
  const handleCollect = () => {
    onCollect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-md">

        {/* 顶部庆祝图标 */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="relative">
            <PartyPopper className="w-20 h-20 text-yellow-400 drop-shadow-glow" />
            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 animate-pulse" />
          </div>
        </div>

        {/* 烟花粒子效果 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <Firework key={i} delay={i * 100} />
          ))}
        </div>

        {/* 飘落星星 */}
        <div className="absolute -top-10 left-0 right-0 h-full overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <FallingStar key={i} delay={i * 200} />
          ))}
        </div>

        {/* 主卡片 */}
        <div className="relative bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-1 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-[22px] overflow-hidden">

            {/* Header */}
            <div className="relative py-8 px-6 bg-gradient-to-b from-amber-50 via-yellow-50 to-white text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200 to-transparent opacity-30 animate-shimmer" />

              <Sparkles className="absolute top-4 left-8 w-6 h-6 text-yellow-400 animate-spin-slow" />
              <Sparkles className="absolute top-8 right-6 w-5 h-5 text-pink-400 animate-pulse" />
              <Sparkles className="absolute bottom-4 left-12 w-5 h-5 text-indigo-400 animate-bounce" />
              <Star className="absolute top-6 right-12 w-4 h-4 text-purple-400 fill-purple-300 animate-ping" />

              <h2 className="relative text-4xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 bg-clip-text text-transparent mb-2 animate-in slide-in-from-top duration-700">
                🎉 养成成功！
              </h2>
              <p className="relative text-slate-600 font-medium animate-in slide-in-from-bottom duration-700 delay-150">
                恭喜 <span className="font-bold text-indigo-600 text-lg">{studentName}</span>
              </p>
            </div>

            {/* Pet Display */}
            <div className="relative py-10 flex flex-col items-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 bg-gradient-to-r from-yellow-300 via-pink-300 to-indigo-300 rounded-full blur-3xl opacity-40 animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-2xl opacity-30 animate-spin-slow" />
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-yellow-300 rounded-full opacity-20 animate-spin-slow" />
                <div className="absolute w-56 h-56 border-4 border-pink-300 rounded-full opacity-15 animate-spin-reverse" />
              </div>

              <div className="relative z-10 w-44 h-44 mb-6 animate-in zoom-in duration-700 delay-300">
                <img
                  src={getPetImagePath(pet.id, 10)}
                  alt={pet.name}
                  className="w-full h-full object-contain drop-shadow-2xl pet-happy-animation"
                  draggable={false}
                />
                <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-pink-400 rounded-full animate-ping delay-100" />
                <div className="absolute top-1/2 -right-3 w-2 h-2 bg-indigo-400 rounded-full animate-ping delay-200" />
              </div>

              <div className="relative z-10 text-center animate-in fade-in duration-700 delay-500">
                <h3 className="text-2xl font-black text-slate-800 mb-1 drop-shadow-sm">
                  {pet.name}
                </h3>
                <p className="text-sm text-slate-400 font-medium">
                  ⭐ 守护神兽 · 满级形态 ⭐
                </p>
              </div>
            </div>

            {/* Badge preview */}
            <div className="px-6 py-5 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
              <div className="flex items-center justify-center gap-3 mb-4 animate-in slide-in-from-bottom duration-700 delay-700">
                <div className="relative">
                  <Award className="w-9 h-9 text-amber-500 animate-bounce" />
                  <div className="absolute inset-0 bg-amber-400 rounded-full blur-lg opacity-40 animate-pulse" />
                </div>
                <span className="text-xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  获得养成徽章
                </span>
              </div>

              <p className="text-center text-sm text-slate-500 mb-5 animate-in fade-in duration-700 delay-900">
                ✨ 徽章将永久保存在你的收藏中 ✨
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 animate-in slide-in-from-bottom duration-700 delay-1000">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200
                           text-slate-600 font-bold hover:bg-slate-100 transition-all min-h-[44px]"
                >
                  稍后再说
                </button>
                <button
                  onClick={handleCollect}
                  className="flex-1 py-3 px-4 rounded-xl
                           bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500
                           text-white font-bold shadow-lg shadow-orange-300
                           hover:shadow-xl hover:scale-105 transition-all
                           flex items-center justify-center gap-2
                           relative overflow-hidden group min-h-[44px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 group-hover:animate-shimmer" />
                  <Sparkles size={18} className="animate-pulse" />
                  收集徽章
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 外层光环 */}
        <div className="absolute -inset-6 rounded-[48px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-30 blur-2xl animate-pulse -z-10" />
        <div className="absolute -inset-8 rounded-[56px] bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 opacity-15 blur-3xl animate-spin-slow -z-20" />
      </div>
    </div>
  );
};

export default GraduationModal;
