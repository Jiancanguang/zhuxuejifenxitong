import { PetBreed, RewardItem, ScoreItem } from './types';

export const DEFAULT_SYSTEM_TITLE = '班级宠物园';

// 所有宠物定义，folder 对应动物图片文件夹名称
export const ALL_PETS: PetBreed[] = [
  { id: 'white-cat', name: '白猫', folder: '白猫十阶段图片' },
  { id: 'bichon', name: '比熊', folder: '比熊十阶段图片' },
  { id: 'border-collie', name: '边牧', folder: '边牧十阶段图片' },
  { id: 'ragdoll', name: '布偶', folder: '布偶十阶段图片' },
  { id: 'shiba', name: '柴犬', folder: '柴犬十阶段图片' },
  { id: 'french-bulldog', name: '法斗', folder: '法斗十阶段图片' },
  { id: 'black-cat', name: '黑猫', folder: '黑猫十阶段图片' },
  { id: 'tabby', name: '虎斑', folder: '虎斑十阶段图片' },
  { id: 'garfield', name: '加菲猫', folder: '加菲猫十阶段图片' },
  { id: 'golden-shaded', name: '金渐层', folder: '金渐层十阶段图片' },
  { id: 'golden-retriever', name: '金毛', folder: '金毛十阶段图片' },
  { id: 'orange-cat', name: '橘猫', folder: '橘猫十阶段图片' },
  { id: 'corgi', name: '柯基', folder: '柯基十阶段图片' },
  { id: 'labrador', name: '拉布拉多', folder: '拉布拉多十阶段图片' },
  { id: 'blue-cat', name: '蓝猫', folder: '蓝猫十阶段图片' },
  { id: 'samoyed', name: '萨摩耶', folder: '萨摩耶十阶段图片' },
  { id: 'calico', name: '三花', folder: '三花十阶段图片' },
  { id: 'teddy', name: '泰迪', folder: '泰迪十阶段图片' },
  { id: 'siamese', name: '暹罗猫', folder: '暹罗猫十阶段图片' },
  { id: 'silver-shaded', name: '银渐层', folder: '银渐层十阶段图片' },
  { id: 'rabbit', name: '小兔子', folder: '小兔子十阶段图片' },
  { id: 'squirrel', name: '松鼠', folder: '松鼠十阶段图片' },
  { id: 'panda', name: '熊猫', folder: '熊猫十阶段图片' },
  { id: 'polar-bear', name: '大白熊', folder: '大白熊十阶段图片' },
  { id: 'monkey', name: '猴子', folder: '猴子十阶段图片' },
  { id: 'piglet', name: '小猪仔', folder: '小猪仔十阶段图片' },
  { id: 'duck', name: '鸭子', folder: '鸭子十阶段图片' },
  { id: 'lihua-cat', name: '狸花猫', folder: '狸花猫十阶段图片' },
  { id: 'nine-tailed-fox', name: '九尾狐', folder: '九尾狐十阶段图片' },
  { id: 'capybara', name: '卡皮巴拉', folder: '卡皮巴拉十阶段图片' },
  { id: 'schnauzer', name: '雪瑞纳', folder: '雪瑞纳十阶段图片' },
  { id: 'lamb', name: '小羊羔', folder: '小羊羔十阶段图片' },
  { id: 'horse', name: '马', folder: '马十阶段图片' },
  { id: 'penguin', name: '企鹅', folder: '企鹅十阶段图片' },
  { id: 'tiger', name: '老虎', folder: '老虎十阶段图片' },
  { id: 'leopard', name: '豹子', folder: '豹子十阶段图片' },
  { id: 'westie', name: '西高地', folder: '西高地十阶段图片' },
  { id: 'dinosaur', name: '恐龙', folder: '恐龙十阶段图片' },
  { id: 'chick', name: '小黄鸡', folder: '小黄鸡十阶段图片' },
  { id: 'parrot', name: '鹦鹉', folder: '鹦鹉十阶段图片' },
  { id: 'hamster', name: '仓鼠', folder: '仓鼠十阶段图片' },
  { id: 'sika-deer', name: '梅花鹿', folder: '梅花鹿十阶段图片' },
  { id: 'chinese-rural-dog', name: '中华田园犬', folder: '中华田园犬十阶段图片' },
  { id: 'elephant', name: '大象', folder: '大象十阶段图片' },
  { id: 'chihuahua', name: '吉娃娃', folder: '吉娃娃十阶段图片' },
  { id: 'frog', name: '青蛙', folder: '青蛙十阶段图片' },
  { id: 'turtle', name: '乌龟', folder: '乌龟十阶段图片' },
  { id: 'fox', name: '狐狸', folder: '狐狸十阶段图片' },
  { id: 'crocodile', name: '鳄鱼', folder: '鳄鱼十阶段图片' },
  { id: 'chameleon', name: '变色龙', folder: '变色龙十阶段图片' },
];

// 兼容旧宠物ID（历史数据）
const PET_ID_ALIASES: Record<string, string> = {
  bulldog: 'french-bulldog',
};

// 统一旧ID到新ID
export const resolvePetId = (petId: string): string => {
  return PET_ID_ALIASES[petId] || petId;
};

// 根据 petId 获取宠物信息（兼容旧ID）
export const getPetById = (petId?: string): PetBreed | undefined => {
  if (!petId) return undefined;
  const resolvedId = resolvePetId(petId);
  return ALL_PETS.find(p => p.id === resolvedId);
};

const getPetAssetBaseUrl = (): string => {
  const configuredBaseUrl = (import.meta.env.VITE_PET_ASSET_BASE_URL || '').trim();
  return configuredBaseUrl.replace(/\/+$/, '');
};

// 获取宠物图片路径的辅助函数
export const getPetImagePath = (petId: string, stage: number): string => {
  const pet = getPetById(petId) || ALL_PETS[0];
  if (!pet) return '';
  // stage 范围 1-10
  const safeStage = Math.max(1, Math.min(10, stage));
  const baseUrl = getPetAssetBaseUrl();
  const relativePath = `/动物图片/${pet.folder}/${safeStage}.webp`;
  return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

// 默认的阶段食物阈值配置（10个阶段）
// 阶段1从0开始，阶段2需要累计5份食物，阶段10需要累计100份食物
export const DEFAULT_STAGE_THRESHOLDS = [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];

// 根据累计食物数量计算当前阶段（1-10）
export const calculateStageFromFood = (food: number, thresholds: number[]): number => {
  // thresholds 应该是10个递增的数字
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (food >= thresholds[i]) {
      return i + 1; // 阶段从1开始
    }
  }
  return 1;
};

// 检查是否可以毕业（达到阶段10）
export const canGraduate = (food: number, thresholds: number[]): boolean => {
  return food >= thresholds[9]; // 达到第10阶段的阈值
};

// 主题配置 - 全局主题系统
export const THEMES = [
  {
    id: 'pink',
    name: '粉红',
    colors: {
      // 卡片颜色
      accent: 'bg-pink-400',
      light: 'bg-pink-50',
      text: 'text-pink-700',
      border: 'border-pink-200',
      shadow: 'shadow-pink-200',
      // 全局颜色
      pageBg: 'bg-gradient-to-br from-pink-50 via-white to-rose-50',
      headerBg: 'bg-pink-500/90',
      headerShadow: 'shadow-pink-300/50',
      logoBg: 'bg-gradient-to-tr from-pink-400 to-rose-400',
      inputFocus: 'focus:border-pink-300 focus:ring-pink-100',
      inputText: 'text-pink-700',
      buttonHover: 'hover:bg-pink-50',
      accentText: 'text-pink-500',
      leaderboardHeader: 'bg-gradient-to-r from-pink-400 to-rose-500',
    }
  },
  {
    id: 'purple',
    name: '紫色',
    colors: {
      accent: 'bg-purple-400',
      light: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      shadow: 'shadow-purple-200',
      pageBg: 'bg-gradient-to-br from-purple-50 via-white to-violet-50',
      headerBg: 'bg-purple-500/90',
      headerShadow: 'shadow-purple-300/50',
      logoBg: 'bg-gradient-to-tr from-purple-400 to-violet-400',
      inputFocus: 'focus:border-purple-300 focus:ring-purple-100',
      inputText: 'text-purple-700',
      buttonHover: 'hover:bg-purple-50',
      accentText: 'text-purple-500',
      leaderboardHeader: 'bg-gradient-to-r from-purple-400 to-violet-500',
    }
  },
  {
    id: 'indigo',
    name: '靛蓝',
    colors: {
      accent: 'bg-indigo-400',
      light: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      shadow: 'shadow-indigo-200',
      pageBg: 'bg-gradient-to-br from-indigo-50 via-white to-blue-50',
      headerBg: 'bg-indigo-500/90',
      headerShadow: 'shadow-indigo-300/50',
      logoBg: 'bg-gradient-to-tr from-indigo-400 to-purple-400',
      inputFocus: 'focus:border-indigo-300 focus:ring-indigo-100',
      inputText: 'text-indigo-700',
      buttonHover: 'hover:bg-indigo-50',
      accentText: 'text-indigo-500',
      leaderboardHeader: 'bg-gradient-to-r from-indigo-400 to-purple-500',
    }
  },
  {
    id: 'blue',
    name: '天蓝',
    colors: {
      accent: 'bg-blue-400',
      light: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      shadow: 'shadow-blue-200',
      pageBg: 'bg-gradient-to-br from-blue-50 via-white to-sky-50',
      headerBg: 'bg-blue-500/90',
      headerShadow: 'shadow-blue-300/50',
      logoBg: 'bg-gradient-to-tr from-blue-400 to-sky-400',
      inputFocus: 'focus:border-blue-300 focus:ring-blue-100',
      inputText: 'text-blue-700',
      buttonHover: 'hover:bg-blue-50',
      accentText: 'text-blue-500',
      leaderboardHeader: 'bg-gradient-to-r from-blue-400 to-sky-500',
    }
  },
  {
    id: 'cyan',
    name: '青色',
    colors: {
      accent: 'bg-cyan-400',
      light: 'bg-cyan-50',
      text: 'text-cyan-700',
      border: 'border-cyan-200',
      shadow: 'shadow-cyan-200',
      pageBg: 'bg-gradient-to-br from-cyan-50 via-white to-teal-50',
      headerBg: 'bg-cyan-500/90',
      headerShadow: 'shadow-cyan-300/50',
      logoBg: 'bg-gradient-to-tr from-cyan-400 to-teal-400',
      inputFocus: 'focus:border-cyan-300 focus:ring-cyan-100',
      inputText: 'text-cyan-700',
      buttonHover: 'hover:bg-cyan-50',
      accentText: 'text-cyan-500',
      leaderboardHeader: 'bg-gradient-to-r from-cyan-400 to-teal-500',
    }
  },
  {
    id: 'teal',
    name: '蓝绿',
    colors: {
      accent: 'bg-teal-400',
      light: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      shadow: 'shadow-teal-200',
      pageBg: 'bg-gradient-to-br from-teal-50 via-white to-emerald-50',
      headerBg: 'bg-teal-500/90',
      headerShadow: 'shadow-teal-300/50',
      logoBg: 'bg-gradient-to-tr from-teal-400 to-emerald-400',
      inputFocus: 'focus:border-teal-300 focus:ring-teal-100',
      inputText: 'text-teal-700',
      buttonHover: 'hover:bg-teal-50',
      accentText: 'text-teal-500',
      leaderboardHeader: 'bg-gradient-to-r from-teal-400 to-emerald-500',
    }
  },
  {
    id: 'green',
    name: '绿色',
    colors: {
      accent: 'bg-green-400',
      light: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      shadow: 'shadow-green-200',
      pageBg: 'bg-gradient-to-br from-green-50 via-white to-emerald-50',
      headerBg: 'bg-green-500/90',
      headerShadow: 'shadow-green-300/50',
      logoBg: 'bg-gradient-to-tr from-green-400 to-emerald-400',
      inputFocus: 'focus:border-green-300 focus:ring-green-100',
      inputText: 'text-green-700',
      buttonHover: 'hover:bg-green-50',
      accentText: 'text-green-500',
      leaderboardHeader: 'bg-gradient-to-r from-green-400 to-emerald-500',
    }
  },
  {
    id: 'yellow',
    name: '黄色',
    colors: {
      accent: 'bg-yellow-400',
      light: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      shadow: 'shadow-yellow-200',
      pageBg: 'bg-gradient-to-br from-yellow-50 via-white to-amber-50',
      headerBg: 'bg-yellow-500/90',
      headerShadow: 'shadow-yellow-300/50',
      logoBg: 'bg-gradient-to-tr from-yellow-400 to-amber-400',
      inputFocus: 'focus:border-yellow-300 focus:ring-yellow-100',
      inputText: 'text-yellow-700',
      buttonHover: 'hover:bg-yellow-50',
      accentText: 'text-yellow-500',
      leaderboardHeader: 'bg-gradient-to-r from-yellow-400 to-amber-500',
    }
  },
  {
    id: 'orange',
    name: '橙色',
    colors: {
      accent: 'bg-orange-400',
      light: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      shadow: 'shadow-orange-200',
      pageBg: 'bg-gradient-to-br from-orange-50 via-white to-amber-50',
      headerBg: 'bg-orange-500/90',
      headerShadow: 'shadow-orange-300/50',
      logoBg: 'bg-gradient-to-tr from-orange-400 to-amber-400',
      inputFocus: 'focus:border-orange-300 focus:ring-orange-100',
      inputText: 'text-orange-700',
      buttonHover: 'hover:bg-orange-50',
      accentText: 'text-orange-500',
      leaderboardHeader: 'bg-gradient-to-r from-orange-400 to-amber-500',
    }
  },
  {
    id: 'red',
    name: '红色',
    colors: {
      accent: 'bg-red-400',
      light: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      shadow: 'shadow-red-200',
      pageBg: 'bg-gradient-to-br from-red-50 via-white to-rose-50',
      headerBg: 'bg-red-500/90',
      headerShadow: 'shadow-red-300/50',
      logoBg: 'bg-gradient-to-tr from-red-400 to-rose-400',
      inputFocus: 'focus:border-red-300 focus:ring-red-100',
      inputText: 'text-red-700',
      buttonHover: 'hover:bg-red-50',
      accentText: 'text-red-500',
      leaderboardHeader: 'bg-gradient-to-r from-red-400 to-rose-500',
    }
  },
];

// 默认奖励商品
export const REWARDS: RewardItem[] = [
  {
    id: 'homework-pass',
    name: '免作业卡',
    description: '可免一次作业',
    cost: 3,
    icon: 'FileSignature',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  {
    id: 'front-seat',
    name: '前排座位券',
    description: '选择喜欢的座位一周',
    cost: 2,
    icon: 'Armchair',
    color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    id: 'snack-ticket',
    name: '小零食券',
    description: '兑换一份小零食',
    cost: 1,
    icon: 'Cookie',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  {
    id: 'sticker',
    name: '贴纸奖励',
    description: '获得精美贴纸一张',
    cost: 1,
    icon: 'Sparkles',
    color: 'bg-pink-50 text-pink-600 border-pink-200',
  },
  {
    id: 'movie-time',
    name: '电影时间',
    description: '课间观看小动画',
    cost: 5,
    icon: 'Film',
    color: 'bg-sky-50 text-sky-600 border-sky-200',
  },
  {
    id: 'team-leader',
    name: '小组长体验',
    description: '当一天小组长',
    cost: 4,
    icon: 'Crown',
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  },
];

// 默认加分项目（10个常用项目）- 使用 Lucide 图标名称
export const DEFAULT_SCORE_ITEMS: ScoreItem[] = [
  { id: 'checkin-1', name: '早读打卡', icon: 'BookOpen', score: 1 },
  { id: 'speak-2', name: '答对问题', icon: 'Lightbulb', score: 2 },
  { id: 'homework-3', name: '作业优秀', icon: 'PenTool', score: 3 },
  { id: 'recite-4', name: '完成背诵', icon: 'Mic', score: 2 },
  { id: 'handup-5', name: '积极举手', icon: 'Hand', score: 1 },
  { id: 'help-6', name: '帮助同学', icon: 'Heart', score: 2 },
  { id: 'duty-7', name: '值日认真', icon: 'Sparkles', score: 2 },
  { id: 'read-8', name: '课外阅读', icon: 'Book', score: 1 },
  { id: 'progress-9', name: '进步明显', icon: 'Rocket', score: 3 },
  { id: 'art-10', name: '才艺展示', icon: 'Palette', score: 3 },
  // 扣分项目（分值为负数）
  { id: 'late-11', name: '迟到', icon: 'Clock', score: -1 },
  { id: 'phone-12', name: '玩手机', icon: 'Smartphone', score: -2 },
  { id: 'sleep-13', name: '打瞌睡', icon: 'Moon', score: -1 },
  { id: 'nohomework-14', name: '未交作业', icon: 'FileX', score: -2 },
];
