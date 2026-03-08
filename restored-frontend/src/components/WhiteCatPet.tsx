import React from 'react';
import { getPetImagePath } from '../constants';

interface PetImageProps {
  petId: string;
  stage: number;
  className?: string;
  onClick?: () => void;
}

// 宠物图片组件
export const PetImage: React.FC<PetImageProps> = ({ petId, stage, className = '', onClick }) => {
  const imagePath = getPetImagePath(petId, stage);

  return (
    <img
      src={imagePath}
      alt={`宠物阶段 ${stage}`}
      className={`object-contain ${className}`}
      onClick={onClick}
      draggable={false}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  );
};

// 为兼容性保留的默认导出
export default PetImage;
