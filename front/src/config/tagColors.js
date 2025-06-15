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
  }

  // 获取标签类型
  getTagColorClass(reason) {
    // Element Plus 支持的标签类型：success, warning, danger, info
    const typeMap = {
      概念: 'success',
      业绩: 'warning',
      公告: 'info',
      政策: 'danger',
      其他: 'info',
    };
    return typeMap[reason] || 'info';
  }
}

// 创建单例实例
export const tagColorManager = new TagColorManager();
