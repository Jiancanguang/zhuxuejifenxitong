import { Badge } from '../types';
import { getPetById, getPetImagePath } from '../constants';

export type ExportTemplateType = 'certificate' | 'sticker';
export type CertificateTemplateStyleId = 'certificate_gold' | 'certificate_blue';
export type StickerTemplateStyleId = 'sticker_round_sky' | 'sticker_round_pink';
export type ExportTemplateStyleId = CertificateTemplateStyleId | StickerTemplateStyleId;

export interface ExportTemplateStyleOption {
  id: ExportTemplateStyleId;
  type: ExportTemplateType;
  name: string;
  description: string;
}

interface CanvasSize {
  width: number;
  height: number;
}

export interface RenderExportCanvasOptions {
  templateType: ExportTemplateType;
  templateStyleId?: ExportTemplateStyleId;
  studentName: string;
  classTitle: string;
  badges: Badge[];
  certificateSerial?: string;
  dateText: string;
}

const CERTIFICATE_SIZE: CanvasSize = { width: 2480, height: 3508 };
const STICKER_SIZE: CanvasSize = { width: 1080, height: 1080 };

const PLACEHOLDER_BG = '#f8fafc';
const PLACEHOLDER_BORDER = '#cbd5e1';
const PLACEHOLDER_TEXT = '#64748b';
const IMAGE_LOAD_TIMEOUT_MS = 8000;

const TEMPLATE_STYLE_OPTIONS: ExportTemplateStyleOption[] = [
  {
    id: 'certificate_gold',
    type: 'certificate',
    name: '鎏金经典',
    description: '庄重暖色风格，适合正式颁发',
  },
  {
    id: 'certificate_blue',
    type: 'certificate',
    name: '蓝调简约',
    description: '清爽蓝色风格，适合日常激励',
  },
  {
    id: 'sticker_round_sky',
    type: 'sticker',
    name: '圆章天空',
    description: '蓝色圆章，宠物主体突出',
  },
  {
    id: 'sticker_round_pink',
    type: 'sticker',
    name: '圆章糖果',
    description: '粉色圆章，适合冰箱贴定制',
  },
];

export const getTemplateStyleOptions = (templateType: ExportTemplateType): ExportTemplateStyleOption[] => {
  return TEMPLATE_STYLE_OPTIONS.filter(option => option.type === templateType);
};

export const getDefaultTemplateStyleId = (templateType: ExportTemplateType): ExportTemplateStyleId => {
  return templateType === 'certificate' ? 'certificate_gold' : 'sticker_round_sky';
};

const resolveTemplateStyleId = (
  templateType: ExportTemplateType,
  templateStyleId?: ExportTemplateStyleId
): ExportTemplateStyleId => {
  const validIds = new Set(getTemplateStyleOptions(templateType).map(option => option.id));
  if (templateStyleId && validIds.has(templateStyleId)) {
    return templateStyleId;
  }
  return getDefaultTemplateStyleId(templateType);
};

const getCanvasSize = (templateType: ExportTemplateType): CanvasSize => {
  return templateType === 'certificate' ? CERTIFICATE_SIZE : STICKER_SIZE;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const fillRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
) => {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
};

const strokeRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  lineWidth: number
) => {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
};

const loadImage = (src: string, timeoutMs = IMAGE_LOAD_TIMEOUT_MS): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finalize = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finalize(null);
    }, timeoutMs);

    img.onload = () => finalize(img);
    img.onerror = () => finalize(null);
    img.src = src;
  });
};

const preloadBadgeImages = async (badges: Badge[]): Promise<Map<string, HTMLImageElement | null>> => {
  const uniquePetIds = [...new Set(badges.map(badge => badge.petId))];
  const imageMap = new Map<string, HTMLImageElement | null>();

  await Promise.all(
    uniquePetIds.map(async (petId) => {
      const image = await loadImage(getPetImagePath(petId, 10));
      imageMap.set(petId, image);
    })
  );

  return imageMap;
};

const drawImageContain = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  if (!image.width || !image.height) return;
  const ratio = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const getBadgeDisplayName = (badge: Badge): string => {
  const snapshotName = (badge.petName || '').trim();
  if (snapshotName) return snapshotName;
  return getPetById(badge.petId)?.name || '徽章';
};

const fitTextByWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
};

const drawBadgeItem = (
  ctx: CanvasRenderingContext2D,
  badge: Badge,
  imageMap: Map<string, HTMLImageElement | null>,
  x: number,
  y: number,
  size: number,
  indexLabel: string,
  compact: boolean,
  displayName: string
) => {
  fillRoundedRect(ctx, x, y, size, size, compact ? 20 : 26, '#fff');
  strokeRoundedRect(ctx, x, y, size, size, compact ? 20 : 26, '#fcd34d', compact ? 4 : 5);

  const petImage = imageMap.get(badge.petId) ?? null;
  const imagePadding = compact ? 20 : 26;
  const imageSize = size - imagePadding * 2;
  if (petImage) {
    drawImageContain(ctx, petImage, x + imagePadding, y + imagePadding, imageSize, imageSize);
  } else {
    fillRoundedRect(
      ctx,
      x + imagePadding,
      y + imagePadding,
      imageSize,
      imageSize,
      compact ? 12 : 14,
      PLACEHOLDER_BG
    );
    strokeRoundedRect(
      ctx,
      x + imagePadding,
      y + imagePadding,
      imageSize,
      imageSize,
      compact ? 12 : 14,
      PLACEHOLDER_BORDER,
      2
    );
    ctx.fillStyle = PLACEHOLDER_TEXT;
    ctx.font = `${compact ? 20 : 24}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无图片', x + size / 2, y + size / 2);
  }

  const labelHeight = compact ? 32 : 40;
  const labelHorizontalPadding = compact ? 12 : 16;
  const maxLabelWidth = size - (compact ? 20 : 26);

  ctx.font = `bold ${compact ? 17 : 21}px sans-serif`;
  const safeDisplayName = fitTextByWidth(ctx, displayName, maxLabelWidth - labelHorizontalPadding * 2);
  const rawTextWidth = ctx.measureText(safeDisplayName).width;
  const labelWidth = Math.max(
    compact ? 78 : 98,
    Math.min(maxLabelWidth, rawTextWidth + labelHorizontalPadding * 2)
  );
  const labelX = x + (size - labelWidth) / 2;
  const labelY = y + size - labelHeight - (compact ? 8 : 12);

  const labelGradient = ctx.createLinearGradient(labelX, labelY, labelX + labelWidth, labelY + labelHeight);
  labelGradient.addColorStop(0, 'rgba(245, 158, 11, 0.97)');
  labelGradient.addColorStop(1, 'rgba(234, 88, 12, 0.97)');

  drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, labelHeight / 2);
  ctx.fillStyle = labelGradient;
  ctx.fill();
  ctx.lineWidth = compact ? 1.8 : 2.2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${compact ? 17 : 21}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeDisplayName, x + size / 2, labelY + labelHeight / 2);

  const badgeRadius = compact ? 18 : 22;
  const badgeCenterX = x + size - badgeRadius - (compact ? 8 : 10);
  const badgeCenterY = y + badgeRadius + (compact ? 8 : 10);
  ctx.beginPath();
  ctx.arc(badgeCenterX, badgeCenterY, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${compact ? 16 : 20}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(indexLabel, badgeCenterX, badgeCenterY);
};

const drawCertificateHeroBadge = (
  ctx: CanvasRenderingContext2D,
  badge: Badge,
  imageMap: Map<string, HTMLImageElement | null>,
  centerX: number,
  centerY: number,
  diameter: number,
  palette: CertificatePalette
) => {
  const radius = diameter / 2;
  const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.12, centerX, centerY, radius * 1.05);
  glow.addColorStop(0, `${palette.borderSecondary}66`);
  glow.addColorStop(0.62, `${palette.borderSecondary}20`);
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.02, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(4, diameter * 0.012);
  ctx.strokeStyle = `${palette.borderSecondary}aa`;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.86, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(8, diameter * 0.028);
  ctx.strokeStyle = palette.borderPrimary;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const petImage = imageMap.get(badge.petId) ?? null;
  const imageRadius = radius * 0.7;
  if (petImage) {
    // 单徽章证书场景优先完整展示宠物，不做圆形裁切，避免边缘被截断
    drawImageContain(ctx, petImage, centerX - imageRadius, centerY - imageRadius, imageRadius * 2, imageRadius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, imageRadius, 0, Math.PI * 2);
    ctx.fillStyle = PLACEHOLDER_BG;
    ctx.fill();
    ctx.strokeStyle = PLACEHOLDER_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PLACEHOLDER_TEXT;
    ctx.font = `${Math.max(24, diameter * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无图片', centerX, centerY);
  }

};

const drawNoBadgePlaceholder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  fillRoundedRect(ctx, x, y, width, height, 24, '#fff');
  strokeRoundedRect(ctx, x, y, width, height, 24, '#e2e8f0', 3);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂无徽章', x + width / 2, y + height / 2 - 20);
  ctx.font = '32px sans-serif';
  ctx.fillText('继续加油，徽章很快就会点亮', x + width / 2, y + height / 2 + 36);
};

interface CertificatePalette {
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  borderPrimary: string;
  borderSecondary: string;
  title: string;
  textMain: string;
  textSub: string;
  panelFill: string;
  panelBorder: string;
}

const getCertificatePalette = (styleId: CertificateTemplateStyleId): CertificatePalette => {
  if (styleId === 'certificate_blue') {
    return {
      bgTop: '#f8fbff',
      bgMid: '#eff6ff',
      bgBottom: '#dbeafe',
      borderPrimary: '#2563eb',
      borderSecondary: '#93c5fd',
      title: '#1d4ed8',
      textMain: '#1e3a8a',
      textSub: '#1e40af',
      panelFill: 'rgba(255, 255, 255, 0.76)',
      panelBorder: '#bfdbfe',
    };
  }

  return {
    bgTop: '#fffef7',
    bgMid: '#fffbeb',
    bgBottom: '#fef3c7',
    borderPrimary: '#f59e0b',
    borderSecondary: '#fcd34d',
    title: '#b45309',
    textMain: '#92400e',
    textSub: '#78350f',
    panelFill: 'rgba(255, 255, 255, 0.72)',
    panelBorder: '#fde68a',
  };
};

const renderCertificateCanvas = (
  canvas: HTMLCanvasElement,
  options: RenderExportCanvasOptions,
  imageMap: Map<string, HTMLImageElement | null>,
  styleId: CertificateTemplateStyleId
) => {
  const palette = getCertificatePalette(styleId);
  const { width, height } = CERTIFICATE_SIZE;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 Canvas 上下文');
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.bgTop);
  gradient.addColorStop(0.45, palette.bgMid);
  gradient.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  strokeRoundedRect(ctx, 90, 90, width - 180, height - 180, 36, palette.borderPrimary, 8);
  strokeRoundedRect(ctx, 130, 130, width - 260, height - 260, 28, palette.borderSecondary, 4);

  ctx.fillStyle = palette.title;
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('荣誉证书', width / 2, 350);

  ctx.fillStyle = palette.textMain;
  ctx.font = '44px sans-serif';
  ctx.fillText(`授予：${options.studentName} 同学`, width / 2, 480);

  ctx.fillStyle = palette.textSub;
  ctx.font = '36px sans-serif';
  ctx.fillText(`班级：${options.classTitle}`, width / 2, 560);

  const badgeAreaX = 220;
  const badgeAreaY = 710;
  const badgeAreaWidth = width - badgeAreaX * 2;
  const badgeAreaHeight = 2050;
  const totalBadgeCount = options.badges.length;
  let renderedBadgeCount = totalBadgeCount;
  let hiddenBadgeCount = 0;

  const gridLayout = (() => {
    if (totalBadgeCount <= 1) return null;

    const columns = 4;
    const gap = 36;
    const innerPadding = 80;
    const badgeSize = Math.floor((badgeAreaWidth - innerPadding * 2 - gap * (columns - 1)) / columns);

    let maxRows = 0;
    while (true) {
      const y = badgeAreaY + 90 + maxRows * (badgeSize + gap + 16);
      if (y + badgeSize > badgeAreaY + badgeAreaHeight - 90) break;
      maxRows += 1;
    }

    const maxDisplayCount = Math.max(0, maxRows * columns);
    renderedBadgeCount = Math.min(totalBadgeCount, maxDisplayCount);
    hiddenBadgeCount = Math.max(0, totalBadgeCount - renderedBadgeCount);

    return { columns, gap, innerPadding, badgeSize, maxDisplayCount };
  })();

  ctx.font = '36px sans-serif';
  const badgeCountText = hiddenBadgeCount > 0
    ? `累计徽章：${totalBadgeCount} 枚（展示 ${renderedBadgeCount} 枚）`
    : `累计徽章：${totalBadgeCount} 枚`;
  ctx.fillText(badgeCountText, width / 2, 620);

  fillRoundedRect(ctx, badgeAreaX, badgeAreaY, badgeAreaWidth, badgeAreaHeight, 28, palette.panelFill);
  strokeRoundedRect(ctx, badgeAreaX, badgeAreaY, badgeAreaWidth, badgeAreaHeight, 28, palette.panelBorder, 3);

  if (options.badges.length === 0) {
    drawNoBadgePlaceholder(ctx, badgeAreaX + 80, badgeAreaY + 120, badgeAreaWidth - 160, badgeAreaHeight - 240);
  } else if (options.badges.length === 1) {
    const singleBadge = options.badges[0];
    const heroDiameter = Math.min(badgeAreaWidth * 0.58, badgeAreaHeight * 0.56);
    const heroCenterX = badgeAreaX + badgeAreaWidth / 2;
    const heroCenterY = badgeAreaY + badgeAreaHeight * 0.43;
    drawCertificateHeroBadge(ctx, singleBadge, imageMap, heroCenterX, heroCenterY, heroDiameter, palette);

    const displayName = getBadgeDisplayName(singleBadge);
    ctx.font = 'bold 62px sans-serif';
    const labelMaxWidth = badgeAreaWidth - 300;
    const safeName = fitTextByWidth(ctx, displayName, labelMaxWidth - 120);
    const labelTextWidth = ctx.measureText(safeName).width;
    const labelWidth = Math.min(labelMaxWidth, Math.max(320, labelTextWidth + 120));
    const labelHeight = 96;
    const labelX = badgeAreaX + (badgeAreaWidth - labelWidth) / 2;
    const labelY = badgeAreaY + badgeAreaHeight - 380;
    const labelGradient = ctx.createLinearGradient(labelX, labelY, labelX + labelWidth, labelY + labelHeight);
    labelGradient.addColorStop(0, 'rgba(245, 158, 11, 0.98)');
    labelGradient.addColorStop(1, 'rgba(234, 88, 12, 0.98)');
    drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, labelHeight / 2);
    ctx.fillStyle = labelGradient;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeName, badgeAreaX + badgeAreaWidth / 2, labelY + labelHeight / 2 + 2);

    ctx.fillStyle = palette.textSub;
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('专属成长徽章', badgeAreaX + badgeAreaWidth / 2, labelY + labelHeight + 82);
  } else {
    const columns = gridLayout?.columns ?? 4;
    const gap = gridLayout?.gap ?? 36;
    const innerPadding = gridLayout?.innerPadding ?? 80;
    const badgeSize = gridLayout?.badgeSize
      ?? Math.floor((badgeAreaWidth - innerPadding * 2 - gap * (columns - 1)) / columns);
    const maxDisplayCount = gridLayout?.maxDisplayCount ?? options.badges.length;
    const visibleBadges = options.badges.slice(0, maxDisplayCount);

    visibleBadges.forEach((badge, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = badgeAreaX + innerPadding + col * (badgeSize + gap);
      const y = badgeAreaY + 90 + row * (badgeSize + gap + 16);
      drawBadgeItem(
        ctx,
        badge,
        imageMap,
        x,
        y,
        badgeSize,
        `${index + 1}`,
        false,
        getBadgeDisplayName(badge)
      );
    });

    if (hiddenBadgeCount > 0) {
      ctx.fillStyle = palette.textSub;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`其余 ${hiddenBadgeCount} 枚徽章已省略展示`, badgeAreaX + badgeAreaWidth / 2, badgeAreaY + badgeAreaHeight - 30);
    }
  }

  ctx.fillStyle = palette.textSub;
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`授予日期：${options.dateText}`, 260, height - 260);
  const serial = options.certificateSerial || 'CERT-UNASSIGNED';
  ctx.font = '30px sans-serif';
  ctx.fillStyle = palette.textSub;
  ctx.fillText(`证书编号：${serial}`, 260, height - 205);

  ctx.textAlign = 'right';
  ctx.fillText('班主任签名：________________', width - 260, height - 260);
};

interface StickerPalette {
  bgTop: string;
  bgBottom: string;
  frame: string;
  frameLight: string;
  title: string;
  circleRingLight: string;
  countBg: string;
  countText: string;
  heart: string;
  heartLight: string;
  candyDotA: string;
  candyDotB: string;
  glow: string;
}

const getStickerPalette = (styleId: StickerTemplateStyleId): StickerPalette => {
  if (styleId === 'sticker_round_pink') {
    return {
      bgTop: '#fff0f5',
      bgBottom: '#ffcce0',
      frame: '#f25d94',
      frameLight: '#ffb0d0',
      title: '#a32065',
      circleRingLight: '#ffd2e8',
      countBg: '#ef3580',
      countText: '#ffffff',
      heart: '#f04d8e',
      heartLight: '#ffa8ce',
      candyDotA: '#ffca52',
      candyDotB: '#80deff',
      glow: '#ffb8d8',
    };
  }

  return {
    bgTop: '#eceeff',
    bgBottom: '#cdd2ff',
    frame: '#7568ef',
    frameLight: '#b5b0ff',
    title: '#4538a8',
    circleRingLight: '#d5d2ff',
    countBg: '#5245cc',
    countText: '#ffffff',
    heart: '#f580bb',
    heartLight: '#ffcce5',
    candyDotA: '#ffaacc',
    candyDotB: '#80eebb',
    glow: '#a0aaff',
  };
};

const drawStickerSparkle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  rotationRad: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.28, -size * 0.28);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * 0.28, size * 0.28);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.28, size * 0.28);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size * 0.28, -size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const traceFlowerPath = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  petalCount: number,
  wobble: number,
  rotationRad: number
) => {
  const steps = 280;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (Math.PI * 2 * i) / steps;
    const wave = Math.sin(petalCount * t);
    const soft = 0.72 + 0.28 * Math.sin(t * 2 + 0.75);
    const r = radius * (1 + wobble * wave * soft);
    const x = centerX + Math.cos(t + rotationRad) * r;
    const y = centerY + Math.sin(t + rotationRad) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

const traceBurstPath = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  spikeCount: number,
  rotationRad: number
) => {
  ctx.beginPath();
  for (let i = 0; i < spikeCount * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotationRad + (Math.PI * i) / spikeCount;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

const drawStickerHeart = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  rotationRad: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, 0.38);
  ctx.bezierCurveTo(0.58, -0.18, 1.18, 0.44, 0, 1.18);
  ctx.bezierCurveTo(-1.18, 0.44, -0.58, -0.18, 0, 0.38);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};
const drawStickerStar6 = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  color: string,
  rotationRad: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / 6;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

const drawStickerGlowDot = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(0.5, color.slice(0, 7) + '60');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
};

const getPrimaryStickerBadge = (badges: Badge[]): Badge | null => {
  if (badges.length === 0) return null;
  return badges.reduce((latest, current) => (
    current.earnedAt > latest.earnedAt ? current : latest
  ));
};

const drawEmptyStickerBadge = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: StickerPalette,
  styleId: StickerTemplateStyleId
) => {
  const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  gradient.addColorStop(0, palette.bgTop);
  gradient.addColorStop(1, palette.bgBottom);
  if (styleId === 'sticker_round_pink') {
    traceFlowerPath(ctx, centerX, centerY, radius, 12, 0.15, -Math.PI / 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.frame;
    ctx.stroke();
  } else {
    traceBurstPath(ctx, centerX, centerY, radius * 1.02, radius * 0.88, 18, -Math.PI / 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = palette.frame;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = palette.circleRingLight;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = PLACEHOLDER_TEXT;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂无徽章', centerX, centerY - 18);
  ctx.font = '32px sans-serif';
  ctx.fillText('继续加油', centerX, centerY + 42);
};

// ── 云朵圆形路径：圆润凸起的云朵边缘 ──
const traceCloudCirclePath = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  baseRadius: number,
  bumpCount: number,
  amplitude: number
) => {
  const steps = 420;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (Math.PI * 2 * i) / steps;
    const valley = Math.pow(Math.abs(Math.sin((bumpCount * t) / 2)), 3.2);
    const r = baseRadius * (1 + amplitude * (1 - valley));
    const x = centerX + Math.cos(t) * r;
    const y = centerY + Math.sin(t) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── 卡通五角星（带描边 + 高光） ──
const drawBorderStar5 = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  fillColor: string,
  strokeColor: string,
  strokeW: number,
  rotationRad: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  const innerR = outerR * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = strokeW;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  // 白色高光点
  const spots = [
    { dx: -outerR * 0.18, dy: -outerR * 0.32, r: outerR * 0.16 },
    { dx: outerR * 0.12, dy: -outerR * 0.08, r: outerR * 0.12 },
  ];
  spots.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.dx, s.dy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill();
  });
  ctx.restore();
};

// ── 水滴装饰 ──
const drawBorderDrop = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string,
  strokeColor: string,
  rotationRad: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.6);
  ctx.quadraticCurveTo(size * 0.42, size * 0.05, 0, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.42, size * 0.05, 0, -size * 0.6);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = Math.max(2.5, size * 0.12);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.restore();
};

// ── 云朵边框（三层叠加：深色描边 → 浅色带 → 白色内填 + 虚线 + 星星 + 水滴） ──
interface CloudBorderColors {
  outline: string;
  band: string;
  dash: string;
  starFill: string;
  starStroke: string;
  dropFill: string;
  dropStroke: string;
}

const drawCloudBorderFrame = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  colors: CloudBorderColors
) => {
  const bumps = 10;
  const amp = 0.13;

  // Layer 1：深色描边底层（最大云朵）
  traceCloudCirclePath(ctx, centerX, centerY, radius, bumps, amp);
  ctx.fillStyle = colors.outline;
  ctx.fill();

  // Layer 2：浅色填充带
  traceCloudCirclePath(ctx, centerX, centerY, radius * 0.935, bumps, amp);
  ctx.fillStyle = colors.band;
  ctx.fill();

  // Layer 3：白色内填
  traceCloudCirclePath(ctx, centerX, centerY, radius * 0.83, bumps, amp);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Layer 4：虚线（跟随云朵形状）
  ctx.save();
  ctx.setLineDash([7, 7]);
  traceCloudCirclePath(ctx, centerX, centerY, radius * 0.88, bumps, amp * 0.95);
  ctx.strokeStyle = colors.dash;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 计算云朵边缘上的坐标
  const cloudEdgePos = (angleDeg: number, rScale: number) => {
    const t = (angleDeg * Math.PI) / 180;
    const valley = Math.pow(Math.abs(Math.sin((bumps * t) / 2)), 3.2);
    const r = radius * rScale * (1 + amp * (1 - valley));
    return { x: centerX + Math.cos(t) * r, y: centerY + Math.sin(t) * r };
  };

  // 星星：放在云朵凸起顶点（bump peaks 在 0°, 36°, 72°, …）
  const starDefs = [
    { deg: -54, size: 34, rot: -0.15 },
    { deg: -18, size: 30, rot: 0.25 },
    { deg: 18, size: 26, rot: 0.05 },
    { deg: 162, size: 22, rot: -0.3 },
  ];
  starDefs.forEach(star => {
    const pos = cloudEdgePos(star.deg, 0.935);
    drawBorderStar5(ctx, pos.x, pos.y, star.size, colors.starFill, colors.starStroke, 4, star.rot);
  });

  // 水滴：放在星星附近
  const dropDefs = [
    { deg: -72, size: 18, rot: -0.6 },
    { deg: -36, size: 14, rot: 0.4 },
  ];
  dropDefs.forEach(drop => {
    const pos = cloudEdgePos(drop.deg, 1.05);
    drawBorderDrop(ctx, pos.x, pos.y, drop.size, colors.dropFill, colors.dropStroke, drop.rot);
  });
};

const drawStickerHeroBadgeCuteFlower = (
  ctx: CanvasRenderingContext2D,
  badge: Badge,
  imageMap: Map<string, HTMLImageElement | null>,
  centerX: number,
  centerY: number,
  diameter: number,
  palette: StickerPalette,
  displayName: string,
  badgeCount: number
) => {
  const radius = diameter / 2;

  // ── 外发光：更柔和、更宽广 ──
  const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.12, centerX, centerY, radius * 1.32);
  glow.addColorStop(0, `${palette.glow}92`);
  glow.addColorStop(0.45, `${palette.glow}40`);
  glow.addColorStop(0.78, `${palette.glow}12`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.32, 0, Math.PI * 2);
  ctx.fill();

  // ── 云朵边框（淡粉色系） ──
  drawCloudBorderFrame(ctx, centerX, centerY, radius, {
    outline: '#f2a0b8',
    band: '#ffe8f0',
    dash: '#e8889e',
    starFill: '#fff0c8',
    starStroke: '#f2a0b8',
    dropFill: '#ffe0ea',
    dropStroke: '#f2a0b8',
  });

  // ── 中心白圆（带 drop shadow 营造悬浮感） ──
  ctx.save();
  ctx.shadowColor = `${palette.frame}45`;
  ctx.shadowBlur = Math.max(22, diameter * 0.055);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(7, diameter * 0.018);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // ── 圆环描边（双环 · 淡色系，与整体配色协调） ──
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = palette.circleRingLight;
  ctx.lineWidth = Math.max(7, diameter * 0.018);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.685, 0, Math.PI * 2);
  ctx.strokeStyle = `${palette.circleRingLight}50`;
  ctx.lineWidth = Math.max(2, diameter * 0.005);
  ctx.stroke();

  // ── 宠物柔光（让宠物图片浮起来） ──
  const petGlow = ctx.createRadialGradient(centerX, centerY - radius * 0.03, radius * 0.06, centerX, centerY, radius * 0.62);
  petGlow.addColorStop(0, 'rgba(255, 248, 254, 0.8)');
  petGlow.addColorStop(0.45, 'rgba(255, 235, 248, 0.2)');
  petGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = petGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.62, 0, Math.PI * 2);
  ctx.fill();

  // ── 宠物图片 ──
  const imageRadius = radius * 0.62;
  const image = imageMap.get(badge.petId) ?? null;
  if (image) {
    drawImageContain(ctx, image, centerX - imageRadius, centerY - imageRadius, imageRadius * 2, imageRadius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, imageRadius, 0, Math.PI * 2);
    ctx.fillStyle = PLACEHOLDER_BG;
    ctx.fill();
    ctx.strokeStyle = PLACEHOLDER_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PLACEHOLDER_TEXT;
    ctx.font = `${Math.max(22, diameter * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无图片', centerX, centerY);
  }

  // ── 名称标签（左上角装饰性标签 · 爱心/星点装饰与圆章风格融合） ──
  ctx.font = 'bold 34px sans-serif';
  const safeName = fitTextByWidth(ctx, displayName, diameter * 0.44);
  const textWidth = ctx.measureText(safeName).width;
  const tagWidth = Math.max(180, Math.min(diameter * 0.52, textWidth + 72));
  const tagHeight = 56;
  const tagCX = centerX - radius * 0.52;
  const tagCY = centerY - radius * 0.58;
  const tagRotation = -0.17;

  // 标签周围打散装饰元素（先画，标签盖在上面）
  drawStickerHeart(ctx, tagCX - tagWidth * 0.44, tagCY - 4, 11, palette.heartLight, -0.35);
  drawStickerHeart(ctx, tagCX + tagWidth * 0.46, tagCY + 8, 9, palette.heart, 0.25);
  drawStickerSparkle(ctx, tagCX - tagWidth * 0.15, tagCY - tagHeight * 0.68, 8, palette.candyDotA, 0.35);
  drawStickerSparkle(ctx, tagCX + tagWidth * 0.24, tagCY - tagHeight * 0.62, 7, palette.frameLight, 0.65);
  // 小圆点点缀
  ctx.beginPath();
  ctx.arc(tagCX - tagWidth * 0.32, tagCY + tagHeight * 0.52, 4, 0, Math.PI * 2);
  ctx.fillStyle = palette.candyDotB;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tagCX + tagWidth * 0.36, tagCY - tagHeight * 0.44, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = palette.candyDotA;
  ctx.fill();

  // 标签柔光晕（让标签融入背景）
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  const tagGlow = ctx.createRadialGradient(0, 0, tagHeight * 0.3, 0, 0, tagWidth * 0.6);
  tagGlow.addColorStop(0, `${palette.glow}3a`);
  tagGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = tagGlow;
  ctx.beginPath();
  ctx.ellipse(0, 0, tagWidth * 0.6, tagHeight * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 标签主体（淡粉渐变底色 + 柔色描边）
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  ctx.shadowColor = `${palette.frame}30`;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  const tagBg = ctx.createLinearGradient(-tagWidth / 2, 0, tagWidth / 2, 0);
  tagBg.addColorStop(0, '#fff3f8');
  tagBg.addColorStop(0.5, '#ffffff');
  tagBg.addColorStop(1, '#fff3f8');
  drawRoundedRect(ctx, -tagWidth / 2, -tagHeight / 2, tagWidth, tagHeight, tagHeight / 2);
  ctx.fillStyle = tagBg;
  ctx.fill();
  ctx.restore();

  // 描边 + 文字
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  drawRoundedRect(ctx, -tagWidth / 2, -tagHeight / 2, tagWidth, tagHeight, tagHeight / 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.frameLight;
  ctx.stroke();
  ctx.fillStyle = palette.title;
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeName, 0, 1);
  ctx.restore();

  // ── 徽章计数（带阴影） ──
  if (badgeCount > 1) {
    const chipWidth = 172;
    const chipHeight = 68;
    const chipX = centerX + radius * 0.22;
    const chipY = centerY - radius * 0.92;
    ctx.save();
    ctx.shadowColor = `${palette.countBg}40`;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    fillRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2, palette.countBg);
    ctx.restore();
    strokeRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2, 'rgba(255,255,255,0.82)', 2.5);
    ctx.fillStyle = palette.countText;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`× ${badgeCount}`, chipX + chipWidth / 2, chipY + chipHeight / 2 + 1);
  }
};

const drawStickerHeroBadgeCool = (
  ctx: CanvasRenderingContext2D,
  badge: Badge,
  imageMap: Map<string, HTMLImageElement | null>,
  centerX: number,
  centerY: number,
  diameter: number,
  palette: StickerPalette,
  displayName: string,
  badgeCount: number
) => {
  const radius = diameter / 2;

  // ── 云朵边框（淡黄色系） ──
  drawCloudBorderFrame(ctx, centerX, centerY, radius, {
    outline: '#e8c868',
    band: '#fff8e0',
    dash: '#d4b050',
    starFill: '#fff0c0',
    starStroke: '#e8c868',
    dropFill: '#fff5d0',
    dropStroke: '#e8c868',
  });

  // ── 中心白圆（带 drop shadow） ──
  ctx.save();
  ctx.shadowColor = `${palette.frame}42`;
  ctx.shadowBlur = Math.max(20, diameter * 0.05);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(6, diameter * 0.016);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.70, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // ── 圆环描边（双环 · 淡金色系，与黄色云朵边框协调） ──
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.70, 0, Math.PI * 2);
  ctx.strokeStyle = '#f0dfa0';
  ctx.lineWidth = Math.max(7, diameter * 0.018);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.665, 0, Math.PI * 2);
  ctx.strokeStyle = '#f5ecc850';
  ctx.lineWidth = Math.max(2, diameter * 0.005);
  ctx.stroke();

  // ── 宠物柔光 ──
  const petGlow = ctx.createRadialGradient(centerX, centerY - radius * 0.03, radius * 0.05, centerX, centerY, radius * 0.60);
  petGlow.addColorStop(0, 'rgba(245, 245, 255, 0.78)');
  petGlow.addColorStop(0.45, 'rgba(220, 225, 255, 0.18)');
  petGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = petGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.60, 0, Math.PI * 2);
  ctx.fill();

  // ── 宠物图片 ──
  const imageRadius = radius * 0.61;
  const image = imageMap.get(badge.petId) ?? null;
  if (image) {
    drawImageContain(ctx, image, centerX - imageRadius, centerY - imageRadius, imageRadius * 2, imageRadius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, imageRadius, 0, Math.PI * 2);
    ctx.fillStyle = PLACEHOLDER_BG;
    ctx.fill();
    ctx.strokeStyle = PLACEHOLDER_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PLACEHOLDER_TEXT;
    ctx.font = `${Math.max(22, diameter * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无图片', centerX, centerY);
  }

  // ── 名称标签（左上角装饰性标签 · 暖金色系与黄色云朵边框协调） ──
  ctx.font = 'bold 34px sans-serif';
  const safeName = fitTextByWidth(ctx, displayName, diameter * 0.44);
  const textWidth = ctx.measureText(safeName).width;
  const tagWidth = Math.max(180, Math.min(diameter * 0.52, textWidth + 72));
  const tagHeight = 56;
  const tagCX = centerX - radius * 0.52;
  const tagCY = centerY - radius * 0.58;
  const tagRotation = -0.14;

  // 标签周围打散装饰元素（暖金色系，先画，标签盖在上面）
  drawStickerSparkle(ctx, tagCX - tagWidth * 0.44, tagCY - 2, 10, '#f0dfa0', 0.2);
  drawStickerSparkle(ctx, tagCX + tagWidth * 0.46, tagCY + 6, 8, '#e8c868', 0.55);
  drawStickerStar6(ctx, tagCX - tagWidth * 0.12, tagCY - tagHeight * 0.68, 9, 4.5, '#ffd966', 0.3);
  drawStickerGlowDot(ctx, tagCX + tagWidth * 0.28, tagCY - tagHeight * 0.56, 7, '#f0dfa0');
  // 小圆点点缀
  ctx.beginPath();
  ctx.arc(tagCX - tagWidth * 0.30, tagCY + tagHeight * 0.52, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#f5ecc8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tagCX + tagWidth * 0.34, tagCY - tagHeight * 0.42, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd966';
  ctx.fill();

  // 标签柔光晕（暖金色，让标签融入背景）
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  const tagGlow = ctx.createRadialGradient(0, 0, tagHeight * 0.3, 0, 0, tagWidth * 0.6);
  tagGlow.addColorStop(0, '#f0dfa03a');
  tagGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = tagGlow;
  ctx.beginPath();
  ctx.ellipse(0, 0, tagWidth * 0.6, tagHeight * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 标签主体（淡金渐变底色 + 暖金色描边）
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  ctx.shadowColor = '#d4b05030';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  const tagBg = ctx.createLinearGradient(-tagWidth / 2, 0, tagWidth / 2, 0);
  tagBg.addColorStop(0, '#fef8e8');
  tagBg.addColorStop(0.5, '#ffffff');
  tagBg.addColorStop(1, '#fef8e8');
  drawRoundedRect(ctx, -tagWidth / 2, -tagHeight / 2, tagWidth, tagHeight, tagHeight / 2);
  ctx.fillStyle = tagBg;
  ctx.fill();
  ctx.restore();

  // 描边 + 文字（暖金色系）
  ctx.save();
  ctx.translate(tagCX, tagCY);
  ctx.rotate(tagRotation);
  drawRoundedRect(ctx, -tagWidth / 2, -tagHeight / 2, tagWidth, tagHeight, tagHeight / 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e8c868';
  ctx.stroke();
  ctx.fillStyle = '#7a6518';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeName, 0, 1);
  ctx.restore();

  // ── 徽章计数（药丸形 + 阴影） ──
  if (badgeCount > 1) {
    const chipWidth = 168;
    const chipHeight = 66;
    const chipX = centerX + radius * 0.24;
    const chipY = centerY - radius * 0.9;
    ctx.save();
    ctx.shadowColor = `${palette.countBg}40`;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    fillRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2, palette.countBg);
    ctx.restore();
    strokeRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2, 'rgba(255,255,255,0.82)', 2.4);
    ctx.fillStyle = palette.countText;
    ctx.font = 'bold 33px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`× ${badgeCount}`, chipX + chipWidth / 2, chipY + chipHeight / 2 + 1);
  }
};

const renderStickerCanvas = (
  canvas: HTMLCanvasElement,
  options: RenderExportCanvasOptions,
  imageMap: Map<string, HTMLImageElement | null>,
  styleId: StickerTemplateStyleId
) => {
  const palette = getStickerPalette(styleId);
  const { width, height } = STICKER_SIZE;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 Canvas 上下文');
  }

  // 开启高质量图片渲染
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 圆形贴纸输出：透明背景，仅保留圆章本体，便于后续打印裁切和冰箱贴定制
  ctx.clearRect(0, 0, width, height);

  const primaryBadge = getPrimaryStickerBadge(options.badges);
  const centerX = width / 2;
  const centerY = height / 2;
  // 两个模板统一使用 0.38 半径，让设计更饱满
  const stickerRadius = Math.floor(Math.min(width, height) * 0.38);

  if (!primaryBadge) {
    drawEmptyStickerBadge(ctx, centerX, centerY, stickerRadius, palette, styleId);
    return;
  }

  if (styleId === 'sticker_round_pink') {
    drawStickerHeroBadgeCuteFlower(
      ctx,
      primaryBadge,
      imageMap,
      centerX,
      centerY,
      stickerRadius * 2,
      palette,
      getBadgeDisplayName(primaryBadge),
      options.badges.length
    );
  } else {
    drawStickerHeroBadgeCool(
      ctx,
      primaryBadge,
      imageMap,
      centerX,
      centerY,
      stickerRadius * 2,
      palette,
      getBadgeDisplayName(primaryBadge),
      options.badges.length
    );
  }
};

export const renderExportCanvas = async (options: RenderExportCanvasOptions): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const imageMap = await preloadBadgeImages(options.badges);
  const size = getCanvasSize(options.templateType);
  canvas.width = size.width;
  canvas.height = size.height;
  const styleId = resolveTemplateStyleId(options.templateType, options.templateStyleId);

  if (options.templateType === 'certificate') {
    renderCertificateCanvas(canvas, options, imageMap, styleId as CertificateTemplateStyleId);
  } else {
    renderStickerCanvas(canvas, options, imageMap, styleId as StickerTemplateStyleId);
  }

  return canvas;
};
