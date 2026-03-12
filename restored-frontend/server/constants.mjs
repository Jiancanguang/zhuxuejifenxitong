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
    id: 'snack',
    name: '小零食',
    description: '兑换一份小零食',
    cost: 1,
    icon: 'Cookie',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  {
    id: 'swiss-roll',
    name: '瑞士卷等',
    description: '兑换瑞士卷等糕点',
    cost: 2,
    icon: 'Cake',
    color: 'bg-pink-50 text-pink-600 border-pink-200',
  },
  {
    id: 'juice-milk',
    name: '果汁/牛奶',
    description: '兑换果汁或牛奶一杯',
    cost: 3,
    icon: 'CupSoda',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    id: 'coffee',
    name: '咖啡一杯',
    description: '兑换咖啡一杯',
    cost: 5,
    icon: 'Coffee',
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  },
  {
    id: 'cat-time',
    name: '20分钟撸猫卡',
    description: '撸猫20分钟',
    cost: 20,
    icon: 'Cat',
    color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    id: 'cat-badge',
    name: '猫咪员工吧唧',
    description: '猫咪员工吧唧1个',
    cost: 20,
    icon: 'Medal',
    color: 'bg-sky-50 text-sky-600 border-sky-200',
  },
];

export const DEFAULT_SCORE_ITEMS = [
  // 课中
  { id: 'prepare-1', name: '提前到达准备', icon: 'Clock', score: 1 },
  { id: 'answer-2', name: '主动回答正确', icon: 'Lightbulb', score: 1 },
  { id: 'bestnote-3', name: '课堂笔记最优', icon: 'PenTool', score: 3 },
  // 课后
  { id: 'homework-4', name: '留堂作业达标', icon: 'ClipboardList', score: 1 },
  { id: 'weekhw-5', name: '周中作业认真', icon: 'BookOpen', score: 1 },
  { id: 'extra-6', name: '完成额外加练', icon: 'Dumbbell', score: 2 },
  // 个人突破
  { id: 'breakthrough-7', name: '单点突破', icon: 'Target', score: 3 },
  // 考试
  { id: 'exam-progress-8', name: '排名/等级进步', icon: 'Rocket', score: 10 },
  { id: 'exam-top20-9', name: '进步且进前二十', icon: 'Medal', score: 20 },
  { id: 'exam-top10-10', name: '进步且进前十', icon: 'Trophy', score: 30 },
  { id: 'exam-top5-11', name: '进步且进前五', icon: 'Star', score: 50 },
  { id: 'exam-top1-12', name: '进步且班级第一', icon: 'Crown', score: 100 },
  // 扣分项目
  { id: 'disturb-13', name: '破坏课堂纪律', icon: 'Flame', score: -2 },
  { id: 'late-14', name: '迟到5分钟以上', icon: 'Timer', score: -1 },
  { id: 'badnote-15', name: '笔记潦草不完整', icon: 'FileX', score: -1 },
  { id: 'nohw-16', name: '不交周中作业', icon: 'FileX', score: -3 },
  { id: 'nopractice-17', name: '不完成课后练习', icon: 'Skull', score: -5 },
];

export const LICENSE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
