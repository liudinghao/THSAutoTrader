// 基础颜色配置
export const baseColors = [
  { h: 0, s: 100, l: 50 }, // 红色
  { h: 120, s: 100, l: 50 }, // 绿色
  { h: 240, s: 100, l: 50 }, // 蓝色
  { h: 60, s: 100, l: 50 }, // 黄色
  { h: 300, s: 100, l: 50 }, // 紫色
  { h: 30, s: 100, l: 50 }, // 橙色
  { h: 180, s: 100, l: 50 }, // 青色
  { h: 330, s: 100, l: 50 }, // 粉色
  { h: 270, s: 100, l: 50 }, // 靛蓝
  { h: 150, s: 100, l: 50 }, // 深绿
];

// 标签颜色管理类
export class TagColorManager {
  constructor() {
    this.colorMap = new Map();
    this.usedColors = new Set();
    this.colorTypes = ['success', 'warning', 'danger', 'info', 'primary'];
    this.colorIndex = 0;
  }

  // 获取标签类型
  getTagColorClass(reason) {
    // 如果已经分配过颜色，直接返回
    if (this.colorMap.has(reason)) {
      return this.colorMap.get(reason);
    }

    // 优先使用预定义的类型映射
    const typeMap = {
      // 概念相关
      概念: 'success',
      题材: 'success',
      热点: 'success',

      // 业绩相关
      业绩: 'warning',
      预增: 'warning',
      扭亏: 'warning',
      超预期: 'warning',

      // 政策相关
      政策: 'danger',
      利好: 'danger',
      支持: 'danger',

      // 公告相关
      公告: 'info',
      披露: 'info',
      回复: 'info',

      // 其他类型
      重组: 'primary',
      收购: 'primary',
      合作: 'primary',
      投资: 'primary',
      研发: 'primary',
      技术: 'primary',
    };

    // 先尝试精确匹配
    if (typeMap[reason]) {
      this.colorMap.set(reason, typeMap[reason]);
      return typeMap[reason];
    }

    // 再尝试模糊匹配
    for (const [key, value] of Object.entries(typeMap)) {
      if (reason.includes(key)) {
        this.colorMap.set(reason, value);
        return value;
      }
    }

    // 如果没有预定义映射，分配一个循环颜色
    const colorType = this.colorTypes[this.colorIndex % this.colorTypes.length];
    this.colorMap.set(reason, colorType);
    this.colorIndex++;

    return colorType;
  }

  // 清除颜色映射（可选，用于重置）
  clearColorMap() {
    this.colorMap.clear();
    this.colorIndex = 0;
  }
}

// 创建单例实例
export const tagColorManager = new TagColorManager();
