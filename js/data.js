/**
 * 数据结构定义模块
 * 定义用户数据结构和常量配置
 */

// ==============================================
// 常量配置
// ==============================================
const CONFIG = {
  DAILY_SEND_LIMIT: 5,    // 每日送出上限（仅用于匹配计算）
  DAILY_RECV_LIMIT: 3,    // 每日收到上限（仅用于匹配计算）
  CATEGORIES: [],         // 将在初始化时填充
  
  // 计算总拼图数
  get TOTAL_PUZZLE() {
    if (typeof getTotalPuzzleCount === 'function') {
      return getTotalPuzzleCount();
    }
    return 0;
  },
  
  // 获取拼图信息
  getPuzzleInfo: function(id) {
    if (typeof getPuzzleInfo === 'function') {
      return getPuzzleInfo(id);
    }
    return null;
  }
};

// ==============================================
// 用户数据类
// ==============================================
class UserData {
  constructor(name = "") {
    this.name = name;
    this.have = {};        // { puzzleId: count } - 拥有的拼图及数量
    this.want = [];        // [ puzzleId ] - 缺少的拼图列表
    this.dailyLimit = {    // 每日限额记录
      date: getToday(),
      sent: 0,
      received: 0
    };
    this.updateTime = new Date().toISOString();
  }

  // 静态方法：从普通对象创建 UserData 实例
  static fromObject(obj) {
    const user = new UserData(obj.name);
    user.have = obj.have || {};
    user.want = obj.want || [];
    user.dailyLimit = obj.dailyLimit || { date: getToday(), sent: 0, received: 0 };
    user.updateTime = obj.updateTime || new Date().toISOString();
    return user;
  }

  // 序列化为普通对象（用于保存到数据库）
  toObject() {
    return {
      name: this.name,
      have: this.have,
      want: this.want,
      dailyLimit: this.dailyLimit,
      updateTime: new Date().toISOString()
    };
  }

  // 检查并刷新每日限额
  refreshDailyLimit() {
    const today = getToday();
    if (this.dailyLimit.date !== today) {
      this.dailyLimit = { date: today, sent: 0, received: 0 };
      return true; // 已重置
    }
    return false; // 未重置
  }

  // 获取今日剩余送出限额
  getRemainingSend() {
    this.refreshDailyLimit();
    return CONFIG.DAILY_SEND_LIMIT - this.dailyLimit.sent;
  }

  // 获取今日剩余收到限额
  getRemainingRecv() {
    this.refreshDailyLimit();
    return CONFIG.DAILY_RECV_LIMIT - this.dailyLimit.received;
  }

  // 获取多余拼图列表（数量>1的）
  getExtraPuzzles() {
    return Object.entries(this.have)
      .filter(([_, count]) => count > 1)
      .map(([id, count]) => ({ id: id, count }));
  }

  // 获取拥有的拼图列表（数量>0的）
  getOwnedPuzzles() {
    return Object.entries(this.have)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ id: id, count }));
  }

  // 增加拼图数量（收到拼图时使用）
  addPuzzle(puzzleId) {
    this.have[puzzleId] = (this.have[puzzleId] || 0) + 1;
    
    // 如果从want列表中收到了，移除它
    const wantIdx = this.want.indexOf(puzzleId);
    if (wantIdx !== -1) {
      this.want.splice(wantIdx, 1);
    }
    
    this.updateTime = new Date().toISOString();
    return this.have[puzzleId];
  }

  // 减少拼图数量（送出拼图时使用）
  removePuzzle(puzzleId) {
    const current = this.have[puzzleId] || 0;
    
    if (current <= 0) {
      return { success: false, error: `没有该拼图` };
    }
    
    this.have[puzzleId] = current - 1;
    if (this.have[puzzleId] === 0) {
      delete this.have[puzzleId];
    }
    
    this.updateTime = new Date().toISOString();
    return { success: true, newCount: this.have[puzzleId] || 0 };
  }

  // 标记缺少的拼图
  addWant(puzzleId) {
    if (!this.want.includes(puzzleId)) {
      this.want.push(puzzleId);
      this.updateTime = new Date().toISOString();
    }
  }

  // 移除缺少标记
  removeWant(puzzleId) {
    const idx = this.want.indexOf(puzzleId);
    if (idx !== -1) {
      this.want.splice(idx, 1);
      this.updateTime = new Date().toISOString();
    }
  }

  // 记录送出（增加限额计数）
  recordSent(count = 1) {
    this.refreshDailyLimit();
    this.dailyLimit.sent += count;
    this.updateTime = new Date().toISOString();
    return this.getRemainingSend();
  }

  // 记录收到（增加限额计数）
  recordReceived(count = 1) {
    this.refreshDailyLimit();
    this.dailyLimit.received += count;
    this.updateTime = new Date().toISOString();
    return this.getRemainingRecv();
  }
}

// ==============================================
// 匹配结果类
// ==============================================
class MatchResult {
  constructor(userA, userB) {
    this.userA = userA;     // 用户A名称
    this.userB = userB;     // 用户B名称
    this.aGive = [];        // A给B的拼图ID列表
    this.aGet = [];         // A从B得到的拼图ID列表
    this.exchangeCount = 0; // 交换数量
    this.aRemaining = { send: 0, recv: 0 };
    this.bRemaining = { send: 0, recv: 0 };
  }

  // 从两个用户数据计算匹配
  static calculate(userA, userB) {
    const match = new MatchResult(userA.name, userB.name);
    
    // 刷新限额
    userA.refreshDailyLimit();
    userB.refreshDailyLimit();
    
    // 剩余限额
    match.aRemaining = {
      send: CONFIG.DAILY_SEND_LIMIT - userA.dailyLimit.sent,
      recv: CONFIG.DAILY_RECV_LIMIT - userA.dailyLimit.received
    };
    match.bRemaining = {
      send: CONFIG.DAILY_SEND_LIMIT - userB.dailyLimit.sent,
      recv: CONFIG.DAILY_RECV_LIMIT - userB.dailyLimit.received
    };
    
    // A可以给B的：A有>1张 且 B缺的
    // 每种拼图可以给对方 (count - 1) 张（自己留1张）
    for (const { id, count } of userA.getExtraPuzzles()) {
      if (userB.want.includes(id)) {
        // 可以给对方 (count - 1) 张
        for (let i = 0; i < count - 1; i++) {
          match.aGive.push(id);
        }
      }
    }
    
    // B可以给A的：B有>1张 且 A缺的
    for (const { id, count } of userB.getExtraPuzzles()) {
      if (userA.want.includes(id)) {
        // 可以给对方 (count - 1) 张
        for (let i = 0; i < count - 1; i++) {
          match.aGet.push(id);
        }
      }
    }
    
    // 计算最大可交换数量
    const maxByPuzzle = Math.min(match.aGive.length, match.aGet.length);
    const maxByALimit = Math.min(match.aRemaining.send, match.aRemaining.recv);
    const maxByBLimit = Math.min(match.bRemaining.send, match.bRemaining.recv);
    match.exchangeCount = Math.min(maxByPuzzle, maxByALimit, maxByBLimit);
    
    // 限制交换数量
    match.aGive = match.aGive.slice(0, match.exchangeCount);
    match.aGet = match.aGet.slice(0, match.exchangeCount);
    
    return match;
  }

  // 是否有效匹配
  isValid() {
    return this.exchangeCount > 0;
  }

  // 获取以指定用户为视角的匹配信息
  getPerspective(userName) {
    const isUserA = this.userA === userName;
    return {
      partner: isUserA ? this.userB : this.userA,
      iGive: isUserA ? this.aGive : this.aGet,
      iGet: isUserA ? this.aGet : this.aGive,
      exchangeCount: this.exchangeCount,
      myRemaining: isUserA ? this.aRemaining : this.bRemaining,
      partnerRemaining: isUserA ? this.bRemaining : this.aRemaining
    };
  }
}

// ==============================================
// 工具函数
// ==============================================
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, UserData, MatchResult, getToday };
}
