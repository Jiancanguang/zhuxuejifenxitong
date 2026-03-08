export const GROUP_COLOR_TOKENS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'brown', 'gray'] as const;

export type GroupColorToken = typeof GROUP_COLOR_TOKENS[number];

export const GROUP_COLOR_STYLES: Record<GroupColorToken, {
  token: GroupColorToken;
  label: string;
  dotClass: string;
  badgeClass: string;
  stripeClass: string;
  borderClass: string;
}> = {
  red: {
    token: 'red',
    label: '红',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    stripeClass: 'bg-red-400',
    borderClass: 'border-red-200',
  },
  orange: {
    token: 'orange',
    label: '橙',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    stripeClass: 'bg-orange-400',
    borderClass: 'border-orange-200',
  },
  yellow: {
    token: 'yellow',
    label: '黄',
    dotClass: 'bg-yellow-500',
    badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    stripeClass: 'bg-yellow-400',
    borderClass: 'border-yellow-200',
  },
  green: {
    token: 'green',
    label: '绿',
    dotClass: 'bg-green-500',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    stripeClass: 'bg-green-400',
    borderClass: 'border-green-200',
  },
  cyan: {
    token: 'cyan',
    label: '青',
    dotClass: 'bg-cyan-500',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    stripeClass: 'bg-cyan-400',
    borderClass: 'border-cyan-200',
  },
  blue: {
    token: 'blue',
    label: '蓝',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    stripeClass: 'bg-blue-400',
    borderClass: 'border-blue-200',
  },
  purple: {
    token: 'purple',
    label: '紫',
    dotClass: 'bg-purple-500',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    stripeClass: 'bg-purple-400',
    borderClass: 'border-purple-200',
  },
  pink: {
    token: 'pink',
    label: '粉',
    dotClass: 'bg-pink-500',
    badgeClass: 'bg-pink-50 text-pink-700 border-pink-200',
    stripeClass: 'bg-pink-400',
    borderClass: 'border-pink-200',
  },
  brown: {
    token: 'brown',
    label: '棕',
    dotClass: 'bg-amber-700',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    stripeClass: 'bg-amber-600',
    borderClass: 'border-amber-200',
  },
  gray: {
    token: 'gray',
    label: '灰',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    stripeClass: 'bg-slate-400',
    borderClass: 'border-slate-200',
  },
};

export const getGroupColorStyle = (token?: string | null) => {
  if (!token) return GROUP_COLOR_STYLES.gray;
  return GROUP_COLOR_STYLES[token as GroupColorToken] || GROUP_COLOR_STYLES.gray;
};

const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

export const getDefaultGroupName = (index: number) => `第${CHINESE_NUMBERS[index] || String(index + 1)}组`;
