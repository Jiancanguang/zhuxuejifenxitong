/**
 * 宠物数据映射
 * petId -> folder 名称，用于构造图片 URL
 */

const PET_MAP = {
  'white-cat': '白猫十阶段图片',
  'bichon': '比熊十阶段图片',
  'border-collie': '边牧十阶段图片',
  'ragdoll': '布偶十阶段图片',
  'shiba': '柴犬十阶段图片',
  'french-bulldog': '法斗十阶段图片',
  'black-cat': '黑猫十阶段图片',
  'tabby': '虎斑十阶段图片',
  'garfield': '加菲猫十阶段图片',
  'golden-shaded': '金渐层十阶段图片',
  'golden-retriever': '金毛十阶段图片',
  'orange-cat': '橘猫十阶段图片',
  'corgi': '柯基十阶段图片',
  'labrador': '拉布拉多十阶段图片',
  'blue-cat': '蓝猫十阶段图片',
  'samoyed': '萨摩耶十阶段图片',
  'calico': '三花十阶段图片',
  'teddy': '泰迪十阶段图片',
  'siamese': '暹罗猫十阶段图片',
  'silver-shaded': '银渐层十阶段图片',
  'rabbit': '小兔子十阶段图片',
  'squirrel': '松鼠十阶段图片',
  'panda': '熊猫十阶段图片',
  'polar-bear': '大白熊十阶段图片',
  'monkey': '猴子十阶段图片',
  'piglet': '小猪仔十阶段图片',
  'duck': '鸭子十阶段图片',
  'lihua-cat': '狸花猫十阶段图片',
  'nine-tailed-fox': '九尾狐十阶段图片',
  'capybara': '卡皮巴拉十阶段图片',
  'schnauzer': '雪瑞纳十阶段图片',
  'lamb': '小羊羔十阶段图片',
  'horse': '马十阶段图片',
  'penguin': '企鹅十阶段图片',
  'tiger': '老虎十阶段图片',
  'leopard': '豹子十阶段图片',
  'westie': '西高地十阶段图片',
  'dinosaur': '恐龙十阶段图片',
  'chick': '小黄鸡十阶段图片',
  'parrot': '鹦鹉十阶段图片',
  'hamster': '仓鼠十阶段图片',
  'sika-deer': '梅花鹿十阶段图片',
  'chinese-rural-dog': '中华田园犬十阶段图片',
  'elephant': '大象十阶段图片',
  'chihuahua': '吉娃娃十阶段图片',
  'frog': '青蛙十阶段图片',
  'turtle': '乌龟十阶段图片',
  'fox': '狐狸十阶段图片',
  'crocodile': '鳄鱼十阶段图片',
  'chameleon': '变色龙十阶段图片',
  // 兼容旧 ID
  'bulldog': '法斗十阶段图片',
};

/**
 * 获取宠物图片 URL
 * @param {string} baseUrl - 服务器地址
 * @param {string} petId - 宠物 ID
 * @param {number} stage - 成长阶段 (1-10)
 * @returns {string} 图片 URL
 */
function getPetImageUrl(baseUrl, petId, stage) {
  const folder = PET_MAP[petId];
  if (!folder) return '';
  const safeStage = Math.max(1, Math.min(10, stage || 1));
  return `${baseUrl}/动物图片/${encodeURIComponent(folder)}/${safeStage}.webp`;
}

module.exports = {
  PET_MAP,
  getPetImageUrl,
};
