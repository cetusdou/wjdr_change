/**
 * 拼图配置 - 从 puzzle.json 加载
 * 12大类 × 9小类 × [9/12/15/18]个碎片
 * 每个小类独立编号（从1开始）
 */

// 拼图数据结构（将在初始化时从 puzzle.json 加载）
let PUZZLE_DATA = null;

// 生成唯一拼图ID
// 格式: "大类ID-小类索引-碎片编号" 例如: "1-1-3" 表示 大类1的第1个小类的第3个碎片
function generatePuzzleId(categoryId, puzzleIndex, pieceNumber) {
  return `${categoryId}-${puzzleIndex}-${pieceNumber}`;
}

// 解析拼图ID
function parsePuzzleId(puzzleId) {
  const parts = puzzleId.split('-');
  return {
    categoryId: parseInt(parts[0]),
    puzzleIndex: parseInt(parts[1]),
    pieceNumber: parseInt(parts[2])
  };
}

// 获取拼图信息
function getPuzzleInfo(puzzleId) {
  if (!PUZZLE_DATA) return null;
  
  const parsed = parsePuzzleId(puzzleId);
  const category = PUZZLE_DATA.categories.find(c => c.id === parsed.categoryId);
  if (!category) return null;
  
  const puzzle = category.puzzles[parsed.puzzleIndex - 1];
  if (!puzzle) return null;
  
  return {
    id: puzzleId,
    categoryId: parsed.categoryId,
    categoryName: category.name,
    puzzleIndex: parsed.puzzleIndex,
    puzzleName: puzzle.name,
    pieceNumber: parsed.pieceNumber,
    totalPieces: puzzle.pieces,
    displayName: `${category.name}-${puzzle.name}-${parsed.pieceNumber}`
  };
}

// 计算总拼图数
function getTotalPuzzleCount() {
  if (!PUZZLE_DATA) return 0;
  
  let total = 0;
  for (const cat of PUZZLE_DATA.categories) {
    for (const puzzle of cat.puzzles) {
      total += puzzle.pieces;
    }
  }
  return total;
}

// 获取所有拼图列表
function getAllPuzzles() {
  if (!PUZZLE_DATA) return [];
  
  const puzzles = [];
  for (const cat of PUZZLE_DATA.categories) {
    for (let pi = 0; pi < cat.puzzles.length; pi++) {
      const puzzle = cat.puzzles[pi];
      for (let piece = 1; piece <= puzzle.pieces; piece++) {
        const id = generatePuzzleId(cat.id, pi + 1, piece);
        puzzles.push({
          id: id,
          categoryId: cat.id,
          categoryName: cat.name,
          puzzleIndex: pi + 1,
          puzzleName: puzzle.name,
          pieceNumber: piece,
          totalPieces: puzzle.pieces
        });
      }
    }
  }
  return puzzles;
}

// 获取某小类的所有拼图
function getPuzzlesBySubcategory(categoryId, puzzleIndex) {
  if (!PUZZLE_DATA) return [];
  
  const category = PUZZLE_DATA.categories.find(c => c.id === categoryId);
  if (!category) return [];
  
  const puzzle = category.puzzles[puzzleIndex - 1];
  if (!puzzle) return [];
  
  const puzzles = [];
  for (let piece = 1; piece <= puzzle.pieces; piece++) {
    puzzles.push({
      id: generatePuzzleId(categoryId, puzzleIndex, piece),
      categoryId: categoryId,
      categoryName: category.name,
      puzzleIndex: puzzleIndex,
      puzzleName: puzzle.name,
      pieceNumber: piece,
      totalPieces: puzzle.pieces
    });
  }
  return puzzles;
}

// 从 puzzle.json 加载配置
async function loadPuzzleConfig() {
  try {
    const response = await fetch('puzzle.json');
    if (!response.ok) {
      throw new Error('无法加载 puzzle.json');
    }
    PUZZLE_DATA = await response.json();
    
    // 更新 CONFIG
    CONFIG.CATEGORIES = PUZZLE_DATA.categories;
    
    console.log(`拼图配置加载完成：${PUZZLE_DATA.categories.length}大类 × 9小类 = ${getTotalPuzzleCount()}个碎片`);
    
    return true;
  } catch (e) {
    console.error('加载拼图配置失败:', e);
    return false;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    PUZZLE_DATA, 
    generatePuzzleId, 
    parsePuzzleId, 
    getPuzzleInfo, 
    getTotalPuzzleCount,
    getAllPuzzles,
    getPuzzlesBySubcategory,
    loadPuzzleConfig 
  };
}
