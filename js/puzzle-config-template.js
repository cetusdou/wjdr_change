/**
 * 拼图配置模板
 * 
 * 复制此文件为 puzzle-config.js 并填入实际数据
 * 结构：12大类 × 9子类 × [12/15/18]个拼图
 */

// 子类数量类型
const SUBCATEGORY_COUNTS = {
  SMALL: 12,   // 小类：12个拼图
  MEDIUM: 15,  // 中类：15个拼图
  LARGE: 18    // 大类：18个拼图
};

// 拼图类别配置
const PUZZLE_CATEGORIES = [
  {
    id: 1,
    name: "大类1名称",  // 例如："城市风光"
    subcategories: [
      { id: 1, name: "子类1-1", count: SUBCATEGORY_COUNTS.SMALL },   // 12个
      { id: 2, name: "子类1-2", count: SUBCATEGORY_COUNTS.SMALL },   // 12个
      { id: 3, name: "子类1-3", count: SUBCATEGORY_COUNTS.MEDIUM },  // 15个
      { id: 4, name: "子类1-4", count: SUBCATEGORY_COUNTS.MEDIUM },  // 15个
      { id: 5, name: "子类1-5", count: SUBCATEGORY_COUNTS.LARGE },   // 18个
      { id: 6, name: "子类1-6", count: SUBCATEGORY_COUNTS.LARGE },   // 18个
      { id: 7, name: "子类1-7", count: SUBCATEGORY_COUNTS.SMALL },   // 12个
      { id: 8, name: "子类1-8", count: SUBCATEGORY_COUNTS.MEDIUM },  // 15个
      { id: 9, name: "子类1-9", count: SUBCATEGORY_COUNTS.LARGE },   // 18个
    ]
  },
  // ... 继续添加其他11个大类
  // 大类2-12
];

// 初始化配置
function initPuzzleConfig() {
  CONFIG.CATEGORIES = PUZZLE_CATEGORIES;
  console.log(`拼图配置加载完成，共 ${CONFIG.TOTAL_PUZZLE} 个拼图`);
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PUZZLE_CATEGORIES, SUBCATEGORY_COUNTS, initPuzzleConfig };
}
