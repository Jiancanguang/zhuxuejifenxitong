/**
 * 工具函数
 */

/**
 * 格式化时间戳为可读字符串
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' ? timestamp : Date.parse(timestamp));
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 格式化日期（简短）
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' ? timestamp : Date.parse(timestamp));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const ts = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  const diff = now - ts;

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;

  return formatDate(timestamp);
}

/**
 * 根据积分计算成长阶段
 */
function calculateStage(foodCount, thresholds) {
  const food = Math.max(0, Math.floor(foodCount || 0));
  const t = thresholds || [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];
  for (let i = t.length - 1; i >= 0; i--) {
    if (food >= t[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * 获取阶段进度百分比
 */
function getStageProgress(foodCount, stage, thresholds) {
  const t = thresholds || [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];
  if (stage >= t.length) return 100;

  const currentThreshold = t[stage - 1] || 0;
  const nextThreshold = t[stage] || currentThreshold + 1;
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 100;

  const progress = ((foodCount - currentThreshold) / range) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * 获取阶段名称
 */
function getStageName(stage) {
  const names = ['蛋蛋', '幼崽', '小小', '成长', '少年', '青年', '壮年', '成熟', '精英', '传说'];
  return names[Math.min(stage - 1, names.length - 1)] || '蛋蛋';
}

/**
 * 获取记录类型显示文本
 */
function getRecordTypeText(type) {
  const map = {
    checkin: '积分',
    redeem: '兑换',
    graduate: '毕业',
  };
  return map[type] || type;
}

module.exports = {
  formatTime,
  formatDate,
  formatRelativeTime,
  calculateStage,
  getStageProgress,
  getStageName,
  getRecordTypeText,
};
