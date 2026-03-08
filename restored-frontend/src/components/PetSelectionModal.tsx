import React from 'react';
import { X } from 'lucide-react';
import { ALL_PETS, getPetImagePath } from '../constants';

interface PetSelectionModalProps {
  isOpen: boolean;
  studentName: string | null;
  onClose: () => void;
  onSelect: (petId: string) => void;
}

export const PetSelectionModal: React.FC<PetSelectionModalProps> = ({
  isOpen,
  studentName,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null;

  const handleSelect = (petId: string) => {
    onSelect(petId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pet-selection-title"
    >
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-content">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-500">
          <div>
            <h2 id="pet-selection-title" className="text-2xl font-black text-white">选择守护神兽</h2>
            <p className="text-indigo-100 text-sm mt-1">
              为 <span className="font-bold text-white">{studentName}</span> 选择一只可爱的神兽吧
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/20 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Pet Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 scroll-smooth">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
            {ALL_PETS.map((pet) => (
              <button
                key={pet.id}
                onClick={() => handleSelect(pet.id)}
                aria-label={`选择 ${pet.name}`}
                className="group relative flex flex-col items-center p-3 sm:p-4 bg-white rounded-2xl
                         border-2 border-slate-100 hover:border-indigo-300
                         shadow-sm hover:shadow-lg transition-all duration-200
                         hover:scale-105 hover:-translate-y-1 active:scale-95
                         min-h-[100px] sm:min-h-[120px]"
              >
                {/* Pet Image - 显示第10阶段的图片 */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 mb-2 flex items-center justify-center">
                  <img
                    src={getPetImagePath(pet.id, 10)}
                    alt={pet.name}
                    className="w-full h-full object-contain drop-shadow-md
                             group-hover:scale-110 transition-transform duration-200"
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Pet Name */}
                <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                  {pet.name}
                </span>

                {/* Hover highlight */}
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 text-center safe-area-bottom">
          <p className="text-sm text-slate-400">
            点击选择神兽，神兽会陪伴你完成每日打卡任务
          </p>
        </div>
      </div>
    </div>
  );
};

export default PetSelectionModal;
