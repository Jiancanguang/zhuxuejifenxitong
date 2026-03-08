export const DEFAULT_SYSTEM_TITLE = '班级宠物园';
export const DEFAULT_THEME_ID = 'pink';
export const DEFAULT_RESET_PASSWORD = '123456';

export const GROUP_COLOR_TOKENS = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
  'brown',
  'gray',
];

export const DEFAULT_STAGE_THRESHOLDS = [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];

export const DEFAULT_REWARDS = [
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

export const DEFAULT_SCORE_ITEMS = [
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
  { id: 'late-11', name: '迟到', icon: 'Clock', score: -1 },
  { id: 'phone-12', name: '玩手机', icon: 'Smartphone', score: -2 },
  { id: 'sleep-13', name: '打瞌睡', icon: 'Moon', score: -1 },
  { id: 'nohomework-14', name: '未交作业', icon: 'FileX', score: -2 },
];

export const LICENSE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
